import { query } from '@/lib/db';

let ready;

export async function ensureEmailRecoverySchema() {
  if (!ready) {
    ready = (async () => {
      await query(
        'CREATE TABLE IF NOT EXISTS email_recovery_challenges (' +
        'id SERIAL PRIMARY KEY, ' +
        'user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, ' +
        'token_hash TEXT NOT NULL UNIQUE, ' +
        'expires_at TIMESTAMPTZ NOT NULL, ' +
        'used_at TIMESTAMPTZ, ' +
        'created_at TIMESTAMPTZ NOT NULL DEFAULT now())'
      );
      await query(
        'CREATE INDEX IF NOT EXISTS email_recovery_challenges_user_idx ' +
        'ON email_recovery_challenges(user_id, created_at DESC)'
      );
      await query(
        'CREATE TABLE IF NOT EXISTS email_recovery_requests (' +
        'id SERIAL PRIMARY KEY, ' +
        'user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, ' +
        'requested_email TEXT NOT NULL, ' +
        'requested_password_hash TEXT NOT NULL, ' +
        "status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')), " +
        'created_at TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        'reviewed_at TIMESTAMPTZ)'
      );
      await query(
        'ALTER TABLE email_recovery_requests ADD COLUMN IF NOT EXISTS ' +
        'reviewed_by INTEGER REFERENCES users(id)'
      );
      await query(
        'CREATE INDEX IF NOT EXISTS email_recovery_requests_status_created_idx ' +
        'ON email_recovery_requests(status, created_at DESC)'
      );
      await query(
        'CREATE UNIQUE INDEX IF NOT EXISTS email_recovery_requests_one_pending_idx ' +
        "ON email_recovery_requests(user_id) WHERE status = 'pendente'"
      );
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
