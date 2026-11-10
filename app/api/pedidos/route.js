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
    if (id && qty > 0) qtyById.set(id, (qtyById.get(id) || 0) + qty);
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

  // Registra o cliente no Asaas e reutiliza o cadastro nas próximas compras.
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return fail('O pagamento ainda não está configurado. Tente novamente mais tarde.', 503);

  const baseUrl = process.env.ASAAS_API_URL ||
    (process.env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3');

  async function asaasRequest(path, payload) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: apiKey,
        'User-Agent': 'BrusselsPet/1.0',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Asaas API error:', response.status, result);
      throw new Error('Não foi possível gerar a cobrança no Asaas.');
    }
    return result;
  }

  let orderId = null;
  try {
    let asaasCustomerId = user.asaas_customer_id;
    if (!asaasCustomerId) {
      const customer = await asaasRequest('/customers', {
        name: user.razao_social || user.nome_fantasia || user.email,
        cpfCnpj: String(user.cnpj || '').replace(/\\D/g, ''),
        email: user.email,
        mobilePhone: String(user.telefone || '').replace(/\\D/g, '') || undefined,
        externalReference: `brussels-pet-user-${user.id}`,
        notificationDisabled: false,
        address: user.logradouro || undefined,
        addressNumber: user.numero || undefined,
        complement: user.complemento || undefined,
        province: user.bairro || undefined,
        postalCode: String(user.cep || '').replace(/\\D/g, '') || undefined,
      });
      if (!customer.id) throw new Error('O Asaas não retornou o cadastro do cliente.');
      asaasCustomerId = customer.id;
      await query('UPDATE users SET asaas_customer_id = $1 WHERE id = $2', [asaasCustomerId, user.id]);
    }

    const orderRows = await query(
      `INSERT INTO orders (user_id, status, payment_method, total, shipping, notes, payment_status)
       VALUES ($1, 'novo', 'asaas', $2, 0, $3, 'PENDING') RETURNING id`,
      [user.id, total.toFixed(2), String(body.notes || '').slice(0, 500)]
    );
    orderId = orderRows[0].id;

    for (const line of lines) {
      await query(
        'INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES ($1, $2, $3, $4, $5)',
        [orderId, line.id, line.name, line.price.toFixed(2), line.qty]
      );
      await query('UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2', [line.qty, line.id]);
    }

    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const paymentResult = await asaasRequest('/payments', {
      customer: asaasCustomerId,
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
    if (orderId) {
      await query("UPDATE orders SET payment_status = 'ERROR' WHERE id = $1", [orderId]).catch(() => {});
    }
    return fail('Não foi possível gerar o pagamento. O pedido ficou registrado para conferência. Tente novamente ou fale conosco.', 502);
  }
}
