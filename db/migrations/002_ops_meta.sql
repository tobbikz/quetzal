-- QZ-HARD-1: lightweight ops marker table (idempotent).
CREATE TABLE IF NOT EXISTS ops_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ops_meta (key, value)
VALUES ('hardening', 'migrations-backup-rate-limit')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();
