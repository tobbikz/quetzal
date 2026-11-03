# Quetzal SQLite → PostgreSQL mapping

ADR: `quetzal-postgres-ssot` · Ticket: **QZ-PG-1**  
Target: database `quetzal`, schema `quetzal` · DSN env: `QUETZAL_DATABASE_URL`

## Conventions

| SQLite | PostgreSQL |
|--------|------------|
| `INTEGER PRIMARY KEY` (autoincrement) | `SERIAL` / `BIGSERIAL` |
| Composite / natural PK (no auto id) | Same composite / `TEXT` PK |
| `INTEGER` 0/1 flags | `BOOLEAN` |
| ISO timestamps as `TEXT` | `TIMESTAMPTZ` |
| Date-only `TEXT` (`YYYY-MM-DD`) | `DATE` |
| Time-only `TEXT` | `TIME` |
| JSON in `TEXT` (`conditions`, `actions`, `*_json`) | `JSONB` |
| Unstructured long text | `TEXT` (unchanged) |
| Labels CSV in `TEXT` | `TEXT` (unchanged; array later optional) |

App rewrite (driver + SQL dialect) is **QZ-PG-2** — this doc is the schema contract only.

## Inventory by source module

| Module | Tables |
|--------|--------|
| `lib/db.ts` | `users`, `projects`, `sprints`, `issues`, `comments`, `spaces`, `pages`, `page_comments`, `activity`, `worklogs`, `workflows`, `workflow_steps`, `reactions`, `reaction_marks`, `issue_watchers`, `calendar_event_types`, `calendar_events`, `space_members`, `notifications`, `issue_links` |
| `lib/sites.ts` | `sites`, `site_members`; ALTERs `projects.site_id`, `spaces.site_id` |
| `lib/versions.ts` | `components`, `versions`; ALTERs `issues.component_id`, `issues.fix_version_id` |
| `lib/workflows.ts` | `workflows`, `workflow_statuses`, `workflow_transitions` (+ sync `workflow_steps`) |
| `lib/permissions.ts` | `permission_schemes`, `permission_scheme_grants`, `project_roles`, `project_role_members`, `space_permissions`, `page_permissions`; ALTER `projects.permission_scheme_id` |
| `lib/wikiExtras.ts` | `page_labels`, `page_attachments`, `page_versions`, `page_properties`, `page_templates`, `page_revisions`, `wiki_page_meta` |
| `lib/watchers.ts` | `issue_watchers`, `issue_votes` |
| `lib/timeTracking.ts` | `worklogs` (canonical `user_id`; mig from `author_id`) |
| `lib/dashboards.ts` | `dashboards`, `dashboard_gadgets` |
| `lib/notify.ts` | `notification_channels` |
| `lib/customFields.ts` | `custom_fields`, `screens`, `screen_fields`, `field_contexts`, `issue_custom_values` |
| `lib/automation.ts` | `automation_rules`, `automation_runs` |
| `lib/audit.ts` | `audit_log` |
| `lib/sso.ts` | `sso_settings` (+ OIDC columns) |
| `lib/savedFilters.ts` | `saved_filters` |
| `lib/helpdesk.ts` | `helpdesk_tickets`, `helpdesk_notes`, `sla_policies` |
| `lib/portal.ts` | `request_types` |

Excluded (migration scratch only): `worklogs_mig`, `sla_policies_new`.

## Table-by-table

### `users`

| Column | SQLite | Postgres |
|--------|--------|----------|
| id | INTEGER PK | SERIAL PK |
| name, email, role | TEXT | TEXT |

Index: `idx_users_email_lower` on `lower(email)`.

### `sites` / `site_members`

| Column | SQLite | Postgres |
|--------|--------|----------|
| sites.id | INTEGER PK | SERIAL PK |
| sites.key | TEXT UNIQUE | TEXT UNIQUE |
| sites.name | TEXT | TEXT |
| site_members | (site_id, user_id) PK + FKs | same + FK indexes |

### `workflows` / `workflow_statuses` / `workflow_transitions` / `workflow_steps`

| Column | SQLite | Postgres |
|--------|--------|----------|
| workflows.id | INTEGER PK | SERIAL PK |
| workflow_statuses.* | TEXT/INTEGER | TEXT/INTEGER; SERIAL PK |
| transitions.conditions_json / validators_json | TEXT JSON | **JSONB** |
| workflow_steps | composite PK | same (legacy edge list) |

### `permission_schemes` / `permission_scheme_grants` / `project_roles` / `project_role_members` / `space_permissions` / `page_permissions`

Composite grant PKs and FKs preserved. `projects.permission_scheme_id` → `permission_schemes(id)`.

### `projects`

| Column | SQLite | Postgres |
|--------|--------|----------|
| id | INTEGER PK | SERIAL PK |
| key | TEXT UNIQUE | TEXT UNIQUE |
| name, description | TEXT | TEXT |
| lead_id | INTEGER | INTEGER **FK → users** |
| next_num | INTEGER | INTEGER |
| workflow_id | INTEGER (ALTER) | INTEGER FK → workflows |
| site_id | INTEGER (ALTER) | INTEGER FK → sites |
| permission_scheme_id | INTEGER (ALTER) | INTEGER FK → permission_schemes |

### `sprints`

