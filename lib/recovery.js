import { createHash } from 'crypto';
import { query } from '@/lib/db';

export function hashRecoveryValue(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export async function allowRecoveryAttempt(fingerprint) {
  const key = hashRecoveryValue(fingerprint);
  const rows = await query(
    `SELECT COUNT(*)::int AS total FROM recovery_attempts
     WHERE fingerprint = $1 AND created_at > now() - interval '1 hour'`,
    [key]
  );
  if ((rows[0]?.total || 0) >= 5) return false;
  await query('INSERT INTO recovery_attempts (fingerprint) VALUES ($1)', [key]);
  return true;
}

export function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return 'e-mail cadastrado';
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return visible + '***@' + domain;
}
