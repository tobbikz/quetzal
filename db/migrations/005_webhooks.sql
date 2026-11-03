-- Outbound issue webhooks for Settings → Integrations
CREATE TABLE IF NOT EXISTS webhooks (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT '',
  events JSONB NOT NULL DEFAULT '["issue.status_changed","issue.comment_added"]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks (enabled);
