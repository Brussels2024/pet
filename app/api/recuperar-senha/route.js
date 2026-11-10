import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { query } from '@/lib/db';
import { allowRecoveryAttempt, hashRecoveryValue } from '@/lib/recovery';
import { sendRecoveryEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await allowRecoveryAttempt('reset:' + ip))) {
    return NextResponse.json({ message: 'Se houver uma conta com esse e-mail, enviaremos as instruções.' });
  }
  const users = await query('SELECT id, email FROM users WHERE email = $1 LIMIT 1', [email]);
  if (users[0]) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashRecoveryValue(token);
    await query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [users[0].id]);
    await query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '15 minutes')`,
      [users[0].id, tokenHash]
    );
    const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const link = `${base.startsWith('http') ? base : 'https://' + base}/redefinir-senha?token=${encodeURIComponent(token)}`;
    try {
      await sendRecoveryEmail({ to: users[0].email, link });
    } catch (error) {
      console.error('Falha ao enviar e-mail de recuperação:', error);
      return NextResponse.json({ error: 'O envio de e-mail ainda não está configurado. Tente novamente mais tarde ou fale com o suporte.' }, { status: 503 });
    }
  }
  return NextResponse.json({ message: 'Se houver uma conta com esse e-mail, enviaremos as instruções.' });
}
