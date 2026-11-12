import { query } from '@/lib/db';

let ready;
export async function ensureEmailRecoverySchema() {
  if (!ready) {
    ready = (async () => {
      await query(`CREATE TABLE IF NOT EXISTS email_recovery_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_email TEXT NOT NULL,
        requested_password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_at TIMESTAMPTZ
      )`);
      await query(`CREATE INDEX IF NOT EXISTS email_recovery_requests_status_created_idx ON email_recovery_requests(status, created_at DESC)`);
    })().catch((error) => { ready = null; throw error; });
  }
  return ready;
}
