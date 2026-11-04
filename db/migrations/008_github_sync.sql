-- GitHub sync: default project + link table

ALTER TABLE integration_connectors
  ADD COLUMN IF NOT EXISTS github_default_project TEXT NOT NULL DEFAULT 'OPS';

CREATE TABLE IF NOT EXISTS github_issue_links (
  id BIGSERIAL PRIMARY KEY,
  github_node_id TEXT NOT NULL UNIQUE,
  repo_full_name TEXT NOT NULL DEFAULT '',
  github_number INTEGER NOT NULL,
  issue_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'issue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_issue_links_key ON github_issue_links (issue_key);
CREATE INDEX IF NOT EXISTS idx_github_issue_links_repo_num ON github_issue_links (repo_full_name, github_number);
