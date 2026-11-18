import { NextResponse } from 'next/server';
import { query, getSetting } from '@/lib/db';
import { getUser, canSeePrices } from '@/lib/auth';
import { brl } from '@/lib/format';
import { enforceRequestLimit } from '@/lib/security';
import { sendAdminPush } from '@/lib/admin-push';

export const dynamic = 'force-dynamic';

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function asaasRequest(base, apiKey, path, payload) {
  const response = await fetch(base + path, {
    method: payload ? 'POST' : 'GET',
    headers: {
      access_token: apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
      'User-Agent': 'BrusselsPet/1.0.0',
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.errors?.[0]?.description || 'O Asaas não conseguiu processar a cobrança.');
  }
  return data;
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

  const wanted = Array.isArray(body.items) ? body.items : [];
  if (wanted.length > 50) return fail('O carrinho excede o limite de itens.');
  const qtyById = new Map();
  const requestedLines = [];

  for (const item of wanted) {
    const id = Number(item.id);
    if (!Number.isSafeInteger(id) || id <= 0) return fail('Produto inválido.');
    if (Array.isArray(item.variants) && item.variants.length) {
      for (const variant of item.variants) {
        const qty = Number(variant.qty);
        const color = String(variant.color || '').trim().slice(0, 60);
        if (!color || !Number.isSafeInteger(qty) || qty <= 0) return fail('Confira a cor e a quantidade dos produtos.');
        const nextQty = (qtyById.get(id) || 0) + qty;
        if (!Number.isSafeInteger(nextQty)) return fail('Quantidade de produto inválida.');
        qtyById.set(id, nextQty);
        requestedLines.push({ id, qty, color });
      }
    } else {
      const qty = Number(item.qty);
      const color = String(item.color || '').trim().slice(0, 60);
      if (!Number.isSafeInteger(qty) || qty <= 0) return fail('Quantidade de produto inválida.');
      const nextQty = (qtyById.get(id) || 0) + qty;
      if (!Number.isSafeInteger(nextQty)) return fail('Quantidade de produto inválida.');
      qtyById.set(id, nextQty);
      requestedLines.push({ id, qty, color });
    }
  }
  if (qtyById.size === 0) return fail('Seu carrinho está vazio.');

  const ids = [...qtyById.keys()];
  const products = await query(
    'SELECT id, name, sku, price, stock, active, min_quantity, colors FROM products WHERE id = ANY($1::int[])',
    [ids]
  );

  let total = 0;
  const lines = [];
  for (const requested of requestedLines) {
    const product = products.find((row) => row.id === requested.id);
    if (!product || !product.active) return fail('Um dos produtos do carrinho não está mais disponível.');

    const productColors = Array.isArray(product.colors) ? product.colors : [];
    const matchingColor = productColors.find((item) => {
      const name = typeof item === 'string' ? item : String(item?.name || item?.color || item?.cor || '').trim();
      return name === requested.color;
    });
    if (productColors.length && !matchingColor) return fail(`Escolha uma cor válida para "${product.name}".`);
    if (!productColors.length && requested.color) return fail(`A cor informada para "${product.name}" não é válida.`);

    const price = Number(product.price);
    total += price * requested.qty;
    const abbreviation = typeof matchingColor === 'object' && matchingColor
      ? String(matchingColor.abbreviation || matchingColor.sigla || '').trim()
      : '';
    const sku = typeof matchingColor === 'object' && matchingColor
      ? String(matchingColor.sku || (product.sku && abbreviation ? product.sku + '-' + abbreviation : '')).trim()
      : '';
    lines.push({
      id: requested.id,
      name: requested.color
        ? `${product.name} — Cor: ${requested.color}${sku ? ' · SKU: ' + sku : ''}`
        : product.name,
      price,
      qty: requested.qty,
    });
  }

  for (const [id, qty] of qtyById) {
    const product = products.find((row) => row.id === id);
    const minimum = Math.max(1, Number(product.min_quantity) || 1);
    if (qty < minimum) return fail(`A quantidade mínima de "${product.name}" é de ${minimum} unidades.`);
    if (qty > Number(product.stock)) return fail(`Estoque insuficiente para "${product.name}" (disponível: ${product.stock}).`);
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
       VALUES ($1, 'novo', 'asaas', $2, 0, $3) RETURNING id`,
      [user.id, total.toFixed(2), String(body.notes || '').slice(0, 500)]
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

  const asaasBase = String(process.env.ASAAS_ENV || '').toLowerCase().includes('sandbox')
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3';

  try {
    let customerId = user.asaas_customer_id;
    if (!customerId) {
      const customerReference = `BP-USER-${user.id}`;
      const existingCustomers = await asaasRequest(asaasBase, apiKey, `/customers?externalReference=${encodeURIComponent(customerReference)}`);
      let customer = existingCustomers.data?.find((item) => item.externalReference === customerReference);
      if (!customer) {
        customer = await asaasRequest(asaasBase, apiKey, '/customers', {
          name: user.razao_social || user.nome_fantasia || user.email,
          cpfCnpj: String(user.cnpj || '').replace(/\D/g, ''),
          email: user.email,
          mobilePhone: String(user.telefone || '').replace(/\D/g, '') || undefined,
          externalReference: customerReference,
          notificationDisabled: false,
        });
      }
      if (!customer?.id) throw new Error('O Asaas não retornou o cadastro do cliente.');
      customerId = customer.id;
      await query('UPDATE users SET asaas_customer_id = $1 WHERE id = $2', [customerId, user.id]);
    }

    const dueDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const payment = await asaasRequest(asaasBase, apiKey, '/payments', {
      customer: customerId,
      billingType: 'UNDEFINED',
      value: Number(total.toFixed(2)),
      dueDate,
      description: `Pedido Brussels Pet #${orderId}`,
      externalReference: `BP-ORDER-${orderId}`,
      notificationDisabled: false,
    });

    if (!payment?.id || !payment?.invoiceUrl) throw new Error('O Asaas não retornou a página de pagamento.');
    await query(
      'UPDATE orders SET asaas_payment_id = $1, asaas_invoice_url = $2, payment_status = $3 WHERE id = $4',
      [payment.id, payment.invoiceUrl, payment.status || 'PENDING', orderId]
    );

    await query(
      "INSERT INTO admin_notifications (order_id, event_type) VALUES ($1, 'checkout_pending') ON CONFLICT (order_id, event_type) DO NOTHING",
      [orderId]
    );
    await sendAdminPush({ type: 'checkout_pending', orderId });

    return NextResponse.json({ ok: true, orderId, paymentUrl: payment.invoiceUrl });
  } catch (error) {
    console.error('Erro ao criar cobrança Asaas:', { orderId, error: String(error?.message || error) });
    await query('DELETE FROM orders WHERE id = $1', [orderId]);
    for (const line of reservedLines) {
      await query('UPDATE products SET stock = stock + $1 WHERE id = $2', [line.qty, line.id]);
    }
    return fail('Não foi possível gerar a cobrança no Asaas. ' + String(error?.message || '').slice(0, 180), 502);
  }
}
