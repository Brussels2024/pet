import { NextResponse } from 'next/server';
import { query, getSetting } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import { brl } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAYMENTS = ['pix', 'boleto', 'cartao'];

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return fail('Entre na sua conta para finalizar o pedido.', 401);
  if (!canSeePrices(user)) return fail('Sua conta ainda não foi aprovada para compras.', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('Dados inválidos.');
  }

  const payment = String(body.payment || '');
  if (!PAYMENTS.includes(payment)) return fail('Escolha a forma de pagamento.');

  const wanted = Array.isArray(body.items) ? body.items : [];
  const qtyById = new Map();
  for (const item of wanted) {
    const id = Number(item.id);
    const qty = Math.floor(Number(item.qty));
    if (Array.isArray(item.variants) && item.variants.length) {
      for (const variant of item.variants) {
        const variantQty = Math.floor(Number(variant.qty));
        const color = String(variant.color || '').trim();
        if (!id || !color || variantQty <= 0) return fail('Confira a cor e a quantidade dos produtos.');
        const nextQty = (qtyById.get(id) || 0) + variantQty;
        qtyById.set(id, nextQty);
      }
    } else if (id && qty > 0) qtyById.set(id, (qtyById.get(id) || 0) + qty);
  }
  if (qtyById.size === 0) return fail('Seu carrinho está vazio.');

  const ids = [...qtyById.keys()];
  const products = await query(
    'SELECT id, name, price, stock, active, min_quantity, colors FROM products WHERE id = ANY($1::int[])',
    [ids]
  );

  let total = 0;
  const lines = [];
  for (const id of ids) {
    const p = products.find((row) => row.id === id);
    const qty = qtyById.get(id);
    if (!p || !p.active) return fail('Um dos produtos do carrinho não está mais disponível.');
    if (qty > p.stock) return fail(`Estoque insuficiente para "${p.name}" (disponível: ${p.stock}).`);
    const minimum = Math.max(1, Number(p.min_quantity) || 1);
    if (qty < minimum) return fail(`A quantidade mínima de "${p.name}" é de ${minimum} unidades.`);
    const price = Number(p.price); // sempre o preço do banco, nunca o do navegador
    total += price * qty;
    const requestedItem = wanted.find((item) => Number(item.id) === id);
    const registeredColors = Array.isArray(p.colors) ? p.colors : [];
    if (registeredColors.length && (!Array.isArray(requestedItem?.variants) || !requestedItem.variants.length)) {
      return fail(`Selecione as cores cadastradas para "${p.name}".`);
    }
    if (Array.isArray(requestedItem?.variants) && requestedItem.variants.length) {
      const colors = Array.isArray(p.colors) ? p.colors : [];
      for (const variant of requestedItem.variants) {
        const color = String(variant.color || '').trim();
        const matched = colors.find((entry) => (typeof entry === 'string' ? entry : String(entry?.name || entry?.color || entry?.cor || '').trim()) === color);
        if (!matched) return fail(`Escolha uma cor cadastrada para "${p.name}".`);
        const qtyForColor = Math.floor(Number(variant.qty));
        if (qtyForColor <= 0) return fail('Quantidade de cor inválida.');
        lines.push({ id, name: p.name + ' — Cor: ' + color, price, qty: qtyForColor });
      }
    } else {
      lines.push({ id, name: p.name, price, qty });
    }
  }

  const minOrder = Number(await getSetting('min_order', '0')) || 0;
  if (total < minOrder) {
    return fail(`O pedido mínimo é de ${brl(minOrder)}. Seu carrinho está em ${brl(total)}.`, 422);
  }

  const orderRows = await query(
    `INSERT INTO orders (user_id, status, payment_method, total, shipping, notes)
     VALUES ($1, 'novo', $2, $3, 0, $4) RETURNING id`,
    [user.id, payment, total.toFixed(2), String(body.notes || '').slice(0, 500)]
  );
  const orderId = orderRows[0].id;

  for (const line of lines) {
    await query(
      'INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES ($1, $2, $3, $4, $5)',
      [orderId, line.id, line.name, line.price.toFixed(2), line.qty]
    );
    await query('UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2', [line.qty, line.id]);
  }

  return NextResponse.json({ ok: true, orderId });
}
