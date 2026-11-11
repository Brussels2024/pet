import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 503 });
  }

  const received = request.headers.get('asaas-access-token') || '';
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
  }

  const eventId = String(body?.id || '');
  const eventName = String(body?.event || '');
  const paymentId = String(body?.payment?.id || '');
  if (!eventId || !eventName) {
    return NextResponse.json({ error: 'Evento incompleto.' }, { status: 400 });
  }

  if (paymentId && ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(eventName)) {
    await query(
      `UPDATE orders
          SET payment_status = 'RECEIVED',
              status = CASE WHEN status IN ('cancelado', 'entregue', 'enviado') THEN status ELSE 'pago' END
        WHERE asaas_payment_id = $1`,
      [paymentId]
    );
  } else if (paymentId && eventName === 'PAYMENT_OVERDUE') {
    await query(
      "UPDATE orders SET payment_status = 'OVERDUE' WHERE asaas_payment_id = $1 AND payment_status <> 'RECEIVED'",
      [paymentId]
    );
  } else if (paymentId && ['PAYMENT_DELETED', 'PAYMENT_CANCELED'].includes(eventName)) {
    await query(
      "UPDATE orders SET payment_status = 'CANCELED' WHERE asaas_payment_id = $1 AND payment_status <> 'RECEIVED'",
      [paymentId]
    );
  } else if (paymentId && ['PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED'].includes(eventName)) {
    await query(
      "UPDATE orders SET payment_status = 'REFUNDED' WHERE asaas_payment_id = $1",
      [paymentId]
    );
  } else if (paymentId && eventName === 'PAYMENT_CHARGEBACK_REQUESTED') {
    await query(
      "UPDATE orders SET payment_status = 'CHARGEBACK' WHERE asaas_payment_id = $1",
      [paymentId]
    );
  }

  await query(
    `INSERT INTO asaas_webhook_events (event_id, event_name, payment_id)
     VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventName, paymentId || null]
  );
  return NextResponse.json({ received: true });
}
