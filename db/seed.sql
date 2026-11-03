-- Demo seed for schema quetzal (idempotent-ish: clears demo keys then inserts).
-- Apply after 001_init.sql:
--   psql "$QUETZAL_DATABASE_URL" -f db/seed.sql

BEGIN;
SET search_path TO quetzal, public;

-- Singleton settings rows
INSERT INTO notification_channels (id, mail_enabled, slack_enabled, updated_at)
VALUES (1, FALSE, FALSE, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO sso_settings (id, enabled, updated_at)
VALUES (1, FALSE, now())
ON CONFLICT (id) DO NOTHING;

-- Sites
INSERT INTO sites (id, key, name) VALUES
  (1, 'HQ', 'Headquarters'),
  (2, 'BR', 'Branch')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name;
SELECT setval(pg_get_serial_sequence('sites', 'id'), (SELECT MAX(id) FROM sites));

-- Users
INSERT INTO users (id, name, email, role) VALUES
  (1, 'Ana Solis', 'ana@example.com', 'admin'),
  (2, 'Luis Mora', 'luis@example.com', 'member'),
  (3, 'Marisol Vega', 'marisol@example.com', 'member'),
  (4, 'Rita Viewer', 'viewer@example.com', 'viewer')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role;
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));

INSERT INTO site_members (site_id, user_id)
SELECT 1, id FROM users
ON CONFLICT DO NOTHING;
INSERT INTO site_members (site_id, user_id)
SELECT s.id, u.id FROM sites s CROSS JOIN users u
WHERE u.role = 'admin'
ON CONFLICT DO NOTHING;

-- Workflow Standard
INSERT INTO workflows (id, name) VALUES (1, 'Standard')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
SELECT setval(pg_get_serial_sequence('workflows', 'id'), (SELECT MAX(id) FROM workflows));

INSERT INTO workflow_statuses (workflow_id, status, name, sort_order) VALUES
  (1, 'todo', 'To do', 0),
  (1, 'in_progress', 'In progress', 1),
  (1, 'in_review', 'In review', 2),
  (1, 'done', 'Done', 3)
ON CONFLICT (workflow_id, status) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO workflow_transitions (workflow_id, from_status, to_status, name, conditions_json, validators_json) VALUES
  (1, 'todo', 'in_progress', 'Start', '[]'::jsonb, '[{"type":"summary_nonempty"}]'::jsonb),
  (1, 'in_progress', 'in_review', 'Send to review', '[{"type":"require_assignee"}]'::jsonb, '[{"type":"summary_nonempty"}]'::jsonb),
  (1, 'in_review', 'done', 'Done', '[{"type":"require_assignee"}]'::jsonb, '[{"type":"summary_nonempty"}]'::jsonb),
  (1, 'in_review', 'in_progress', 'Reopen', '[]'::jsonb, '[{"type":"summary_nonempty"}]'::jsonb),
  (1, 'done', 'todo', 'Reopen', '[]'::jsonb, '[{"type":"summary_nonempty"}]'::jsonb)
ON CONFLICT (workflow_id, from_status, to_status) DO NOTHING;

INSERT INTO workflow_steps (workflow_id, from_status, to_status)
SELECT workflow_id, from_status, to_status FROM workflow_transitions WHERE workflow_id = 1
ON CONFLICT DO NOTHING;

-- Default permission scheme
INSERT INTO permission_schemes (id, name, description) VALUES
  (1, 'Default', 'Admins and members can create/edit; viewers browse only.')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;
SELECT setval(pg_get_serial_sequence('permission_schemes', 'id'), (SELECT MAX(id) FROM permission_schemes));

INSERT INTO permission_scheme_grants (scheme_id, permission, grantee_type, grantee) VALUES
  (1, 'BROWSE_PROJECTS', 'application_role', 'admin'),
  (1, 'BROWSE_PROJECTS', 'application_role', 'member'),
  (1, 'BROWSE_PROJECTS', 'application_role', 'viewer'),
  (1, 'CREATE_ISSUES', 'application_role', 'admin'),
  (1, 'CREATE_ISSUES', 'application_role', 'member'),
  (1, 'EDIT_ISSUES', 'application_role', 'admin'),
  (1, 'EDIT_ISSUES', 'application_role', 'member')
ON CONFLICT DO NOTHING;

