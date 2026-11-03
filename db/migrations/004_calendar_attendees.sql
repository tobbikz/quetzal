-- Event invitees / attendees
CREATE TABLE IF NOT EXISTS calendar_event_attendees (
  event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_attendees_user
  ON calendar_event_attendees (user_id);
