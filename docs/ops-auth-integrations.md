# Quetzal ops — auth & integrations

## Auth

| Mode | When |
|------|------|
| Local scrypt | User has `auth_source=local` and `password_hash` |
| LDAP | Settings → LDAP enabled; users without local hash (or `auth_source=ldap`) |
| Demo escape hatch | Only if `QUETZAL_DEMO_AUTH=1` **and** `NODE_ENV !== production` and user has **no** password hash |
| Quick login | Only if `QUETZAL_QUICK_LOGIN=1` **and** `NODE_ENV !== production` |

Hardening defaults for production:

- `NODE_ENV=production` **forces off** demo auth and quick login even if env flags are set.
- Leave `QUETZAL_DEMO_AUTH` and `QUETZAL_QUICK_LOGIN` unset.
- Seed local password hashes for operators (`QUETZAL_SEED_PASSWORDS=1` once, or admin tools).
- Prefer LDAP or SSO for org accounts; disable unused users.
- Middleware rate-limits `/login`, portal, CSAT, SSO, and inbound connector APIs.
- Login page warns when any dev escape is active.

Session cookie: `quetzal_auth=1` (gate only). Site cookie: `quetzal_site`.

## Helpdesk extras

- **Macros** — `/helpdesk/macros`; apply from ticket notes.
- **CSAT** — created on resolve/close; public form `/csat/<token>`.
- **Email inbound** — `POST /api/helpdesk/email-inbound` with Bearer token from Settings → Integrations.
  Body: `{ "from", "fromName?", "subject", "text"|"html" }`.

## Connectors

| Connector | Config | Endpoint / behavior |
|-----------|--------|---------------------|
| Slack | Notifications / Integrations | Outbound notify mirror |
| Teams | Integrations | Posts helpdesk notify text to incoming webhook |
| GitHub | Integrations | `POST /api/integrations/github` — sync issues/PRs/comments into Work (`github_default_project`) |
| CSAT report | Helpdesk → CSAT | Avg + distribution + recent scores |
| Outbound webhooks | Integrations | Issue + helpdesk events, HMAC header |

Env overrides (Slack/SMTP): `QUETZAL_SLACK_WEBHOOK`, `QUETZAL_SMTP_*`, `QUETZAL_BASE_URL`.

## Migrations

```bash
npm run migrate
```

Includes `007_postmvp_wave.sql` (macros, CSAT, `integration_connectors`).
