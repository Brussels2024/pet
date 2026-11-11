import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { query } from '@/lib/db';

const FIELDS = ['telefone', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];
let schemaReady;

function encryptionKey() {
  const encoded = process.env.PII_ENCRYPTION_KEY || '';
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('PII_ENCRYPTION_KEY precisa conter uma chave Base64 de 32 bytes.');
  return key;
}

export async function ensurePiiSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const field of FIELDS) {
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${field}_enc TEXT`);
      }
      await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS telefone_lookup_hash TEXT');
      await query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_enc TEXT');
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export function encryptPii(value) {
  if (value === null || value === undefined || value === '') return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptPii(encrypted, legacyValue = null) {
  if (!encrypted) return legacyValue ?? null;
  const parts = String(encrypted).split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Formato de dado protegido inválido.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(parts[1], 'base64url'));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3], 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function phoneLookupHash(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  return createHmac('sha256', encryptionKey()).update('brussels-pet:phone:' + digits).digest('hex');
}

export async function decryptUserPii(user) {
  if (!user) return user;
  await ensurePiiSchema();
  const result = { ...user };
  for (const field of FIELDS) {
    result[field] = decryptPii(user[field + '_enc'], user[field]);
  }
  return result;
}

export function encryptOrderAddress(address) {
  if (!address) return null;
  return encryptPii(JSON.stringify(address));
}

export function decryptOrderAddress(encrypted, legacyValue = null) {
  if (encrypted) {
    const value = decryptPii(encrypted);
    return value ? JSON.parse(value) : null;
  }
  if (!legacyValue) return null;
  if (typeof legacyValue === 'string') return JSON.parse(legacyValue);
  return legacyValue;
}

export function piiFields() {
  return FIELDS;
}
