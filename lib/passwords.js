import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';

const PREFIX = 'sha256-bcrypt$';

export function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Z]/.test(value)) return 'Inclua pelo menos uma letra maiúscula.';
  if (!/[0-9]/.test(value)) return 'Inclua pelo menos um número.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Inclua pelo menos um caractere especial (ex.: ! @ # . , ;).';
  return '';
}

function prehash(password) {
  return createHash('sha256').update(String(password), 'utf8').digest('base64');
}

export async function hashPassword(password) {
  const hash = await bcrypt.hash(prehash(password), 12);
  return PREFIX + hash;
}

export async function verifyPassword(password, storedHash) {
  const value = String(storedHash || '');
  if (value.startsWith(PREFIX)) return bcrypt.compare(prehash(password), value.slice(PREFIX.length));
  // Compatibilidade com senhas antigas armazenadas diretamente em bcrypt.
  if (Buffer.byteLength(String(password), 'utf8') > 72) return false;
  return bcrypt.compare(String(password), value);
}
