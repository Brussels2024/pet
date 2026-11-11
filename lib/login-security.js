import { randomBytes } from 'crypto';
import { query } from '@/lib/db';
import { hashRecoveryValue } from '@/lib/recovery';

let schemaReady;
async function ensureSecurityTables() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS login_security (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        lock_email_sent_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS admin_mfa_challenges (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        challenge_hash TEXT NOT NULL UNIQUE,
        code_hash TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await query('CREATE INDEX IF NOT EXISTS admin_mfa_user_created_idx ON admin_mfa_challenges(user_id, created_at DESC)');
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export async function accountLock(userId) {
  await ensureSecurityTables();
  const rows = await query('SELECT locked_until FROM login_security WHERE user_id = $1 AND locked_until > now()', [userId]);
  return rows[0]?.locked_until || null;
}

export async function recordFailedLogin(userId) {
  await ensureSecurityTables();
  const rows = await query(
    `INSERT INTO login_security (user_id, failed_attempts)
     VALUES ($1, 1)
     ON CONFLICT (user_id) DO UPDATE SET
       failed_attempts = CASE
         WHEN login_security.locked_until IS NOT NULL AND login_security.locked_until <= now() THEN 1
         ELSE login_security.failed_attempts + 1
       END,
       locked_until = CASE
         WHEN (CASE
           WHEN login_security.locked_until IS NOT NULL AND login_security.locked_until <= now() THEN 1
           ELSE login_security.failed_attempts + 1
         END) >= 3 THEN now() + interval '15 minutes'
         ELSE NULL
       END,
       lock_email_sent_at = CASE
         WHEN (CASE
           WHEN login_security.locked_until IS NOT NULL AND login_security.locked_until <= now() THEN 1
           ELSE login_security.failed_attempts + 1
         END) >= 3 AND (
           login_security.locked_until IS NULL OR login_security.locked_until <= now()
         ) AND login_security.lock_email_sent_at IS NULL THEN now()
         WHEN login_security.locked_until IS NOT NULL AND login_security.locked_until <= now() THEN NULL
         ELSE login_security.lock_email_sent_at
       END,
       updated_at = now()
     RETURNING failed_attempts, locked_until,
       (failed_attempts >= 3 AND lock_email_sent_at = updated_at) AS should_notify`,
    [userId]
  );
  return rows[0] || { failed_attempts: 1, locked_until: null, should_notify: false };
}

export async function markLockEmailSent(userId) {
  await ensureSecurityTables();
  await query(
    'UPDATE login_security SET lock_email_sent_at = now() WHERE user_id = $1 AND locked_until > now() AND lock_email_sent_at IS NULL',
    [userId]
  );
}

export async function clearLoginFailures(userId) {
  await ensureSecurityTables();
  await query(
    'INSERT INTO login_security (user_id, failed_attempts, locked_until, lock_email_sent_at, updated_at) VALUES ($1, 0, NULL, NULL, now()) ON CONFLICT (user_id) DO UPDATE SET failed_attempts = 0, locked_until = NULL, lock_email_sent_at = NULL, updated_at = now()',
    [userId]
  );
}

export async function createAdminChallenge(userId, code) {
  await ensureSecurityTables();
  const challenge = randomBytes(32).toString('base64url');
  await query(
    'UPDATE admin_mfa_challenges SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
    [userId]
  );
  await query(
    `INSERT INTO admin_mfa_challenges (user_id, challenge_hash, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '5 minutes')`,
    [userId, hashRecoveryValue(challenge), hashRecoveryValue(`${challenge}:${code}`)]
  );
  return challenge;
}

export async function verifyAdminChallenge(challenge, code) {
  await ensureSecurityTables();
  const challengeHash = hashRecoveryValue(challenge);
  const rows = await query(
    `SELECT id, user_id, code_hash, attempts
     FROM admin_mfa_challenges
     WHERE challenge_hash = $1 AND used_at IS NULL AND expires_at > now() AND attempts < 5
     LIMIT 1`,
    [challengeHash]
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: 'expired' };
  if (hashRecoveryValue(`${challenge}:${code}`) !== row.code_hash) {
    await query(
      'UPDATE admin_mfa_challenges SET attempts = attempts + 1 WHERE id = $1 AND used_at IS NULL AND attempts < 5',
      [row.id]
    );
    return { ok: false, reason: 'invalid' };
  }
  const consumed = await query(
    'UPDATE admin_mfa_challenges SET used_at = now() WHERE id = $1 AND used_at IS NULL AND expires_at > now() AND attempts < 5 RETURNING user_id',
    [row.id]
  );
  return consumed[0] ? { ok: true, userId: consumed[0].user_id } : { ok: false, reason: 'expired' };
}
