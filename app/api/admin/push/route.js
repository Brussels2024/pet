import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAdminUser();
  if (!user || user.status !== 'ativo') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: 'Notificações push não configuradas.' }, { status: 503 });
  return NextResponse.json({ publicKey }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  const user = await getAdminUser();
  if (!user || user.status !== 'ativo') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  let subscription;
  try { subscription = await request.json(); } catch {
    return NextResponse.json({ error: 'Inscrição inválida.' }, { status: 400 });
  }
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Dados da inscrição incompletos.' }, { status: 400 });
  }
  await query(
    `INSERT INTO admin_push_subscriptions (endpoint, subscription)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (endpoint) DO UPDATE
       SET subscription = EXCLUDED.subscription, updated_at = now()`,
    [subscription.endpoint, JSON.stringify(subscription)]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const user = await getAdminUser();
  if (!user || user.status !== 'ativo') return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (body.endpoint) await query('DELETE FROM admin_push_subscriptions WHERE endpoint = $1', [body.endpoint]);
  return NextResponse.json({ ok: true });
}
