import { query } from '@/lib/db';

let schemaReady;
async function ensureSecurityTables() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS login_security (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
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
         END) >= 3 THEN now() + interval '5 minutes'
         ELSE NULL
       END,
       updated_at = now()
     RETURNING failed_attempts, locked_until`,
    [userId]
  );
  return rows[0] || { failed_attempts: 1, locked_until: null };
}

export async function clearLoginFailures(userId) {
  await ensureSecurityTables();
  await query(
    'INSERT INTO login_security (user_id, failed_attempts, locked_until, updated_at) VALUES ($1, 0, NULL, now()) ON CONFLICT (user_id) DO UPDATE SET failed_attempts = 0, locked_until = NULL, updated_at = now()',
    [userId]
  );
}
