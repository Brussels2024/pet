import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { query } from '@/lib/db';
import { hashRecoveryValue } from '@/lib/recovery';
import { sendRecoveryEmail } from '@/lib/mailer';
import { enforceRequestLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const generic = { message: 'Se houver uma conta com esse e-mail, enviaremos as instruções.' };

export async function POST(request) {
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 10000) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 413 });
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const at = email.indexOf('@');
  if (at < 1 || at === email.length - 1 || email.lastIndexOf('.') <= at + 1 || email.includes(' ') || email.length > 254) {
    return NextResponse.json(generic);
  }
  if (!(await enforceRequestLimit(request, 'password-recovery', 5, 60 * 60, email))) {
    return NextResponse.json(generic, { status: 429, headers: { 'Retry-After': '3600' } });
  }

  const users = await query('SELECT id, email FROM users WHERE email = $1 LIMIT 1', [email]);
  if (!users[0]) return NextResponse.json(generic);

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashRecoveryValue(token);
  await query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [users[0].id]);
  await query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) ' +
    "VALUES ($1, $2, now() + interval '15 minutes')",
    [users[0].id, tokenHash]
  );

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
      : process.env.VERCEL_URL
        ? 'https://' + process.env.VERCEL_URL
        : '';
    if (!base) throw new Error('URL pública não configurada.');
    const link = base + '/redefinir-senha?token=' + encodeURIComponent(token);
    await sendRecoveryEmail({ to: users[0].email, link });
  } catch (error) {
    console.error('Falha no envio de recuperação:', error);
  }
  return NextResponse.json(generic);
}
