# Quetzal

Open-source **work · wiki · helpdesk** desk for a small company. Apache 2.0.

Not Atlassian, and **not** the Hacienda / facturación “Quetzal FE” product. This repo is the daily ops desk: Portal, Work, Board, Filters (QQL), Calendar, Roadmap, Releases, Dashboards, Wiki, Helpdesk, Automation, Settings (SSO + Integrations).

## Work

- Projects, with a lead
- Issue types: epic, story, task, bug, sub-task
- Status, priority, assignee, reporter, sprint, points, labels, parent
- Active-sprint board (drag a card to change status)
- Backlog grouped by sprint
- Issue detail, field editor, and comments

## Wiki

- Spaces and a page tree
- Editor, page comments
- Templates: blank, meeting, decision, how-to
- Search across issues and pages

## Helpdesk & Portal

- Agent desk (queues, SLA, triage) for helpdesk agents
- Customer portal for requesters
- Automation rules (admin)

## Integrations & auth

- Settings → Integrations: outbound issue/helpdesk webhooks, Slack, Teams, GitHub receiver, email inbound
- Helpdesk: macros, CSAT (`/csat/<token>`), email inbound API
- Settings → LDAP: directory bind + JIT local mirror users
- Ops notes: `docs/ops-auth-integrations.md` · go-live: `docs/go-live.md`
- Notifications: SMTP + Slack (`QUETZAL_SMTP_*`, `QUETZAL_SLACK_WEBHOOK`)
- GitHub: inbound webhook sync + optional outbound comments (`QUETZAL_GITHUB_TOKEN`)
- SSO: SAML ACS + OIDC
- Admin → Users: create local accounts, reset passwords, disable users

Demo local password for seeded users: `quetzal` (e.g. `ana@example.com` / `quetzal`).

## Database

Application data targets **PostgreSQL** database `quetzal`, schema **`quetzal`** (ADR `quetzal-postgres-ssot`).

| Context | DSN |
| --- | --- |
| Local host (peer / trust) | `postgresql://tomy.berrios@127.0.0.1:5432/quetzal` |
| Docker Compose (`db` service) | `postgresql://quetzal:quetzal@db:5432/quetzal` |
| Compose Postgres on host | `postgresql://quetzal:quetzal@127.0.0.1:5433/quetzal` |

```bash
export QUETZAL_DATABASE_URL='postgresql://tomy.berrios@127.0.0.1:5432/quetzal'
# optional alias also accepted by some tooling: DATABASE_URL
psql "$QUETZAL_DATABASE_URL" -f db/migrations/001_init.sql
psql "$QUETZAL_DATABASE_URL" -f db/seed.sql
```

SQLite→Postgres column map: [`docs/db-mapping.md`](docs/db-mapping.md). Compose first-boot runs `db/docker-init/00-create-schema.sql` (schema only). App driver cutover is **QZ-PG-2**; until then local `data/quetzal.db` may still back some modules.

## Run (dev)

```bash
cp .env.example .env   # optional
npm install
npm run dev
```

Open http://127.0.0.1:3210

Health (Postgres ping): http://127.0.0.1:3210/api/health

## Docker

Multi-stage Next image (`output: 'standalone'`) plus Postgres 16:

```bash
# Postgres only (safe while the Next tree is mid-cutover):
docker compose up -d db

# Full stack (needs a green `npm run build` / QZ-PG-2):
docker compose up --build -d
```

Smoke the DSN + JSON logger without the app container:

```bash
QUETZAL_DATABASE_URL='postgresql://quetzal:quetzal@127.0.0.1:5433/quetzal' \
  npx tsx scripts/ops-smoke.ts
```

- App: http://127.0.0.1:3210  
- Health: http://127.0.0.1:3210/api/health — JSON `{ status, db: { ok, latencyMs } }`  
- Logs: structured JSON lines from `lib/log.ts` (`ts`, `level`, `msg`, `service`)

```bash
docker compose logs -f app
curl -sS http://127.0.0.1:3210/api/health
```

After first boot, apply migrations into the Compose DB if not already loaded:

```bash
docker compose exec -T db \
  psql -U quetzal -d quetzal -f /migrations/001_init.sql
```

(Requires `db/migrations/001_init.sql` from the Postgres DDL ticket.)

## Go-live

See [`docs/go-live.md`](docs/go-live.md) for env secrets, backups, cron (`/api/automation/tick`), and smoke checks.
