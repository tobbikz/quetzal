import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { STATUS_LABEL, TRANSITIONS } from '@/lib/format';
import type { Issue, IssueStatus } from '@/lib/types';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export type WorkflowRule = {
  type: string;
  [key: string]: unknown;
};

export interface Workflow {
  id: number;
  name: string;
}

export interface WorkflowStatusRow {
  id: number;
  workflowId: number;
  status: IssueStatus;
  name: string;
  sortOrder: number;
}

export interface WorkflowTransition {
  id: number;
  workflowId: number;
  fromStatus: IssueStatus;
  toStatus: IssueStatus;
  name: string;
  conditions: WorkflowRule[];
  validators: WorkflowRule[];
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

function parseRules(raw: string | null | undefined): WorkflowRule[] {
  if (!raw || !String(raw).trim()) return [];
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WorkflowRule => {
      return Boolean(item && typeof item === 'object' && typeof (item as WorkflowRule).type === 'string');
    });
  } catch {
    return [];
  }
}

function mapTransition(row: Record<string, unknown>): WorkflowTransition {
  return {
    id: Number(row.id),
    workflowId: Number(row.workflow_id),
    fromStatus: String(row.from_status) as IssueStatus,
    toStatus: String(row.to_status) as IssueStatus,
    name: String(row.name),
    conditions: parseRules(row.conditions_json == null ? '[]' : String(row.conditions_json)),
    validators: parseRules(row.validators_json == null ? '[]' : String(row.validators_json)),
  };
}

/** Evaluate a condition against the issue (gates visibility + execution). */
export function checkCondition(rule: WorkflowRule, issue: Issue): TransitionCheck {
  if (rule.type === 'require_assignee') {
    if (issue.assigneeId == null) return { ok: false, reason: 'Assignee is required for this transition' };
    return { ok: true };
  }
  return { ok: true };
}

/** Evaluate a validator against the issue (runs before status change). */
export function checkValidator(rule: WorkflowRule, issue: Issue): TransitionCheck {
  if (rule.type === 'summary_nonempty') {
    if (!issue.summary.trim()) return { ok: false, reason: 'Summary must not be empty' };
    return { ok: true };
  }
  return { ok: true };
}

