import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { enforceRequestLimit } from '@/lib/security';
import { verifyPassword } from '@/lib/passwords';
import { accountLock, clearLoginFailures, recordFailedLogin } from '@/lib/login-security';

export const dynamic = 'force-dynamic';

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
      { error: 'Conta bloqueada por 5 minutos após três tentativas de senha incorreta. Aguarde o desbloqueio para tentar novamente.' },
      { status: 401 }
    );
  }

  const passwordOk = await verifyPassword(senha, user.password_hash);
  if (!passwordOk) {
    const result = await recordFailedLogin(user.id);
    if (result.locked_until) {
      return NextResponse.json(
        { error: 'Conta bloqueada por 5 minutos após três tentativas de senha incorreta. Aguarde o desbloqueio para tentar novamente.' },
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
