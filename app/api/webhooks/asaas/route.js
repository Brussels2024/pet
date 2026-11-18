import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function tokenMatches(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const received = request.headers.get('asaas-access-token') || '';
  if (!tokenMatches(received, expected)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 }); }

  if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(String(body?.event || ''))) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const payment = body?.payment || {};
  const paymentLinkId = String(payment.paymentLink || '');
  const externalReference = String(payment.externalReference || '');
  const match = externalReference.match(/^BP-ORDER-(\d+)$/);
  const orderId = match ? Number(match[1]) : 0;
  let updated = [];

  if (paymentLinkId) {
    updated = await query("UPDATE orders SET status = 'pago' WHERE asaas_payment_link_id = $1 AND status <> 'pago' RETURNING id", [paymentLinkId]);
  }
  if (!updated.length && orderId > 0) {
    updated = await query("UPDATE orders SET status = 'pago' WHERE id = $1 AND status <> 'pago' RETURNING id", [orderId]);
  }
  for (const order of updated) {
  }
  return NextResponse.json({ received: true });
}
