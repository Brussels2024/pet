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
  const requestedLines = [];
  for (const item of wanted) {
    const id = Number(item.id);
    const qty = Math.floor(Number(item.qty));
    const color = String(item.color || '').trim().slice(0, 60);
    if (!id || qty <= 0 || qty > 100) return fail('Quantidade de produto inválida.');
    const nextQty = (qtyById.get(id) || 0) + qty;
    if (nextQty > 100) return fail('Quantidade máxima por produto: 100 unidades.');
    qtyById.set(id, nextQty);
    requestedLines.push({ id, qty, color });
  }
  if (qtyById.size === 0) return fail('Seu carrinho está vazio.');

  const ids = [...qtyById.keys()];
  const products = await query(
    'SELECT id, name, price, stock, active, min_quantity, colors FROM products WHERE id = ANY($1::int[])',
    [ids]
  );

  let total = 0;
  const lines = [];
  for (const requested of requestedLines) {
    const p = products.find((row) => row.id === requested.id);
    if (!p || !p.active) return fail('Um dos produtos do carrinho não está mais disponível.');
    const minimum = Math.max(1, Number(p.min_quantity) || 1);
    if (requested.qty < minimum) return fail(`A quantidade mínima de "${p.name}" é de ${minimum} unidades.`);
    const availableColors = Array.isArray(p.colors) ? p.colors.map((item) => typeof item === 'string' ? item : String(item?.name || item?.color || item?.cor || '').trim()).filter(Boolean) : [];
    if (availableColors.length && !availableColors.includes(requested.color)) {
      return fail(`Escolha uma cor válida para "${p.name}".`);
    }
    if (!availableColors.length && requested.color) return fail(`A cor informada para "${p.name}" não é válida.`);
    const price = Number(p.price); // sempre o preço do banco, nunca o do navegador
    total += price * requested.qty;
    lines.push({
      id: requested.id,
      name: requested.color ? `${p.name} — Cor: ${requested.color}` : p.name,
      price,
      qty: requested.qty,
    });
  }

  for (const [id, qty] of qtyById) {
    const p = products.find((row) => row.id === id);
    if (qty > p.stock) return fail(`Estoque insuficiente para "${p.name}" (disponível: ${p.stock}).`);
  }

  const minOrder = Number(await getSetting('min_order', '0')) || 0;
  if (total < minOrder) {
    return fail(`O pedido mínimo é de ${brl(minOrder)}. Seu carrinho está em ${brl(total)}.`, 422);
  }

  const reservedLines = [];
  for (const [id, qty] of qtyById) {
    const reserved = await query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2 AND active = true AND stock >= $1 RETURNING id',
      [qty, id]
    );
    if (!reserved.length) {
      for (const previous of reservedLines) {
        await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [previous.qty, previous.id]);
      }
      return fail('O estoque mudou enquanto seu pedido era finalizado. Atualize o carrinho e tente novamente.', 409);
    }
    reservedLines.push({ id, qty });
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

  const apiKey = process.env.ASAAS_API_KEY;
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!apiKey || !webhookToken) {
    await query('DELETE FROM orders WHERE id = $1', [orderId]);
    for (const line of reservedLines) await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [line.qty, line.id]);
    return fail('A integração de cobrança Asaas não está configurada no servidor.', 503);
  }

  const asaasBase = String(process.env.ASAAS_ENV || '').toLowerCase().includes('sandbox') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
  const billingType = { pix: 'PIX', boleto: 'BOLETO', cartao: 'CREDIT_CARD' }[payment];
  let paymentLink;
  try {
    const asaasResponse = await fetch(asaasBase + '/paymentLinks', {
      method: 'POST',
      headers: { access_token: apiKey, accept: 'application/json', 'content-type': 'application/json', 'User-Agent': 'BrusselsPet/1.0.0' },
      body: JSON.stringify({
        name: `Pedido Brussels Pet #${orderId}`,
        description: lines.map((line) => `${line.name} x${line.qty}`).join('; ').slice(0, 500),
        value: Number(total.toFixed(2)),
        billingType,
        chargeType: 'DETACHED',
        ...(payment === 'boleto' ? { dueDateLimitDays: 5 } : {}),
        externalReference: `BP-ORDER-${orderId}`,
        notificationEnabled: true,
        callback: { successUrl: `https://www.brusselspet.com.br/conta?pedido=${orderId}&pagamento=retorno`, autoRedirect: false },
      }),
    });
    const payload = await asaasResponse.json().catch(() => ({}));
    if (!asaasResponse.ok || !payload.id || !payload.url) throw new Error(payload.errors?.[0]?.description || 'O Asaas não retornou o link de cobrança.');
    paymentLink = payload;
  } catch (error) {
    await query('DELETE FROM orders WHERE id = $1', [orderId]);
    for (const line of reservedLines) await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [line.qty, line.id]);
    return fail('Não foi possível gerar a cobrança no Asaas. ' + String(error?.message || '').slice(0, 180), 502);
  }

  await query('UPDATE orders SET asaas_payment_link_id = $1, asaas_payment_url = $2 WHERE id = $3', [paymentLink.id, paymentLink.url, orderId]);

  await query(
    "INSERT INTO admin_notifications (order_id, event_type) VALUES ($1, 'checkout_pending') ON CONFLICT (order_id, event_type) DO NOTHING",
    [orderId]
  );
  await sendAdminPush({ type: 'checkout_pending', orderId });

  return NextResponse.json({ ok: true, orderId, paymentUrl: paymentLink.url });
}
