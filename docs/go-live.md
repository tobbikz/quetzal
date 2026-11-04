# Quetzal go-live checklist

## Secrets

| Variable | Notes |
|----------|--------|
| `QUETZAL_PG_PASSWORD` | Strong password for Compose Postgres |
| `QUETZAL_AUTOMATION_CRON_SECRET` | Long random; required by Compose cron |
| `QUETZAL_GITHUB_TOKEN` | Optional; **new** fine-grained PAT only — never reuse a leaked token; never commit |
| `QUETZAL_DEMO_AUTH` / `QUETZAL_QUICK_LOGIN` | Must be `0` / unset. Compose forces `0` |

Local secrets live in **`.env`** (gitignored).

## Deploy (Compose)

```bash
cp .env.example .env   # set password + cron secret
docker compose up --build -d
curl -fsS "${QUETZAL_BASE_URL:-http://127.0.0.1:3210}/api/health"
./scripts/docker-smoke.sh
```

Stack: **Postgres** + **migrate** + **app** (`NODE_ENV=production`) + **Mailpit** + **cron** (tick every 15m).

Set `QUETZAL_BASE_URL` to your public origin when exposing beyond localhost.

## Mail

Compose defaults SMTP to **Mailpit** (`mail:1025`, UI `:8025`).  
For a real provider, set `QUETZAL_SMTP_HOST/PORT/USER/PASS/FROM` in `.env`.

## Cron

The `cron` service POSTs every 15 minutes:

```http
POST /api/automation/tick
Authorization: Bearer $QUETZAL_AUTOMATION_CRON_SECRET
```

Runs due-date automations + helpdesk SLA breach alerts.

## Smoke

```bash
export QUETZAL_AUTOMATION_CRON_SECRET=…   # from .env
./scripts/docker-smoke.sh
```

Manual: Portal → request → Helpdesk claim → resolve → CSAT link → Mailpit for outbound mail.