-- Projects
INSERT INTO projects (id, key, name, description, lead_id, next_num, workflow_id, site_id, permission_scheme_id) VALUES
  (1, 'OPS', 'Operations', 'Checkout, billing, and the register.', 1, 7, 1, 1, 1),
  (2, 'WEB', 'Storefront', 'Public catalog and content.', 2, 4, 1, 1, 1)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  lead_id = EXCLUDED.lead_id,
  next_num = EXCLUDED.next_num,
  workflow_id = EXCLUDED.workflow_id,
  site_id = EXCLUDED.site_id,
  permission_scheme_id = EXCLUDED.permission_scheme_id;
SELECT setval(pg_get_serial_sequence('projects', 'id'), (SELECT MAX(id) FROM projects));

INSERT INTO project_roles (project_id, key, name)
SELECT p.id, r.key, r.name
FROM projects p
CROSS JOIN (VALUES
  ('admin', 'Administrators'),
  ('developer', 'Developers'),
  ('viewer', 'Viewers')
) AS r(key, name)
ON CONFLICT (project_id, key) DO NOTHING;

INSERT INTO project_role_members (role_id, user_id)
SELECT pr.id, 1
FROM project_roles pr
WHERE pr.key = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO sprints (id, project_id, name, state, goal) VALUES
  (1, 1, 'Sprint 14', 'active', 'Stop duplicate charges and ship the retry path.'),
  (2, 1, 'Sprint 15', 'planned', 'Refunds and the end-of-day close.'),
  (3, 2, 'Sprint 8', 'active', 'Catalog grid and image fixes.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  state = EXCLUDED.state,
  goal = EXCLUDED.goal;
SELECT setval(pg_get_serial_sequence('sprints', 'id'), (SELECT MAX(id) FROM sprints));

INSERT INTO components (project_id, name)
SELECT 1, c FROM (VALUES ('Payments'), ('Register')) AS t(c)
WHERE NOT EXISTS (
  SELECT 1 FROM components WHERE project_id = 1 AND name = t.c
);

INSERT INTO versions (project_id, name, released, release_date)
SELECT 1, '1.0', FALSE, NULL
WHERE NOT EXISTS (SELECT 1 FROM versions WHERE project_id = 1 AND name = '1.0');

-- Issues (demo set)
INSERT INTO issues (
  id, project_id, num, type, summary, description, status, priority,
  assignee_id, reporter_id, sprint_id, parent_id, points, labels, created_at, updated_at
) VALUES
  (1, 1, 1, 'epic', 'Checkout reliability', 'Keep a payment from being charged twice when the gateway times out.', 'in_progress', 'high', 1, 1, 1, NULL, NULL, 'payments', now(), now()),
  (2, 1, 2, 'story', 'Retry a failed capture', 'If the first capture times out, retry once with the same idempotency key.', 'in_progress', 'high', 2, 1, 1, 1, 5, 'payments', now(), now()),
  (3, 1, 3, 'task', 'Store the idempotency key', 'Persist the key before calling the gateway.', 'in_review', 'medium', 1, 2, 1, 2, 3, 'payments', now(), now()),
  (4, 1, 4, 'bug', 'Duplicate charge on timeout', 'A 30s gateway timeout is charged again on the next attempt.', 'todo', 'highest', 3, 2, 1, 1, 5, 'payments,sev1', now(), now()),
  (5, 1, 5, 'story', 'Refund confirmation email', 'Send one email when a refund settles. Do not send it on the pending state.', 'todo', 'medium', NULL, 1, NULL, 1, 3, 'email', now(), now()),
  (6, 1, 6, 'task', 'Close the register', 'Write the end-of-day totals and lock the drawer.', 'done', 'low', 1, 1, 1, NULL, 2, 'register', now(), now()),
  (7, 2, 1, 'epic', 'Catalog launch', 'The public grid has to be usable on a phone and a desktop.', 'in_progress', 'medium', 2, 2, 3, NULL, NULL, 'catalog', now(), now()),
  (8, 2, 2, 'story', 'Product grid', 'Four columns on desktop, one on a phone, with the price under the name.', 'in_progress', 'medium', 2, 1, 3, 7, 5, 'catalog', now(), now()),
  (9, 2, 3, 'bug', 'Missing image alt text', 'Product photos render with an empty alt attribute.', 'todo', 'high', 3, 2, 3, 7, 2, 'a11y', now(), now())
ON CONFLICT (project_id, num) DO UPDATE SET
  summary = EXCLUDED.summary,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  assignee_id = EXCLUDED.assignee_id,
  updated_at = now();
SELECT setval(pg_get_serial_sequence('issues', 'id'), (SELECT MAX(id) FROM issues));

INSERT INTO comments (issue_id, author_id, body, created_at) VALUES
  (4, 3, 'Reproduced on the staging gateway with a forced 30s delay. Second POST creates a new charge.', now()),
  (2, 1, 'Retry only when the first response is a timeout, not a decline.', now());

-- Wiki spaces / pages
INSERT INTO spaces (id, key, name, description, kind, owner_user_id, site_id) VALUES
  (1, 'HAN', 'Handbook', 'How the company works.', 'team', NULL, 1),
  (2, 'ENG', 'Engineering', 'Systems, decisions, and runbooks.', 'team', NULL, 1)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  site_id = EXCLUDED.site_id;
SELECT setval(pg_get_serial_sequence('spaces', 'id'), (SELECT MAX(id) FROM spaces));

INSERT INTO space_members (space_id, user_id)
SELECT s.id, u.id FROM spaces s CROSS JOIN users u
WHERE s.key IN ('HAN', 'ENG')
ON CONFLICT DO NOTHING;

INSERT INTO pages (id, space_id, parent_id, slug, title, body, author_id, updated_at) VALUES
  (1, 1, NULL, 'overview', 'Handbook', 'How we run the shop, who owns what, and where decisions live.', 1, now()),
  (2, 1, 1, 'how-we-ship', 'How we ship', 'A change lands when the board column is Done and the page that describes it is updated the same day.', 1, now()),
  (3, 1, 1, 'onboarding', 'First week', 'Day 1 is accounts. Day 2 is shadowing the register. Day 3 is a small issue from the backlog.', 1, now()),
  (4, 2, NULL, 'overview', 'Engineering', 'Runbooks and decisions for the storefront and the register.', 2, now()),
  (5, 2, 4, 'payments', 'Payments', 'Captures use an idempotency key. A timeout is not a success and it is not a decline.', 2, now()),
  (6, 2, 5, 'timeout-decision', 'Decision: one retry', 'We retry a capture once. The second timeout becomes a bug, not another charge.', 1, now())
ON CONFLICT (space_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  updated_at = now();
SELECT setval(pg_get_serial_sequence('pages', 'id'), (SELECT MAX(id) FROM pages));

INSERT INTO page_comments (page_id, author_id, body, created_at) VALUES
  (6, 2, 'Agreed. The board bug OPS-4 is the case this decision is meant to stop.', now());

INSERT INTO wiki_page_meta (page_id, view_count)
SELECT id, 0 FROM pages
ON CONFLICT (page_id) DO NOTHING;

-- Portal request types
INSERT INTO request_types (key, name, helpdesk_type, description) VALUES
  ('general', 'General request', 'request', 'Ask for help with something that is not urgent or broken.'),
  ('incident', 'Report an incident', 'incident', 'Something is down or blocking customers right now.'),
  ('question', 'Ask a question', 'question', 'How-to questions about tools, process, or access.'),
  ('access', 'Access request', 'access', 'Need a login, space membership, or permission change.'),
  ('hardware', 'Hardware issue', 'hardware', 'Printers, registers, card readers, and other devices.'),
  ('software', 'Software issue', 'software', 'Apps crashing, sync errors, or missing features.')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  helpdesk_type = EXCLUDED.helpdesk_type,
  description = EXCLUDED.description;

-- SLA policies
INSERT INTO sla_policies (type, priority, response_minutes, resolve_minutes) VALUES
  ('incident', 'highest', 15, 240),
  ('incident', 'high', 30, 480),
  ('incident', 'medium', 60, 1440),
  ('request', '', 240, 2880),
  ('question', '', 480, 4320)
ON CONFLICT (type, priority) DO UPDATE SET
  response_minutes = EXCLUDED.response_minutes,
  resolve_minutes = EXCLUDED.resolve_minutes;

-- Custom fields sample
INSERT INTO custom_fields (key, name, type, options_json, description) VALUES
  ('environment', 'Environment', 'select', '["Production","Staging","Dev"]'::jsonb, 'Where the work applies'),
  ('story_points_extra', 'Business value', 'number', '[]'::jsonb, 'Relative business value'),
  ('target_date', 'Target date', 'date', '[]'::jsonb, 'Desired delivery day')
ON CONFLICT (key) DO NOTHING;

COMMIT;
