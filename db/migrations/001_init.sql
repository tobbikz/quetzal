-- QZ-PG-1: Quetzal app schema (Postgres SSOT)
-- Database: quetzal  ·  Schema: quetzal
-- Source inventory: lib/*.ts CREATE TABLE (+ ALTERs reflected in final columns)
-- ADR: quetzal-postgres-ssot

BEGIN;

CREATE SCHEMA IF NOT EXISTS quetzal;
SET search_path TO quetzal, public;

-- ---------------------------------------------------------------------------
-- Core identity & tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email));

CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE site_members (
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (site_id, user_id)
);

CREATE INDEX idx_site_members_user ON site_members (user_id);

-- ---------------------------------------------------------------------------
-- Workflows & permission schemes (before projects)
-- ---------------------------------------------------------------------------

CREATE TABLE workflows (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE workflow_statuses (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (workflow_id, status)
);

CREATE INDEX idx_workflow_statuses_workflow ON workflow_statuses (workflow_id, sort_order);

CREATE TABLE workflow_transitions (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  name TEXT NOT NULL,
  conditions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  validators_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (workflow_id, from_status, to_status)
);

CREATE INDEX idx_workflow_transitions_workflow ON workflow_transitions (workflow_id);

-- Legacy edge list kept in sync by app ensureWorkflows()
CREATE TABLE workflow_steps (
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  PRIMARY KEY (workflow_id, from_status, to_status)
);

CREATE TABLE permission_schemes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE permission_scheme_grants (
  scheme_id INTEGER NOT NULL REFERENCES permission_schemes(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  grantee_type TEXT NOT NULL,
  grantee TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (scheme_id, permission, grantee_type, grantee)
);

-- ---------------------------------------------------------------------------
-- Projects / sprints / components / versions / issues
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lead_id INTEGER NOT NULL REFERENCES users(id),
  next_num INTEGER NOT NULL DEFAULT 1,
  workflow_id INTEGER REFERENCES workflows(id),
  site_id INTEGER REFERENCES sites(id),
  permission_scheme_id INTEGER REFERENCES permission_schemes(id)
);

CREATE INDEX idx_projects_site ON projects (site_id);
CREATE INDEX idx_projects_lead ON projects (lead_id);

CREATE TABLE project_roles (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (project_id, key)
);

CREATE TABLE project_role_members (
  role_id INTEGER NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, user_id)
);

CREATE INDEX idx_project_role_members_user ON project_role_members (user_id);

CREATE TABLE sprints (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_sprints_project ON sprints (project_id);

CREATE TABLE components (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE INDEX idx_components_project ON components (project_id);

CREATE TABLE versions (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  released BOOLEAN NOT NULL DEFAULT FALSE,
  release_date DATE
);

CREATE INDEX idx_versions_project ON versions (project_id);

CREATE TABLE issues (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  num INTEGER NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  assignee_id INTEGER REFERENCES users(id),
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  sprint_id INTEGER REFERENCES sprints(id),
  parent_id INTEGER REFERENCES issues(id) ON DELETE SET NULL,
  points INTEGER,
  labels TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_on DATE,
  start_on DATE,
  component_id INTEGER REFERENCES components(id) ON DELETE SET NULL,
  fix_version_id INTEGER REFERENCES versions(id) ON DELETE SET NULL,
  original_estimate_minutes INTEGER,
  remaining_minutes INTEGER,
  UNIQUE (project_id, num)
);

CREATE INDEX idx_issues_project_status ON issues (project_id, status);
CREATE INDEX idx_issues_assignee ON issues (assignee_id);
CREATE INDEX idx_issues_sprint ON issues (sprint_id);
CREATE INDEX idx_issues_parent ON issues (parent_id);
CREATE INDEX idx_issues_component ON issues (component_id);
CREATE INDEX idx_issues_fix_version ON issues (fix_version_id);

CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parent_id BIGINT REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_comments_issue ON comments (issue_id, created_at);
CREATE INDEX idx_comments_parent ON comments (parent_id);

CREATE TABLE activity (
  id BIGSERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_issue ON activity (issue_id, created_at DESC);

CREATE TABLE worklogs (
  id BIGSERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  minutes INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_worklogs_issue ON worklogs (issue_id, created_at DESC);
CREATE INDEX idx_worklogs_user ON worklogs (user_id);

CREATE TABLE reactions (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issue_id, user_id, emoji)
);

CREATE TABLE reaction_marks (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, target_id, user_id, emoji)
);

CREATE INDEX idx_reaction_marks_target ON reaction_marks (kind, target_id);

CREATE TABLE issue_watchers (
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, user_id)
);

CREATE INDEX idx_issue_watchers_user ON issue_watchers (user_id);

CREATE TABLE issue_votes (
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, user_id)
);

CREATE INDEX idx_issue_votes_user ON issue_votes (user_id);

CREATE TABLE issue_links (
  id SERIAL PRIMARY KEY,
  from_issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  to_issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_issue_id, to_issue_id, type)
);

CREATE INDEX idx_issue_links_from ON issue_links (from_issue_id);
CREATE INDEX idx_issue_links_to ON issue_links (to_issue_id);

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------

CREATE TABLE calendar_event_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  scope TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_event_types_scope ON calendar_event_types (scope, project_id);

CREATE TABLE calendar_events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  type_id INTEGER NOT NULL REFERENCES calendar_event_types(id),
  scope TEXT NOT NULL,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_range ON calendar_events (starts_on, ends_on);
CREATE INDEX idx_calendar_events_project ON calendar_events (project_id);

-- ---------------------------------------------------------------------------
-- Wiki
-- ---------------------------------------------------------------------------

CREATE TABLE spaces (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'team',
  owner_user_id INTEGER REFERENCES users(id),
  site_id INTEGER REFERENCES sites(id)
);

CREATE INDEX idx_spaces_site ON spaces (site_id);
CREATE INDEX idx_spaces_owner ON spaces (owner_user_id);

CREATE TABLE space_members (
  space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (space_id, user_id)
);

CREATE TABLE space_permissions (
  space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  grantee_type TEXT NOT NULL,
  grantee TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (space_id, permission, grantee_type, grantee)
);

CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author_id INTEGER NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug)
);

CREATE INDEX idx_pages_parent ON pages (parent_id);
CREATE INDEX idx_pages_author ON pages (author_id);

CREATE TABLE page_comments (
  id BIGSERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_comments_page ON page_comments (page_id, created_at);

CREATE TABLE page_permissions (
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  grantee_type TEXT NOT NULL,
  grantee TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (page_id, permission, grantee_type, grantee)
);

CREATE TABLE page_labels (
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  PRIMARY KEY (page_id, label)
);

CREATE INDEX idx_page_labels_label ON page_labels (lower(label));

CREATE TABLE page_attachments (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_attachments_page ON page_attachments (page_id);

-- Legacy + current revision stores (wikiExtras keeps both during transition)
CREATE TABLE page_versions (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

CREATE TABLE page_revisions (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

CREATE TABLE page_properties (
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (page_id, key)
);

CREATE TABLE page_templates (
  id SERIAL PRIMARY KEY,
  space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_templates_space ON page_templates (space_id);

CREATE TABLE wiki_page_meta (
  page_id INTEGER PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  view_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id)
);

-- ---------------------------------------------------------------------------
-- Notifications / channels / SSO / audit / filters / dashboards
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);

CREATE TABLE notification_channels (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mail_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  slack_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_host TEXT NOT NULL DEFAULT '',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL DEFAULT '',
  smtp_pass TEXT NOT NULL DEFAULT '',
  smtp_from TEXT NOT NULL DEFAULT '',
  slack_webhook_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sso_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  entity_id TEXT NOT NULL DEFAULT 'quetzal-demo-sp',
  acs_path TEXT NOT NULL DEFAULT '/api/sso/saml/acs',
  idp_metadata_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  oidc_issuer TEXT NOT NULL DEFAULT '',
  oidc_client_id TEXT NOT NULL DEFAULT '',
  oidc_client_secret TEXT NOT NULL DEFAULT '',
  oidc_redirect_uri TEXT NOT NULL DEFAULT 'http://127.0.0.1:3210/api/sso/oidc/callback'
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log (action, created_at DESC);

CREATE TABLE saved_filters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  jql TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_saved_filters_user ON saved_filters (user_id, name);

CREATE TABLE dashboards (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboards_owner ON dashboards (owner_user_id, lower(name));

CREATE TABLE dashboard_gadgets (
  id SERIAL PRIMARY KEY,
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_gadgets_dash ON dashboard_gadgets (dashboard_id, position, id);

-- ---------------------------------------------------------------------------
-- Custom fields / screens
-- ---------------------------------------------------------------------------

CREATE TABLE custom_fields (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE screens (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE screen_fields (
  screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (screen_id, field_id)
);

CREATE TABLE field_contexts (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE
);

CREATE TABLE issue_custom_values (
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (issue_id, field_id)
);

-- ---------------------------------------------------------------------------
-- Automation
-- ---------------------------------------------------------------------------

CREATE TABLE automation_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_event TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_rules_trigger ON automation_rules (trigger_event, enabled);

CREATE TABLE automation_runs (
  id BIGSERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  issue_key TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_runs_created ON automation_runs (created_at DESC);
CREATE INDEX idx_automation_runs_rule_issue ON automation_runs (rule_id, issue_key, trigger_event);

-- ---------------------------------------------------------------------------
-- Helpdesk / portal
-- ---------------------------------------------------------------------------

CREATE TABLE helpdesk_tickets (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  num INTEGER NOT NULL UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  requester_id INTEGER NOT NULL REFERENCES users(id),
  assignee_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  priority TEXT NOT NULL DEFAULT 'medium',
  labels TEXT NOT NULL DEFAULT '',
  due TIMESTAMPTZ,
  response_due TIMESTAMPTZ,
  resolve_due TIMESTAMPTZ,
  response_met_at TIMESTAMPTZ,
  resolve_met_at TIMESTAMPTZ,
  sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
  site_id INTEGER REFERENCES sites(id)
);

CREATE INDEX idx_helpdesk_tickets_status ON helpdesk_tickets (status);
CREATE INDEX idx_helpdesk_tickets_type ON helpdesk_tickets (type);
CREATE INDEX idx_helpdesk_tickets_priority ON helpdesk_tickets (priority);
CREATE INDEX idx_helpdesk_tickets_site ON helpdesk_tickets (site_id);

CREATE TABLE helpdesk_notes (
  id BIGSERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_helpdesk_notes_ticket ON helpdesk_notes (ticket_id, created_at);

CREATE TABLE sla_policies (
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT '',
  response_minutes INTEGER NOT NULL,
  resolve_minutes INTEGER NOT NULL,
  PRIMARY KEY (type, priority)
);

CREATE TABLE request_types (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  helpdesk_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

COMMIT;