export async function checkConditions(rules: WorkflowRule[], issue: Issue): Promise<TransitionCheck> {
  for (const rule of rules) {
    const result = await checkCondition(rule, issue);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export async function checkValidators(rules: WorkflowRule[], issue: Issue): Promise<TransitionCheck> {
  for (const rule of rules) {
    const result = await checkValidator(rule, issue);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export async function ensureWorkflows(): Promise<void> {
  /* DDL skipped — migrations */ void 0;

  const existing = await qGet('SELECT id FROM workflows WHERE id = 1') as { id: number } | undefined;
  if (!existing) {
    await qRun('INSERT INTO workflows (id, name) VALUES (1, ?)', ['Standard']);
  } else {
    await qRun(`UPDATE workflows SET name = COALESCE(NULLIF(name, ''), 'Standard') WHERE id = 1`);
  }

  const statusCount = await qGet('SELECT COUNT(*) AS n FROM workflow_statuses WHERE workflow_id = 1') as {
    n: number;
  };
  if (statusCount.n === 0) {
    
    const order: IssueStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
    for (let index = 0; index < order.length; index++) {
      const status = order[index];
      await qRun('INSERT INTO workflow_statuses (workflow_id, status, name, sort_order) VALUES (1, ?, ?, ?)', [status, STATUS_LABEL[status], index]);
    }
  }

  const transitionCount = await qGet('SELECT COUNT(*) AS n FROM workflow_transitions WHERE workflow_id = 1') as {
    n: number;
  };
  if (transitionCount.n === 0) {
    const insertSql = `
      INSERT INTO workflow_transitions
        (workflow_id, from_status, to_status, name, conditions_json, validators_json)
      VALUES (1, ?, ?, ?, ?, ?)
    `;
    const summaryValidator = JSON.stringify([{ type: 'summary_nonempty' }]);
    const assigneeCondition = JSON.stringify([{ type: 'require_assignee' }]);
    const empty = '[]';

    for (const [from, steps] of Object.entries(TRANSITIONS) as [IssueStatus, { to: IssueStatus; label: string }[]][]) {
      for (const step of steps) {
        // Require assignee before review / done; always validate non-empty summary.
        const needsAssignee = step.to === 'in_review' || step.to === 'done';
        await qRun(insertSql, [from,
          step.to,
          step.label,
          needsAssignee ? assigneeCondition : empty,
          summaryValidator,]);
      }
    }
  }

  // Keep legacy workflow_steps in sync when present (board/older code paths).
  try {
    /* DDL skipped — migrations */ void 0;
    const stepCount = await qGet('SELECT COUNT(*) AS n FROM workflow_steps WHERE workflow_id = 1') as {
      n: number;
    };
    if (stepCount.n === 0) {
      const rows = await qAll('SELECT from_status, to_status FROM workflow_transitions WHERE workflow_id = 1') as { from_status: string; to_status: string }[];
      
      for (const row of rows) await qRun('INSERT INTO workflow_steps (workflow_id, from_status, to_status) VALUES (1, ?, ?) ON CONFLICT DO NOTHING', [row.from_status, row.to_status]);
    }
  } catch {
    // ignore legacy sync failures
  }

  await qRun('UPDATE projects SET workflow_id = 1 WHERE workflow_id IS NULL');
}

// deferred: await ensureWorkflows();
export async function listWorkflows(): Promise<Workflow[]> {
  await ensureWorkflows();
  return (await qAll('SELECT id, name FROM workflows ORDER BY id') as { id: number; name: string }[]).map(
    (row) => ({ id: row.id, name: row.name }),
  );
}

export async function listWorkflowStatuses(workflowId: number): Promise<WorkflowStatusRow[]> {
  await ensureWorkflows();
  return (
    await qAll('SELECT id, workflow_id, status, name, sort_order FROM workflow_statuses WHERE workflow_id = ? ORDER BY sort_order, id', [workflowId]) as Record<string, unknown>[]
  ).map((row) => ({
    id: Number(row.id),
    workflowId: Number(row.workflow_id),
    status: String(row.status) as IssueStatus,
    name: String(row.name),
    sortOrder: Number(row.sort_order),
  }));
}

export async function listWorkflowTransitions(workflowId: number): Promise<WorkflowTransition[]> {
  await ensureWorkflows();
  return (
    await qAll(`SELECT id, workflow_id, from_status, to_status, name, conditions_json, validators_json
         FROM workflow_transitions WHERE workflow_id = ? ORDER BY id`, [workflowId]) as Record<string, unknown>[]
  ).map(mapTransition);
}

export async function getProjectWorkflowId(projectId: number): Promise<number | null> {
  await ensureWorkflows();
  const row = await qGet('SELECT workflow_id FROM projects WHERE id = ?', [projectId]) as
    | { workflow_id: number | null }
    | undefined;
  return row?.workflow_id ?? null;
}

export async function findTransition(
  workflowId: number,
  from: IssueStatus,
  to: IssueStatus,
): Promise<WorkflowTransition | undefined> {
  await ensureWorkflows();
  const row = await qGet(`SELECT id, workflow_id, from_status, to_status, name, conditions_json, validators_json
       FROM workflow_transitions
       WHERE workflow_id = ? AND from_status = ? AND to_status = ?`, [workflowId, from, to]) as Record<string, unknown> | undefined;
  return row ? mapTransition(row) : undefined;
}

/** Transitions from current status that pass conditions (buttons). */
export async function allowedTransitions(issue: Issue): Promise<WorkflowTransition[]> {
  await ensureWorkflows();
  const workflowId = await getProjectWorkflowId(issue.projectId);
  if (!workflowId) return [];
  const allTransitions = await listWorkflowTransitions(workflowId);
  const result: WorkflowTransition[] = [];
  for (const transition of allTransitions) {
    if (transition.fromStatus !== issue.status) continue;
    if ((await checkConditions(transition.conditions, issue)).ok) result.push(transition);
  }
  return result;
}

/** Status keys reachable now (conditions applied). */
export async function nextWorkflowStatuses(issue: Issue): Promise<IssueStatus[]> {
  return (await allowedTransitions(issue)).map((transition) => transition.toStatus);
}

/** Full gate before setIssueStatus: edge exists, conditions + validators pass. */
export async function canApplyTransition(issue: Issue, to: IssueStatus): Promise<TransitionCheck> {
  await ensureWorkflows();
  if (issue.status === to) return { ok: false, reason: 'Already in that status' };
  const workflowId = await getProjectWorkflowId(issue.projectId);
  if (!workflowId) return { ok: false, reason: 'Project has no workflow' };
  const transition = await findTransition(workflowId, issue.status, to);
  if (!transition) return { ok: false, reason: 'Transition is not allowed' };
  const conditions = await checkConditions(transition.conditions, issue);
  if (!conditions.ok) return conditions;
  const validators = await checkValidators(transition.validators, issue);
  if (!validators.ok) return validators;
  return { ok: true };
}

/** Shortest status path using configured workflow edges (for board multi-hop drops). */
export async function findStatusPath(
  workflowId: number,
  from: IssueStatus,
  to: IssueStatus,
): Promise<IssueStatus[] | null> {
  if (from === to) return [];
  await ensureWorkflows();
  const edges = await listWorkflowTransitions(workflowId);
  const adj = new Map<IssueStatus, IssueStatus[]>();
  for (const edge of edges) {
    const list = adj.get(edge.fromStatus) ?? [];
    list.push(edge.toStatus);
    adj.set(edge.fromStatus, list);
  }
  const queue: IssueStatus[] = [from];
  const prev = new Map<IssueStatus, IssueStatus | null>([[from, null]]);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adj.get(current) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, current);
      if (next === to) {
        const path: IssueStatus[] = [];
        let cursor: IssueStatus | null = to;
        while (cursor && cursor !== from) {
          path.push(cursor);
          cursor = prev.get(cursor) ?? null;
        }
        path.reverse();
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Apply direct transition or walk intermediate statuses for board DnD. */
export async function canApplyBoardMove(issue: Issue, to: IssueStatus): Promise<TransitionCheck & { path?: IssueStatus[] }> {
  const direct = await canApplyTransition(issue, to);
  if (direct.ok) return { ok: true, path: [to] };
  const workflowId = await getProjectWorkflowId(issue.projectId);
  if (!workflowId) return { ok: false, reason: 'Project has no workflow' };
  const path = await findStatusPath(workflowId, issue.status, to);
  if (!path || path.length === 0) return { ok: false, reason: direct.ok === false ? direct.reason : 'Transition is not allowed' };

  let cursor = issue;
  for (const step of path) {
    const gate = await canApplyTransition(cursor, step);
    if (!gate.ok) return gate;
    cursor = { ...cursor, status: step };
  }
  return { ok: true, path };
}
