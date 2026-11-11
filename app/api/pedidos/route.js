import { NextResponse } from 'next/server';
import { query, getSetting } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import { brl } from '@/lib/format';

export const dynamic = 'force-dynamic';

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function asaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.ASAAS_API_URL ||
    (process.env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl };
}

async function asaasRequest(config, path, payload) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      access_token: config.apiKey,
      'User-Agent': 'BrusselsPet/1.0',
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Asaas API error:', response.status, result);
    throw new Error('Não foi possível gerar a cobrança no Asaas.');
  }
  return result;
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return fail('Entre na sua conta para finalizar o pedido.', 401);
  if (!canSeePrices(user)) return fail('Sua conta ainda não foi aprovada para compras.', 403);

  const config = asaasConfig();
  if (!config) return fail('O pagamento ainda não está configurado. Tente novamente mais tarde.', 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('Dados inválidos.');
  }

  const wanted = Array.isArray(body.items) ? body.items : [];
  const qtyById = new Map();
  for (const item of wanted) {
    const id = Number(item.id);
    const qty = Math.floor(Number(item.qty));
    if (Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(qty) && qty > 0 && qty <= 500) {
      qtyById.set(id, (qtyById.get(id) || 0) + qty);
    }
  }
  if (!qtyById.size) return fail('Seu carrinho está vazio.');

  const ids = [...qtyById.keys()];
  const products = await query(
    'SELECT id, name, price, stock, active FROM products WHERE id = ANY($1::int[])',
    [ids]
  );

  let total = 0;
  const lines = [];
  for (const id of ids) {
    const product = products.find((row) => row.id === id);
    const qty = qtyById.get(id);
    if (!product || !product.active) return fail('Um dos produtos do carrinho não está mais disponível.');
    if (qty > Number(product.stock)) {
      return fail(`Estoque insuficiente para "${product.name}" (disponível: ${product.stock}).`);
    }
    const price = Number(product.price);
    total += price * qty;
    lines.push({ id, name: product.name, price, qty });
  }

  const minOrder = Number(await getSetting('min_order', '0')) || 0;
  if (total < minOrder) {
    return fail(`O pedido mínimo é de ${brl(minOrder)}. Seu carrinho está em ${brl(total)}.`, 422);
  }

  let orderId = null;
  const reservedLines = [];
  try {
    let customerId = user.asaas_customer_id;
    if (!customerId) {
      const customer = await asaasRequest(config, '/customers', {
        name: user.razao_social || user.nome_fantasia || user.email,
        cpfCnpj: String(user.cnpj || '').replace(/\D/g, ''),
        email: user.email,
        mobilePhone: String(user.telefone || '').replace(/\D/g, '') || undefined,
        externalReference: `brussels-pet-user-${user.id}`,
        notificationDisabled: false,
      });
      if (!customer.id) throw new Error('O Asaas não retornou o cadastro do cliente.');
      customerId = customer.id;
      await query('UPDATE users SET asaas_customer_id = $1 WHERE id = $2', [customerId, user.id]);
    }

    const orderRows = await query(
      `INSERT INTO orders (user_id, status, payment_method, total, shipping, notes, payment_status)
       VALUES ($1, 'novo', 'asaas', $2, 0, $3, 'PENDING') RETURNING id`,
      [user.id, total.toFixed(2), String(body.notes || '').slice(0, 500)]
    );
    orderId = orderRows[0].id;

    for (const line of lines) {
      const reserved = await query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND active = true AND stock >= $1 RETURNING id',
        [line.qty, line.id]
      );
      if (!reserved.length) throw new Error(`O estoque de "${line.name}" acabou de mudar. Atualize o carrinho.`);
      reservedLines.push(line);
      await query(
        'INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES ($1, $2, $3, $4, $5)',
        [orderId, line.id, line.name, line.price.toFixed(2), line.qty]
      );
    }

    const dueDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const paymentResult = await asaasRequest(config, '/payments', {
      customer: customerId,
      billingType: 'UNDEFINED',
      value: Number(total.toFixed(2)),
      dueDate,
      description: `Pedido #${orderId} - Brussels Pet`,
      externalReference: `brussels-pet-order-${orderId}`,
    });

    const invoiceUrl = paymentResult.invoiceUrl || paymentResult.bankSlipUrl;
    if (!paymentResult.id || !invoiceUrl) {
      throw new Error('O Asaas não retornou o link de pagamento.');
    }

    await query(
      `UPDATE orders
          SET asaas_payment_id = $1, asaas_invoice_url = $2, payment_status = $3
        WHERE id = $4`,
      [paymentResult.id, invoiceUrl, paymentResult.status || 'PENDING', orderId]
    );

    return NextResponse.json({ ok: true, orderId, invoiceUrl });
  } catch (error) {
    console.error('Erro ao criar cobrança Asaas:', error);
    for (const line of reservedLines) {
      await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [line.qty, line.id]).catch(() => {});
    }
    if (orderId) {
      await query("UPDATE orders SET payment_status = 'ERROR' WHERE id = $1", [orderId]).catch(() => {});
    }
    return fail(error.message || 'Não foi possível gerar o pagamento. Tente novamente.', 502);
  }
}
