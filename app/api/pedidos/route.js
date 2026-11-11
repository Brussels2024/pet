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

function asaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.ASAAS_API_URL ||
    (process.env.ASAAS_ENV === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');
  return { apiKey, baseUrl };
}

async function asaasRequest(config, path, payload) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', access_token: config.apiKey, 'User-Agent': 'BrusselsPet/1.0' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Asaas API error:', response.status, result);
    throw new Error('Não foi possível consultar ou gerar a cobrança no Asaas.');
  }
  return result;
}

async function findPayment(config, orderId) {
  const result = await asaasRequest(config, `/payments?externalReference=${encodeURIComponent(`brussels-pet-order-${orderId}`)}`);
  return result.data?.find((payment) => payment.externalReference === `brussels-pet-order-${orderId}`) || null;
}

async function checkoutResponse(orderId, payment) {
  const invoiceUrl = payment.invoiceUrl || payment.bankSlipUrl;
  if (!payment.id || !invoiceUrl) return null;
  await query(
    `UPDATE orders SET asaas_payment_id = $1, asaas_invoice_url = $2, payment_status = $3 WHERE id = $4`,
    [payment.id, invoiceUrl, payment.status || 'PENDING', orderId]
  );
  await query(
    `INSERT INTO admin_notifications (order_id, event_type)
     VALUES ($1, 'checkout_pending')
     ON CONFLICT (order_id, event_type) DO NOTHING`,
    [orderId]
  );
  return NextResponse.json({ ok: true, orderId, invoiceUrl });
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return fail('Entre na sua conta para finalizar o pedido.', 401);
  if (!canSeePrices(user)) return fail('Sua conta ainda não foi aprovada para compras.', 403);
  if (!(await enforceRequestLimit(request, 'orders', 10, 10 * 60, String(user.id)))) return fail('Muitos pedidos em pouco tempo. Aguarde e tente novamente.', 429);

  const config = asaasConfig();
  if (!config) return fail('O pagamento ainda não está configurado. Tente novamente mais tarde.', 503);

  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 30000) return fail('Dados inválidos.', 413);
    body = await request.json();
  } catch { return fail('Dados inválidos.'); }

  const checkoutKey = String(body?.checkoutKey || '');
  if (!/^[0-9a-f-]{36}$/i.test(checkoutKey)) return fail('Identificador do checkout inválido.');

  const existing = await query(
    'SELECT id, asaas_payment_id, asaas_invoice_url, payment_status FROM orders WHERE checkout_key = $1 AND user_id = $2 LIMIT 1',
    [checkoutKey, user.id]
  );
  if (existing.length) {
    const order = existing[0];
    if (order.asaas_invoice_url) return NextResponse.json({ ok: true, orderId: order.id, invoiceUrl: order.asaas_invoice_url });
    try {
      const payment = await findPayment(config, order.id);
      if (payment) {
        const recovered = await checkoutResponse(order.id, payment);
        if (recovered) return recovered;
      }
    } catch (error) {
      console.error('Falha ao recuperar cobrança existente:', error);
    }
    return fail('Este pedido já foi iniciado e está em conferência do pagamento. Não refaça a compra; entre em contato com a Brussels Pet informando o pedido #' + order.id + '.', 409);
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
  if (!qtyById.size || qtyById.size > 100) return fail('Seu carrinho está vazio ou contém itens demais.');

  const ids = [...qtyById.keys()];
  const quantities = ids.map((id) => qtyById.get(id));
  const products = await query(
    'SELECT id, name, price, stock, active FROM products WHERE id = ANY($1::int[])',
    [ids]
  );
  if (products.length !== ids.length || products.some((p) => !p.active)) {
    return fail('Um dos produtos do carrinho não está mais disponível.');
  }
  for (const product of products) {
    const qty = qtyById.get(product.id);
    if (qty > Number(product.stock)) return fail(`Estoque insuficiente para "${product.name}" (disponível: ${product.stock}).`);
  }
  const total = products.reduce((sum, p) => sum + Number(p.price) * qtyById.get(p.id), 0);
  const minOrder = Number(await getSetting('min_order', '0')) || 0;
  if (total < minOrder) return fail(`O pedido mínimo é de ${brl(minOrder)}. Seu carrinho está em ${brl(total)}.`, 422);

  let customerId = user.asaas_customer_id;
  try {
    if (!customerId) {
      const externalReference = `brussels-pet-user-${user.id}`;
      const existingCustomers = await asaasRequest(config, `/customers?externalReference=${encodeURIComponent(externalReference)}`);
      let customer = existingCustomers.data?.find((item) => item.externalReference === externalReference);
      if (!customer) {
        customer = await asaasRequest(config, '/customers', {
          name: user.razao_social || user.nome_fantasia || user.email,
          cpfCnpj: String(user.cnpj || '').replace(/\D/g, ''),
          email: user.email,
          mobilePhone: String(user.telefone || '').replace(/\D/g, '') || undefined,
          externalReference,
          notificationDisabled: false,
        });
      }
      if (!customer?.id) throw new Error('O Asaas não retornou o cadastro do cliente.');
      customerId = customer.id;
      await query('UPDATE users SET asaas_customer_id = $1 WHERE id = $2', [customerId, user.id]);
    }

    // Uma única instrução SQL reserva todo o estoque e cria pedido/itens atomicamente.
    const created = await query(
      `WITH requested AS (
         SELECT * FROM unnest($1::int[], $2::int[]) AS r(id, qty)
       ),
       eligible AS (
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE p.id IS NOT NULL AND p.active = true AND p.stock >= r.qty)::int AS available,
                COALESCE(SUM(p.price * r.qty), 0)::numeric(12,2) AS amount
           FROM requested r LEFT JOIN products p ON p.id = r.id
       ),
       reserved AS (
         UPDATE products p SET stock = p.stock - r.qty
           FROM requested r, eligible e
          WHERE p.id = r.id AND e.total = e.available
         RETURNING p.id
       ),
       new_order AS (
         INSERT INTO orders (user_id, status, payment_method, total, shipping, notes, payment_status, checkout_key)
         SELECT $3, 'novo', 'asaas', e.amount, 0, $4, 'PENDING', $5
           FROM eligible e
          WHERE e.total = e.available AND (SELECT COUNT(*) FROM reserved) = e.total
         RETURNING id
       ),
       new_items AS (
         INSERT INTO order_items (order_id, product_id, name, price, qty)
         SELECT o.id, p.id, p.name, p.price, r.qty
           FROM new_order o CROSS JOIN requested r JOIN products p ON p.id = r.id
         RETURNING id
       )
       SELECT o.id, e.total, e.available, e.amount, (SELECT COUNT(*)::int FROM new_items) AS item_count
         FROM eligible e LEFT JOIN new_order o ON true`,
      [ids, quantities, user.id, String(body.notes || '').slice(0, 500), checkoutKey]
    );
    const row = created[0];
    if (!row?.id) return fail('O estoque mudou durante a finalização. Atualize o carrinho e tente novamente.', 409);
    const orderId = row.id;

    // Avisar o administrador assim que o cliente confirma o pedido,
    // sem esperar a criação ou confirmação do pagamento no Asaas.
    await query(
      `INSERT INTO admin_notifications (order_id, event_type)
       VALUES ($1, 'checkout_pending')
       ON CONFLICT (order_id, event_type) DO NOTHING`,
      [orderId]
    );
    await sendAdminPush({ type: 'checkout_pending', orderId });

    let paymentAttempted = false;
    try {
      // Recupera eventual cobrança criada numa tentativa anterior antes de criar outra.
      let payment = await findPayment(config, orderId);
      if (!payment) {
        paymentAttempted = true;
        const dueDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
        payment = await asaasRequest(config, '/payments', {
          customer: customerId,
          billingType: 'UNDEFINED',
          value: Number(row.amount),
          dueDate,
          description: `Pedido #${orderId} - Brussels Pet`,
          externalReference: `brussels-pet-order-${orderId}`,
        });
      }
      const response = await checkoutResponse(orderId, payment);
      if (response) return response;
      throw new Error('O Asaas não retornou o link de pagamento. Pedido mantido em conferência para evitar duplicidade.');
    } catch (paymentError) {
      // Se a chamada ao Asaas foi iniciada, o resultado pode ser incerto: não liberar estoque
      // nem criar outra cobrança automaticamente. A próxima tentativa consulta externalReference.
      await query(
        `UPDATE orders SET payment_status = 'PAYMENT_REVIEW', notes = COALESCE(notes, '') WHERE id = $1`,
        [orderId]
      ).catch(() => {});
      console.error('Cobrança em conferência:', { orderId, paymentAttempted, error: paymentError });
      return fail(`O pedido #${orderId} foi registrado, mas o pagamento está em conferência. Não refaça o pedido. Entre em contato com a Brussels Pet.`, 502);
    }
  } catch (error) {
    console.error('Erro ao iniciar pedido:', error);
    return fail(error.message || 'Não foi possível iniciar o pedido. Tente novamente.', 502);
  }
}
