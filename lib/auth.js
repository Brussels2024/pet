import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './db';

const COOKIE = 'bp_session';

function secret() {
  const raw =
    process.env.AUTH_SECRET ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    'brussels-pet-dev-secret';
  return new TextEncoder().encode(raw);
}

export async function createSession(userId) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
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
    const { payload } = await jwtVerify(token, secret());
    const rows = await query(
      'SELECT id, email, role, status, razao_social, nome_fantasia, cnpj, telefone, cep, logradouro, numero, complemento, bairro, asaas_customer_id FROM users WHERE id = $1',
      [payload.uid]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// Preços só aparecem para administrador ou cliente com conta ativa.
export function canSeePrices(user) {
  return !!user && (user.role === 'admin' || user.status === 'ativo');
}

// Quem não é administrador recebe "página não encontrada" (404),
// sem nenhuma pista de que o painel existe.
export async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== 'admin') notFound();
  return user;
}
