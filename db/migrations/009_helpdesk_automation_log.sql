CREATE TABLE IF NOT EXISTS helpdesk_automation_log (
  id BIGSERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_automation_log_kind
  ON helpdesk_automation_log (kind, created_at DESC);
