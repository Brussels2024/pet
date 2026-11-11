import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './db';

const CUSTOMER_COOKIE = 'bp_session';
const ADMIN_COOKIE = 'bp_admin_session';
const SESSION_SECONDS = 60 * 60 * 12;
const ADMIN_IDLE_SECONDS = 30 * 24 * 60 * 60;

function secret() {
  const raw = process.env.AUTH_SECRET || '';
  if (Buffer.byteLength(raw, 'utf8') < 32) {
    throw new Error('AUTH_SECRET ausente ou muito curta. Configure uma chave aleatória de pelo menos 32 bytes.');
  }
  return new TextEncoder().encode(raw);
}

async function readUserFromToken(token, expectedRole) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (!Number.isInteger(Number(payload.uid)) || payload.role !== expectedRole) return null;
    const rows = await query(
      'SELECT id, email, role, status, session_version, razao_social, nome_fantasia, cnpj, telefone, asaas_customer_id FROM users WHERE id = $1',
      [payload.uid]
    );
    const user = rows[0];
    if (!user || user.role !== expectedRole || Number(payload.sv) !== Number(user.session_version) || user.status === 'bloqueado') return null;
    return user;
  } catch {
    return null;
  }
}

export async function createSession(userId, sessionVersion = 0, role = 'cliente') {
  const isAdmin = role === 'admin';
  const sessionSeconds = isAdmin ? ADMIN_IDLE_SECONDS : SESSION_SECONDS;
  const token = await new SignJWT({ uid: userId, sv: Number(sessionVersion) || 0, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${sessionSeconds}s`)
    .sign(secret());
  const store = await cookies();
  store.set(isAdmin ? ADMIN_COOKIE : CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionSeconds,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
  store.delete(ADMIN_COOKIE);
}

export async function getUser() {
  const store = await cookies();
  return readUserFromToken(store.get(CUSTOMER_COOKIE)?.value, 'cliente');
}

export async function getAdminUser() {
  const store = await cookies();
  const current = await readUserFromToken(store.get(ADMIN_COOKIE)?.value, 'admin');
  if (current) return current;

  // Migra sessões administrativas antigas que ainda usam o cookie compartilhado.
  const legacy = await readUserFromToken(store.get(CUSTOMER_COOKIE)?.value, 'admin');
  if (legacy) {
    await createSession(legacy.id, legacy.session_version, 'admin');
    store.delete(CUSTOMER_COOKIE);
  }
  return legacy;
}

export function canSeePrices(user) {
  return !!user && user.status === 'ativo';
}

export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user || user.status !== 'ativo') notFound();
  return user;
}
