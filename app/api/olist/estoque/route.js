import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function safeEqual(received, expected) {
  const a = Buffer.from(received || '');
  const b = Buffer.from(expected || '');
  return a.length > 0 && a.length === b.length && require('crypto').timingSafeEqual(a, b);
}

// Endpoint de entrada para o conector Olist. O adaptador recebe SKU + saldo absoluto;
// o formato exato enviado pelo Olist será mapeado quando a conta/API V3 estiver disponível.
export async function POST(request) {
  const expected = process.env.OLIST_WEBHOOK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Integração Olist ainda não configurada.' }, { status: 503 });
  }
  if (!safeEqual(request.headers.get('x-olist-webhook-token'), expected)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const eventId = String(body?.eventId || '').trim();
  const products = Array.isArray(body?.products) ? body.products : [];
  if (!eventId || !products.length || products.length > 500) {
    return NextResponse.json({ error: 'Evento ou lista de produtos inválida.' }, { status: 400 });
  }

  const inserted = await query(
    'INSERT INTO olist_stock_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id',
    [eventId]
  );
  if (!inserted.length) return NextResponse.json({ received: true, duplicate: true });

  let updated = 0;
  for (const item of products) {
    const sku = String(item?.sku || '').trim();
    const stock = Number(item?.stock);
    if (!sku || !Number.isSafeInteger(stock) || stock < 0) continue;
    const rows = await query(
      'UPDATE products SET stock = $1 WHERE sku = $2 RETURNING id',
      [stock, sku]
    );
    updated += rows.length;
  }

  return NextResponse.json({ received: true, updated, receivedProducts: products.length });
}
