-- Schema-only dump of quetzal
-- Generated: 2026-11-20T09:57:01-06:00
-- Source volume: quetzal_quetzal_pg

--
-- PostgreSQL database dump
--

\restrict 4le90wSXOQGczy851llAgQ3cY9RKsottmXP27DBTdRoaO9rm9J5w2QYlqF4B4ML

-- Dumped from database version 16.16
-- Dumped by pg_dump version 16.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: quetzal; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA quetzal;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.activity (
    id bigint NOT NULL,
    issue_id integer NOT NULL,
    author_id integer,
    kind text NOT NULL,
    detail text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.activity_id_seq OWNED BY quetzal.activity.id;


--
-- Name: audit_log; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.audit_log (
    id bigint NOT NULL,
    actor_id integer,
    action text NOT NULL,
    entity_type text DEFAULT ''::text NOT NULL,
    entity_id text DEFAULT ''::text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.audit_log_id_seq OWNED BY quetzal.audit_log.id;


--
-- Name: automation_rules; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.automation_rules (
    id integer NOT NULL,
    name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    trigger_event text NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_rules_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.automation_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: automation_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.automation_rules_id_seq OWNED BY quetzal.automation_rules.id;


--
-- Name: automation_runs; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.automation_runs (
    id bigint NOT NULL,
    rule_id integer NOT NULL,
    issue_key text NOT NULL,
    trigger_event text NOT NULL,
    status text DEFAULT 'ok'::text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_runs_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.automation_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: automation_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.automation_runs_id_seq OWNED BY quetzal.automation_runs.id;


--
-- Name: boards; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.boards (
    id bigint NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    jql text DEFAULT ''::text NOT NULL,
    scope text NOT NULL,
    owner_user_id integer NOT NULL,
    project_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT boards_scope_check CHECK ((scope = ANY (ARRAY['personal'::text, 'project'::text]))),
    CONSTRAINT boards_scope_project CHECK ((((scope = 'personal'::text) AND (project_id IS NULL)) OR ((scope = 'project'::text) AND (project_id IS NOT NULL))))
);


--
-- Name: boards_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

ALTER TABLE quetzal.boards ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME quetzal.boards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: calendar_event_attendees; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.calendar_event_attendees (
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_event_types; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.calendar_event_types (
    id integer NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    scope text NOT NULL,
    project_id integer,
    owner_user_id integer,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_event_types_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.calendar_event_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_event_types_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.calendar_event_types_id_seq OWNED BY quetzal.calendar_event_types.id;


--
-- Name: calendar_events; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.calendar_events (
    id integer NOT NULL,
    title text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    type_id integer NOT NULL,
    scope text NOT NULL,
    owner_user_id integer,
    project_id integer,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    created_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.calendar_events_id_seq OWNED BY quetzal.calendar_events.id;


--
-- Name: comments; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.comments (
    id bigint NOT NULL,
    issue_id integer NOT NULL,
    author_id integer NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id bigint
);


--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.comments_id_seq OWNED BY quetzal.comments.id;


--
-- Name: components; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.components (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: components_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.components_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: components_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.components_id_seq OWNED BY quetzal.components.id;


--
-- Name: custom_fields; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.custom_fields (
    id integer NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    options_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    description text DEFAULT ''::text NOT NULL
);


--
-- Name: custom_fields_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.custom_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custom_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.custom_fields_id_seq OWNED BY quetzal.custom_fields.id;


--
-- Name: dashboard_gadgets; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.dashboard_gadgets (
    id integer NOT NULL,
    dashboard_id integer NOT NULL,
    type text NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboard_gadgets_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.dashboard_gadgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dashboard_gadgets_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.dashboard_gadgets_id_seq OWNED BY quetzal.dashboard_gadgets.id;


--
-- Name: dashboards; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.dashboards (
    id integer NOT NULL,
    owner_user_id integer NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboards_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.dashboards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dashboards_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.dashboards_id_seq OWNED BY quetzal.dashboards.id;


--
-- Name: field_contexts; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.field_contexts (
    id integer NOT NULL,
    project_id integer NOT NULL,
    screen_id integer NOT NULL
);


--
-- Name: field_contexts_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.field_contexts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: field_contexts_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.field_contexts_id_seq OWNED BY quetzal.field_contexts.id;


--
-- Name: github_check_runs; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.github_check_runs (
    id bigint NOT NULL,
    github_id bigint NOT NULL,
    repo_full_name text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    status text DEFAULT ''::text NOT NULL,
    conclusion text DEFAULT ''::text NOT NULL,
    html_url text DEFAULT ''::text NOT NULL,
    head_sha text DEFAULT ''::text NOT NULL,
    details_url text DEFAULT ''::text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: github_check_runs_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.github_check_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: github_check_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.github_check_runs_id_seq OWNED BY quetzal.github_check_runs.id;


--
-- Name: github_commit_issues; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.github_commit_issues (
    commit_id bigint NOT NULL,
    issue_key text NOT NULL
);


--
-- Name: github_commits; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.github_commits (
    id bigint NOT NULL,
    repo_full_name text NOT NULL,
    sha text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    author_name text DEFAULT ''::text NOT NULL,
    author_login text DEFAULT ''::text NOT NULL,
    html_url text DEFAULT ''::text NOT NULL,
    committed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: github_commits_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.github_commits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: github_commits_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.github_commits_id_seq OWNED BY quetzal.github_commits.id;


--
-- Name: github_issue_links; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.github_issue_links (
    id bigint NOT NULL,
    github_node_id text NOT NULL,
    repo_full_name text DEFAULT ''::text NOT NULL,
    github_number integer NOT NULL,
    issue_key text NOT NULL,
    kind text DEFAULT 'issue'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: github_issue_links_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.github_issue_links_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: github_issue_links_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.github_issue_links_id_seq OWNED BY quetzal.github_issue_links.id;


--
-- Name: helpdesk_automation_log; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.helpdesk_automation_log (
    id bigint NOT NULL,
    ticket_id integer NOT NULL,
    kind text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: helpdesk_automation_log_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.helpdesk_automation_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: helpdesk_automation_log_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.helpdesk_automation_log_id_seq OWNED BY quetzal.helpdesk_automation_log.id;


--
-- Name: helpdesk_csat; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.helpdesk_csat (
    id bigint NOT NULL,
    ticket_id integer NOT NULL,
    score smallint,
    comment text DEFAULT ''::text NOT NULL,
    token text NOT NULL,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT helpdesk_csat_score_check CHECK (((score IS NULL) OR ((score >= 1) AND (score <= 5))))
);


--
-- Name: helpdesk_csat_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.helpdesk_csat_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: helpdesk_csat_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.helpdesk_csat_id_seq OWNED BY quetzal.helpdesk_csat.id;


--
-- Name: helpdesk_macros; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.helpdesk_macros (
    id bigint NOT NULL,
    name text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: helpdesk_macros_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.helpdesk_macros_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: helpdesk_macros_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.helpdesk_macros_id_seq OWNED BY quetzal.helpdesk_macros.id;


--
-- Name: helpdesk_notes; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.helpdesk_notes (
    id bigint NOT NULL,
    ticket_id integer NOT NULL,
    author_id integer NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: helpdesk_notes_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.helpdesk_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: helpdesk_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.helpdesk_notes_id_seq OWNED BY quetzal.helpdesk_notes.id;


--
-- Name: helpdesk_ticket_labels; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.helpdesk_ticket_labels (
    ticket_id integer NOT NULL,
    label_id integer NOT NULL
);


--
-- Name: helpdesk_tickets; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.helpdesk_tickets (
    id integer NOT NULL,
    key text NOT NULL,
    num integer NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    summary text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    requester_id integer NOT NULL,
    assignee_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    labels text DEFAULT ''::text NOT NULL,
    due timestamp with time zone,
    response_due timestamp with time zone,
    resolve_due timestamp with time zone,
    response_met_at timestamp with time zone,
    resolve_met_at timestamp with time zone,
    sla_breached boolean DEFAULT false NOT NULL,
    site_id integer,
    CONSTRAINT helpdesk_tickets_priority_check CHECK ((priority = ANY (ARRAY['lowest'::text, 'low'::text, 'medium'::text, 'high'::text, 'highest'::text, 'blocker'::text]))),
    CONSTRAINT helpdesk_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]))),
    CONSTRAINT helpdesk_tickets_type_check CHECK ((type = ANY (ARRAY['request'::text, 'incident'::text, 'problem'::text, 'change'::text, 'question'::text, 'access'::text, 'hardware'::text, 'software'::text, 'service'::text])))
);


--
-- Name: helpdesk_tickets_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.helpdesk_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: helpdesk_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.helpdesk_tickets_id_seq OWNED BY quetzal.helpdesk_tickets.id;


--
-- Name: integration_connectors; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.integration_connectors (
    id integer NOT NULL,
    github_webhook_secret text DEFAULT ''::text NOT NULL,
    github_enabled boolean DEFAULT false NOT NULL,
    teams_webhook_url text DEFAULT ''::text NOT NULL,
    teams_enabled boolean DEFAULT false NOT NULL,
    email_inbound_token text DEFAULT ''::text NOT NULL,
    email_inbound_enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    github_default_project text DEFAULT 'OPS'::text NOT NULL,
    github_default_repo text DEFAULT ''::text NOT NULL,
    CONSTRAINT integration_connectors_id_check CHECK ((id = 1))
);


--
-- Name: issue_custom_values; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.issue_custom_values (
    issue_id integer NOT NULL,
    field_id integer NOT NULL,
    value text DEFAULT ''::text NOT NULL
);


--
-- Name: issue_labels; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.issue_labels (
    issue_id integer NOT NULL,
    label_id integer NOT NULL
);


--
-- Name: issue_links; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.issue_links (
    id integer NOT NULL,
    from_issue_id integer NOT NULL,
    to_issue_id integer NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: issue_links_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.issue_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: issue_links_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.issue_links_id_seq OWNED BY quetzal.issue_links.id;


--
-- Name: issue_votes; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.issue_votes (
    issue_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: issue_watchers; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.issue_watchers (
    issue_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: issues; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.issues (
    id integer NOT NULL,
    project_id integer NOT NULL,
    num integer NOT NULL,
    type text NOT NULL,
    summary text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    priority text NOT NULL,
    assignee_id integer,
    reporter_id integer NOT NULL,
    sprint_id integer,
    parent_id integer,
    points integer,
    labels text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    due_on date,
    start_on date,
    component_id integer,
    fix_version_id integer,
    original_estimate_minutes integer,
    remaining_minutes integer,
    search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((COALESCE(summary, ''::text) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(labels, ''::text)))) STORED,
    CONSTRAINT issues_priority_check CHECK ((priority = ANY (ARRAY['blocker'::text, 'highest'::text, 'high'::text, 'medium'::text, 'low'::text, 'lowest'::text]))),
    CONSTRAINT issues_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'in_review'::text, 'done'::text]))),
    CONSTRAINT issues_type_check CHECK ((type = ANY (ARRAY['epic'::text, 'story'::text, 'task'::text, 'bug'::text, 'subtask'::text, 'feature'::text, 'improvement'::text, 'spike'::text])))
);


--
-- Name: issues_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.issues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: issues_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.issues_id_seq OWNED BY quetzal.issues.id;


--
-- Name: labels; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.labels (
    id integer NOT NULL,
    name text NOT NULL,
    name_norm text NOT NULL
);


--
-- Name: labels_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.labels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: labels_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.labels_id_seq OWNED BY quetzal.labels.id;


--
-- Name: ldap_settings; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.ldap_settings (
    id integer NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    url text DEFAULT 'ldap://127.0.0.1:389'::text NOT NULL,
    bind_dn text DEFAULT ''::text NOT NULL,
    bind_password text DEFAULT ''::text NOT NULL,
    base_dn text DEFAULT ''::text NOT NULL,
    user_filter text DEFAULT '(uid={{username}})'::text NOT NULL,
    email_attr text DEFAULT 'mail'::text NOT NULL,
    name_attr text DEFAULT 'cn'::text NOT NULL,
    start_tls boolean DEFAULT false NOT NULL,
    default_role text DEFAULT 'member'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ldap_settings_id_check CHECK ((id = 1))
);


--
-- Name: notification_channels; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.notification_channels (
    id integer NOT NULL,
    mail_enabled boolean DEFAULT false NOT NULL,
    slack_enabled boolean DEFAULT false NOT NULL,
    smtp_host text DEFAULT ''::text NOT NULL,
    smtp_port integer DEFAULT 587 NOT NULL,
    smtp_user text DEFAULT ''::text NOT NULL,
    smtp_pass text DEFAULT ''::text NOT NULL,
    smtp_from text DEFAULT ''::text NOT NULL,
    slack_webhook_url text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_channels_id_check CHECK ((id = 1))
);


--
-- Name: notifications; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.notifications (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    href text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.notifications_id_seq OWNED BY quetzal.notifications.id;


--
-- Name: ops_meta; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.ops_meta (
    key text NOT NULL,
    value text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: page_attachments; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.page_attachments (
    id integer NOT NULL,
    page_id integer NOT NULL,
    filename text NOT NULL,
    stored_name text NOT NULL,
    mime text DEFAULT 'application/octet-stream'::text NOT NULL,
    size integer DEFAULT 0 NOT NULL,
    uploaded_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: page_attachments_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.page_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: page_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.page_attachments_id_seq OWNED BY quetzal.page_attachments.id;


--
-- Name: page_comments; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.page_comments (
    id bigint NOT NULL,
    page_id integer NOT NULL,
    author_id integer NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: page_comments_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.page_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: page_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.page_comments_id_seq OWNED BY quetzal.page_comments.id;


--
-- Name: page_labels; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.page_labels (
    page_id integer NOT NULL,
    label text NOT NULL
);


--
-- Name: page_permissions; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.page_permissions (
    page_id integer NOT NULL,
    permission text NOT NULL,
    grantee_type text NOT NULL,
    grantee text DEFAULT ''::text NOT NULL
);


--
-- Name: page_properties; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.page_properties (
    page_id integer NOT NULL,
    key text NOT NULL,
    value text DEFAULT ''::text NOT NULL
);


--
-- Name: page_revisions; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.page_revisions (
    id integer NOT NULL,
    page_id integer NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    author_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: page_revisions_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.page_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: page_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.page_revisions_id_seq OWNED BY quetzal.page_revisions.id;


--
-- Name: page_templates; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.page_templates (
    id integer NOT NULL,
    space_id integer,
    name text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: page_templates_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.page_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: page_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.page_templates_id_seq OWNED BY quetzal.page_templates.id;


--
-- Name: page_versions; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.page_versions (
    id integer NOT NULL,
    page_id integer NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    author_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: page_versions_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.page_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: page_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.page_versions_id_seq OWNED BY quetzal.page_versions.id;


--
-- Name: pages; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.pages (
    id integer NOT NULL,
    space_id integer NOT NULL,
    parent_id integer,
    slug text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    author_id integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pages_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pages_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.pages_id_seq OWNED BY quetzal.pages.id;


--
-- Name: permission_scheme_grants; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.permission_scheme_grants (
    scheme_id integer NOT NULL,
    permission text NOT NULL,
    grantee_type text NOT NULL,
    grantee text DEFAULT ''::text NOT NULL
);


--
-- Name: permission_schemes; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.permission_schemes (
    id integer NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL
);


--
-- Name: permission_schemes_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.permission_schemes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_schemes_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.permission_schemes_id_seq OWNED BY quetzal.permission_schemes.id;


--
-- Name: project_role_members; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.project_role_members (
    role_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: project_roles; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.project_roles (
    id integer NOT NULL,
    project_id integer NOT NULL,
    key text NOT NULL,
    name text NOT NULL
);


--
-- Name: project_roles_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.project_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.project_roles_id_seq OWNED BY quetzal.project_roles.id;


--
-- Name: projects; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.projects (
    id integer NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    lead_id integer NOT NULL,
    next_num integer DEFAULT 1 NOT NULL,
    workflow_id integer,
    site_id integer,
    permission_scheme_id integer
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.projects_id_seq OWNED BY quetzal.projects.id;


--
-- Name: reaction_marks; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.reaction_marks (
    id bigint NOT NULL,
    kind text NOT NULL,
    target_id integer NOT NULL,
    user_id integer NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reaction_marks_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.reaction_marks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reaction_marks_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.reaction_marks_id_seq OWNED BY quetzal.reaction_marks.id;


--
-- Name: reactions; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.reactions (
    id integer NOT NULL,
    issue_id integer NOT NULL,
    user_id integer NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reactions_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.reactions_id_seq OWNED BY quetzal.reactions.id;


--
-- Name: request_types; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.request_types (
    key text NOT NULL,
    name text NOT NULL,
    helpdesk_type text NOT NULL,
    description text DEFAULT ''::text NOT NULL
);


--
-- Name: saved_filters; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.saved_filters (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    jql text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_filters_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.saved_filters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saved_filters_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.saved_filters_id_seq OWNED BY quetzal.saved_filters.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.schema_migrations (
    id text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: screen_fields; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.screen_fields (
    screen_id integer NOT NULL,
    field_id integer NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    required boolean DEFAULT false NOT NULL
);


--
-- Name: screens; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.screens (
    id integer NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL
);


--
-- Name: screens_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.screens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: screens_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.screens_id_seq OWNED BY quetzal.screens.id;


--
-- Name: site_members; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.site_members (
    site_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: sites; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.sites (
    id integer NOT NULL,
    key text NOT NULL,
    name text NOT NULL
);


--
-- Name: sites_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.sites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sites_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.sites_id_seq OWNED BY quetzal.sites.id;


--
-- Name: sla_policies; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.sla_policies (
    type text NOT NULL,
    priority text DEFAULT ''::text NOT NULL,
    response_minutes integer NOT NULL,
    resolve_minutes integer NOT NULL
);


--
-- Name: space_members; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.space_members (
    space_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: space_permissions; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.space_permissions (
    space_id integer NOT NULL,
    permission text NOT NULL,
    grantee_type text NOT NULL,
    grantee text DEFAULT ''::text NOT NULL
);


--
-- Name: spaces; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.spaces (
    id integer NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    kind text DEFAULT 'team'::text NOT NULL,
    owner_user_id integer,
    site_id integer,
    CONSTRAINT spaces_kind_check CHECK ((kind = ANY (ARRAY['personal'::text, 'team'::text])))
);


--
-- Name: spaces_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.spaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: spaces_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.spaces_id_seq OWNED BY quetzal.spaces.id;


--
-- Name: sprints; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.sprints (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    state text NOT NULL,
    goal text DEFAULT ''::text NOT NULL,
    CONSTRAINT sprints_state_check CHECK ((state = ANY (ARRAY['planned'::text, 'active'::text, 'closed'::text])))
);


--
-- Name: sprints_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.sprints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sprints_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.sprints_id_seq OWNED BY quetzal.sprints.id;


--
-- Name: sso_settings; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.sso_settings (
    id integer NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    entity_id text DEFAULT 'quetzal-demo-sp'::text NOT NULL,
    acs_path text DEFAULT '/api/sso/saml/acs'::text NOT NULL,
    idp_metadata_text text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    oidc_issuer text DEFAULT ''::text NOT NULL,
    oidc_client_id text DEFAULT ''::text NOT NULL,
    oidc_client_secret text DEFAULT ''::text NOT NULL,
    oidc_redirect_uri text DEFAULT 'http://127.0.0.1:3210/api/sso/oidc/callback'::text NOT NULL,
    CONSTRAINT sso_settings_id_check CHECK ((id = 1))
);


--
-- Name: users; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    password_hash text,
    auth_source text DEFAULT 'local'::text NOT NULL,
    disabled boolean DEFAULT false NOT NULL,
    helpdesk_agent boolean DEFAULT false NOT NULL,
    CONSTRAINT users_auth_source_check CHECK ((auth_source = ANY (ARRAY['local'::text, 'ldap'::text]))),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'viewer'::text])))
);


--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: quetzal; Owner: -
--

COMMENT ON COLUMN quetzal.users.password_hash IS 'scrypt hash (salt:hex$derived:hex). Null for LDAP-only accounts.';


--
-- Name: COLUMN users.auth_source; Type: COMMENT; Schema: quetzal; Owner: -
--

COMMENT ON COLUMN quetzal.users.auth_source IS 'local | ldap';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.users_id_seq OWNED BY quetzal.users.id;


--
-- Name: versions; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.versions (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    released boolean DEFAULT false NOT NULL,
    release_date date
);


--
-- Name: versions_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: versions_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.versions_id_seq OWNED BY quetzal.versions.id;


--
-- Name: webhooks; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.webhooks (
    id bigint NOT NULL,
    url text NOT NULL,
    secret text DEFAULT ''::text NOT NULL,
    events jsonb DEFAULT '["issue.status_changed", "issue.comment_added"]'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhooks_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.webhooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.webhooks_id_seq OWNED BY quetzal.webhooks.id;


--
-- Name: wiki_page_meta; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.wiki_page_meta (
    page_id integer NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by integer
);


--
-- Name: workflow_statuses; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.workflow_statuses (
    id integer NOT NULL,
    workflow_id integer NOT NULL,
    status text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: workflow_statuses_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.workflow_statuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.workflow_statuses_id_seq OWNED BY quetzal.workflow_statuses.id;


--
-- Name: workflow_steps; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.workflow_steps (
    workflow_id integer NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL
);


--
-- Name: workflow_transitions; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.workflow_transitions (
    id integer NOT NULL,
    workflow_id integer NOT NULL,
    from_status text NOT NULL,
    to_status text NOT NULL,
    name text NOT NULL,
    conditions_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    validators_json jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: workflow_transitions_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.workflow_transitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflow_transitions_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.workflow_transitions_id_seq OWNED BY quetzal.workflow_transitions.id;


--
-- Name: workflows; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.workflows (
    id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: workflows_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.workflows_id_seq OWNED BY quetzal.workflows.id;


--
-- Name: worklogs; Type: TABLE; Schema: quetzal; Owner: -
--

CREATE TABLE quetzal.worklogs (
    id bigint NOT NULL,
    issue_id integer NOT NULL,
    user_id integer NOT NULL,
    minutes integer NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: worklogs_id_seq; Type: SEQUENCE; Schema: quetzal; Owner: -
--

CREATE SEQUENCE quetzal.worklogs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worklogs_id_seq; Type: SEQUENCE OWNED BY; Schema: quetzal; Owner: -
--

ALTER SEQUENCE quetzal.worklogs_id_seq OWNED BY quetzal.worklogs.id;


--
-- Name: activity id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.activity ALTER COLUMN id SET DEFAULT nextval('quetzal.activity_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.audit_log ALTER COLUMN id SET DEFAULT nextval('quetzal.audit_log_id_seq'::regclass);


--
-- Name: automation_rules id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.automation_rules ALTER COLUMN id SET DEFAULT nextval('quetzal.automation_rules_id_seq'::regclass);


--
-- Name: automation_runs id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.automation_runs ALTER COLUMN id SET DEFAULT nextval('quetzal.automation_runs_id_seq'::regclass);


--
-- Name: calendar_event_types id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_event_types ALTER COLUMN id SET DEFAULT nextval('quetzal.calendar_event_types_id_seq'::regclass);


--
-- Name: calendar_events id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_events ALTER COLUMN id SET DEFAULT nextval('quetzal.calendar_events_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.comments ALTER COLUMN id SET DEFAULT nextval('quetzal.comments_id_seq'::regclass);


--
-- Name: components id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.components ALTER COLUMN id SET DEFAULT nextval('quetzal.components_id_seq'::regclass);


--
-- Name: custom_fields id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.custom_fields ALTER COLUMN id SET DEFAULT nextval('quetzal.custom_fields_id_seq'::regclass);


--
-- Name: dashboard_gadgets id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.dashboard_gadgets ALTER COLUMN id SET DEFAULT nextval('quetzal.dashboard_gadgets_id_seq'::regclass);


--
-- Name: dashboards id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.dashboards ALTER COLUMN id SET DEFAULT nextval('quetzal.dashboards_id_seq'::regclass);


--
-- Name: field_contexts id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.field_contexts ALTER COLUMN id SET DEFAULT nextval('quetzal.field_contexts_id_seq'::regclass);


--
-- Name: github_check_runs id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_check_runs ALTER COLUMN id SET DEFAULT nextval('quetzal.github_check_runs_id_seq'::regclass);


--
-- Name: github_commits id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_commits ALTER COLUMN id SET DEFAULT nextval('quetzal.github_commits_id_seq'::regclass);


--
-- Name: github_issue_links id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_issue_links ALTER COLUMN id SET DEFAULT nextval('quetzal.github_issue_links_id_seq'::regclass);


--
-- Name: helpdesk_automation_log id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_automation_log ALTER COLUMN id SET DEFAULT nextval('quetzal.helpdesk_automation_log_id_seq'::regclass);


--
-- Name: helpdesk_csat id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_csat ALTER COLUMN id SET DEFAULT nextval('quetzal.helpdesk_csat_id_seq'::regclass);


--
-- Name: helpdesk_macros id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_macros ALTER COLUMN id SET DEFAULT nextval('quetzal.helpdesk_macros_id_seq'::regclass);


--
-- Name: helpdesk_notes id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_notes ALTER COLUMN id SET DEFAULT nextval('quetzal.helpdesk_notes_id_seq'::regclass);


--
-- Name: helpdesk_tickets id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_tickets ALTER COLUMN id SET DEFAULT nextval('quetzal.helpdesk_tickets_id_seq'::regclass);


--
-- Name: issue_links id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_links ALTER COLUMN id SET DEFAULT nextval('quetzal.issue_links_id_seq'::regclass);


--
-- Name: issues id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues ALTER COLUMN id SET DEFAULT nextval('quetzal.issues_id_seq'::regclass);


--
-- Name: labels id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.labels ALTER COLUMN id SET DEFAULT nextval('quetzal.labels_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.notifications ALTER COLUMN id SET DEFAULT nextval('quetzal.notifications_id_seq'::regclass);


--
-- Name: page_attachments id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_attachments ALTER COLUMN id SET DEFAULT nextval('quetzal.page_attachments_id_seq'::regclass);


--
-- Name: page_comments id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_comments ALTER COLUMN id SET DEFAULT nextval('quetzal.page_comments_id_seq'::regclass);


--
-- Name: page_revisions id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_revisions ALTER COLUMN id SET DEFAULT nextval('quetzal.page_revisions_id_seq'::regclass);


--
-- Name: page_templates id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_templates ALTER COLUMN id SET DEFAULT nextval('quetzal.page_templates_id_seq'::regclass);


--
-- Name: page_versions id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_versions ALTER COLUMN id SET DEFAULT nextval('quetzal.page_versions_id_seq'::regclass);


--
-- Name: pages id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.pages ALTER COLUMN id SET DEFAULT nextval('quetzal.pages_id_seq'::regclass);


--
-- Name: permission_schemes id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.permission_schemes ALTER COLUMN id SET DEFAULT nextval('quetzal.permission_schemes_id_seq'::regclass);


--
-- Name: project_roles id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.project_roles ALTER COLUMN id SET DEFAULT nextval('quetzal.project_roles_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.projects ALTER COLUMN id SET DEFAULT nextval('quetzal.projects_id_seq'::regclass);


--
-- Name: reaction_marks id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reaction_marks ALTER COLUMN id SET DEFAULT nextval('quetzal.reaction_marks_id_seq'::regclass);


--
-- Name: reactions id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reactions ALTER COLUMN id SET DEFAULT nextval('quetzal.reactions_id_seq'::regclass);


--
-- Name: saved_filters id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.saved_filters ALTER COLUMN id SET DEFAULT nextval('quetzal.saved_filters_id_seq'::regclass);


--
-- Name: screens id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.screens ALTER COLUMN id SET DEFAULT nextval('quetzal.screens_id_seq'::regclass);


--
-- Name: sites id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.sites ALTER COLUMN id SET DEFAULT nextval('quetzal.sites_id_seq'::regclass);


--
-- Name: spaces id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.spaces ALTER COLUMN id SET DEFAULT nextval('quetzal.spaces_id_seq'::regclass);


--
-- Name: sprints id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.sprints ALTER COLUMN id SET DEFAULT nextval('quetzal.sprints_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.users ALTER COLUMN id SET DEFAULT nextval('quetzal.users_id_seq'::regclass);


--
-- Name: versions id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.versions ALTER COLUMN id SET DEFAULT nextval('quetzal.versions_id_seq'::regclass);


--
-- Name: webhooks id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.webhooks ALTER COLUMN id SET DEFAULT nextval('quetzal.webhooks_id_seq'::regclass);


--
-- Name: workflow_statuses id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_statuses ALTER COLUMN id SET DEFAULT nextval('quetzal.workflow_statuses_id_seq'::regclass);


--
-- Name: workflow_transitions id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_transitions ALTER COLUMN id SET DEFAULT nextval('quetzal.workflow_transitions_id_seq'::regclass);


--
-- Name: workflows id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflows ALTER COLUMN id SET DEFAULT nextval('quetzal.workflows_id_seq'::regclass);


--
-- Name: worklogs id; Type: DEFAULT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.worklogs ALTER COLUMN id SET DEFAULT nextval('quetzal.worklogs_id_seq'::regclass);


--
-- Name: activity activity_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.activity
    ADD CONSTRAINT activity_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: automation_runs automation_runs_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.automation_runs
    ADD CONSTRAINT automation_runs_pkey PRIMARY KEY (id);


--
-- Name: boards boards_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.boards
    ADD CONSTRAINT boards_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_attendees calendar_event_attendees_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_pkey PRIMARY KEY (event_id, user_id);


--
-- Name: calendar_event_types calendar_event_types_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_event_types
    ADD CONSTRAINT calendar_event_types_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: components components_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);


--
-- Name: custom_fields custom_fields_key_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.custom_fields
    ADD CONSTRAINT custom_fields_key_key UNIQUE (key);


--
-- Name: custom_fields custom_fields_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.custom_fields
    ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);


--
-- Name: dashboard_gadgets dashboard_gadgets_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.dashboard_gadgets
    ADD CONSTRAINT dashboard_gadgets_pkey PRIMARY KEY (id);


--
-- Name: dashboards dashboards_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.dashboards
    ADD CONSTRAINT dashboards_pkey PRIMARY KEY (id);


--
-- Name: field_contexts field_contexts_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.field_contexts
    ADD CONSTRAINT field_contexts_pkey PRIMARY KEY (id);


--
-- Name: field_contexts field_contexts_project_id_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.field_contexts
    ADD CONSTRAINT field_contexts_project_id_key UNIQUE (project_id);


--
-- Name: github_check_runs github_check_runs_github_id; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_check_runs
    ADD CONSTRAINT github_check_runs_github_id UNIQUE (github_id);


--
-- Name: github_check_runs github_check_runs_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_check_runs
    ADD CONSTRAINT github_check_runs_pkey PRIMARY KEY (id);


--
-- Name: github_commit_issues github_commit_issues_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_commit_issues
    ADD CONSTRAINT github_commit_issues_pkey PRIMARY KEY (commit_id, issue_key);


--
-- Name: github_commits github_commits_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_commits
    ADD CONSTRAINT github_commits_pkey PRIMARY KEY (id);


--
-- Name: github_commits github_commits_repo_sha; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_commits
    ADD CONSTRAINT github_commits_repo_sha UNIQUE (repo_full_name, sha);


--
-- Name: github_issue_links github_issue_links_github_node_id_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_issue_links
    ADD CONSTRAINT github_issue_links_github_node_id_key UNIQUE (github_node_id);


--
-- Name: github_issue_links github_issue_links_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_issue_links
    ADD CONSTRAINT github_issue_links_pkey PRIMARY KEY (id);


--
-- Name: helpdesk_automation_log helpdesk_automation_log_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_automation_log
    ADD CONSTRAINT helpdesk_automation_log_pkey PRIMARY KEY (id);


--
-- Name: helpdesk_automation_log helpdesk_automation_log_ticket_id_kind_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_automation_log
    ADD CONSTRAINT helpdesk_automation_log_ticket_id_kind_key UNIQUE (ticket_id, kind);


--
-- Name: helpdesk_csat helpdesk_csat_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_csat
    ADD CONSTRAINT helpdesk_csat_pkey PRIMARY KEY (id);


--
-- Name: helpdesk_csat helpdesk_csat_token_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_csat
    ADD CONSTRAINT helpdesk_csat_token_key UNIQUE (token);


--
-- Name: helpdesk_macros helpdesk_macros_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_macros
    ADD CONSTRAINT helpdesk_macros_pkey PRIMARY KEY (id);


--
-- Name: helpdesk_notes helpdesk_notes_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_notes
    ADD CONSTRAINT helpdesk_notes_pkey PRIMARY KEY (id);


--
-- Name: helpdesk_ticket_labels helpdesk_ticket_labels_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_ticket_labels
    ADD CONSTRAINT helpdesk_ticket_labels_pkey PRIMARY KEY (ticket_id, label_id);


--
-- Name: helpdesk_tickets helpdesk_tickets_key_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_key_key UNIQUE (key);


--
-- Name: helpdesk_tickets helpdesk_tickets_num_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_num_key UNIQUE (num);


--
-- Name: helpdesk_tickets helpdesk_tickets_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_pkey PRIMARY KEY (id);


--
-- Name: integration_connectors integration_connectors_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.integration_connectors
    ADD CONSTRAINT integration_connectors_pkey PRIMARY KEY (id);


--
-- Name: issue_custom_values issue_custom_values_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_custom_values
    ADD CONSTRAINT issue_custom_values_pkey PRIMARY KEY (issue_id, field_id);


--
-- Name: issue_labels issue_labels_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_labels
    ADD CONSTRAINT issue_labels_pkey PRIMARY KEY (issue_id, label_id);


--
-- Name: issue_links issue_links_from_issue_id_to_issue_id_type_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_links
    ADD CONSTRAINT issue_links_from_issue_id_to_issue_id_type_key UNIQUE (from_issue_id, to_issue_id, type);


--
-- Name: issue_links issue_links_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_links
    ADD CONSTRAINT issue_links_pkey PRIMARY KEY (id);


--
-- Name: issue_votes issue_votes_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_votes
    ADD CONSTRAINT issue_votes_pkey PRIMARY KEY (issue_id, user_id);


--
-- Name: issue_watchers issue_watchers_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_watchers
    ADD CONSTRAINT issue_watchers_pkey PRIMARY KEY (issue_id, user_id);


--
-- Name: issues issues_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_pkey PRIMARY KEY (id);


--
-- Name: issues issues_project_id_num_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_project_id_num_key UNIQUE (project_id, num);


--
-- Name: labels labels_name_norm_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.labels
    ADD CONSTRAINT labels_name_norm_key UNIQUE (name_norm);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: ldap_settings ldap_settings_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.ldap_settings
    ADD CONSTRAINT ldap_settings_pkey PRIMARY KEY (id);


--
-- Name: notification_channels notification_channels_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.notification_channels
    ADD CONSTRAINT notification_channels_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: ops_meta ops_meta_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.ops_meta
    ADD CONSTRAINT ops_meta_pkey PRIMARY KEY (key);


--
-- Name: page_attachments page_attachments_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_attachments
    ADD CONSTRAINT page_attachments_pkey PRIMARY KEY (id);


--
-- Name: page_comments page_comments_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_comments
    ADD CONSTRAINT page_comments_pkey PRIMARY KEY (id);


--
-- Name: page_labels page_labels_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_labels
    ADD CONSTRAINT page_labels_pkey PRIMARY KEY (page_id, label);


--
-- Name: page_permissions page_permissions_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_permissions
    ADD CONSTRAINT page_permissions_pkey PRIMARY KEY (page_id, permission, grantee_type, grantee);


--
-- Name: page_properties page_properties_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_properties
    ADD CONSTRAINT page_properties_pkey PRIMARY KEY (page_id, key);


--
-- Name: page_revisions page_revisions_page_id_version_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_revisions
    ADD CONSTRAINT page_revisions_page_id_version_key UNIQUE (page_id, version);


--
-- Name: page_revisions page_revisions_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_revisions
    ADD CONSTRAINT page_revisions_pkey PRIMARY KEY (id);


--
-- Name: page_templates page_templates_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_templates
    ADD CONSTRAINT page_templates_pkey PRIMARY KEY (id);


--
-- Name: page_versions page_versions_page_id_version_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_versions
    ADD CONSTRAINT page_versions_page_id_version_key UNIQUE (page_id, version);


--
-- Name: page_versions page_versions_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_versions
    ADD CONSTRAINT page_versions_pkey PRIMARY KEY (id);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: pages pages_space_id_slug_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.pages
    ADD CONSTRAINT pages_space_id_slug_key UNIQUE (space_id, slug);


--
-- Name: permission_scheme_grants permission_scheme_grants_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.permission_scheme_grants
    ADD CONSTRAINT permission_scheme_grants_pkey PRIMARY KEY (scheme_id, permission, grantee_type, grantee);


--
-- Name: permission_schemes permission_schemes_name_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.permission_schemes
    ADD CONSTRAINT permission_schemes_name_key UNIQUE (name);


--
-- Name: permission_schemes permission_schemes_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.permission_schemes
    ADD CONSTRAINT permission_schemes_pkey PRIMARY KEY (id);


--
-- Name: project_role_members project_role_members_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.project_role_members
    ADD CONSTRAINT project_role_members_pkey PRIMARY KEY (role_id, user_id);


--
-- Name: project_roles project_roles_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.project_roles
    ADD CONSTRAINT project_roles_pkey PRIMARY KEY (id);


--
-- Name: project_roles project_roles_project_id_key_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.project_roles
    ADD CONSTRAINT project_roles_project_id_key_key UNIQUE (project_id, key);


--
-- Name: projects projects_key_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.projects
    ADD CONSTRAINT projects_key_key UNIQUE (key);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: reaction_marks reaction_marks_kind_target_id_user_id_emoji_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reaction_marks
    ADD CONSTRAINT reaction_marks_kind_target_id_user_id_emoji_key UNIQUE (kind, target_id, user_id, emoji);


--
-- Name: reaction_marks reaction_marks_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reaction_marks
    ADD CONSTRAINT reaction_marks_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_issue_id_user_id_emoji_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reactions
    ADD CONSTRAINT reactions_issue_id_user_id_emoji_key UNIQUE (issue_id, user_id, emoji);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: request_types request_types_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.request_types
    ADD CONSTRAINT request_types_pkey PRIMARY KEY (key);


--
-- Name: saved_filters saved_filters_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.saved_filters
    ADD CONSTRAINT saved_filters_pkey PRIMARY KEY (id);


--
-- Name: saved_filters saved_filters_user_id_name_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.saved_filters
    ADD CONSTRAINT saved_filters_user_id_name_key UNIQUE (user_id, name);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: screen_fields screen_fields_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.screen_fields
    ADD CONSTRAINT screen_fields_pkey PRIMARY KEY (screen_id, field_id);


--
-- Name: screens screens_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.screens
    ADD CONSTRAINT screens_pkey PRIMARY KEY (id);


--
-- Name: site_members site_members_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.site_members
    ADD CONSTRAINT site_members_pkey PRIMARY KEY (site_id, user_id);


--
-- Name: sites sites_key_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.sites
    ADD CONSTRAINT sites_key_key UNIQUE (key);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: sla_policies sla_policies_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.sla_policies
    ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (type, priority);


--
-- Name: space_members space_members_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.space_members
    ADD CONSTRAINT space_members_pkey PRIMARY KEY (space_id, user_id);


--
-- Name: space_permissions space_permissions_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.space_permissions
    ADD CONSTRAINT space_permissions_pkey PRIMARY KEY (space_id, permission, grantee_type, grantee);


--
-- Name: spaces spaces_key_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.spaces
    ADD CONSTRAINT spaces_key_key UNIQUE (key);


--
-- Name: spaces spaces_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.spaces
    ADD CONSTRAINT spaces_pkey PRIMARY KEY (id);


--
-- Name: sprints sprints_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.sprints
    ADD CONSTRAINT sprints_pkey PRIMARY KEY (id);


--
-- Name: sso_settings sso_settings_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.sso_settings
    ADD CONSTRAINT sso_settings_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: versions versions_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.versions
    ADD CONSTRAINT versions_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: wiki_page_meta wiki_page_meta_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.wiki_page_meta
    ADD CONSTRAINT wiki_page_meta_pkey PRIMARY KEY (page_id);


--
-- Name: workflow_statuses workflow_statuses_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_statuses
    ADD CONSTRAINT workflow_statuses_pkey PRIMARY KEY (id);


--
-- Name: workflow_statuses workflow_statuses_workflow_id_status_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_statuses
    ADD CONSTRAINT workflow_statuses_workflow_id_status_key UNIQUE (workflow_id, status);


--
-- Name: workflow_steps workflow_steps_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_steps
    ADD CONSTRAINT workflow_steps_pkey PRIMARY KEY (workflow_id, from_status, to_status);


--
-- Name: workflow_transitions workflow_transitions_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_transitions
    ADD CONSTRAINT workflow_transitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_transitions workflow_transitions_workflow_id_from_status_to_status_key; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_transitions
    ADD CONSTRAINT workflow_transitions_workflow_id_from_status_to_status_key UNIQUE (workflow_id, from_status, to_status);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: worklogs worklogs_pkey; Type: CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.worklogs
    ADD CONSTRAINT worklogs_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_author; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_activity_author ON quetzal.activity USING btree (author_id);


--
-- Name: idx_activity_issue; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_activity_issue ON quetzal.activity USING btree (issue_id, created_at DESC);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_audit_log_action ON quetzal.audit_log USING btree (action, created_at DESC);


--
-- Name: idx_audit_log_actor; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_audit_log_actor ON quetzal.audit_log USING btree (actor_id);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_audit_log_created ON quetzal.audit_log USING btree (created_at DESC);


--
-- Name: idx_automation_rules_trigger; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_automation_rules_trigger ON quetzal.automation_rules USING btree (trigger_event, enabled);


--
-- Name: idx_automation_runs_created; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_automation_runs_created ON quetzal.automation_runs USING btree (created_at DESC);


--
-- Name: idx_automation_runs_rule_issue; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_automation_runs_rule_issue ON quetzal.automation_runs USING btree (rule_id, issue_key, trigger_event);


--
-- Name: idx_boards_owner; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_boards_owner ON quetzal.boards USING btree (owner_user_id, scope, lower(name));


--
-- Name: idx_boards_project; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_boards_project ON quetzal.boards USING btree (project_id) WHERE (project_id IS NOT NULL);


--
-- Name: idx_calendar_event_attendees_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_event_attendees_user ON quetzal.calendar_event_attendees USING btree (user_id);


--
-- Name: idx_calendar_event_types_owner; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_event_types_owner ON quetzal.calendar_event_types USING btree (owner_user_id);


--
-- Name: idx_calendar_event_types_project; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_event_types_project ON quetzal.calendar_event_types USING btree (project_id);


--
-- Name: idx_calendar_event_types_scope; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_event_types_scope ON quetzal.calendar_event_types USING btree (scope, project_id);


--
-- Name: idx_calendar_events_created_by; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_events_created_by ON quetzal.calendar_events USING btree (created_by);


--
-- Name: idx_calendar_events_owner; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_events_owner ON quetzal.calendar_events USING btree (owner_user_id);


--
-- Name: idx_calendar_events_project; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_events_project ON quetzal.calendar_events USING btree (project_id);


--
-- Name: idx_calendar_events_range; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_events_range ON quetzal.calendar_events USING btree (starts_on, ends_on);


--
-- Name: idx_calendar_events_type; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_calendar_events_type ON quetzal.calendar_events USING btree (type_id);


--
-- Name: idx_comments_author; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_comments_author ON quetzal.comments USING btree (author_id);


--
-- Name: idx_comments_issue; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_comments_issue ON quetzal.comments USING btree (issue_id, created_at);


--
-- Name: idx_comments_parent; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_comments_parent ON quetzal.comments USING btree (parent_id);


--
-- Name: idx_components_project; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_components_project ON quetzal.components USING btree (project_id);


--
-- Name: idx_dashboard_gadgets_dash; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_dashboard_gadgets_dash ON quetzal.dashboard_gadgets USING btree (dashboard_id, "position", id);


--
-- Name: idx_dashboards_owner; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_dashboards_owner ON quetzal.dashboards USING btree (owner_user_id, lower(name));


--
-- Name: idx_field_contexts_screen; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_field_contexts_screen ON quetzal.field_contexts USING btree (screen_id);


--
-- Name: idx_github_check_runs_head; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_github_check_runs_head ON quetzal.github_check_runs USING btree (repo_full_name, head_sha);


--
-- Name: idx_github_check_runs_updated; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_github_check_runs_updated ON quetzal.github_check_runs USING btree (updated_at DESC);


--
-- Name: idx_github_commit_issues_key; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_github_commit_issues_key ON quetzal.github_commit_issues USING btree (issue_key);


--
-- Name: idx_github_commits_committed; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_github_commits_committed ON quetzal.github_commits USING btree (committed_at DESC NULLS LAST);


--
-- Name: idx_github_issue_links_key; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_github_issue_links_key ON quetzal.github_issue_links USING btree (issue_key);


--
-- Name: idx_github_issue_links_repo_num; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_github_issue_links_repo_num ON quetzal.github_issue_links USING btree (repo_full_name, github_number);


--
-- Name: idx_helpdesk_automation_log_kind; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_automation_log_kind ON quetzal.helpdesk_automation_log USING btree (kind, created_at DESC);


--
-- Name: idx_helpdesk_csat_ticket; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE UNIQUE INDEX idx_helpdesk_csat_ticket ON quetzal.helpdesk_csat USING btree (ticket_id);


--
-- Name: idx_helpdesk_macros_created_by; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_macros_created_by ON quetzal.helpdesk_macros USING btree (created_by);


--
-- Name: idx_helpdesk_notes_author; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_notes_author ON quetzal.helpdesk_notes USING btree (author_id);


--
-- Name: idx_helpdesk_notes_ticket; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_notes_ticket ON quetzal.helpdesk_notes USING btree (ticket_id, created_at);


--
-- Name: idx_helpdesk_ticket_labels_label; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_ticket_labels_label ON quetzal.helpdesk_ticket_labels USING btree (label_id);


--
-- Name: idx_helpdesk_tickets_assignee; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_tickets_assignee ON quetzal.helpdesk_tickets USING btree (assignee_id);


--
-- Name: idx_helpdesk_tickets_assignee_status; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_tickets_assignee_status ON quetzal.helpdesk_tickets USING btree (assignee_id, status);


--
-- Name: idx_helpdesk_tickets_priority; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_tickets_priority ON quetzal.helpdesk_tickets USING btree (priority);


--
-- Name: idx_helpdesk_tickets_requester; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_tickets_requester ON quetzal.helpdesk_tickets USING btree (requester_id);


--
-- Name: idx_helpdesk_tickets_site; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_tickets_site ON quetzal.helpdesk_tickets USING btree (site_id);


--
-- Name: idx_helpdesk_tickets_site_status_updated; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_tickets_site_status_updated ON quetzal.helpdesk_tickets USING btree (site_id, status, updated_at DESC);


--
-- Name: idx_helpdesk_tickets_status; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_tickets_status ON quetzal.helpdesk_tickets USING btree (status);


--
-- Name: idx_helpdesk_tickets_type; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_helpdesk_tickets_type ON quetzal.helpdesk_tickets USING btree (type);


--
-- Name: idx_issue_custom_values_field; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issue_custom_values_field ON quetzal.issue_custom_values USING btree (field_id);


--
-- Name: idx_issue_labels_label; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issue_labels_label ON quetzal.issue_labels USING btree (label_id);


--
-- Name: idx_issue_links_from; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issue_links_from ON quetzal.issue_links USING btree (from_issue_id);


--
-- Name: idx_issue_links_to; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issue_links_to ON quetzal.issue_links USING btree (to_issue_id);


--
-- Name: idx_issue_votes_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issue_votes_user ON quetzal.issue_votes USING btree (user_id);


--
-- Name: idx_issue_watchers_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issue_watchers_user ON quetzal.issue_watchers USING btree (user_id);


--
-- Name: idx_issues_assignee; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_assignee ON quetzal.issues USING btree (assignee_id);


--
-- Name: idx_issues_component; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_component ON quetzal.issues USING btree (component_id);


--
-- Name: idx_issues_fix_version; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_fix_version ON quetzal.issues USING btree (fix_version_id);


--
-- Name: idx_issues_parent; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_parent ON quetzal.issues USING btree (parent_id);


--
-- Name: idx_issues_project_assignee_status; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_project_assignee_status ON quetzal.issues USING btree (project_id, assignee_id, status);


--
-- Name: idx_issues_project_status; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_project_status ON quetzal.issues USING btree (project_id, status);


--
-- Name: idx_issues_project_status_updated; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_project_status_updated ON quetzal.issues USING btree (project_id, status, updated_at DESC);


--
-- Name: idx_issues_reporter; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_reporter ON quetzal.issues USING btree (reporter_id);


--
-- Name: idx_issues_search_tsv; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_search_tsv ON quetzal.issues USING gin (search_tsv);


--
-- Name: idx_issues_sprint; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_issues_sprint ON quetzal.issues USING btree (sprint_id);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_notifications_user_created ON quetzal.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_page_attachments_page; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_page_attachments_page ON quetzal.page_attachments USING btree (page_id);


--
-- Name: idx_page_attachments_uploaded_by; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_page_attachments_uploaded_by ON quetzal.page_attachments USING btree (uploaded_by);


--
-- Name: idx_page_comments_author; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_page_comments_author ON quetzal.page_comments USING btree (author_id);


--
-- Name: idx_page_comments_page; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_page_comments_page ON quetzal.page_comments USING btree (page_id, created_at);


--
-- Name: idx_page_labels_label; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_page_labels_label ON quetzal.page_labels USING btree (lower(label));


--
-- Name: idx_page_revisions_author; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_page_revisions_author ON quetzal.page_revisions USING btree (author_id);


--
-- Name: idx_page_templates_space; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_page_templates_space ON quetzal.page_templates USING btree (space_id);


--
-- Name: idx_page_versions_author; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_page_versions_author ON quetzal.page_versions USING btree (author_id);


--
-- Name: idx_pages_author; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_pages_author ON quetzal.pages USING btree (author_id);


--
-- Name: idx_pages_parent; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_pages_parent ON quetzal.pages USING btree (parent_id);


--
-- Name: idx_project_role_members_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_project_role_members_user ON quetzal.project_role_members USING btree (user_id);


--
-- Name: idx_projects_lead; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_projects_lead ON quetzal.projects USING btree (lead_id);


--
-- Name: idx_projects_permission_scheme; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_projects_permission_scheme ON quetzal.projects USING btree (permission_scheme_id);


--
-- Name: idx_projects_site; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_projects_site ON quetzal.projects USING btree (site_id);


--
-- Name: idx_projects_workflow; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_projects_workflow ON quetzal.projects USING btree (workflow_id);


--
-- Name: idx_reaction_marks_target; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_reaction_marks_target ON quetzal.reaction_marks USING btree (kind, target_id);


--
-- Name: idx_reaction_marks_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_reaction_marks_user ON quetzal.reaction_marks USING btree (user_id);


--
-- Name: idx_reactions_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_reactions_user ON quetzal.reactions USING btree (user_id);


--
-- Name: idx_saved_filters_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_saved_filters_user ON quetzal.saved_filters USING btree (user_id, name);


--
-- Name: idx_screen_fields_field; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_screen_fields_field ON quetzal.screen_fields USING btree (field_id);


--
-- Name: idx_site_members_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_site_members_user ON quetzal.site_members USING btree (user_id);


--
-- Name: idx_space_members_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_space_members_user ON quetzal.space_members USING btree (user_id);


--
-- Name: idx_spaces_owner; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_spaces_owner ON quetzal.spaces USING btree (owner_user_id);


--
-- Name: idx_spaces_site; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_spaces_site ON quetzal.spaces USING btree (site_id);


--
-- Name: idx_sprints_project; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_sprints_project ON quetzal.sprints USING btree (project_id);


--
-- Name: idx_users_email_lower; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE UNIQUE INDEX idx_users_email_lower ON quetzal.users USING btree (lower(email));


--
-- Name: idx_versions_project; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_versions_project ON quetzal.versions USING btree (project_id);


--
-- Name: idx_webhooks_enabled; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_webhooks_enabled ON quetzal.webhooks USING btree (enabled);


--
-- Name: idx_wiki_page_meta_deleted_by; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_wiki_page_meta_deleted_by ON quetzal.wiki_page_meta USING btree (deleted_by);


--
-- Name: idx_workflow_statuses_workflow; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_workflow_statuses_workflow ON quetzal.workflow_statuses USING btree (workflow_id, sort_order);


--
-- Name: idx_workflow_transitions_workflow; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_workflow_transitions_workflow ON quetzal.workflow_transitions USING btree (workflow_id);


--
-- Name: idx_worklogs_issue; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_worklogs_issue ON quetzal.worklogs USING btree (issue_id, created_at DESC);


--
-- Name: idx_worklogs_user; Type: INDEX; Schema: quetzal; Owner: -
--

CREATE INDEX idx_worklogs_user ON quetzal.worklogs USING btree (user_id);


--
-- Name: activity activity_author_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.activity
    ADD CONSTRAINT activity_author_id_fkey FOREIGN KEY (author_id) REFERENCES quetzal.users(id);


--
-- Name: activity activity_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.activity
    ADD CONSTRAINT activity_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES quetzal.users(id);


--
-- Name: automation_runs automation_runs_rule_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.automation_runs
    ADD CONSTRAINT automation_runs_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES quetzal.automation_rules(id) ON DELETE CASCADE;


--
-- Name: boards boards_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.boards
    ADD CONSTRAINT boards_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: boards boards_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.boards
    ADD CONSTRAINT boards_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: calendar_event_attendees calendar_event_attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES quetzal.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_event_attendees calendar_event_attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: calendar_event_types calendar_event_types_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_event_types
    ADD CONSTRAINT calendar_event_types_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: calendar_event_types calendar_event_types_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_event_types
    ADD CONSTRAINT calendar_event_types_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES quetzal.users(id);


--
-- Name: calendar_events calendar_events_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_events
    ADD CONSTRAINT calendar_events_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_events
    ADD CONSTRAINT calendar_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_type_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.calendar_events
    ADD CONSTRAINT calendar_events_type_id_fkey FOREIGN KEY (type_id) REFERENCES quetzal.calendar_event_types(id);


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES quetzal.users(id);


--
-- Name: comments comments_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.comments
    ADD CONSTRAINT comments_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES quetzal.comments(id) ON DELETE CASCADE;


--
-- Name: components components_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.components
    ADD CONSTRAINT components_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: dashboard_gadgets dashboard_gadgets_dashboard_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.dashboard_gadgets
    ADD CONSTRAINT dashboard_gadgets_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES quetzal.dashboards(id) ON DELETE CASCADE;


--
-- Name: dashboards dashboards_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.dashboards
    ADD CONSTRAINT dashboards_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: field_contexts field_contexts_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.field_contexts
    ADD CONSTRAINT field_contexts_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: field_contexts field_contexts_screen_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.field_contexts
    ADD CONSTRAINT field_contexts_screen_id_fkey FOREIGN KEY (screen_id) REFERENCES quetzal.screens(id) ON DELETE CASCADE;


--
-- Name: github_commit_issues github_commit_issues_commit_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.github_commit_issues
    ADD CONSTRAINT github_commit_issues_commit_id_fkey FOREIGN KEY (commit_id) REFERENCES quetzal.github_commits(id) ON DELETE CASCADE;


--
-- Name: helpdesk_csat helpdesk_csat_ticket_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_csat
    ADD CONSTRAINT helpdesk_csat_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES quetzal.helpdesk_tickets(id) ON DELETE CASCADE;


--
-- Name: helpdesk_macros helpdesk_macros_created_by_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_macros
    ADD CONSTRAINT helpdesk_macros_created_by_fkey FOREIGN KEY (created_by) REFERENCES quetzal.users(id) ON DELETE SET NULL;


--
-- Name: helpdesk_notes helpdesk_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_notes
    ADD CONSTRAINT helpdesk_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES quetzal.users(id);


--
-- Name: helpdesk_notes helpdesk_notes_ticket_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_notes
    ADD CONSTRAINT helpdesk_notes_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES quetzal.helpdesk_tickets(id) ON DELETE CASCADE;


--
-- Name: helpdesk_ticket_labels helpdesk_ticket_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_ticket_labels
    ADD CONSTRAINT helpdesk_ticket_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES quetzal.labels(id) ON DELETE CASCADE;


--
-- Name: helpdesk_ticket_labels helpdesk_ticket_labels_ticket_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_ticket_labels
    ADD CONSTRAINT helpdesk_ticket_labels_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES quetzal.helpdesk_tickets(id) ON DELETE CASCADE;


--
-- Name: helpdesk_tickets helpdesk_tickets_assignee_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES quetzal.users(id);


--
-- Name: helpdesk_tickets helpdesk_tickets_requester_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES quetzal.users(id);


--
-- Name: helpdesk_tickets helpdesk_tickets_site_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.helpdesk_tickets
    ADD CONSTRAINT helpdesk_tickets_site_id_fkey FOREIGN KEY (site_id) REFERENCES quetzal.sites(id);


--
-- Name: issue_custom_values issue_custom_values_field_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_custom_values
    ADD CONSTRAINT issue_custom_values_field_id_fkey FOREIGN KEY (field_id) REFERENCES quetzal.custom_fields(id) ON DELETE CASCADE;


--
-- Name: issue_custom_values issue_custom_values_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_custom_values
    ADD CONSTRAINT issue_custom_values_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: issue_labels issue_labels_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_labels
    ADD CONSTRAINT issue_labels_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: issue_labels issue_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_labels
    ADD CONSTRAINT issue_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES quetzal.labels(id) ON DELETE CASCADE;


--
-- Name: issue_links issue_links_from_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_links
    ADD CONSTRAINT issue_links_from_issue_id_fkey FOREIGN KEY (from_issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: issue_links issue_links_to_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_links
    ADD CONSTRAINT issue_links_to_issue_id_fkey FOREIGN KEY (to_issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: issue_votes issue_votes_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_votes
    ADD CONSTRAINT issue_votes_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: issue_votes issue_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_votes
    ADD CONSTRAINT issue_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id);


--
-- Name: issue_watchers issue_watchers_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_watchers
    ADD CONSTRAINT issue_watchers_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: issue_watchers issue_watchers_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issue_watchers
    ADD CONSTRAINT issue_watchers_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id);


--
-- Name: issues issues_assignee_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES quetzal.users(id);


--
-- Name: issues issues_component_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_component_id_fkey FOREIGN KEY (component_id) REFERENCES quetzal.components(id) ON DELETE SET NULL;


--
-- Name: issues issues_fix_version_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_fix_version_id_fkey FOREIGN KEY (fix_version_id) REFERENCES quetzal.versions(id) ON DELETE SET NULL;


--
-- Name: issues issues_parent_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES quetzal.issues(id) ON DELETE SET NULL;


--
-- Name: issues issues_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: issues issues_reporter_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES quetzal.users(id);


--
-- Name: issues issues_sprint_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.issues
    ADD CONSTRAINT issues_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES quetzal.sprints(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: page_attachments page_attachments_page_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_attachments
    ADD CONSTRAINT page_attachments_page_id_fkey FOREIGN KEY (page_id) REFERENCES quetzal.pages(id) ON DELETE CASCADE;


--
-- Name: page_attachments page_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_attachments
    ADD CONSTRAINT page_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES quetzal.users(id);


--
-- Name: page_comments page_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_comments
    ADD CONSTRAINT page_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES quetzal.users(id);


--
-- Name: page_comments page_comments_page_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_comments
    ADD CONSTRAINT page_comments_page_id_fkey FOREIGN KEY (page_id) REFERENCES quetzal.pages(id) ON DELETE CASCADE;


--
-- Name: page_labels page_labels_page_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_labels
    ADD CONSTRAINT page_labels_page_id_fkey FOREIGN KEY (page_id) REFERENCES quetzal.pages(id) ON DELETE CASCADE;


--
-- Name: page_permissions page_permissions_page_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_permissions
    ADD CONSTRAINT page_permissions_page_id_fkey FOREIGN KEY (page_id) REFERENCES quetzal.pages(id) ON DELETE CASCADE;


--
-- Name: page_properties page_properties_page_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_properties
    ADD CONSTRAINT page_properties_page_id_fkey FOREIGN KEY (page_id) REFERENCES quetzal.pages(id) ON DELETE CASCADE;


--
-- Name: page_revisions page_revisions_author_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_revisions
    ADD CONSTRAINT page_revisions_author_id_fkey FOREIGN KEY (author_id) REFERENCES quetzal.users(id);


--
-- Name: page_revisions page_revisions_page_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_revisions
    ADD CONSTRAINT page_revisions_page_id_fkey FOREIGN KEY (page_id) REFERENCES quetzal.pages(id) ON DELETE CASCADE;


--
-- Name: page_templates page_templates_space_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_templates
    ADD CONSTRAINT page_templates_space_id_fkey FOREIGN KEY (space_id) REFERENCES quetzal.spaces(id) ON DELETE CASCADE;


--
-- Name: page_versions page_versions_author_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_versions
    ADD CONSTRAINT page_versions_author_id_fkey FOREIGN KEY (author_id) REFERENCES quetzal.users(id);


--
-- Name: page_versions page_versions_page_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.page_versions
    ADD CONSTRAINT page_versions_page_id_fkey FOREIGN KEY (page_id) REFERENCES quetzal.pages(id) ON DELETE CASCADE;


--
-- Name: pages pages_author_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.pages
    ADD CONSTRAINT pages_author_id_fkey FOREIGN KEY (author_id) REFERENCES quetzal.users(id);


--
-- Name: pages pages_parent_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.pages
    ADD CONSTRAINT pages_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES quetzal.pages(id) ON DELETE SET NULL;


--
-- Name: pages pages_space_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.pages
    ADD CONSTRAINT pages_space_id_fkey FOREIGN KEY (space_id) REFERENCES quetzal.spaces(id) ON DELETE CASCADE;


--
-- Name: permission_scheme_grants permission_scheme_grants_scheme_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.permission_scheme_grants
    ADD CONSTRAINT permission_scheme_grants_scheme_id_fkey FOREIGN KEY (scheme_id) REFERENCES quetzal.permission_schemes(id) ON DELETE CASCADE;


--
-- Name: project_role_members project_role_members_role_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.project_role_members
    ADD CONSTRAINT project_role_members_role_id_fkey FOREIGN KEY (role_id) REFERENCES quetzal.project_roles(id) ON DELETE CASCADE;


--
-- Name: project_role_members project_role_members_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.project_role_members
    ADD CONSTRAINT project_role_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: project_roles project_roles_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.project_roles
    ADD CONSTRAINT project_roles_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_lead_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.projects
    ADD CONSTRAINT projects_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES quetzal.users(id);


--
-- Name: projects projects_permission_scheme_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.projects
    ADD CONSTRAINT projects_permission_scheme_id_fkey FOREIGN KEY (permission_scheme_id) REFERENCES quetzal.permission_schemes(id);


--
-- Name: projects projects_site_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.projects
    ADD CONSTRAINT projects_site_id_fkey FOREIGN KEY (site_id) REFERENCES quetzal.sites(id);


--
-- Name: projects projects_workflow_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.projects
    ADD CONSTRAINT projects_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES quetzal.workflows(id);


--
-- Name: reaction_marks reaction_marks_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reaction_marks
    ADD CONSTRAINT reaction_marks_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id);


--
-- Name: reactions reactions_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reactions
    ADD CONSTRAINT reactions_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: reactions reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.reactions
    ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id);


--
-- Name: saved_filters saved_filters_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.saved_filters
    ADD CONSTRAINT saved_filters_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: screen_fields screen_fields_field_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.screen_fields
    ADD CONSTRAINT screen_fields_field_id_fkey FOREIGN KEY (field_id) REFERENCES quetzal.custom_fields(id) ON DELETE CASCADE;


--
-- Name: screen_fields screen_fields_screen_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.screen_fields
    ADD CONSTRAINT screen_fields_screen_id_fkey FOREIGN KEY (screen_id) REFERENCES quetzal.screens(id) ON DELETE CASCADE;


--
-- Name: site_members site_members_site_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.site_members
    ADD CONSTRAINT site_members_site_id_fkey FOREIGN KEY (site_id) REFERENCES quetzal.sites(id) ON DELETE CASCADE;


--
-- Name: site_members site_members_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.site_members
    ADD CONSTRAINT site_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: space_members space_members_space_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.space_members
    ADD CONSTRAINT space_members_space_id_fkey FOREIGN KEY (space_id) REFERENCES quetzal.spaces(id) ON DELETE CASCADE;


--
-- Name: space_members space_members_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.space_members
    ADD CONSTRAINT space_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id) ON DELETE CASCADE;


--
-- Name: space_permissions space_permissions_space_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.space_permissions
    ADD CONSTRAINT space_permissions_space_id_fkey FOREIGN KEY (space_id) REFERENCES quetzal.spaces(id) ON DELETE CASCADE;


--
-- Name: spaces spaces_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.spaces
    ADD CONSTRAINT spaces_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES quetzal.users(id);


--
-- Name: spaces spaces_site_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.spaces
    ADD CONSTRAINT spaces_site_id_fkey FOREIGN KEY (site_id) REFERENCES quetzal.sites(id);


--
-- Name: sprints sprints_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.sprints
    ADD CONSTRAINT sprints_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: versions versions_project_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.versions
    ADD CONSTRAINT versions_project_id_fkey FOREIGN KEY (project_id) REFERENCES quetzal.projects(id) ON DELETE CASCADE;


--
-- Name: wiki_page_meta wiki_page_meta_deleted_by_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.wiki_page_meta
    ADD CONSTRAINT wiki_page_meta_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES quetzal.users(id);


--
-- Name: wiki_page_meta wiki_page_meta_page_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.wiki_page_meta
    ADD CONSTRAINT wiki_page_meta_page_id_fkey FOREIGN KEY (page_id) REFERENCES quetzal.pages(id) ON DELETE CASCADE;


--
-- Name: workflow_statuses workflow_statuses_workflow_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_statuses
    ADD CONSTRAINT workflow_statuses_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES quetzal.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_steps workflow_steps_workflow_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_steps
    ADD CONSTRAINT workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES quetzal.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_transitions workflow_transitions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.workflow_transitions
    ADD CONSTRAINT workflow_transitions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES quetzal.workflows(id) ON DELETE CASCADE;


--
-- Name: worklogs worklogs_issue_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.worklogs
    ADD CONSTRAINT worklogs_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quetzal.issues(id) ON DELETE CASCADE;


--
-- Name: worklogs worklogs_user_id_fkey; Type: FK CONSTRAINT; Schema: quetzal; Owner: -
--

ALTER TABLE ONLY quetzal.worklogs
    ADD CONSTRAINT worklogs_user_id_fkey FOREIGN KEY (user_id) REFERENCES quetzal.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 4le90wSXOQGczy851llAgQ3cY9RKsottmXP27DBTdRoaO9rm9J5w2QYlqF4B4ML

