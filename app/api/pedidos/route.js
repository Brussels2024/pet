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

async function getPaymentDetails(config, paymentId) {
  if (!paymentId) return null;
  return asaasRequest(config, `/payments/${encodeURIComponent(paymentId)}`);
}

async function findPayment(config, orderId, knownPaymentId = null) {
  // Se o ID já foi salvo no pedido, consulte a cobrança diretamente.
  if (knownPaymentId) {
    try {
      const payment = await getPaymentDetails(config, knownPaymentId);
      if (payment?.id) return payment;
    } catch (error) {
      console.error('Falha ao consultar cobrança pelo ID salvo:', { orderId, error });
    }
  }

  // Se a resposta do POST se perdeu, procure pela referência única do pedido.
  const externalReference = `brussels-pet-order-${orderId}`;
  const result = await asaasRequest(
    config,
    `/payments?externalReference=${encodeURIComponent(externalReference)}&limit=100&offset=0`
  );
  const match = result.data?.find((payment) => payment.externalReference === externalReference);
  if (!match?.id) return null;

  // O endpoint de listagem pode trazer dados resumidos; recupere a cobrança completa.
  try {
    return await getPaymentDetails(config, match.id);
  } catch (error) {
    console.error('Falha ao detalhar cobrança encontrada:', { orderId, paymentId: match.id, error });
    return match;
  }
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
      const payment = await findPayment(config, order.id, order.asaas_payment_id);
      if (payment) {
        const recovered = await checkoutResponse(order.id, payment);
        if (recovered) return recovered;
      }
    } catch (error) {
      console.error('Falha ao recuperar cobrança existente:', error);
    }
    return fail('Este pedido já foi iniciado e está em conferência do pagamento. Não refaça a compra; entre em contato com a Brussels Pet informando o pedido #' + order.id + '.', 409);
  }

  const shippingAddress = body.shippingAddress || {};
  const requiredAddress = ['cep','logradouro','numero','bairro','cidade','uf'];
  if (requiredAddress.some((key) => !String(shippingAddress[key] || '').trim())) return fail('Informe o endereço completo de entrega.');
  const cityRows = await query('SELECT city, uf FROM shipping_cities WHERE free_shipping = true');
  const normalizeCity = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  const freeShipping = cityRows.some((city) => normalizeCity(city.city) === normalizeCity(shippingAddress.cidade) && String(city.uf).toUpperCase() === String(shippingAddress.uf).trim().toUpperCase());
  if (!freeShipping) return fail('Sua cidade não está na lista de frete grátis. Consulte o frete pelo WhatsApp.', 422);
  const cleanAddress = {
    cep: String(shippingAddress.cep).replace(/\D/g, '').slice(0, 8),
    logradouro: String(shippingAddress.logradouro).trim().slice(0, 180),
    numero: String(shippingAddress.numero).trim().slice(0, 30),
    complemento: String(shippingAddress.complemento || '').trim().slice(0, 100),
    bairro: String(shippingAddress.bairro).trim().slice(0, 100),
    cidade: String(shippingAddress.cidade).trim().slice(0, 100),
    uf: String(shippingAddress.uf).trim().toUpperCase().slice(0, 2),
    telefone: String(user.telefone || '').trim().slice(0, 30),
  };
  if (cleanAddress.cep.length !== 8 || cleanAddress.uf.length !== 2) return fail('Confira o CEP e a UF do endereço.');
  await query('UPDATE users SET cep=$1, logradouro=$2, numero=$3, complemento=$4, bairro=$5, cidade=$6, uf=$7 WHERE id=$8',
    [cleanAddress.cep, cleanAddress.logradouro, cleanAddress.numero, cleanAddress.complemento, cleanAddress.bairro, cleanAddress.cidade, cleanAddress.uf, user.id]);

  const wanted = Array.isArray(body.items) ? body.items : [];
  const lines = [];
  for (const item of wanted) {
    const productId = Number(item.id);
    if (!Number.isSafeInteger(productId) || productId < 1) continue;
    if (Array.isArray(item.variants) && item.variants.length) {
      for (const variant of item.variants) {
        const colorId = Number(variant.colorId);
        const qty = Math.floor(Number(variant.qty));
        if (Number.isSafeInteger(colorId) && colorId > 0 && Number.isSafeInteger(qty) && qty > 0 && qty <= 500) {
          lines.push({ productId, colorId, qty });
        }
      }
    } else {
      const qty = Math.floor(Number(item.qty));
      if (Number.isSafeInteger(qty) && qty > 0 && qty <= 500) lines.push({ productId, colorId: null, qty });
    }
  }
  const mergedLines = new Map();
  for (const line of lines) {
    const key = line.productId + ':' + (line.colorId ?? 'none');
    const previous = mergedLines.get(key);
    if (previous) previous.qty += line.qty;
    else mergedLines.set(key, { ...line });
  }
  lines.splice(0, lines.length, ...mergedLines.values());
  if (!lines.length || lines.length > 200) return fail('Seu carrinho está vazio ou contém itens demais.');
  const productIds = [...new Set(lines.map(line => line.productId))];
  const products = await query(
    'SELECT id, name, price, stock, active FROM products WHERE id = ANY($1::int[])',
    [productIds]
  );
  if (products.length !== productIds.length || products.some(p => !p.active)) return fail('Um dos produtos do carrinho não está mais disponível.');
  const colorIds = lines.filter(line => line.colorId !== null).map(line => line.colorId);
  const colors = colorIds.length ? await query(
    'SELECT id, product_id, name, sku, stock FROM product_colors WHERE id = ANY($1::int[])',
    [colorIds]
  ) : [];
  if (colors.length !== colorIds.length) return fail('Uma das cores escolhidas não está mais disponível.');
  for (const line of lines) {
    const product = products.find(p => p.id === line.productId);
    if (line.colorId !== null) {
      const color = colors.find(c => c.id === line.colorId && c.product_id === line.productId);
      if (!color) return fail('A cor selecionada não pertence a este produto.');
      if (line.qty > Number(color.stock)) return fail(`Estoque insuficiente para "${product.name}" — ${color.name} (SKU: ${color.sku || 'sem SKU'}; disponível: ${color.stock}).`);
      line.colorName = color.name;
      line.colorSku = color.sku || '';
    } else {
      if (await query('SELECT 1 FROM product_colors WHERE product_id = $1 LIMIT 1', [line.productId]).then(rows => rows.length)) {
        return fail(`Escolha uma cor para o produto "${product.name}".`);
      }
      if (line.qty > Number(product.stock)) return fail(`Estoque insuficiente para "${product.name}" (disponível: ${product.stock}).`);
      line.colorName = null;
      line.colorSku = null;
    }
  }
  const total = lines.reduce((sum, line) => {
    const product = products.find(p => p.id === line.productId);
    return sum + Number(product.price) * line.qty;
  }, 0);
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

    // Reserva o estoque por cor e grava uma linha por cor no mesmo pedido, atomicamente.
    const created = await query(
      `WITH requested AS (
         SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(product_id int, color_id int, qty int, color_name text, color_sku text)
       ),
       eligible AS (
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE p.id IS NOT NULL AND p.active = true AND
                  ((r.color_id IS NOT NULL AND c.id IS NOT NULL AND c.stock >= r.qty) OR
                   (r.color_id IS NULL AND c_any.id IS NULL AND p.stock >= r.qty)))::int AS available,
                COALESCE(SUM(p.price * r.qty), 0)::numeric(12,2) AS amount
           FROM requested r
           LEFT JOIN products p ON p.id = r.product_id
           LEFT JOIN product_colors c ON c.id = r.color_id AND c.product_id = r.product_id
           LEFT JOIN LATERAL (SELECT id FROM product_colors pc WHERE pc.product_id = r.product_id LIMIT 1) c_any ON true
       ),
       reserved_colors AS (
         UPDATE product_colors c SET stock = c.stock - r.qty
           FROM requested r, eligible e
          WHERE r.color_id IS NOT NULL AND c.id = r.color_id AND c.product_id = r.product_id
            AND e.total = e.available
         RETURNING c.product_id
       ),
       reserved_legacy AS (
         UPDATE products p SET stock = p.stock - r.qty
           FROM requested r, eligible e
          WHERE r.color_id IS NULL AND p.id = r.product_id AND e.total = e.available
         RETURNING p.id
       ),
       synced AS (
         UPDATE products p SET stock = totals.total_stock
           FROM (SELECT product_id, SUM(stock)::int AS total_stock FROM product_colors GROUP BY product_id) totals
          WHERE p.id = totals.product_id
         RETURNING p.id
       ),
       new_order AS (
         INSERT INTO orders (user_id, status, payment_method, total, shipping, notes, payment_status, checkout_key, shipping_address)
         SELECT $2, 'novo', 'asaas', e.amount, 0, $3, 'PENDING', $4, $5::jsonb
           FROM eligible e
          WHERE e.total = e.available
            AND (SELECT COUNT(*) FROM reserved_colors) = (SELECT COUNT(*) FROM requested WHERE color_id IS NOT NULL)
            AND (SELECT COUNT(*) FROM reserved_legacy) = (SELECT COUNT(*) FROM requested WHERE color_id IS NULL)
         RETURNING id
       ),
       new_items AS (
         INSERT INTO order_items (order_id, product_id, name, price, qty, color_id, color_name, color_sku)
         SELECT o.id, p.id, p.name, p.price, r.qty, r.color_id, r.color_name, r.color_sku
           FROM new_order o CROSS JOIN requested r JOIN products p ON p.id = r.product_id
         RETURNING id
       )
       SELECT o.id, e.total, e.available, e.amount, (SELECT COUNT(*)::int FROM new_items) AS item_count
         FROM eligible e LEFT JOIN new_order o ON true`,
      [JSON.stringify(lines.map(line => ({
        product_id: line.productId, color_id: line.colorId, qty: line.qty,
        color_name: line.colorName, color_sku: line.colorSku
      }))), user.id, String(body.notes || '').slice(0, 500), checkoutKey, JSON.stringify(cleanAddress)]
    );
    const row = created[0];
    if (!row?.id) return fail('O estoque mudou durante a finalização. Atualize o carrinho e tente novamente.', 409);
    const orderId = row.id;
    await query(
      `UPDATE products p
          SET stock = (SELECT COALESCE(SUM(pc.stock), 0)::int FROM product_colors pc WHERE pc.product_id = p.id)
        WHERE p.id = ANY($1::int[])
          AND EXISTS (SELECT 1 FROM product_colors pc WHERE pc.product_id = p.id)`,
      [productIds]
    );

    // Avisar o administrador assim que o cliente confirma o pedido,
    // sem esperar a criação ou confirmação do pagamento no Asaas.
    await query(
      `INSERT INTO admin_notifications (order_id, event_type)
       VALUES ($1, 'checkout_pending')
       ON CONFLICT (order_id, event_type) DO NOTHING`,
      [orderId]
    );
    const notificationItems = await query('SELECT name, qty, color_name, color_sku FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]);
    await sendAdminPush({ type: 'checkout_pending', orderId, items: notificationItems });

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
