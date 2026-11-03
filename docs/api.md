# Quetzal public REST API (`/api/v1`)

Machine-to-machine API for issues and wiki pages. Cookie session auth is **not** used here — every request needs a Bearer token.

## Auth

```http
Authorization: Bearer <token>
```

Token sources (either works):

1. **Env** — `QUETZAL_API_TOKEN=…` (plaintext, compared with timing-safe equality).
2. **Table** — `api_tokens` in SQLite (`data/quetzal.db`). Rows store `token_hash` (SHA-256 of the plaintext). Use `createApiToken(name, token)` from `lib/apiAuth.ts` (or insert manually).

Missing/invalid token → `401` with `{ "error": "unauthorized", "hint": "…" }`.

Middleware skips the login cookie gate for `/api/v1/*`.

## Issues

### `GET /api/v1/issues`

List issues.

| Query | Notes |
|-------|--------|
| `project` | Project key (e.g. `OPS`) |
| `status` | `todo` \| `in_progress` \| `in_review` \| `done` |
| `type` | Issue type |
| `q` | Substring search on summary/description/labels |
| `label` | Exact label token |
| `limit` | 1–200 (default 50) |

Response:

```json
{ "issues": [ /* ApiIssue */ ], "count": 12 }
```

### `GET /api/v1/issues/:id`

Fetch one issue by **numeric id** or **key** (`OPS-1`).

### `POST /api/v1/issues`

Create an issue. JSON body:

| Field | Required | Notes |
|-------|----------|--------|
| `projectKey` or `project` | yes | Project key |
| `summary` | yes | |
| `description` | no | |
| `type` | no | default `task` |
| `priority` | no | default `medium` |
| `assigneeId` | no | user id |
| `reporterId` | no | defaults to first admin |
| `labels` | no | string CSV or string array |
| `dueOn` | no | `YYYY-MM-DD` |
| `parentKey` | no | parent issue key |
| `points` | no | number |

`201` + `ApiIssue` on success.

### `ApiIssue` shape

```json
{
  "id": 1,
  "key": "OPS-1",
  "projectKey": "OPS",
  "type": "bug",
  "summary": "…",
  "description": "…",
  "status": "todo",
  "priority": "medium",
  "assigneeId": null,
  "reporterId": 1,
  "sprintId": null,
  "parentId": null,
  "points": null,
  "labels": ["billing"],
  "dueOn": null,
  "createdAt": "…",
  "updatedAt": "…"
}
```

## Pages

### `GET /api/v1/pages/:id`

Fetch a wiki page by **numeric id**.

```json
{
  "id": 1,
  "spaceId": 1,
  "spaceKey": "TEAM",
  "parentId": null,
  "slug": "home",
  "title": "Home",
  "body": "…",
  "authorId": 1,
  "updatedAt": "…"
}
```

## Webhooks

Outbound HTTP callbacks live in the `webhooks` table (`lib/webhooks.ts`).

| Column | Meaning |
|--------|---------|
| `url` | `http(s)` endpoint |
| `secret` | optional; when set, requests include `X-Quetzal-Signature: sha256=<hmac>` |
| `events` | JSON array of events (default both) |
| `enabled` | `1` / `0` |

### Events

| Event | When |
|-------|------|
| `issue.status_changed` | Issue status changes (`updateIssue` / `setIssueStatus`) |
| `issue.comment_added` | Comment added (`addComment`) |

Delivery is `POST` with JSON body:

```json
{
  "event": "issue.status_changed",
  "at": "2026-10-31T09:00:00.000Z",
  "issue": { "id": 1, "key": "OPS-1", "projectKey": "OPS", "summary": "…", "status": "in_progress", "priority": "high", "type": "bug", "assigneeId": 2, "reporterId": 1 },
  "fromStatus": "todo",
  "toStatus": "in_progress",
  "authorId": 1
}
```

Headers: `Content-Type: application/json`, `X-Quetzal-Event: <event>`, optional `X-Quetzal-Signature`.

Helpers: `createWebhook`, `listWebhooks`, `setWebhookEnabled`, `deleteWebhook` in `lib/webhooks.ts`.

## Examples

```bash
export TOKEN=dev-secret
export BASE=http://127.0.0.1:3210

curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/issues?project=OPS&limit=5"

curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/issues/OPS-1"

curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"projectKey":"OPS","summary":"API create smoke","type":"task","priority":"medium"}' \
  "$BASE/api/v1/issues"

curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/v1/pages/1"
```

Set the env token before starting the app:

```bash
export QUETZAL_API_TOKEN=dev-secret
npm run dev
```
