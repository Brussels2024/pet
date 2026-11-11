import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';

const PREFIX = 'sha256-bcrypt$';

function prehash(password) {
  return createHash('sha256').update(String(password), 'utf8').digest('base64');
}

export async function verifyPassword(password, storedHash) {
  const value = String(storedHash || '');
  if (value.startsWith(PREFIX)) {
    return bcrypt.compare(prehash(password), value.slice(PREFIX.length));
  }
  if (Buffer.byteLength(String(password), 'utf8') > 72) return false;
  return bcrypt.compare(String(password), value);
}