Unchanged semantics; `project_id` FK CASCADE; SERIAL PK.

### `components` / `versions`

| Column | SQLite | Postgres |
|--------|--------|----------|
| versions.released | INTEGER 0/1 | **BOOLEAN** |
| versions.release_date | TEXT | **DATE** |

### `issues`

| Column | SQLite | Postgres |
|--------|--------|----------|
| id | INTEGER PK | SERIAL PK |
| created_at / updated_at | TEXT | **TIMESTAMPTZ** |
| due_on / start_on | TEXT | **DATE** |
| component_id / fix_version_id | INTEGER (ALTER) | FK SET NULL |
| original_estimate_minutes / remaining_minutes | INTEGER (ALTER) | INTEGER |
| labels | TEXT CSV | TEXT |
| UNIQUE(project_id, num) | yes | yes |

### `comments` / `activity` / `worklogs`

| Column | SQLite | Postgres |
|--------|--------|----------|
| id | INTEGER PK | **BIGSERIAL** PK |
| created_at | TEXT | TIMESTAMPTZ |
| comments.parent_id | INTEGER (ALTER) | BIGINT FK → comments |
| worklogs.user_id | INTEGER (was author_id) | INTEGER FK → users |

### `reactions` / `reaction_marks` / `issue_watchers` / `issue_votes` / `issue_links`

Uniques and composite PKs preserved. Timestamps → TIMESTAMPTZ. `issue_votes` is defined in `lib/watchers.ts` (may be empty in older SQLite files).

### `calendar_event_types` / `calendar_events`

| Column | SQLite | Postgres |
|--------|--------|----------|
| is_system | INTEGER 0/1 | **BOOLEAN** |
| starts_on / ends_on | TEXT | **DATE** |
| start_time / end_time | TEXT | **TIME** |
| created_at / updated_at | TEXT | TIMESTAMPTZ |

### `spaces` / `pages` / wiki extras

| Column | SQLite | Postgres |
|--------|--------|----------|
| spaces.kind | TEXT DEFAULT 'team' | TEXT |
| spaces.owner_user_id / site_id | INTEGER (ALTER) | FK |
| pages.updated_at | TEXT | TIMESTAMPTZ |
| page_versions + page_revisions | both present | both tables kept |
| wiki_page_meta.deleted_at | TEXT | TIMESTAMPTZ |
| page_attachments.size | INTEGER | INTEGER |

### `notifications` / `notification_channels`

| Column | SQLite | Postgres |
|--------|--------|----------|
| notifications.read_at / created_at | TEXT | TIMESTAMPTZ |
| mail_enabled / slack_enabled | INTEGER 0/1 | **BOOLEAN** |
| notification_channels.id | CHECK (id = 1) | same |

### `sso_settings`

| Column | SQLite | Postgres |
|--------|--------|----------|
| enabled | INTEGER 0/1 | **BOOLEAN** |
| oidc_* | TEXT (ALTER) | TEXT |
| updated_at | TEXT | TIMESTAMPTZ |
| id | CHECK (id = 1) | same |

### `audit_log` / `saved_filters` / `dashboards` / `dashboard_gadgets`

| Column | SQLite | Postgres |
|--------|--------|----------|
| audit_log.id | INTEGER | BIGSERIAL |
| created_at | TEXT | TIMESTAMPTZ |
| dashboard_gadgets.config_json | TEXT | **JSONB** |

### `custom_fields` family

| Column | SQLite | Postgres |
|--------|--------|----------|
| options_json | TEXT | **JSONB** |
| screen_fields.required | INTEGER 0/1 | **BOOLEAN** |
| issue_custom_values.issue_id | INTEGER (no FK in SQLite) | **FK → issues** |
| field_contexts.project_id | INTEGER UNIQUE | UNIQUE + **FK → projects** |

### `automation_rules` / `automation_runs`

| Column | SQLite | Postgres |
|--------|--------|----------|
| enabled | INTEGER 0/1 | **BOOLEAN** |
| conditions / actions | TEXT JSON | **JSONB** |
| automation_runs.rule_id | INTEGER (no FK) | **FK → automation_rules** CASCADE |
| runs.id | INTEGER | BIGSERIAL |

### `helpdesk_tickets` / `helpdesk_notes` / `sla_policies` / `request_types`

| Column | SQLite | Postgres |
|--------|--------|----------|
| sla_breached | INTEGER 0/1 | **BOOLEAN** |
| due / response_due / resolve_due / *_met_at | TEXT | **TIMESTAMPTZ** |
| site_id | INTEGER (ALTER) | FK → sites |
| sla_policies | PK (type, priority) | same |
| request_types.key | TEXT PK | TEXT PK |

## Apply

```bash
export QUETZAL_DATABASE_URL='postgresql://tomy.berrios@127.0.0.1:5432/quetzal'
psql "$QUETZAL_DATABASE_URL" -f db/migrations/001_init.sql
psql "$QUETZAL_DATABASE_URL" -f db/seed.sql
```

## Verification

```sql
SET search_path TO quetzal;
SELECT count(*) FROM information_schema.tables
 WHERE table_schema = 'quetzal' AND table_type = 'BASE TABLE';
SELECT id, email, role FROM users;
SELECT key, name FROM projects;
SELECT key, name FROM spaces;
```
