import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function safeEqual(received, expected) {
  const a = Buffer.from(received || '');
  const b = Buffer.from(expected || '');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

// Adaptador temporário: recebe SKU e saldo absoluto. O payload oficial Olist V3
// será mapeado quando houver acesso à aplicação e ao contrato da conta.
export async function POST(request) {
  const expected = process.env.OLIST_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: 'Integração Olist ainda não configurada.' }, { status: 503 });
  if (!safeEqual(request.headers.get('x-olist-webhook-token'), expected)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const eventId = String(body?.eventId || '').trim();
  const products = Array.isArray(body?.products) ? body.products : [];
  if (!eventId || !products.length || products.length > 500) {
    return NextResponse.json({ error: 'Evento ou lista de produtos inválida.' }, { status: 400 });
  }

  const normalized = products.map((item) => ({
    sku: String(item?.sku || '').trim(),
    stock: Number(item?.stock),
  }));
  const skuSet = new Set(normalized.map((item) => item.sku));
  if (normalized.some((item) => !item.sku || !Number.isSafeInteger(item.stock) || item.stock < 0) || skuSet.size !== normalized.length) {
    return NextResponse.json({ error: 'Cada item precisa ter SKU único e estoque inteiro não negativo.' }, { status: 400 });
  }

  const skus = normalized.map((item) => item.sku);
  const stocks = normalized.map((item) => item.stock);
  const result = await query(
    `WITH incoming AS (
       SELECT * FROM unnest($2::text[], $3::int[]) AS i(sku, stock)
     ),
     mapped AS (
       SELECT p.id, i.stock
         FROM incoming i JOIN products p ON p.sku = i.sku
     ),
     validation AS (
       SELECT (SELECT COUNT(*) FROM incoming)::int AS received,
              (SELECT COUNT(*) FROM mapped)::int AS matched
     ),
     accepted AS (
       INSERT INTO olist_stock_events (event_id)
       SELECT $1 FROM validation v WHERE v.received = v.matched
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id
     ),
     updated AS (
       UPDATE products p SET stock = m.stock
         FROM mapped m
        WHERE p.id = m.id AND EXISTS (SELECT 1 FROM accepted)
       RETURNING p.id
     )
     SELECT v.received, v.matched,
            EXISTS(SELECT 1 FROM accepted) AS accepted,
            (SELECT COUNT(*)::int FROM updated) AS updated_count,
            EXISTS(SELECT 1 FROM olist_stock_events WHERE event_id = $1) AS event_exists
       FROM validation v`,
    [eventId, skus, stocks]
  );

  const row = result[0];
  if (row.received !== row.matched) {
    return NextResponse.json({ error: 'Um ou mais SKUs não estão cadastrados na Brussels Pet. Nenhum estoque foi alterado.', receivedProducts: row.received, matchedProducts: row.matched }, { status: 422 });
  }
  if (!row.accepted) return NextResponse.json({ received: true, duplicate: true });
  return NextResponse.json({ received: true, updated: row.updated_count, receivedProducts: row.received });
}
