import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { enforceRequestLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const generic = { message: 'Se os dados corresponderem a uma conta, enviaremos um código por SMS para o telefone cadastrado.' };

function normalizeBrazilPhone(value) {
  const digits = String(value || '').replace(/\\D/g, '');
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return '+' + digits;
  return null;
}

async function sendVerification(phone) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Serviço de SMS não configurado.');
  }
  const credentials = Buffer.from(accountSid + ':' + authToken).toString('base64');
  const body = new URLSearchParams({ To: phone, Channel: 'sms' });
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
    { method: 'POST', headers: { Authorization: 'Basic ' + credentials, 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' }
  );
  if (!response.ok) throw new Error('Falha ao solicitar código SMS.');
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
  const at = email.indexOf('@');
  if (at < 1 || at === email.length - 1 || email.lastIndexOf('.') <= at + 1 || email.includes(' ') || email.length > 254) {
    return NextResponse.json(generic);
  }
  if (!(await enforceRequestLimit(request, 'password-recovery-sms', 3, 60 * 60, email))) {
    return NextResponse.json(generic, { status: 429, headers: { 'Retry-After': '3600' } });
  }

  const users = await query('SELECT id, telefone FROM users WHERE email = $1 LIMIT 1', [email]);
  const phone = normalizeBrazilPhone(users[0]?.telefone);
  if (users[0] && phone) {
    try {
      await sendVerification(phone);
    } catch (error) {
      console.error('Falha ao enviar SMS de recuperação:', error);
    }
  }
  return NextResponse.json(generic);
}
