import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await getAdminUser();
  if (!user || user.status !== 'ativo') {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const url = new URL(request.url);
  if (url.searchParams.get('initial') === '1') {
    const rows = await query(
      `SELECT n.id, n.order_id, n.event_type, n.created_at, o.total
         FROM admin_notifications n
         JOIN orders o ON o.id = n.order_id
        WHERE n.created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY n.id DESC
        LIMIT 20`
    );
    const notifications = rows.reverse();
    const latestRows = await query('SELECT COALESCE(MAX(id), 0)::int AS latest_id FROM admin_notifications');
    return NextResponse.json({
      latestId: latestRows[0]?.latest_id || 0,
      notifications
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const after = Math.max(0, Math.floor(Number(url.searchParams.get('after') || 0)));
  const notifications = await query(
    `SELECT n.id, n.order_id, n.event_type, n.created_at, o.total
       FROM admin_notifications n
       JOIN orders o ON o.id = n.order_id
      WHERE n.id > $1
      ORDER BY n.id ASC
      LIMIT 30`,
    [after]
  );
  const latest = notifications.length ? notifications[notifications.length - 1].id : after;
  return NextResponse.json({ latestId: latest, notifications }, { headers: { 'Cache-Control': 'no-store' } });
}
