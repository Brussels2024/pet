import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const senha = String(body.senha || '');
  const adminLogin = body.scope === 'admin';

  const rows = await query(
    'SELECT id, password_hash, role, status FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];

  if (!user || !bcrypt.compareSync(senha, user.password_hash)) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }
  // Pelo acesso restrito só administrador entra; para os demais a resposta é igual à de senha errada.
  if (adminLogin && user.role !== 'admin') {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }
  if (user.status === 'bloqueado') {
    return NextResponse.json({ error: 'Esta conta está bloqueada. Fale com a Brussels Pet.' }, { status: 403 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
