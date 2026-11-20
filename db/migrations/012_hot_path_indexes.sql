-- Wave 1 hygiene: composite indexes for Work desk + Helpdesk queues.

SET search_path TO quetzal, public;

-- Home Flow / board filters by project + status, sorted by recency
CREATE INDEX IF NOT EXISTS idx_issues_project_status_updated
  ON issues (project_id, status, updated_at DESC);

-- My queue / assignee QQL within a project
CREATE INDEX IF NOT EXISTS idx_issues_project_assignee_status
  ON issues (project_id, assignee_id, status);

-- Agent desk queues by site
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_site_status_updated
  ON helpdesk_tickets (site_id, status, updated_at DESC);

-- Mine / assignee queues
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_assignee_status
  ON helpdesk_tickets (assignee_id, status);
