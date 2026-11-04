-- Local password auth + LDAP directory settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_source TEXT NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.password_hash IS 'scrypt hash (salt:hex$derived:hex). Null for LDAP-only accounts.';
COMMENT ON COLUMN users.auth_source IS 'local | ldap';

CREATE TABLE IF NOT EXISTS ldap_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  url TEXT NOT NULL DEFAULT 'ldap://127.0.0.1:389',
  bind_dn TEXT NOT NULL DEFAULT '',
  bind_password TEXT NOT NULL DEFAULT '',
  base_dn TEXT NOT NULL DEFAULT '',
  user_filter TEXT NOT NULL DEFAULT '(uid={{username}})',
  email_attr TEXT NOT NULL DEFAULT 'mail',
  name_attr TEXT NOT NULL DEFAULT 'cn',
  start_tls BOOLEAN NOT NULL DEFAULT FALSE,
  default_role TEXT NOT NULL DEFAULT 'member',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ldap_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
