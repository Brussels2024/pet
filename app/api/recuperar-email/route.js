import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { ensureEmailRecoverySchema } from '@/lib/account-recovery';
import { isValidCnpj, onlyDigits } from '@/lib/cnpj';
import { hashRecoveryValue } from '@/lib/recovery';
import { enforceRequestLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'bp_email_recovery';
const COOKIE_TTL_SECONDS = 10 * 60;

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function strongPassword(value) {
  return value.length >= 12 &&
    Buffer.byteLength(value, 'utf8') <= 72 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value);
}

function clearChallenge(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/recuperar-email',
    maxAge: 0,
  });
  return response;
}

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

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  await ensureEmailRecoverySchema();
  await query(
    "UPDATE email_recovery_requests SET status = 'recusada', reviewed_at = now(), requested_password_hash = '' " +
    "WHERE status = 'pendente' AND expires_at <= now()"
  );

  if (body.action === 'validar') {
    const cnpj = onlyDigits(body.cnpj);
    const telefone = onlyDigits(body.telefone);

    if (!isValidCnpj(cnpj) || telefone.length < 10 || telefone.length > 13) {
      return NextResponse.json({ error: 'Confira o CNPJ e o telefone cadastrados.' }, { status: 400 });
    }

    if (!(await enforceRequestLimit(request, 'email-recovery-verify', 5, 60 * 60, cnpj))) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde e tente novamente mais tarde.' }, {
        status: 429,
        headers: { 'Retry-After': '3600' },
      });
    }

    const users = await query(
      'SELECT id FROM users ' +
      "WHERE role = 'cliente' " +
      "AND regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g') = $1 " +
      "AND (regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') = $2 " +
      "OR right(regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g'), 11) = right($2, 11) " +
      "OR right(regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g'), 10) = right($2, 10)) " +
      'LIMIT 1',
      [cnpj, telefone]
    );

    if (!users[0]) {
      return NextResponse.json({ error: 'Não foi possível confirmar os dados. Confira as informações ou fale com o suporte.' }, { status: 400 });
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashRecoveryValue(token);

    await query(
      'WITH invalidated AS (' +
      ' UPDATE email_recovery_challenges SET used_at = now() ' +
      ' WHERE user_id = $1 AND used_at IS NULL RETURNING id' +
      ') INSERT INTO email_recovery_challenges (user_id, token_hash, expires_at) ' +
      "VALUES ($1, $2, now() + interval '10 minutes')",
      [users[0].id, tokenHash]
    );

    const response = NextResponse.json({
      ok: true,
      message: 'Dados conferidos. Informe o novo e-mail e a nova senha. A solicitação será analisada pela equipe Brussels Pet antes de alterar sua conta.',
    });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/recuperar-email',
      maxAge: COOKIE_TTL_SECONDS,
    });
    return response;
  }

  if (body.action === 'solicitar') {
    const token = request.cookies.get(COOKIE_NAME)?.value || '';
    if (token.length < 30 || token.length > 200) {
      return NextResponse.json({ error: 'Sua confirmação expirou. Comece novamente.' }, { status: 401 });
    }

    const novoEmail = String(body.novoEmail || '').trim().toLowerCase();
    const senha = String(body.senha || '');
    const confirmacao = String(body.confirmacao || '');

    if (!validEmail(novoEmail)) {
      return NextResponse.json({ error: 'Informe um novo e-mail válido.' }, { status: 400 });
    }
    if (!strongPassword(senha)) {
      return NextResponse.json({ error: 'A nova senha precisa ter 12 caracteres ou mais, incluindo maiúscula, minúscula, número e símbolo.' }, { status: 400 });
    }
    if (senha !== confirmacao) {
      return NextResponse.json({ error: 'A confirmação da senha não corresponde.' }, { status: 400 });
    }

    if (!(await enforceRequestLimit(request, 'email-recovery-request', 3, 60 * 60, novoEmail))) {
      return NextResponse.json({ error: 'Muitas solicitações. Aguarde e tente novamente mais tarde.' }, {
        status: 429,
        headers: { 'Retry-After': '3600' },
      });
    }

    const tokenHash = hashRecoveryValue(token);
    const challenges = await query(
      'SELECT user_id FROM email_recovery_challenges ' +
      'WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() LIMIT 1',
      [tokenHash]
    );
    if (!challenges[0]) {
      return clearChallenge(NextResponse.json({ error: 'Sua confirmação expirou. Comece novamente.' }, { status: 401 }));
    }

    const existingEmail = await query(
      'SELECT id FROM users WHERE lower(email) = $1 LIMIT 1',
      [novoEmail]
    );
    if (existingEmail.length) {
      return NextResponse.json({ error: 'Este e-mail já está vinculado a uma conta. Informe outro e-mail.' }, { status: 409 });
    }

    const pending = await query(
      "SELECT id FROM email_recovery_requests WHERE user_id = $1 AND status = 'pendente' LIMIT 1",
      [challenges[0].user_id]
    );
    if (pending.length) {
      return clearChallenge(NextResponse.json({
        error: 'Já existe uma solicitação de alteração de acesso aguardando análise. Aguarde a equipe Brussels Pet.',
      }, { status: 409 }));
    }

    const passwordHash = await bcrypt.hash(senha, 12);
    let created;
    try {
      created = await query(
        'WITH consumed AS (' +
        ' UPDATE email_recovery_challenges SET used_at = now() ' +
        ' WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() ' +
        ' RETURNING user_id' +
        '), inserted AS (' +
        ' INSERT INTO email_recovery_requests (user_id, requested_email, requested_password_hash) ' +
        " SELECT user_id, $2, $3 FROM consumed WHERE NOT EXISTS (" +
        " SELECT 1 FROM email_recovery_requests r WHERE r.user_id = consumed.user_id AND r.status = 'pendente'" +
        ' ) RETURNING id' +
        ') SELECT id FROM inserted',
        [tokenHash, novoEmail, passwordHash]
      );
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('unique')) {
        return clearChallenge(NextResponse.json({
          error: 'Já existe uma solicitação aguardando análise para esta conta.',
        }, { status: 409 }));
      }
      throw error;
    }

    if (!created.length) {
      return clearChallenge(NextResponse.json({ error: 'Sua confirmação expirou ou já foi utilizada. Comece novamente.' }, { status: 401 }));
    }

    return clearChallenge(NextResponse.json({
      ok: true,
      message: 'Solicitação enviada para análise. Seus dados atuais continuam válidos até a aprovação. Depois da atualização, você poderá entrar com o novo e-mail e a nova senha.',
    }));
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
