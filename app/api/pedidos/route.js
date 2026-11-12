import { NextResponse } from 'next/server';
import { query, getSetting } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import { brl } from '@/lib/format';
import { enforceRequestLimit } from '@/lib/security';
import { sendAdminPush } from '@/lib/admin-push';

export const dynamic = 'force-dynamic';

const PAYMENTS = ['pix', 'boleto', 'cartao'];

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return fail('Entre na sua conta para finalizar o pedido.', 401);
  if (!canSeePrices(user)) return fail('Sua conta ainda não foi aprovada para compras.', 403);
  if (!(await enforceRequestLimit(request, 'orders', 10, 10 * 60, String(user.id)))) return fail('Muitos pedidos em pouco tempo. Aguarde e tente novamente.', 429);

  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 30000) return fail('Dados inválidos.', 413);
    body = await request.json();
  } catch {
    return fail('Dados inválidos.');
  }

  const payment = String(body.payment || '');
  if (!PAYMENTS.includes(payment)) return fail('Escolha a forma de pagamento.');

  const wanted = Array.isArray(body.items) ? body.items : [];
  if (wanted.length > 50) return fail('O carrinho excede o limite de itens.');
  const qtyById = new Map();
  for (const item of wanted) {
    const id = Number(item.id);
    const qty = Math.floor(Number(item.qty));
    if (id && qty > 0 && qty <= 100) {
      const nextQty = (qtyById.get(id) || 0) + qty;
      if (nextQty > 100) return fail('Quantidade máxima por produto: 100 unidades.');
      qtyById.set(id, nextQty);
    }
    else return fail('Quantidade de produto inválida.');
  }
  if (qtyById.size === 0) return fail('Seu carrinho está vazio.');

  const ids = [...qtyById.keys()];
  const products = await query(
    'SELECT id, name, price, stock, active FROM products WHERE id = ANY($1::int[])',
    [ids]
  );

  let total = 0;
  const lines = [];
  for (const id of ids) {
    const p = products.find((row) => row.id === id);
    const qty = qtyById.get(id);
    if (!p || !p.active) return fail('Um dos produtos do carrinho não está mais disponível.');
    if (qty > p.stock) return fail(`Estoque insuficiente para "${p.name}" (disponível: ${p.stock}).`);
    const price = Number(p.price); // sempre o preço do banco, nunca o do navegador
    total += price * qty;
    lines.push({ id, name: p.name, price, qty });
  }

  const minOrder = Number(await getSetting('min_order', '0')) || 0;
  if (total < minOrder) {
    return fail(`O pedido mínimo é de ${brl(minOrder)}. Seu carrinho está em ${brl(total)}.`, 422);
  }

  const reservedLines = [];
  for (const line of lines) {
    const reserved = await query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2 AND active = true AND stock >= $1 RETURNING id',
      [line.qty, line.id]
    );
    if (!reserved.length) {
      for (const previous of reservedLines) {
        await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [previous.qty, previous.id]);
      }
      return fail('O estoque mudou enquanto seu pedido era finalizado. Atualize o carrinho e tente novamente.', 409);
    }
    reservedLines.push(line);
  }

  let orderId;
  try {
    const orderRows = await query(
      `INSERT INTO orders (user_id, status, payment_method, total, shipping, notes)
       VALUES ($1, 'novo', $2, $3, 0, $4) RETURNING id`,
      [user.id, payment, total.toFixed(2), String(body.notes || '').slice(0, 500)]
    );
    orderId = orderRows[0].id;
    for (const line of lines) {
      await query(
        'INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES ($1, $2, $3, $4, $5)',
        [orderId, line.id, line.name, line.price.toFixed(2), line.qty]
      );
    }
  } catch (error) {
    if (orderId) await query('DELETE FROM orders WHERE id = $1', [orderId]);
    for (const line of reservedLines) {
      await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [line.qty, line.id]);
    }
    throw error;
  }

  await query(\`INSERT INTO admin_notifications (order_id, event_type)\n     VALUES ($1, 'checkout_pending')\n     ON CONFLICT (order_id, event_type) DO NOTHING\`, [orderId]);\n  await sendAdminPush({ type: 'checkout_pending', orderId });\n\n  return NextResponse.json({ ok: true, orderId });
}
