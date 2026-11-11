import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await getUser();
  if (!user || user.role !== 'admin' || user.status !== 'ativo') {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const url = new URL(request.url);
  if (url.searchParams.get('initial') === '1') {
    const rows = await query('SELECT COALESCE(MAX(id), 0)::int AS latest_id FROM orders');
    return NextResponse.json({ latestId: rows[0]?.latest_id || 0, orders: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const after = Math.max(0, Math.floor(Number(url.searchParams.get('after') || 0)));
  const orders = await query(
    `SELECT id, total, created_at FROM orders WHERE id > $1 ORDER BY id ASC LIMIT 20`,
    [after]
  );
  const latest = orders.length ? orders[orders.length - 1].id : after;
  return NextResponse.json({ latestId: latest, orders }, { headers: { 'Cache-Control': 'no-store' } });
}
