import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export interface Worklog {
  id: number;
  issueId: number;
  userId: number;
  minutes: number;
  note: string;
  createdAt: string;
}

type IssueTimeRow = {
  id: number;
  originalEstimateMinutes: number | null;
  remainingMinutes: number | null;
};

function now(): string {
  return new Date().toISOString();
}

function parseMinutes(raw: number | string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

export async function ensureTimeTracking(): Promise<void> {
  const issueColumns = await qAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'quetzal' AND table_name = 'issues'`,
  );
  const issueNames = new Set(issueColumns.map((column) => column.column_name));
  if (!issueNames.has('original_estimate_minutes')) {
    await qRun('ALTER TABLE issues ADD COLUMN original_estimate_minutes INTEGER');
  }
  if (!issueNames.has('remaining_minutes')) {
    await qRun('ALTER TABLE issues ADD COLUMN remaining_minutes INTEGER');
  }

  const worklogColumns = await qAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'quetzal' AND table_name = 'worklogs'`,
  );
  const worklogNames = new Set(worklogColumns.map((column) => column.column_name));

  if (worklogColumns.length === 0) {
    /* DDL skipped — migrations */ void 0;
    return;
  }

  if (worklogNames.has('user_id')) return;

  if (worklogNames.has('author_id')) {
    /* DDL skipped — migrations */ void 0;
    return;
  }

  await qRun('ALTER TABLE worklogs ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1');
}

// deferred: await ensureTimeTracking();
function mapWorklog(row: Record<string, unknown>): Worklog {
  return {
    id: Number(row.id),
    issueId: Number(row.issue_id),
    userId: Number(row.user_id ?? row.author_id),
    minutes: Number(row.minutes),
    note: String(row.note ?? ''),
    createdAt: String(row.created_at),
  };
}

async function resolveIssue(key: string): Promise<IssueTimeRow | undefined> {
  await ensureTimeTracking();
  const match = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(key.trim());
  if (!match) return undefined;
  const row = await qGet(`
      SELECT i.id, i.original_estimate_minutes, i.remaining_minutes
      FROM issues i
      JOIN projects p ON p.id = i.project_id
      WHERE upper(p.key) = upper(?) AND i.num = ?
    `, [match[1], Number(match[2])]) as
    | {
        id: number;
        original_estimate_minutes: number | null;
        remaining_minutes: number | null;
      }
    | undefined;
  if (!row) return undefined;
  return {
    id: Number(row.id),
    originalEstimateMinutes:
      row.original_estimate_minutes == null ? null : Number(row.original_estimate_minutes),
    remainingMinutes: row.remaining_minutes == null ? null : Number(row.remaining_minutes),
  };
}

async function logActivity(
  issueId: number,
  authorId: number | null,
  kind: string,
  detail: string,
  createdAt = now(),
): Promise<void> {
  await qRun('INSERT INTO activity (issue_id, author_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)', [issueId, authorId, kind, detail, createdAt]);
}

export async function listWorklogs(issueId: number): Promise<Worklog[]> {
  await ensureTimeTracking();
  const rows = await qAll('SELECT * FROM worklogs WHERE issue_id = ? ORDER BY id', [issueId]) as Record<string, unknown>[];
  return rows.map(mapWorklog);
}

export async function totalSpentMinutes(issueId: number): Promise<number> {
  return (await listWorklogs(issueId)).reduce((sum, entry) => sum + entry.minutes, 0);
}

/** Set original estimate; seeds remaining when it was unset or matched the previous original. */
export async function setOriginalEstimate(key: string, userId: number, minutes: number | null): Promise<void> {
  const issue = await resolveIssue(key);
  if (!issue) return;
  const next = minutes == null ? null : parseMinutes(minutes);
  if (minutes != null && next == null) return;
  const prevOriginal = issue.originalEstimateMinutes;
  const prevRemaining = issue.remainingMinutes;
  if (prevOriginal === next) return;

  let remaining = prevRemaining;
  if (next == null) {
    remaining = null;
  } else if (prevRemaining == null || prevRemaining === prevOriginal) {
    remaining = next;
  }

  const stamp = now();
  await qRun('UPDATE issues SET original_estimate_minutes = ?, remaining_minutes = ?, updated_at = ? WHERE id = ?', [next, remaining, stamp, issue.id]);
  await logActivity(issue.id, userId, 'estimate', `${prevOriginal ?? ''}|${next ?? ''}`, stamp);
  if (prevRemaining !== remaining) {
    logActivity(issue.id, userId, 'remaining', `${prevRemaining ?? ''}|${remaining ?? ''}`, stamp);
  }
}

/** Manually adjust remaining estimate without changing original. */
export async function setRemainingEstimate(key: string, userId: number, minutes: number | null): Promise<void> {
  const issue = await resolveIssue(key);
  if (!issue) return;
  const next = minutes == null ? null : parseMinutes(minutes);
  if (minutes != null && next == null) return;
  if (issue.remainingMinutes === next) return;
  const stamp = now();
  await qRun('UPDATE issues SET remaining_minutes = ?, updated_at = ? WHERE id = ?', [next,
    stamp,
    issue.id,]);
  await logActivity(issue.id, userId, 'remaining', `${issue.remainingMinutes ?? ''}|${next ?? ''}`, stamp);
}

/** Log work against an issue and decrement remaining_minutes (floor 0). */
export async function addWorklog(
  key: string,
  userId: number,
  minutes: number,
  note: string,
): Promise<Worklog | undefined> {
  const issue = await resolveIssue(key);
  const logged = parseMinutes(minutes);
  if (!issue || logged == null || logged <= 0) return undefined;

  const stamp = now();
  const cleanNote = note.trim();
  const newId = await qInsertReturningId('INSERT INTO worklogs (issue_id, user_id, minutes, note, created_at) VALUES (?, ?, ?, ?, ?)', [issue.id, userId, logged, cleanNote, stamp]);

  let remaining = issue.remainingMinutes;
  if (remaining != null) {
    remaining = Math.max(0, remaining - logged);
  }

  await qRun('UPDATE issues SET remaining_minutes = ?, updated_at = ? WHERE id = ?', [remaining,
    stamp,
    issue.id,]);
  await logActivity(issue.id, userId, 'worklog', `${logged}|${cleanNote}`, stamp);
  if (issue.remainingMinutes !== remaining) {
    logActivity(
      issue.id,
      userId,
      'remaining',
      `${issue.remainingMinutes ?? ''}|${remaining ?? ''}`,
      stamp,
    );
  }

  return {
    id: newId,
    issueId: issue.id,
    userId,
    minutes: logged,
    note: cleanNote,
    createdAt: stamp,
  };
}
