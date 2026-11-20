-- Wave 1 hygiene: domain CHECKs aligned to lib/types.ts + lib/helpdeskMeta.ts + auth.
-- Idempotent via exception handlers (constraint may already exist).

SET search_path TO quetzal, public;

DO $$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_auth_source_check
    CHECK (auth_source = ANY (ARRAY['local'::text, 'ldap'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE issues
    ADD CONSTRAINT issues_type_check
    CHECK (type = ANY (ARRAY[
      'epic'::text, 'story'::text, 'task'::text, 'bug'::text, 'subtask'::text,
      'feature'::text, 'improvement'::text, 'spike'::text
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE issues
    ADD CONSTRAINT issues_status_check
    CHECK (status = ANY (ARRAY[
      'todo'::text, 'in_progress'::text, 'in_review'::text, 'done'::text
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE issues
    ADD CONSTRAINT issues_priority_check
    CHECK (priority = ANY (ARRAY[
      'blocker'::text, 'highest'::text, 'high'::text,
      'medium'::text, 'low'::text, 'lowest'::text
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_type_check
    CHECK (type = ANY (ARRAY[
      'request'::text, 'incident'::text, 'problem'::text, 'change'::text,
      'question'::text, 'access'::text, 'hardware'::text, 'software'::text, 'service'::text
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_status_check
    CHECK (status = ANY (ARRAY[
      'open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_priority_check
    CHECK (priority = ANY (ARRAY[
      'lowest'::text, 'low'::text, 'medium'::text,
      'high'::text, 'highest'::text, 'blocker'::text
    ]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE spaces
    ADD CONSTRAINT spaces_kind_check
    CHECK (kind = ANY (ARRAY['personal'::text, 'team'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE sprints
    ADD CONSTRAINT sprints_state_check
    CHECK (state = ANY (ARRAY['planned'::text, 'active'::text, 'closed'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
