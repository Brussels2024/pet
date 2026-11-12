import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendAdminPush } from '@/lib/admin-push';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 503 });

  const received = request.headers.get('asaas-access-token') || '';
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
  }

  const eventId = String(body?.id || '').trim();
  const eventName = String(body?.event || '').trim();
  const paymentId = String(body?.payment?.id || '').trim() || null;
  if (!eventId || !eventName) return NextResponse.json({ error: 'Evento incompleto.' }, { status: 400 });

  // Registro do evento e atualização do pedido são uma única instrução:
  // eventos repetidos não reaplicam alterações e falhas não consomem o evento.
  const result = await query(
    `WITH accepted AS (
       INSERT INTO asaas_webhook_events (event_id, event_name, payment_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id
     ),
     updated AS (
       UPDATE orders
          SET payment_status = CASE
                WHEN $2 IN ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') THEN 'RECEIVED'
                WHEN $2 = 'PAYMENT_OVERDUE' THEN 'OVERDUE'
                WHEN $2 IN ('PAYMENT_DELETED', 'PAYMENT_CANCELED') THEN 'CANCELED'
                WHEN $2 IN ('PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED') THEN 'REFUNDED'
                WHEN $2 IN ('PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL') THEN 'CHARGEBACK'
                ELSE payment_status
              END,
              status = CASE
                WHEN $2 IN ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED')
                  AND status NOT IN ('cancelado', 'entregue', 'enviado') THEN 'pago'
                ELSE status
              END
        WHERE asaas_payment_id = $3
          AND $3 IS NOT NULL
          AND $2 IN (
            'PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE',
            'PAYMENT_DELETED', 'PAYMENT_CANCELED', 'PAYMENT_REFUNDED',
            'PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED',
            'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
          )
          AND EXISTS (SELECT 1 FROM accepted)
       RETURNING id
     )
     , notified AS (
       INSERT INTO admin_notifications (order_id, event_type)
       SELECT o.id, 'purchase_paid'
         FROM orders o
        WHERE o.asaas_payment_id = $3
          AND $2 IN ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED')
          AND EXISTS (SELECT 1 FROM updated)
       ON CONFLICT (order_id, event_type) DO NOTHING
       RETURNING id
     )
     SELECT EXISTS(SELECT 1 FROM accepted) AS accepted,
            (SELECT COUNT(*)::int FROM updated) AS updated_count`,
    [eventId, eventName, paymentId]
  );

  const accepted = Boolean(result[0]?.accepted);
  if (accepted && Number(result[0]?.updated_count || 0) > 0 && ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(eventName)) {
    const orderRows = await query('SELECT id FROM orders WHERE asaas_payment_id = $1 LIMIT 1', [paymentId]);
    if (orderRows[0]?.id) {
      const items = await query('SELECT name, qty, color_name, color_sku FROM order_items WHERE order_id = $1 ORDER BY id', [orderRows[0].id]);
      await sendAdminPush({ type: 'purchase_paid', orderId: orderRows[0].id, items });
    }
  }
  return NextResponse.json({ received: true, duplicate: !accepted });
}
