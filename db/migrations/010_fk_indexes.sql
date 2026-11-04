-- Wave 1 hygiene: indexes on FK first-columns that lacked a leftmost index.
-- Local/Compose migrate runs inside a transaction-friendly path — no CONCURRENTLY.

SET search_path TO quetzal, public;

-- Work
CREATE INDEX IF NOT EXISTS idx_issues_reporter ON issues (reporter_id);
CREATE INDEX IF NOT EXISTS idx_issue_custom_values_field ON issue_custom_values (field_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions (user_id);
CREATE INDEX IF NOT EXISTS idx_reaction_marks_user ON reaction_marks (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_author ON activity (author_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments (author_id);

-- Helpdesk
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_assignee ON helpdesk_tickets (assignee_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_requester ON helpdesk_tickets (requester_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_notes_author ON helpdesk_notes (author_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_macros_created_by ON helpdesk_macros (created_by);

-- Wiki
CREATE INDEX IF NOT EXISTS idx_page_comments_author ON page_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_page_versions_author ON page_versions (author_id);
CREATE INDEX IF NOT EXISTS idx_page_revisions_author ON page_revisions (author_id);
CREATE INDEX IF NOT EXISTS idx_page_attachments_uploaded_by ON page_attachments (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_wiki_page_meta_deleted_by ON wiki_page_meta (deleted_by);
CREATE INDEX IF NOT EXISTS idx_space_members_user ON space_members (user_id);

-- Calendar
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner ON calendar_events (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events (created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events (type_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_types_owner ON calendar_event_types (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_types_project ON calendar_event_types (project_id);

-- Projects / screens / audit
CREATE INDEX IF NOT EXISTS idx_projects_workflow ON projects (workflow_id);
CREATE INDEX IF NOT EXISTS idx_projects_permission_scheme ON projects (permission_scheme_id);
CREATE INDEX IF NOT EXISTS idx_field_contexts_screen ON field_contexts (screen_id);
CREATE INDEX IF NOT EXISTS idx_screen_fields_field ON screen_fields (field_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_id);
