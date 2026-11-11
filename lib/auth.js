import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './db';
import { decryptUserPii, ensurePiiSchema } from './pii';

const CUSTOMER_COOKIE = 'bp_session';
const ADMIN_COOKIE = 'bp_admin_session';
const SESSION_SECONDS = 60 * 60 * 12;
const ADMIN_IDLE_SECONDS = 30 * 24 * 60 * 60;
let adminMfaMigration;

async function enforceAdminMfaEpoch() {
  if (!adminMfaMigration) {
    adminMfaMigration = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS app_security_migrations (
        migration_key TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`WITH first_run AS (
        INSERT INTO app_security_migrations (migration_key)
        VALUES ('admin-mfa-v1')
        ON CONFLICT (migration_key) DO NOTHING
        RETURNING migration_key
      )
      UPDATE users SET session_version = session_version + 1
      WHERE role = 'admin' AND EXISTS (SELECT 1 FROM first_run)`);
    })().catch((error) => { adminMfaMigration = null; throw error; });
  }
  return adminMfaMigration;
}

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
    await ensurePiiSchema();
    const rows = await query(
      'SELECT id, email, role, status, session_version, razao_social, nome_fantasia, cnpj, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf, telefone_enc, cep_enc, logradouro_enc, numero_enc, complemento_enc, bairro_enc, cidade_enc, uf_enc, asaas_customer_id FROM users WHERE id = $1',
      [payload.uid]
    );
    const user = rows[0];
    if (!user || user.role !== expectedRole || Number(payload.sv) !== Number(user.session_version) || user.status === 'bloqueado') return null;
    return await decryptUserPii(user);
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
  if (isAdmin) store.delete(CUSTOMER_COOKIE);
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
  // Invalida sessões administrativas antigas para exigir senha + SMS após ativar MFA.
  await enforceAdminMfaEpoch();
  const store = await cookies();
  return readUserFromToken(store.get(ADMIN_COOKIE)?.value, 'admin');
}

export function canSeePrices(user) {
  return !!user && user.status === 'ativo';
}

export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user || user.status !== 'ativo') notFound();
  return user;
}
