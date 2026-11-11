import { query } from '@/lib/db';

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

