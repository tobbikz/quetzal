-- Custom kanban boards (personal or project-scoped). Not sprint-bound.
CREATE TABLE IF NOT EXISTS boards (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  jql TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL CHECK (scope IN ('personal', 'project')),
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT boards_scope_project CHECK (
    (scope = 'personal' AND project_id IS NULL)
    OR (scope = 'project' AND project_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards (owner_user_id, scope, lower(name));
CREATE INDEX IF NOT EXISTS idx_boards_project ON boards (project_id) WHERE project_id IS NOT NULL;
