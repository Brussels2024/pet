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

  if (!email || senha.length > 72) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  const rows = await query(
    'SELECT id, password_hash, role, status FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  const user = rows[0];

  let passwordOk = user ? await bcrypt.compare(senha, user.password_hash) : false;

  // Recuperação única do administrador: usa o segredo ADMIN_PASSWORD já configurado
  // na Vercel para gravar o hash no Neon. O marcador no banco impede reutilização.
  const configuredAdminPassword = process.env.ADMIN_PASSWORD || '';
  if (
    !passwordOk &&
    adminLogin &&
    user?.role === 'admin' &&
    user.status !== 'bloqueado' &&
    configuredAdminPassword.length >= 12 &&
    senha === configuredAdminPassword
  ) {
    const newHash = await bcrypt.hash(configuredAdminPassword, 12);
    const recovered = await query(
      `WITH recovery AS (
         INSERT INTO settings (key, value)
         VALUES ('admin_password_recovery_used', 'true')
         ON CONFLICT (key) DO NOTHING
         RETURNING key
       )
       UPDATE users
       SET password_hash = $1
       WHERE id = $2
         AND role = 'admin'
         AND status <> 'bloqueado'
         AND EXISTS (SELECT 1 FROM recovery)
       RETURNING id`,
      [newHash, user.id]
    );
    passwordOk = recovered.length > 0;
  }

  if (!user || !passwordOk) {
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
