import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { enforceRequestLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 10000) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 413 });
    }
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const senha = String(body.senha || '');
  const adminLogin = body.scope === 'admin';
  if (email.length > 254 || senha.length > 72 || !email) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  const allowed = await enforceRequestLimit(
    request,
    adminLogin ? 'admin-login' : 'customer-login',
    adminLogin ? 5 : 8,
    15 * 60,
    email
  );
  if (!allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }

  const rows = await query(
    'SELECT id, password_hash, role, status, session_version FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  const user = rows[0];
  const passwordOk = user ? await bcrypt.compare(senha, user.password_hash) : false;

  if (!user || !passwordOk || (adminLogin && user.role !== 'admin') || user.status === 'bloqueado') {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  if (adminLogin && user.status !== 'ativo') {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  await createSession(user.id, user.session_version, user.role);
  return NextResponse.json({ ok: true, role: user.role });
}
