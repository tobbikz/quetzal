-- Wave 2b: full-text search vector on issues (summary + description + labels mirror).

SET search_path TO quetzal, public;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(summary, '') || ' ' || coalesce(description, '') || ' ' || coalesce(labels, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_issues_search_tsv ON issues USING GIN (search_tsv);
