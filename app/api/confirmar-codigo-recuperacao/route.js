import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { query } from '@/lib/db';
import { hashRecoveryValue } from '@/lib/recovery';
import { enforceRequestLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

function normalizeBrazilPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return '+' + digits;
  return null;
}

async function checkVerification(phone, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) throw new Error('Serviço de SMS não configurado.');
  const credentials = Buffer.from(accountSid + ':' + authToken).toString('base64');
  const body = new URLSearchParams({ To: phone, Code: code });
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
    { method: 'POST', headers: { Authorization: 'Basic ' + credentials, 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' }
  );
  if (!response.ok) return false;
  const result = await response.json();
  return result.status === 'approved';
}

export async function POST(request) {
  if (!(await enforceRequestLimit(request, 'password-recovery-sms-check', 5, 15 * 60))) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, { status: 429, headers: { 'Retry-After': '900' } });
  }

  let body;
  try {
    if (Number(request.headers.get('content-length') || 0) > 10000) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 413 });
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').replace(/\D/g, '');
  if (email.length > 254 || code.length !== 6) return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 });

  const users = await query('SELECT id, telefone FROM users WHERE email = $1 LIMIT 1', [email]);
  const user = users[0];
  const phone = normalizeBrazilPhone(user?.telefone);
  if (!user || !phone) return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 });

  let approved = false;
  try {
    approved = await checkVerification(phone, code);
  } catch (error) {
    console.error('Falha ao validar SMS de recuperação:', error);
  }
  if (!approved) return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 });

  const token = randomBytes(32).toString('base64url');
  await query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  await query(
    "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
    [user.id, hashRecoveryValue(token)]
  );
  return NextResponse.json({ ok: true, token });
}
