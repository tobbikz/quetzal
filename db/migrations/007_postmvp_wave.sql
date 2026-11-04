-- Helpdesk macros, CSAT, email inbound token, connector stubs metadata

CREATE TABLE IF NOT EXISTS helpdesk_macros (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS helpdesk_csat (
  id BIGSERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
  score SMALLINT CHECK (score IS NULL OR score BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_helpdesk_csat_ticket ON helpdesk_csat (ticket_id);

CREATE TABLE IF NOT EXISTS integration_connectors (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  github_webhook_secret TEXT NOT NULL DEFAULT '',
  github_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  teams_webhook_url TEXT NOT NULL DEFAULT '',
  teams_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_inbound_token TEXT NOT NULL DEFAULT '',
  email_inbound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO integration_connectors (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO helpdesk_macros (name, body, created_at, updated_at)
SELECT 'Acknowledge', 'Thanks for reaching out — we are looking into this and will update you shortly.', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM helpdesk_macros WHERE name = 'Acknowledge');

INSERT INTO helpdesk_macros (name, body, created_at, updated_at)
SELECT 'Need more info', 'Could you share steps to reproduce, expected vs actual behavior, and any screenshots?', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM helpdesk_macros WHERE name = 'Need more info');

INSERT INTO helpdesk_macros (name, body, created_at, updated_at)
SELECT 'Resolved', 'We believe this is resolved. Please confirm or reopen if the issue continues.', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM helpdesk_macros WHERE name = 'Resolved');
