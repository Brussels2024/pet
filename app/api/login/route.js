import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { enforceRequestLimit } from '@/lib/security';
import { verifyPassword } from '@/lib/passwords';
import { accountLock, clearLoginFailures, recordFailedLogin } from '@/lib/login-security';
import { sendAccountLockedEmail } from '@/lib/mailer';
import { randomBytes } from 'crypto';
import { hashRecoveryValue } from '@/lib/recovery';

export const dynamic = 'force-dynamic';

async function createLockRecoveryLink(user) {
  const token = randomBytes(32).toString('base64url');
  await query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  await query(
    "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '15 minutes')",
    [user.id, hashRecoveryValue(token)]
  );
  const base = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '';
  if (!base) throw new Error('URL pública não configurada.');
  const link = base + '/redefinir-senha?token=' + encodeURIComponent(token);
  return link;
}

export async function POST(request) {
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 10000) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 413 });
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const senha = String(body.senha || '');
  const adminLogin = body.scope === 'admin';
  if (email.length > 254 || !email || senha.length > 4096) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  const allowed = await enforceRequestLimit(request, adminLogin ? 'admin-login' : 'customer-login', adminLogin ? 5 : 8, 15 * 60, email);
  if (!allowed) return NextResponse.json(
    { error: 'Muitas tentativas. Aguarde e tente novamente.' },
    { status: 429, headers: { 'Retry-After': '900' } }
  );

  const rows = await query(
    'SELECT id, email, password_hash, role, status, session_version, nome_fantasia, razao_social FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  const user = rows[0];
  if (!user || user.status === 'bloqueado') {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  const lockedUntil = await accountLock(user.id);
  if (lockedUntil) {
    return NextResponse.json(
      { error: 'E-mail ou senha incorretos. Se sua conta estiver bloqueada, confira o e-mail cadastrado.' },
      { status: 401 }
    );
  }

  const passwordOk = await verifyPassword(senha, user.password_hash);
  if (!passwordOk) {
    const result = await recordFailedLogin(user.id);
    if (result.should_notify) {
      let recoveryLink = '';
      try {
        recoveryLink = await createLockRecoveryLink(user);
      } catch (error) {
        console.error('Falha ao criar link de recuperação:', error);
      }

      if (recoveryLink) {
        try {
          await sendAccountLockedEmail({ to: user.email, link: recoveryLink });
        } catch (error) {
          console.error('Falha ao enviar alerta de bloqueio para a conta:', error);
        }
      }
    }
    if (result.locked_until) {
      return NextResponse.json(
        { error: 'E-mail ou senha incorretos. Se sua conta estiver bloqueada, confira o e-mail cadastrado.' },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  if ((adminLogin && user.role !== 'admin') || (!adminLogin && user.role !== 'cliente') || (adminLogin && user.status !== 'ativo')) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  await clearLoginFailures(user.id);

  await createSession(user.id, user.session_version, user.role);
  return NextResponse.json({ ok: true, role: user.role });
}
