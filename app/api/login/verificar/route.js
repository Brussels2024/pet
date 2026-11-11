import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { verifyAdminChallenge } from '@/lib/login-security';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 2000) return NextResponse.json({ error: 'Código inválido.' }, { status: 413 });
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
  }

  const code = String(body.code || '').trim();
  const store = await cookies();
  const challenge = store.get('bp_admin_mfa')?.value || '';
  if (!/^\d{6}$/.test(code) || challenge.length < 30) {
    return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 });
  }

  const result = await verifyAdminChallenge(challenge, code);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === 'expired' ? 'Código expirado ou limite de tentativas atingido. Faça login novamente.' : 'Código incorreto. Confira o SMS e tente novamente.' },
      { status: 401 }
    );
  }

  const users = await query(
    "SELECT id, session_version FROM users WHERE id = $1 AND role = 'admin' AND status = 'ativo' LIMIT 1",
    [result.userId]
  );
  if (!users[0]) {
    store.delete('bp_admin_mfa');
    return NextResponse.json({ error: 'Não foi possível concluir o acesso.' }, { status: 401 });
  }

  await createSession(users[0].id, users[0].session_version, 'admin');
  const response = NextResponse.json({ ok: true });
  response.cookies.set('bp_admin_mfa', '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/login', maxAge: 0 });
  return response;
}
