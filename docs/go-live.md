# Quetzal go-live checklist

Use this before exposing Quetzal beyond localhost.

## 1. Environment

Copy `.env.example` → `.env` (or Compose env) and set:

| Variable | Required | Notes |
|----------|----------|--------|
| `QUETZAL_DATABASE_URL` | yes | Postgres DSN; schema `quetzal` |
| `NODE_ENV` | yes | `production` (disables demo/quick login) |
| `QUETZAL_BASE_URL` or `QUETZAL_APP_URL` | yes | Public origin, no trailing slash (CSAT + notify links) |
| `QUETZAL_SMTP_*` | for mail | `HOST`, `PORT`, `USER`, `PASS`, `FROM` |
| `QUETZAL_SLACK_WEBHOOK` | optional | Incoming webhook URL |
| `QUETZAL_GITHUB_TOKEN` | for GH outbound | `repo` scope; posts comments on linked issues |
| `QUETZAL_AUTOMATION_CRON_SECRET` | for cron | Bearer for `POST /api/automation/tick` |
| `QUETZAL_DEMO_AUTH` / `QUETZAL_QUICK_LOGIN` | **unset** | Forced off when `NODE_ENV=production` |

Also configure in UI: Settings → Notifications (SMTP/Slack), Integrations (GitHub/Teams/email inbound), LDAP/SSO as needed.

## 2. Database

```bash
export QUETZAL_DATABASE_URL='postgresql://…/quetzal'
npm run migrate
# optional seed
psql "$QUETZAL_DATABASE_URL" -f db/seed.sql
```

Compose first boot creates schema via `db/docker-init/`. Then:

```bash
docker compose exec -T db \
  sh -c 'for f in /migrations/*.sql; do psql -U quetzal -d quetzal -v ON_ERROR_STOP=1 -f "$f"; done'
# or from host against published port:
QUETZAL_DATABASE_URL='postgresql://quetzal:…@127.0.0.1:5433/quetzal' npm run migrate
```

## 3. Secrets & auth

- [ ] Strong `QUETZAL_PG_PASSWORD` (Compose)
- [ ] Local admin has a real password hash (or LDAP/SSO)
- [ ] Disable unused accounts in Admin → Users
- [ ] GitHub webhook secret set when connector enabled
- [ ] Email inbound token rotated and stored in the mail relay

## 4. Backup (Postgres)

```bash
# logical dump (daily cron)
pg_dump "$QUETZAL_DATABASE_URL" -Fc -f "quetzal-$(date +%F).dump"

# restore
pg_restore -d "$QUETZAL_DATABASE_URL" --clean --if-exists quetzal-YYYY-MM-DD.dump
```

Volume backup (Compose): snapshot `quetzal_pg` + `quetzal_uploads`.

## 5. Cron

Every 15 minutes (due dates + helpdesk SLA breach alerts):

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $QUETZAL_AUTOMATION_CRON_SECRET" \
  "$QUETZAL_BASE_URL/api/automation/tick"
```

## 6. Smoke

```bash
curl -fsS "$QUETZAL_BASE_URL/api/health"
# expect { "status": "ok", "db": { "ok": true, … } }
```

Manual: Portal → create request → Helpdesk claim → resolve → CSAT link → Work issue comment → Integrations status tags.

## 7. Docker

```bash
docker compose up --build -d
docker compose logs -f app
```

Pass through env (example):

```bash
QUETZAL_BASE_URL=https://desk.example.com \
QUETZAL_AUTOMATION_CRON_SECRET=… \
QUETZAL_GITHUB_TOKEN=ghp_… \
docker compose up -d
```

See also: `docs/ops-auth-integrations.md`.
