import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './db';

const COOKIE = 'bp_session';
const SESSION_SECONDS = 60 * 60 * 12;

function secret() {
  const raw = process.env.AUTH_SECRET || '';
  if (Buffer.byteLength(raw, 'utf8') < 32) {
    throw new Error('AUTH_SECRET ausente ou muito curta. Configure uma chave aleatória de pelo menos 32 bytes.');
  }
  return new TextEncoder().encode(raw);
}

export async function createSession(userId, sessionVersion = 0) {
  const token = await new SignJWT({ uid: userId, sv: Number(sessionVersion) || 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getUser() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (!Number.isInteger(Number(payload.uid))) return null;
    const rows = await query(
      'SELECT id, email, role, status, session_version, razao_social, nome_fantasia, cnpj, telefone FROM users WHERE id = $1',
      [payload.uid]
    );
    const user = rows[0];
    if (!user || Number(payload.sv) !== Number(user.session_version) || user.status === 'bloqueado') return null;
    return user;
  } catch {
    return null;
  }
}

export function canSeePrices(user) {
  return !!user && user.status === 'ativo';
}

export async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== 'admin' || user.status !== 'ativo') notFound();
  return user;
}
