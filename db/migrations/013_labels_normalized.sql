-- Wave 2: normalized labels catalog + junction tables (CSV columns kept as denormalized mirror).

SET search_path TO quetzal, public;

CREATE TABLE IF NOT EXISTS labels (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL,
  CONSTRAINT labels_name_norm_key UNIQUE (name_norm)
);

CREATE TABLE IF NOT EXISTS issue_labels (
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_labels_label ON issue_labels (label_id);

CREATE TABLE IF NOT EXISTS helpdesk_ticket_labels (
  ticket_id INTEGER NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_ticket_labels_label ON helpdesk_ticket_labels (label_id);

-- Backfill from CSV mirrors (idempotent)
INSERT INTO labels (name, name_norm)
SELECT DISTINCT trim(both FROM part) AS name, lower(trim(both FROM part)) AS name_norm
FROM (
  SELECT unnest(string_to_array(labels, ',')) AS part FROM issues WHERE labels IS NOT NULL AND labels <> ''
  UNION ALL
  SELECT unnest(string_to_array(labels, ',')) AS part FROM helpdesk_tickets WHERE labels IS NOT NULL AND labels <> ''
) raw
WHERE trim(both FROM part) <> ''
ON CONFLICT (name_norm) DO NOTHING;

INSERT INTO issue_labels (issue_id, label_id)
SELECT i.id, l.id
FROM issues i
CROSS JOIN LATERAL unnest(string_to_array(i.labels, ',')) AS part
JOIN labels l ON l.name_norm = lower(trim(both FROM part))
WHERE i.labels IS NOT NULL AND i.labels <> '' AND trim(both FROM part) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO helpdesk_ticket_labels (ticket_id, label_id)
SELECT t.id, l.id
FROM helpdesk_tickets t
CROSS JOIN LATERAL unnest(string_to_array(t.labels, ',')) AS part
JOIN labels l ON l.name_norm = lower(trim(both FROM part))
WHERE t.labels IS NOT NULL AND t.labels <> '' AND trim(both FROM part) <> ''
ON CONFLICT DO NOTHING;
