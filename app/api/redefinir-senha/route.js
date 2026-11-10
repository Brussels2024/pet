import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { hashRecoveryValue } from '@/lib/recovery';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const token = String(body.token || '');
  const senha = String(body.senha || '');
  if (token.length < 30 || senha.length < 8) {
    return NextResponse.json({ error: 'Link inválido ou senha com menos de 8 caracteres.' }, { status: 400 });
  }
  const rows = await query(
    `SELECT id, user_id FROM password_resets
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [hashRecoveryValue(token)]
  );
  if (!rows[0]) return NextResponse.json({ error: 'Este link expirou ou já foi utilizado. Solicite outro.' }, { status: 400 });
  const passwordHash = await bcrypt.hash(senha, 10);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, rows[0].user_id]);
  await query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [rows[0].user_id]);
  return NextResponse.json({ ok: true });
}
