import { createHash } from 'crypto';
import { query } from './db';

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function clientIp(request) {
  const direct = request.headers.get('x-real-ip')?.trim();
  if (direct) return direct.slice(0, 80);
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',').at(-1)?.trim().slice(0, 80) || 'unknown';
  return 'unknown';
}

export async function consumeRateLimitKey(key, limit, windowSeconds) {
  const fingerprint = digest(key);
  const rows = await query(
    `INSERT INTO security_rate_limits (fingerprint, window_started_at, attempts)
     VALUES ($1, now(), 1)
     ON CONFLICT (fingerprint) DO UPDATE SET
       attempts = CASE
         WHEN security_rate_limits.window_started_at <= now() - ($2::int * interval '1 second') THEN 1
         ELSE security_rate_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN security_rate_limits.window_started_at <= now() - ($2::int * interval '1 second') THEN now()
         ELSE security_rate_limits.window_started_at
       END
     RETURNING attempts`,
    [fingerprint, windowSeconds]
  );
  return Number(rows[0]?.attempts || 0) <= limit;
}

export async function enforceRequestLimit(request, scope, limit, windowSeconds, identity = '') {
  const ip = clientIp(request);
  const ipAllowed = await consumeRateLimitKey(`${scope}:ip:${ip}`, Math.max(limit * 4, 20), windowSeconds);
  if (!ipAllowed) return false;
  if (!identity) return true;
  return consumeRateLimitKey(`${scope}:identity:${ip}:${String(identity).slice(0, 200)}`, limit, windowSeconds);
}
