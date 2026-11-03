import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Issue, IssueStatus } from '@/lib/types';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export const AUTOMATION_TRIGGERS = [
  'issue_created',
  'comment_added',
  'status_changed',
  'due_approaching',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export type AutomationConditions = {
  from_status?: string;
  to_status?: string;
  status?: string;
  priority?: string;
  type?: string;
  project_key?: string;
  /** For due_approaching: fire when due_on is within this many days (inclusive of today). Default 3. */
  within_days?: number;
};

export type AutomationAction =
  | { type: 'notify_user'; user_id: number; title?: string; body?: string }
  | { type: 'set_assignee'; user_id: number | null }
  | { type: 'add_comment'; body: string };

export interface AutomationRule {
  id: number;
  name: string;
  enabled: boolean;
  triggerEvent: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  createdAt: string;
}

export type AutomationRunStatus = 'ok' | 'error' | 'skipped';

export interface AutomationRun {
  id: number;
  ruleId: number;
  ruleName: string;
  issueKey: string;
  triggerEvent: AutomationTrigger;
  status: AutomationRunStatus;
  detail: string;
  createdAt: string;
}

export type AutomationEvent = {
  event: AutomationTrigger;
  issueKey: string;
  fromStatus?: IssueStatus | null;
  toStatus?: IssueStatus | null;
  authorId: number | null;
  commentBody?: string | null;
};

/** Prevents comment/create hooks from re-entering while actions run. */
let runnerDepth = 0;

function stamp(): string {
  return new Date().toISOString();
}

function todayYmd(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseTrigger(raw: unknown): AutomationTrigger {
  const value = String(raw ?? '');
  return (AUTOMATION_TRIGGERS as readonly string[]).includes(value)
    ? (value as AutomationTrigger)
    : 'status_changed';
}

function mapRule(row: Record<string, unknown>): AutomationRule {
  return {
    id: Number(row.id),
    name: String(row.name),
    enabled: Number(row.enabled) === 1,
    triggerEvent: parseTrigger(row.trigger_event),
    conditions: parseJson<AutomationConditions>(String(row.conditions ?? '{}'), {}),
    actions: parseJson<AutomationAction[]>(String(row.actions ?? '[]'), []),
    createdAt: String(row.created_at),
  };
}

function mapRun(row: Record<string, unknown>): AutomationRun {
  const statusRaw = String(row.status ?? 'ok');
  const status: AutomationRunStatus =
    statusRaw === 'error' || statusRaw === 'skipped' ? statusRaw : 'ok';
  return {
    id: Number(row.id),
    ruleId: Number(row.rule_id),
    ruleName: String(row.rule_name ?? ''),
    issueKey: String(row.issue_key),
    triggerEvent: parseTrigger(row.trigger_event),
    status,
    detail: String(row.detail ?? ''),
    createdAt: String(row.created_at),
  };
}

async function recordRun(input: {
  ruleId: number;
  issueKey: string;
  triggerEvent: AutomationTrigger;
  status: AutomationRunStatus;
  detail?: string;
}): Promise<void> {
  await qRun(`INSERT INTO automation_runs (rule_id, issue_key, trigger_event, status, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`, [input.ruleId,
    input.issueKey.slice(0, 40),
    input.triggerEvent,
    input.status,
    (input.detail ?? '').slice(0, 2000),
    stamp(),]);
}

/** Create automation_rules + automation_runs tables and seed demo when/then rules if empty. */
export async function ensureAutomation(): Promise<void> {
  /* DDL skipped — migrations */ void 0;

  const count = await qGet('SELECT COUNT(*) AS n FROM automation_rules') as { n: number };
  if (count.n > 0) return;

  const users = await qGet('SELECT COUNT(*) AS n FROM users') as { n: number };
  if (users.n === 0) return;

  const at = stamp();
  const insertSql = `
    INSERT INTO automation_rules (name, enabled, trigger_event, conditions, actions, created_at)
    VALUES (?, TRUE, ?, ?, ?, ?)
  `;

  await qRun(insertSql, ['Notify lead when issue is Done',
    'status_changed',
    JSON.stringify({ to_status: 'done' } satisfies AutomationConditions),
    JSON.stringify([
      {
        type: 'notify_user',
        user_id: 1,
        title: '{{issue.key}} marked Done',
        body: '{{issue.summary}} is now {{issue.status}}.',
      },
      {
        type: 'add_comment',
        body: 'Automation: {{issue.key}} moved to {{issue.status}}.',
      },
    ] satisfies AutomationAction[]),
    at,]);

  await qRun(insertSql, ['Assign Ana when work starts',
    'status_changed',
    JSON.stringify({ from_status: 'todo', to_status: 'in_progress' } satisfies AutomationConditions),
    JSON.stringify([
      { type: 'set_assignee', user_id: 1 },
      {
        type: 'notify_user',
        user_id: 1,
        title: 'Assigned by automation',
        body: 'You were assigned on {{issue.key}} because it left To do.',
      },
    ] satisfies AutomationAction[]),
    at,]);

  await qRun(insertSql, ['Welcome comment on create',
    'issue_created',
    JSON.stringify({} satisfies AutomationConditions),
    JSON.stringify([
      {
        type: 'add_comment',
        body: 'Automation: {{issue.key}} created — {{issue.summary}}.',
      },
    ] satisfies AutomationAction[]),
    at,]);

  await qRun(insertSql, ['Echo comment notify',
    'comment_added',
    JSON.stringify({} satisfies AutomationConditions),
    JSON.stringify([
      {
        type: 'notify_user',
        user_id: 1,
        title: 'Comment on {{issue.key}}',
        body: '{{comment.body}}',
      },
    ] satisfies AutomationAction[]),
    at,]);

  await qRun(insertSql, ['Due within 3 days',
    'due_approaching',
    JSON.stringify({ within_days: 3 } satisfies AutomationConditions),
    JSON.stringify([
      {
        type: 'notify_user',
        user_id: 1,
        title: 'Due soon: {{issue.key}}',
        body: '{{issue.summary}} is due soon (status {{issue.status}}).',
      },
    ] satisfies AutomationAction[]),
    at,]);
}

// deferred: await ensureAutomation();
export async function listAutomationRules(): Promise<AutomationRule[]> {
  await ensureAutomation();
  return (
    await qAll(`SELECT * FROM automation_rules ORDER BY id`) as Record<string, unknown>[]
  ).map(mapRule);
}

export async function listAutomationRuns(limit = 50): Promise<AutomationRun[]> {
  await ensureAutomation();
  const capped = Math.min(Math.max(1, Math.floor(limit) || 50), 200);
  return (
    await qAll(`SELECT r.*, COALESCE(rules.name, '') AS rule_name
         FROM automation_runs r
         LEFT JOIN automation_rules rules ON rules.id = r.rule_id
         ORDER BY r.id DESC
         LIMIT ?`, [capped]) as Record<string, unknown>[]
  ).map(mapRun);
}

export async function getAutomationRule(id: number): Promise<AutomationRule | undefined> {
  await ensureAutomation();
  if (!Number.isInteger(id) || id <= 0) return undefined;
  const row = await qGet(`SELECT * FROM automation_rules WHERE id = ?`, [id]) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRule(row) : undefined;
}

export async function createAutomationRule(input: {
  name: string;
  enabled?: boolean;
  triggerEvent?: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
}): Promise<AutomationRule> {
  await ensureAutomation();
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error('Name is required');
  const actions = Array.isArray(input.actions) ? input.actions : [];
  if (actions.length === 0) throw new Error('At least one action is required');
  const trigger = parseTrigger(input.triggerEvent ?? 'status_changed');
  const id = await qInsertReturningId(`INSERT INTO automation_rules (name, enabled, trigger_event, conditions, actions, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`, [name,
      input.enabled !== false,
      trigger,
      JSON.stringify(input.conditions ?? {}),
      JSON.stringify(actions),
      stamp(),]);
  const rule = await getAutomationRule(id);
  if (!rule) throw new Error('Failed to create automation rule');
  return rule;
}

export async function setAutomationRuleEnabled(id: number, enabled: boolean): Promise<void> {
  await ensureAutomation();
  if (!Number.isInteger(id) || id <= 0) return;
  await qRun(`UPDATE automation_rules SET enabled = ? WHERE id = ?`, [enabled, id]);
}

function matchesConditions(issue: Issue, conditions: AutomationConditions, event: AutomationEvent): boolean {
  if (event.event === 'status_changed') {
    const toStatus = conditions.to_status ?? conditions.status;
    if (conditions.from_status && conditions.from_status !== event.fromStatus) return false;
    if (toStatus && toStatus !== event.toStatus) return false;
  } else if (conditions.status && conditions.status !== issue.status) {
    return false;
  }
  if (conditions.priority && conditions.priority !== issue.priority) return false;
  if (conditions.type && conditions.type !== issue.type) return false;
  if (conditions.project_key && conditions.project_key.toUpperCase() !== issue.projectKey) return false;
  return true;
}

type SmartContext = {
  issue: Issue;
  event: AutomationEvent;
};

function interpolate(template: string, ctx: SmartContext): string {
  const { issue, event } = ctx;
  const status = event.toStatus ?? issue.status;
  const from = event.fromStatus ?? '';
  const comment = event.commentBody ?? '';
  return template
    .replaceAll('{{issue.key}}', issue.key)
    .replaceAll('{{issue.summary}}', issue.summary)
    .replaceAll('{{issue.status}}', status)
    .replaceAll('{{comment.body}}', comment)
    .replaceAll('{{key}}', issue.key)
    .replaceAll('{{summary}}', issue.summary)
    .replaceAll('{{from_status}}', from)
    .replaceAll('{{to_status}}', status)
    .replaceAll('{{status}}', status);
}

async function runActions(issue: Issue, event: AutomationEvent, actions: AutomationAction[]): Promise<void> {
  const { assignIssue, addComment, getIssue } = require('@/lib/db') as typeof import('@/lib/db');
  const { notifyUser } = require('@/lib/notify') as typeof import('@/lib/notify');
  const authorId = event.authorId && event.authorId > 0 ? event.authorId : 1;
  const ctx: SmartContext = { issue, event };

  for (const action of actions) {
    try {
      if (action.type === 'notify_user') {
        const userId = Number(action.user_id);
        if (!Number.isInteger(userId) || userId <= 0) continue;
        const title = interpolate(
          action.title?.trim() || `${issue.key} · ${event.event}`,
          ctx,
        );
        const body = interpolate(
          action.body?.trim() || `${issue.summary} (${issue.status}).`,
          ctx,
        );
        await notifyUser({
          userId,
          kind: 'automation',
          title: title.slice(0, 200),
          body: body.slice(0, 2000),
          href: `/issues/${issue.key}`,
        });
        continue;
      }
      if (action.type === 'set_assignee') {
        const userId =
          action.user_id == null || action.user_id === 0 ? null : Number(action.user_id);
        if (userId != null && (!Number.isInteger(userId) || userId <= 0)) continue;
        await assignIssue(issue.key, userId, authorId);
        continue;
      }
      if (action.type === 'add_comment') {
        const body = interpolate(String(action.body ?? '').trim(), ctx);
        if (!body) continue;
        await addComment(issue.key, authorId, body, null, { skipAutomation: true });
        await getIssue(issue.key);
      }
    } catch (err) {
      console.error('[automation] action failed', action.type, err);
      throw err;
    }
  }
}

async function loadEnabledRules(trigger: AutomationTrigger): Promise<AutomationRule[]> {
  await ensureAutomation();
  return (
    await qAll(`SELECT * FROM automation_rules
         WHERE enabled IS TRUE AND trigger_event = ?
         ORDER BY id`, [trigger]) as Record<string, unknown>[]
  ).map(mapRule);
}

/** Evaluate enabled rules for an event. Never throws into issue update paths. */
export async function runAutomations(event: AutomationEvent): Promise<void> {
  if (runnerDepth > 0) return;
  try {
    if (event.event === 'status_changed' && event.fromStatus === event.toStatus) return;
    runnerDepth += 1;
    const { getIssue } = require('@/lib/db') as typeof import('@/lib/db');
    const issue = await getIssue(event.issueKey);
    if (!issue) return;

    const rules = await loadEnabledRules(event.event);
    for (const rule of rules) {
      if (!matchesConditions(issue, rule.conditions, event)) continue;
      try {
        await runActions(issue, event, rule.actions);
        await recordRun({
          ruleId: rule.id,
          issueKey: issue.key,
          triggerEvent: event.event,
          status: 'ok',
          detail: `actions=${rule.actions.length}`,
        });
      } catch (err) {
        console.error('[automation] rule failed', rule.id, err);
        await recordRun({
          ruleId: rule.id,
          issueKey: issue.key,
          triggerEvent: event.event,
          status: 'error',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    console.error('[automation] runner failed', err);
  } finally {
    runnerDepth = Math.max(0, runnerDepth - 1);
  }
}

async function alreadyFiredDue(ruleId: number, issueKey: string, dueOn: string): Promise<boolean> {
  const row = await qGet(`SELECT id FROM automation_runs
       WHERE rule_id = ? AND issue_key = ? AND trigger_event = 'due_approaching'
         AND status = 'ok' AND detail LIKE ?
       LIMIT 1`, [ruleId, issueKey, `%due=${dueOn}%`]) as { id: number } | undefined;
  return Boolean(row);
}

/**
 * Evaluate due_approaching rules for open issues whose due_on falls within each rule's window.
 * Intended for cron via POST /api/automation/tick.
 */
export async function tickDueApproaching(now = new Date()): Promise<{
  evaluated: number;
  fired: number;
  skipped: number;
}> {
  await ensureAutomation();
  const today = todayYmd(now);
  const rules = await loadEnabledRules('due_approaching');
  let evaluated = 0;
  let fired = 0;
  let skipped = 0;

  if (rules.length === 0) {
    return { evaluated, fired, skipped };
  }

  const { getIssue } = require('@/lib/db') as typeof import('@/lib/db');
  const maxDays = Math.max(
    1,
    ...rules.map((rule) => {
      const n = Number(rule.conditions.within_days);
      return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 90) : 3;
    }),
  );
  const until = addDaysYmd(today, maxDays);

  const keys = (
    await qAll(`SELECT p.key || '-' || i.num AS issue_key, i.due_on AS due_on
         FROM issues i
         JOIN projects p ON p.id = i.project_id
         WHERE i.due_on IS NOT NULL
           AND i.due_on >= ? AND i.due_on <= ?
           AND i.status != 'done'
         ORDER BY i.due_on, i.num`, [today, until]) as Array<{ issue_key: string; due_on: string }>
  );

  runnerDepth += 1;
  try {
    for (const row of keys) {
      const issue = await getIssue(row.issue_key);
      if (!issue || !issue.dueOn) continue;
      evaluated += 1;
      const event: AutomationEvent = {
        event: 'due_approaching',
        issueKey: issue.key,
        toStatus: issue.status,
        authorId: issue.assigneeId ?? issue.reporterId,
      };

      for (const rule of rules) {
        const within =
          Number.isFinite(Number(rule.conditions.within_days)) && Number(rule.conditions.within_days) > 0
            ? Math.min(Math.floor(Number(rule.conditions.within_days)), 90)
            : 3;
        const windowEnd = addDaysYmd(today, within);
        if (issue.dueOn > windowEnd) continue;
        if (!matchesConditions(issue, rule.conditions, event)) continue;
        if (await alreadyFiredDue(rule.id, issue.key, issue.dueOn)) {
          skipped += 1;
          continue;
        }
        try {
          await runActions(issue, event, rule.actions);
          await recordRun({
            ruleId: rule.id,
            issueKey: issue.key,
            triggerEvent: 'due_approaching',
            status: 'ok',
            detail: `due=${issue.dueOn}; within_days=${within}; actions=${rule.actions.length}`,
          });
          fired += 1;
        } catch (err) {
          console.error('[automation] due tick rule failed', rule.id, err);
          await recordRun({
            ruleId: rule.id,
            issueKey: issue.key,
            triggerEvent: 'due_approaching',
            status: 'error',
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } finally {
    runnerDepth = Math.max(0, runnerDepth - 1);
  }

  return { evaluated, fired, skipped };
}
