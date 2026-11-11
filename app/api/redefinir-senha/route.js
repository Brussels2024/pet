import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashRecoveryValue } from '@/lib/recovery';
import { enforceRequestLimit } from '@/lib/security';
import { clearLoginFailures } from '@/lib/login-security';
import { hashPassword, validatePassword } from '@/lib/passwords';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!(await enforceRequestLimit(request, 'password-reset', 10, 60 * 60))) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde e tente novamente.' }, { status: 429, headers: { 'Retry-After': '3600' } });
  }
  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 10000) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 413 });
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const token = String(body.token || '');
  const senha = String(body.senha || '');
  const passwordError = validatePassword(senha);
  if (token.length < 30 || token.length > 200 || passwordError) {
    return NextResponse.json({ error: passwordError || 'Link inválido. Solicite outro.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(senha);
  const changed = await query(
    `WITH consumed AS (
       UPDATE password_resets SET used_at = now()
       WHERE id = (
         SELECT id FROM password_resets
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE SKIP LOCKED
       )
       AND used_at IS NULL AND expires_at > now()
       RETURNING user_id
     )
     UPDATE users
     SET password_hash = $2, session_version = session_version + 1
     WHERE id = (SELECT user_id FROM consumed)
     RETURNING id`,
    [hashRecoveryValue(token), passwordHash]
  );
  if (!changed.length) return NextResponse.json({ error: 'Este link expirou ou já foi utilizado. Solicite outro.' }, { status: 400 });

  await clearLoginFailures(changed[0].id);
  return NextResponse.json({ ok: true });
}
