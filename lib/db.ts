import { PRIORITIES, STATUSES, TYPES } from './format';
import { qAll, qGet, qRun, qInsertReturningId, toPg } from './sql';
import { withTransaction } from './pg';
import { getSiteByKey, DEFAULT_SITE_KEY } from './sites';
import type {
  Comment,
  CalendarAttendee,
  CalendarEvent,
  CalendarEventType,
  CalendarScope,
  CalendarTypeScope,
  Issue,
  IssueLink,
  IssueLinkType,
  IssueStatus,
  IssueType,
  Notification,
  Priority,
  Project,
  Space,
  Sprint,
  User,
  UserRole,
  WikiPage,
} from './types';

function now(): string {
  return new Date().toISOString();
}

let bootPromise: Promise<void> | null = null;

/** Idempotent boot: seed Ana admin if users empty (Postgres schema from migrations). */
export function ensureDbReady(): Promise<void> | void {
  if (!bootPromise) bootPromise = seedIfEmpty();
  return bootPromise;
}

async function seedIfEmpty(): Promise<void> {
  const count = await qGet<{ n: number }>('SELECT COUNT(*) AS n FROM users');
  if (count && Number(count.n) > 0) return;
  // Minimal lockout-safe seed if seed.sql was not applied
  await qRun(
    `INSERT INTO users (id, name, email, role) VALUES
      (1, 'Ana Solis', 'ana@example.com', 'admin'),
      (2, 'Luis Mora', 'luis@example.com', 'member'),
      (3, 'Marisol Vega', 'marisol@example.com', 'member')
     ON CONFLICT (id) DO NOTHING`,
  );
  try {
    const { ensureSites } = await import('./sites');
    await ensureSites();
  } catch (e) {
    console.error('[db] ensureSites', e);
  }
}

function mapUser(row: Record<string, unknown>): User {
  const role = String(row.role);
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    role: role === 'admin' || role === 'viewer' ? role : 'member',
    helpdeskAgent:
      row.helpdesk_agent === true ||
      Number(row.helpdesk_agent ?? 0) === 1 ||
      String(row.helpdesk_agent) === 't',
  };
}

export type AuthSource = 'local' | 'ldap';

export type UserAuthRecord = User & {
  passwordHash: string | null;
  authSource: AuthSource;
  disabled: boolean;
};

function mapUserAuth(row: Record<string, unknown>): UserAuthRecord {
  const source = String(row.auth_source ?? 'local');
  return {
    ...mapUser(row),
    passwordHash:
      row.password_hash == null || row.password_hash === ''
        ? null
        : String(row.password_hash),
    authSource: source === 'ldap' ? 'ldap' : 'local',
    disabled:
      row.disabled === true ||
      Number(row.disabled ?? 0) === 1 ||
      String(row.disabled) === 't',
  };
}

let authColumnsReady: Promise<void> | null = null;

/** Idempotent columns for local/LDAP auth (also in migration 006). */
export async function ensureAuthColumns(): Promise<void> {
  if (!authColumnsReady) {
    authColumnsReady = (async () => {
      await qRun(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
      await qRun(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_source TEXT NOT NULL DEFAULT 'local'`,
      );
      await qRun(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE`,
      );
    })().catch((err) => {
      authColumnsReady = null;
      throw err;
    });
  }
  await authColumnsReady;
}

function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    kind: String(row.kind),
    title: String(row.title),
    body: String(row.body ?? ''),
    href: row.href == null || row.href === '' ? null : String(row.href),
    readAt: row.read_at == null || row.read_at === '' ? null : String(row.read_at),
    createdAt: String(row.created_at),
  };
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: Number(row.id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description),
    leadId: Number(row.lead_id),
    workflowId: Number(row.workflow_id ?? 1),
    siteId: Number(row.site_id ?? 1),
    permissionSchemeId: Number(row.permission_scheme_id ?? 1),
  };
}

function mapSprint(row: Record<string, unknown>): Sprint {
  const state = String(row.state);
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    name: String(row.name),
    state: state === 'active' || state === 'closed' ? state : 'planned',
    goal: String(row.goal),
  };
}

const ISSUE_SELECT = `
  SELECT i.*, p.key AS project_key
  FROM issues i
  JOIN projects p ON p.id = i.project_id
`;

function mapIssue(row: Record<string, unknown>): Issue {
  const projectKey = String(row.project_key);
  const num = Number(row.num);
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    projectKey,
    num,
    key: `${projectKey}-${num}`,
    type: String(row.type) as IssueType,
    summary: String(row.summary),
    description: String(row.description),
    status: String(row.status) as IssueStatus,
    priority: String(row.priority) as Priority,
    assigneeId: row.assignee_id == null ? null : Number(row.assignee_id),
    reporterId: Number(row.reporter_id),
    sprintId: row.sprint_id == null ? null : Number(row.sprint_id),
    parentId: row.parent_id == null ? null : Number(row.parent_id),
    points: row.points == null ? null : Number(row.points),
    labels: String(row.labels ?? ''),
    componentId: row.component_id == null || row.component_id === '' ? null : Number(row.component_id),
    fixVersionId: row.fix_version_id == null || row.fix_version_id === '' ? null : Number(row.fix_version_id),
    startOn: row.start_on == null || row.start_on === '' ? null : String(row.start_on),
    dueOn: row.due_on == null || row.due_on === '' ? null : String(row.due_on),
    originalEstimateMinutes:
      row.original_estimate_minutes == null || row.original_estimate_minutes === ''
        ? null
        : Number(row.original_estimate_minutes),
    remainingMinutes:
      row.remaining_minutes == null || row.remaining_minutes === ''
        ? null
        : Number(row.remaining_minutes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapComment(row: Record<string, unknown>): Comment {
  return {
    id: Number(row.id),
    authorId: Number(row.author_id),
    body: String(row.body),
    createdAt: String(row.created_at),
    parentId: row.parent_id == null || row.parent_id === '' ? null : Number(row.parent_id),
  };
}

function mapSpace(row: Record<string, unknown>): Space {
  return {
    id: Number(row.id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description),
    kind: String(row.kind) === 'personal' ? 'personal' : 'team',
    ownerUserId: row.owner_user_id == null ? null : Number(row.owner_user_id),
    siteId: Number(row.site_id ?? 1),
  };
}

function mapPage(row: Record<string, unknown>): WikiPage {
  return {
    id: Number(row.id),
    spaceId: Number(row.space_id),
    spaceKey: String(row.space_key),
    parentId: row.parent_id == null ? null : Number(row.parent_id),
    slug: String(row.slug),
    title: String(row.title),
    body: String(row.body),
    authorId: Number(row.author_id),
    updatedAt: String(row.updated_at),
  };
}






// Re-backfill site_id after seed inserts that omit the column.
// Deferred init — called on first request, not at module load.
// (async () => {
//   const { ensureSites } = await import('@/lib/sites');
//   await ensureSites();
// })();

export async function listUsers(): Promise<User[]> {
  await ensureAuthColumns();
  return ((await qAll('SELECT * FROM users ORDER BY id')) as Record<string, unknown>[]).map(mapUser);
}

export async function listUserAuthRecords(): Promise<UserAuthRecord[]> {
  await ensureAuthColumns();
  return ((await qAll('SELECT * FROM users ORDER BY id')) as Record<string, unknown>[]).map(
    mapUserAuth,
  );
}

export async function getUser(id: number): Promise<User | undefined> {
  await ensureAuthColumns();
  const row = (await qGet('SELECT * FROM users WHERE id = ?', [id])) as Record<string, unknown> | undefined;
  return row ? mapUser(row) : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  await ensureAuthColumns();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  const row = (await qGet('SELECT * FROM users WHERE lower(email) = ? LIMIT 1', [normalized])) as Record<string, unknown> | undefined;
  return row ? mapUser(row) : undefined;
}

export async function getUserAuthByEmail(email: string): Promise<UserAuthRecord | undefined> {
  await ensureAuthColumns();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  const row = (await qGet('SELECT * FROM users WHERE lower(email) = ? LIMIT 1', [normalized])) as
    | Record<string, unknown>
    | undefined;
  return row ? mapUserAuth(row) : undefined;
}

export async function getUserAuth(id: number): Promise<UserAuthRecord | undefined> {
  await ensureAuthColumns();
  const row = (await qGet('SELECT * FROM users WHERE id = ?', [id])) as
    | Record<string, unknown>
    | undefined;
  return row ? mapUserAuth(row) : undefined;
}

export async function setUserPassword(userId: number, passwordHash: string): Promise<void> {
  await ensureAuthColumns();
  await qRun(
    `UPDATE users SET password_hash = ?, auth_source = 'local' WHERE id = ?`,
    [passwordHash, userId],
  );
}

export async function setUserAuthSource(userId: number, source: AuthSource): Promise<void> {
  await ensureAuthColumns();
  await qRun(`UPDATE users SET auth_source = ? WHERE id = ?`, [source, userId]);
}

export async function setUserDisabled(userId: number, disabled: boolean): Promise<void> {
  await ensureAuthColumns();
  await qRun(`UPDATE users SET disabled = ? WHERE id = ?`, [disabled, userId]);
}

const DEFAULT_SEED_PASSWORD = 'quetzal';
let seedPasswordsReady: Promise<void> | null = null;

/** Give existing local users without a hash the demo password `quetzal`. */
export async function ensureSeedLocalPasswords(): Promise<void> {
  if (process.env.QUETZAL_SEED_PASSWORDS === '0') return;
  if (!seedPasswordsReady) {
    seedPasswordsReady = (async () => {
      await ensureAuthColumns();
      const { hashPassword } = await import('@/lib/passwords');
      const rows = (await qAll(
        `SELECT id FROM users
          WHERE (password_hash IS NULL OR password_hash = '')
            AND COALESCE(auth_source, 'local') = 'local'`,
      )) as Array<{ id: number }>;
      if (!rows.length) return;
      const hash = hashPassword(DEFAULT_SEED_PASSWORD);
      for (const row of rows) {
        await qRun(`UPDATE users SET password_hash = ?, auth_source = 'local' WHERE id = ?`, [
          hash,
          row.id,
        ]);
      }
    })().catch((err) => {
      seedPasswordsReady = null;
      throw err;
    });
  }
  await seedPasswordsReady;
}

export async function createLocalUser(input: {
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
}): Promise<User> {
  await ensureAuthColumns();
  const normalized = input.email.trim().toLowerCase();
  if (!normalized.includes('@')) throw new Error('A valid email is required');
  const display = input.name.trim().slice(0, 80) || normalized.split('@')[0] || 'User';
  const role: UserRole =
    input.role === 'admin' || input.role === 'viewer' ? input.role : 'member';
  const id = await qInsertReturningId(
    `INSERT INTO users (name, email, role, password_hash, auth_source, disabled)
     VALUES (?, ?, ?, ?, 'local', FALSE)`,
    [display, normalized, role, input.passwordHash],
  );
  const user = await getUser(id);
  if (!user) throw new Error('Failed to create user');
  return user;
}

/** Create a user when email is unknown; returns existing row when already present. */
export async function ensureUserByEmail(
  email: string,
  name?: string,
  role: UserRole = 'member',
  authSource: AuthSource = 'local',
): Promise<User> {
  await ensureAuthColumns();
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    throw new Error('A valid email is required');
  }
  const existing = await getUserByEmail(normalized);
  if (existing) return existing;
  const display =
    (name?.trim() || normalized.split('@')[0] || 'User').replace(/\s+/g, ' ').slice(0, 80) || 'User';
  const safeRole: UserRole =
    role === 'admin' || role === 'viewer' || role === 'member' ? role : 'member';
  const id = await qInsertReturningId(
    `INSERT INTO users (name, email, role, auth_source) VALUES (?, ?, ?, ?)`,
    [display, normalized, safeRole, authSource === 'ldap' ? 'ldap' : 'local'],
  );
  const user = await getUser(id);
  if (!user) throw new Error('Failed to create user');
  return user;
}

export async function isSpaceMember(userId: number, spaceId: number): Promise<boolean> {
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(spaceId) || spaceId <= 0) return false;
  return Boolean(
    await qGet('SELECT 1 FROM space_members WHERE space_id = ? AND user_id = ?', [spaceId, userId]),
  );
}

export async function addSpaceMember(spaceId: number, userId: number): Promise<void> {
  if (!Number.isInteger(spaceId) || spaceId <= 0 || !Number.isInteger(userId) || userId <= 0) return;
  await qRun('INSERT INTO space_members (space_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [spaceId, userId]);
}

export async function listProjects(siteId?: number): Promise<Project[]> {
  if (typeof siteId === 'number') {
    return ((await qAll('SELECT * FROM projects WHERE site_id = ? ORDER BY key', [siteId])) as Record<
      string,
      unknown
    >[]).map(mapProject);
  }
  return ((await qAll('SELECT * FROM projects ORDER BY key')) as Record<string, unknown>[]).map(mapProject);
}

export async function projectsForAssignee(userId: number, siteId?: number): Promise<Project[]> {
  if (typeof siteId === 'number') {
    return ((await qAll(`
        SELECT DISTINCT p.* FROM projects p
        JOIN issues i ON i.project_id = p.id
        WHERE i.assignee_id = ? AND p.site_id = ?
        ORDER BY p.key
      `, [userId, siteId])) as Record<string, unknown>[]).map(mapProject);
  }
  return ((await qAll(`
      SELECT DISTINCT p.* FROM projects p
      JOIN issues i ON i.project_id = p.id
      WHERE i.assignee_id = ?
      ORDER BY p.key
    `, [userId])) as Record<string, unknown>[]).map(mapProject);
}

export async function getProject(key: string): Promise<Project | undefined> {
  const row = (await qGet('SELECT * FROM projects WHERE key = ?', [key])) as Record<string, unknown> | undefined;
  return row ? mapProject(row) : undefined;
}

export async function listSprints(projectId?: number): Promise<Sprint[]> {
  const rows = projectId
    ? await qAll('SELECT * FROM sprints WHERE project_id = ? ORDER BY id', [projectId])
    : await qAll('SELECT * FROM sprints ORDER BY id');
  return (rows as Record<string, unknown>[]).map(mapSprint);
}

export async function getSprint(id: number): Promise<Sprint | undefined> {
  const row = (await qGet('SELECT * FROM sprints WHERE id = ?', [id])) as Record<string, unknown> | undefined;
  return row ? mapSprint(row) : undefined;
}

export async function createSprint(projectId: number, name: string, goal = ''): Promise<Sprint | undefined> {
  const clean = name.trim().slice(0, 80);
  if (!clean || !Number.isInteger(projectId) || projectId <= 0) return undefined;
  const project = (await qGet('SELECT id FROM projects WHERE id = ?', [projectId])) as { id: number } | undefined;
  if (!project) return undefined;
  const id = await qInsertReturningId(
    `INSERT INTO sprints (project_id, name, state, goal) VALUES (?, ?, 'planned', ?)`,
    [project.id, clean, goal.trim().slice(0, 240)],
  );
  const sprint = await getSprint(id);
  if (!sprint || sprint.projectId !== project.id || sprint.state !== 'planned') return undefined;
  return sprint;
}

export interface IssueQuery {
  projectKey?: string;
  /** Filter via projects.site_id */
  siteId?: number;
  status?: string;
  type?: string;
  q?: string;
  /** Exact label token match inside the CSV labels column. */
  label?: string;
  sprintId?: number | 'backlog' | 'active';
  /** number = that user; null = unassigned; undefined = any */
  assigneeId?: number | null;
  reporterId?: number;
}

export async function listIssues(query: IssueQuery = {}): Promise<Issue[]> {
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (query.siteId != null) {
    where.push('p.site_id = ?');
    args.push(query.siteId);
  }
  if (query.projectKey) {
    where.push('p.key = ?');
    args.push(query.projectKey);
  }
  if (query.status) {
    where.push('i.status = ?');
    args.push(query.status);
  }
  if (query.type) {
    where.push('i.type = ?');
    args.push(query.type);
  }
  if (query.assigneeId === null) {
    where.push('i.assignee_id IS NULL');
  } else if (typeof query.assigneeId === 'number') {
    where.push('i.assignee_id = ?');
    args.push(query.assigneeId);
  }
  if (query.reporterId) {
    where.push('i.reporter_id = ?');
    args.push(query.reporterId);
  }
  if (query.q) {
    where.push('(i.summary LIKE ? OR i.description LIKE ? OR i.labels LIKE ?)');
    const like = `%${query.q}%`;
    args.push(like, like, like);
  }
  if (query.label) {
    const label = query.label.trim().toLowerCase().replace(/\s+/g, '');
    if (label) {
      where.push(`(',' || lower(replace(i.labels, ' ', '')) || ',') LIKE ?`);
      args.push(`%,${label},%`);
    }
  }
  if (query.sprintId === 'backlog') {
    where.push('i.sprint_id IS NULL');
  } else if (query.sprintId === 'active') {
    where.push("i.sprint_id IN (SELECT id FROM sprints WHERE state = 'active')");
  } else if (typeof query.sprintId === 'number') {
    where.push('i.sprint_id = ?');
    args.push(query.sprintId);
  }
  const sql = `${ISSUE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.key, i.num`;
  return ((await qAll(toPg(sql), args)) as Record<string, unknown>[]).map(mapIssue);
}

/** Prepared WHERE/ORDER fragments for JQL (lib/jql.ts). Args bind to `?` in whereSql. */
export type IssueSqlFilter = {
  whereSql: string;
  args: Array<string | number | null>;
  orderSql?: string;
};

export async function listIssuesFiltered(filter: IssueSqlFilter): Promise<Issue[]> {
  const where = filter.whereSql.trim() || '1=1';
  const order = filter.orderSql?.trim() || 'p.key, i.num';
  const sql = `${ISSUE_SELECT} WHERE ${where} ORDER BY ${order}`;
  return ((await qAll(toPg(sql), filter.args)) as Record<string, unknown>[]).map(mapIssue);
}

export async function getIssueById(id: number): Promise<Issue | undefined> {
  const row = (await qGet(`${ISSUE_SELECT} WHERE i.id = ?`, [id])) as Record<string, unknown> | undefined;
  return row ? mapIssue(row) : undefined;
}

export async function getIssue(key: string): Promise<Issue | undefined> {
  const match = /^([A-Z]+)-(\d+)$/.exec(key);
  if (!match) return undefined;
  const row = (await qGet(`${ISSUE_SELECT} WHERE p.key = ? AND i.num = ?`, [match[1], Number(match[2])])) as
    | Record<string, unknown>
    | undefined;
  return row ? mapIssue(row) : undefined;
}

/** Suggest issues while typing KEY or KEY- or KEY-12. */
export async function searchIssuesByKeyPrefix(query: string, limit = 8): Promise<Issue[]> {
  const cleaned = query.trim().toUpperCase();
  if (!cleaned) return [];
  const match = /^([A-Z][A-Z0-9]*)-?(\d*)$/.exec(cleaned);
  if (!match) return [];
  const projectKey = match[1];
  const numPrefix = match[2];
  if (numPrefix) {
    return ((await qAll(`${ISSUE_SELECT}
           WHERE p.key = ? AND CAST(i.num AS TEXT) LIKE ?
           ORDER BY i.num
           LIMIT ?`, [projectKey, `${numPrefix}%`, limit])) as Record<string, unknown>[]).map(mapIssue);
  }
  return ((await qAll(`${ISSUE_SELECT}
         WHERE p.key = ? OR p.key LIKE ?
         ORDER BY p.key, i.num
         LIMIT ?`, [projectKey, `${projectKey}%`, limit])) as Record<string, unknown>[]).map(mapIssue);
}

export async function childrenOf(issueId: number): Promise<Issue[]> {
  return ((await qAll(`${ISSUE_SELECT} WHERE i.parent_id = ? ORDER BY i.num`, [issueId])) as Record<string, unknown>[]).map(mapIssue);
}

export async function listComments(issueId: number): Promise<Comment[]> {
  return ((await qAll('SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at, id', [issueId])) as Record<string, unknown>[]).map(mapComment);
}

export async function createIssue(input: {
  projectKey: string;
  type: IssueType;
  summary: string;
  description: string;
  priority: Priority;
  assigneeId: number | null;
  reporterId: number;
  sprintId: number | null;
  parentKey: string | null;
  points: number | null;
  labels: string;
  dueOn: string | null;
  /** When set and free, keep this KEY-n instead of allocating next_num. */
  key?: string | null;
}): Promise<Issue> {
  const project = (await qGet('SELECT id, key, next_num FROM projects WHERE key = ?', [input.projectKey])) as
    | { id: number; key: string; next_num: number }
    | undefined;
  if (!project) throw new Error('Unknown project');
  const parent = input.parentKey ? await getIssue(input.parentKey) : undefined;
  const stamp = now();

  let num = project.next_num;
  const wanted = (input.key ?? '').trim().toUpperCase();
  if (wanted) {
    const match = /^([A-Z][A-Z0-9]*)-(\d+)$/.exec(wanted);
    if (!match) throw new Error(`Invalid issue key "${wanted}"`);
    if (match[1] !== project.key) {
      throw new Error(`Key ${wanted} does not match project ${project.key}`);
    }
    const wantedNum = Number(match[2]);
    if (!Number.isInteger(wantedNum) || wantedNum < 1) throw new Error(`Invalid issue key "${wanted}"`);
    if (await getIssue(`${project.key}-${wantedNum}`)) {
      throw new Error(`Issue ${project.key}-${wantedNum} already exists`);
    }
    num = wantedNum;
  }

  const nextNum = Math.max(project.next_num, num + 1);
  await qRun('UPDATE projects SET next_num = ? WHERE id = ?', [nextNum, project.id]);
  await qRun(`
    INSERT INTO issues (
      project_id, num, type, summary, description, status, priority,
      assignee_id, reporter_id, sprint_id, parent_id, points, labels, due_on, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [project.id,
    num,
    input.type,
    input.summary,
    input.description,
    input.priority,
    input.assigneeId,
    input.reporterId,
    input.sprintId,
    parent?.id ?? null,
    input.points,
    input.labels,
    input.dueOn && input.dueOn.trim() !== '' ? input.dueOn : null,
    stamp,
    stamp]);
  const created = await getIssue(`${project.key}-${num}`);
  if (!created) throw new Error(`Failed to create issue ${project.key}-${num}`);
  try {
    const { runAutomations } = require('./automation') as typeof import('./automation');
    await runAutomations({
      event: 'issue_created',
      issueKey: created.key,
      toStatus: created.status,
      authorId: input.reporterId,
    });
  } catch (err) {
    console.error('[automation] createIssue hook failed', err);
  }
  return created;
}

export async function updateIssue(
  key: string,
  authorId: number | null,
  patch: {
    summary: string;
    description: string;
    status: IssueStatus;
    priority: Priority;
    type: IssueType;
    assigneeId: number | null;
    sprintId: number | null;
    points: number | null;
    labels: string;
    dueOn: string | null;
  },
): Promise<void> {

  const issue = await getIssue(key);
  if (!issue) return;
  const { canApplyTransition } = require('./workflows') as typeof import('./workflows');
  const status =
    patch.status === issue.status || (await canApplyTransition(issue, patch.status)).ok
      ? patch.status
      : issue.status;
  await qRun(`
    UPDATE issues SET
      summary = ?, description = ?, status = ?, priority = ?, type = ?,
      assignee_id = ?, sprint_id = ?, points = ?, labels = ?, due_on = ?, updated_at = ?
    WHERE id = ?
  `, [patch.summary,
    patch.description,
    status,
    patch.priority,
    patch.type,
    patch.assigneeId,
    patch.sprintId,
    patch.points,
    patch.labels,
    patch.dueOn && patch.dueOn.trim() !== '' ? patch.dueOn : null,
    now(),
    issue.id,
  ]);
  const sprintName = async (id: number | null) => (id == null ? 'Backlog' : (await getSprint(id))?.name ?? 'Backlog');
  const changes: [string, string, string][] = [
    ['summary', issue.summary, patch.summary],
    ['description', issue.description, patch.description],
    ['status', issue.status, status],
    ['priority', issue.priority, patch.priority],
    ['type', issue.type, patch.type],
    ['assignee', issue.assigneeId == null ? 'unassigned' : String(issue.assigneeId), patch.assigneeId == null ? 'unassigned' : String(patch.assigneeId)],
    ['sprint', await sprintName(issue.sprintId), await sprintName(patch.sprintId)],
    ['points', issue.points == null ? '' : String(issue.points), patch.points == null ? '' : String(patch.points)],
    ['labels', issue.labels, patch.labels],
    ['due', issue.dueOn ?? '', patch.dueOn ?? ''],
  ];
  for (const [kind, from, to] of changes) {
    if (from === to) continue;
    if (kind === 'description') {
      logActivity(issue.id, authorId, 'description', 'updated');
      continue;
    }
    logActivity(issue.id, authorId, kind, `${from}|${to}`);
  }
  if (issue.status !== status) {
    try {
      const { runAutomations } = require('./automation') as typeof import('./automation');
      await runAutomations({
        event: 'status_changed',
        issueKey: key,
        fromStatus: issue.status,
        toStatus: status,
        authorId,
      });
    } catch (err) {
      console.error('[automation] updateIssue hook failed', err);
    }
    try {
      const { fireIssueStatusChanged } = require('./webhooks') as typeof import('./webhooks');
      const updated = await getIssue(key);
      if (updated) {
        await fireIssueStatusChanged({
          issue: updated,
          fromStatus: issue.status,
          toStatus: status,
          authorId,
        });
      }
    } catch (err) {
      console.error('[webhooks] updateIssue hook failed', err);
    }
  }
}

async function logActivity(
  issueId: number,
  authorId: number | null,
  kind: string,
  detail: string,
  createdAt: string = now()): Promise<void> {
  if (kind === 'comment' || kind === 'worklog') {
    const existing = (await qGet(`SELECT id FROM activity
         WHERE issue_id = ? AND kind = ? AND detail = ?
         LIMIT 1`, [issueId, kind, detail])) as { id: number } | undefined;
    if (existing) return;
  }
  await qRun('INSERT INTO activity (issue_id, author_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)', [issueId,
    authorId,
    kind,
    detail,
    createdAt,]);
}

export interface Activity {
  id: number;
  authorId: number | null;
  kind: string;
  detail: string;
  createdAt: string;
}

export type { Worklog } from '@/lib/timeTracking';
export { addWorklog, listWorklogs } from '@/lib/timeTracking';

export async function listActivity(issueId: number): Promise<Activity[]> {
  const rows = (await qAll('SELECT * FROM activity WHERE issue_id = ? ORDER BY id', [issueId])) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    authorId: row.author_id == null ? null : Number(row.author_id),
    kind: String(row.kind),
    detail: String(row.detail),
    createdAt: String(row.created_at),
  }));
}

/** Graph edges only (no conditions). Prefer `await allowedTransitions(issue)` for UI buttons. */
export async function nextStatuses(projectId: number, from: IssueStatus): Promise<IssueStatus[]> {
  const { getProjectWorkflowId, listWorkflowTransitions } =
    require('./workflows') as typeof import('./workflows');
  const workflowId = await getProjectWorkflowId(projectId);
  if (!workflowId) return [];
  const allowed = new Set(
    (await listWorkflowTransitions(workflowId))
      .filter((transition) => transition.fromStatus === from)
      .map((transition) => transition.toStatus));
  return STATUSES.filter((status) => allowed.has(status));
}

export async function setIssueStatus(key: string, status: IssueStatus, authorId?: number | null): Promise<boolean> {
  const issue = await getIssue(key);
  if (!issue || issue.status === status) return false;
  const { canApplyTransition } = await import('@/lib/workflows');
  const gate = await canApplyTransition(issue, status);
  if (!gate.ok) return false;
  const stamp = now();
  const fromStatus = issue.status;
  await qRun('UPDATE issues SET status = ?, updated_at = ? WHERE id = ?', [status, stamp, issue.id]);
  await logActivity(issue.id, authorId ?? null, 'status', `${fromStatus}|${status}`);
  try {
    const { runAutomations } = await import('@/lib/automation');
    await runAutomations({
      event: 'status_changed',
      issueKey: key,
      fromStatus,
      toStatus: status,
      authorId: authorId ?? null,
    });
  } catch (err) {
    console.error('[automation] setIssueStatus hook failed', err);
  }
  try {
    const { fireIssueStatusChanged } = await import('@/lib/webhooks');
    const updated = await getIssue(key);
    if (updated) {
      await fireIssueStatusChanged({
        issue: updated,
        fromStatus,
        toStatus: status,
        authorId: authorId ?? null,
      });
    }
  } catch (err) {
    console.error('[webhooks] setIssueStatus hook failed', err);
  }
  return true;
}

export async function labelsInProject(projectId: number): Promise<string[]> {
  const rows = (await qAll("SELECT labels FROM issues WHERE project_id = ? AND labels != ''", [projectId])) as { labels: string }[];
  const labels = new Set<string>();
  for (const row of rows) {
    for (const part of String(row.labels).split(',')) {
      const label = part.trim();
      if (label) labels.add(label);
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b));
}

export async function saveIssueField(key: string, authorId: number | null, field: string, raw: string): Promise<void> {
  const issue = await getIssue(key);
  if (!issue) return;
  if (field === 'status') {
    if (STATUSES.includes(raw as IssueStatus)) await setIssueStatus(key, raw as IssueStatus, authorId);
    return;
  }
  if (field === 'priority') {
    if (!PRIORITIES.includes(raw as Priority) || issue.priority === raw) return;
    await qRun('UPDATE issues SET priority = ?, updated_at = ? WHERE id = ?', [raw, now(), issue.id]);
    logActivity(issue.id, authorId, 'priority', `${issue.priority}|${raw}`);
    return;
  }
  if (field === 'type') {
    if (!TYPES.includes(raw as IssueType) || issue.type === raw) return;
    await qRun('UPDATE issues SET type = ?, updated_at = ? WHERE id = ?', [raw, now(), issue.id]);
    logActivity(issue.id, authorId, 'type', `${issue.type}|${raw}`);
    return;
  }
  if (field === 'assignee') {
    await assignIssue(key, raw ? Number(raw) : null, authorId);
    return;
  }
  if (field === 'reporter') {
    const reporterId = Number(raw);
    if (!Number.isInteger(reporterId) || reporterId <= 0 || !await getUser(reporterId)) return;
    if (issue.reporterId === reporterId) return;
    await qRun('UPDATE issues SET reporter_id = ?, updated_at = ? WHERE id = ?', [reporterId, now(), issue.id]);
    const prevReporter = (await getUser(issue.reporterId))?.name ?? String(issue.reporterId);
    const nextReporter = (await getUser(reporterId))?.name ?? String(reporterId);
    logActivity(issue.id, authorId, 'reporter', `${prevReporter}|${nextReporter}`);
    return;
  }
  if (field === 'sprint') {
    const sprintId = raw ? Number(raw) : null;
    if (sprintId != null) {
      const sprint = await getSprint(sprintId);
      if (!sprint || sprint.projectId !== issue.projectId) return;
    }
    if (issue.sprintId === sprintId) return;
    const sprintName = async (id: number | null) => (id == null ? 'Backlog' : (await getSprint(id))?.name ?? 'Backlog');
    await qRun('UPDATE issues SET sprint_id = ?, updated_at = ? WHERE id = ?', [sprintId, now(), issue.id]);
    logActivity(issue.id, authorId, 'sprint', `${await sprintName(issue.sprintId)}|${await sprintName(sprintId)}`);
    return;
  }
  if (field === 'component') {
    const { getComponent } = require('@/lib/versions') as typeof import('@/lib/versions');
    const componentId = raw ? Number(raw) : null;
    if (componentId != null) {
      const component = await getComponent(componentId);
      if (!component || component.projectId !== issue.projectId) return;
    }
    if (issue.componentId === componentId) return;
    const componentName = async (id: number | null) =>
      id == null ? 'None' : (await getComponent(id))?.name ?? 'None';
    await qRun('UPDATE issues SET component_id = ?, updated_at = ? WHERE id = ?', [componentId, now(), issue.id]);
    logActivity(issue.id, authorId, 'component', `${await componentName(issue.componentId)}|${await componentName(componentId)}`);
    return;
  }
  if (field === 'fixVersion' || field === 'fix_version') {
    const { getVersion } = require('@/lib/versions') as typeof import('@/lib/versions');
    const fixVersionId = raw ? Number(raw) : null;
    if (fixVersionId != null) {
      const version = await getVersion(fixVersionId);
      if (!version || version.projectId !== issue.projectId) return;
    }
    if (issue.fixVersionId === fixVersionId) return;
    const versionName = async (id: number | null) => (id == null ? 'None' : (await getVersion(id))?.name ?? 'None');
    await qRun('UPDATE issues SET fix_version_id = ?, updated_at = ? WHERE id = ?', [fixVersionId, now(), issue.id]);
    logActivity(issue.id, authorId, 'fixVersion', `${await versionName(issue.fixVersionId)}|${await versionName(fixVersionId)}`);
    return;
  }
  if (field === 'points') {
    const points = raw === '' ? null : Number(raw);
    if (points != null && !Number.isFinite(points)) return;
    if (issue.points === points) return;
    await qRun('UPDATE issues SET points = ?, updated_at = ? WHERE id = ?', [points, now(), issue.id]);
    logActivity(issue.id, authorId, 'points', `${issue.points ?? ''}|${points ?? ''}`);
    return;
  }
  if (field === 'estimate' || field === 'original_estimate') {
    const { setOriginalEstimate } = require('@/lib/timeTracking') as typeof import('@/lib/timeTracking');
    const minutes = raw === '' ? null : Number(raw);
    if (minutes != null && !Number.isFinite(minutes)) return;
    await setOriginalEstimate(key, authorId ?? 0, minutes);
    return;
  }
  if (field === 'remaining') {
    const { setRemainingEstimate } = require('@/lib/timeTracking') as typeof import('@/lib/timeTracking');
    const minutes = raw === '' ? null : Number(raw);
    if (minutes != null && !Number.isFinite(minutes)) return;
    await setRemainingEstimate(key, authorId ?? 0, minutes);
    return;
  }
  if (field === 'labels') {
    if (issue.labels === raw) return;
    await qRun('UPDATE issues SET labels = ?, updated_at = ? WHERE id = ?', [raw, now(), issue.id]);
    logActivity(issue.id, authorId, 'labels', `${issue.labels}|${raw}`);
    return;
  }
  if (field === 'due') {
    const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    if ((issue.dueOn ?? null) === dueOn) return;
    await qRun('UPDATE issues SET due_on = ?, updated_at = ? WHERE id = ?', [dueOn, now(), issue.id]);
    logActivity(issue.id, authorId, 'due', `${issue.dueOn ?? ''}|${dueOn ?? ''}`);
    return;
  }
  if (field === 'start') {
    const startOn = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    if ((issue.startOn ?? null) === startOn) return;
    await qRun('UPDATE issues SET start_on = ?, updated_at = ? WHERE id = ?', [startOn, now(), issue.id]);
    logActivity(issue.id, authorId, 'start', `${issue.startOn ?? ''}|${startOn ?? ''}`);
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Update roadmap schedule (start/due) without touching other fields. */
export async function setIssueSchedule(
  key: string,
  authorId: number | null,
  patch: { startOn?: string | null; dueOn?: string | null },
): Promise<void> {

  const issue = await getIssue(key);
  if (!issue) return;
  const startOn =
    patch.startOn === undefined
      ? issue.startOn
      : patch.startOn == null || patch.startOn === ''
        ? null
        : ISO_DAY.test(patch.startOn)
          ? patch.startOn
          : issue.startOn;
  const dueOn =
    patch.dueOn === undefined
      ? issue.dueOn
      : patch.dueOn == null || patch.dueOn === ''
        ? null
        : ISO_DAY.test(patch.dueOn)
          ? patch.dueOn
          : issue.dueOn;
  if ((issue.startOn ?? null) === (startOn ?? null) && (issue.dueOn ?? null) === (dueOn ?? null)) return;
  await qRun('UPDATE issues SET start_on = ?, due_on = ?, updated_at = ? WHERE id = ?', [
    startOn,
    dueOn,
    now(),
    issue.id,
  ]);
  if ((issue.startOn ?? null) !== (startOn ?? null)) {
    logActivity(issue.id, authorId, 'start', `${issue.startOn ?? ''}|${startOn ?? ''}`);
  }
  if ((issue.dueOn ?? null) !== (dueOn ?? null)) {
    logActivity(issue.id, authorId, 'due', `${issue.dueOn ?? ''}|${dueOn ?? ''}`);
  }
}

function mapIssueLink(row: Record<string, unknown>): IssueLink {
  return {
    id: Number(row.id),
    fromIssueId: Number(row.from_issue_id),
    toIssueId: Number(row.to_issue_id),
    type: String(row.type) as IssueLinkType,
    createdAt: String(row.created_at),
  };
}

export async function listIssueLinks(projectId: number, type: IssueLinkType = 'blocks'): Promise<IssueLink[]> {
  return ((await qAll(`
      SELECT l.*
      FROM issue_links l
      JOIN issues f ON f.id = l.from_issue_id
      JOIN issues t ON t.id = l.to_issue_id
      WHERE l.type = ? AND f.project_id = ? AND t.project_id = ?
      ORDER BY l.id
    `, [type, projectId, projectId])) as Record<string, unknown>[]).map(mapIssueLink);
}

export async function addIssueLink(
  fromKey: string,
  toKey: string,
  type: IssueLinkType = 'blocks',
): Promise<IssueLink | null> {
  const from = await getIssue(fromKey);
  const to = await getIssue(toKey);
  if (!from || !to || from.id === to.id) return null;
  if (from.projectId !== to.projectId) return null;
  const stamp = now();
  try {
    await qRun(`INSERT INTO issue_links (from_issue_id, to_issue_id, type, created_at) VALUES (?, ?, ?, ?)`, [from.id, to.id, type, stamp]);
  } catch {
    return (
      (await qGet(`SELECT * FROM issue_links WHERE from_issue_id = ? AND to_issue_id = ? AND type = ?`, [from.id, to.id, type])) as Record<string, unknown> | undefined
    )
      ? mapIssueLink(
          (await qGet(`SELECT * FROM issue_links WHERE from_issue_id = ? AND to_issue_id = ? AND type = ?`, [from.id, to.id, type])) as Record<string, unknown>,
        )
      : null;
  }
  const row = (await qGet(`SELECT * FROM issue_links WHERE from_issue_id = ? AND to_issue_id = ? AND type = ?`, [from.id, to.id, type])) as Record<string, unknown> | undefined;
  return row ? mapIssueLink(row) : null;
}

export async function removeIssueLink(fromKey: string, toKey: string, type: IssueLinkType = 'blocks'): Promise<boolean> {
  const from = await getIssue(fromKey);
  const to = await getIssue(toKey);
  if (!from || !to) return false;
  const result = await qRun(`DELETE FROM issue_links WHERE from_issue_id = ? AND to_issue_id = ? AND type = ?`, [from.id, to.id, type]);
  return Number(result) > 0;
}

export async function assignIssue(key: string, assigneeId: number | null, authorId: number | null): Promise<void> {
  const issue = await getIssue(key);
  if (!issue || issue.assigneeId === assigneeId) return;
  const stamp = now();
  await qRun('UPDATE issues SET assignee_id = ?, updated_at = ? WHERE id = ?', [assigneeId, stamp, issue.id]);
  const next = assigneeId == null ? 'unassigned' : (await getUser(assigneeId))?.name ?? String(assigneeId);
  const prev = issue.assigneeId == null ? 'unassigned' : (await getUser(issue.assigneeId))?.name ?? String(issue.assigneeId);
  await logActivity(issue.id, authorId, 'assignee', `${prev}|${next}`);
}

export async function startSprint(id: number): Promise<boolean> {
  const sprint = await getSprint(id);
  if (!sprint || sprint.state !== 'planned') return false;
  const active = await qGet(`SELECT id FROM sprints WHERE project_id = ? AND state = 'active'`, [sprint.projectId]);
  if (active) return false;
  await qRun(`UPDATE sprints SET state = 'active' WHERE id = ?`, [id]);
  return true;
}

export async function completeSprint(id: number): Promise<boolean> {
  const sprint = await getSprint(id);
  if (!sprint || sprint.state !== 'active') return false;
  const stamp = now();
  await qRun(`UPDATE issues SET sprint_id = NULL, updated_at = ? WHERE sprint_id = ? AND status != 'done'`, [stamp, id]);
  await qRun(`UPDATE sprints SET state = 'closed' WHERE id = ?`, [id]);
  return true;
}

export interface IssueReaction {
  emoji: string;
  count: number;
  mine: boolean;
  users: string[];
}

function groupReactions(rows: { emoji: string; user_id: number; name: string }[], viewerId: number): IssueReaction[] {
  const grouped = new Map<string, IssueReaction>();
  for (const row of rows) {
    const current = grouped.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false, users: [] };
    current.count += 1;
    current.users.push(String(row.name));
    if (Number(row.user_id) === viewerId) current.mine = true;
    grouped.set(row.emoji, current);
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

export async function listReactions(kind: 'issue' | 'comment', targetId: number, viewerId: number): Promise<IssueReaction[]> {
  const rows = (await qAll(
    `
      SELECT r.emoji, r.user_id, u.name
      FROM reaction_marks r
      JOIN users u ON u.id = r.user_id
      WHERE r.kind = ? AND r.target_id = ?
      ORDER BY r.created_at, r.id
    `,
    [kind, targetId],
  )) as { emoji: string; user_id: number; name: string }[];
  return groupReactions(rows, viewerId);
}

export async function listIssueReactions(issueId: number, viewerId: number): Promise<IssueReaction[]> {
  return await listReactions('issue', issueId, viewerId);
}

export async function listCommentReactions(commentIds: number[], viewerId: number): Promise<Record<number, IssueReaction[]> > {
  if (commentIds.length === 0) return {};
  const placeholders = commentIds.map(() => '?').join(',');
  const rows = (await qAll(
    `
      SELECT r.target_id, r.emoji, r.user_id, u.name
      FROM reaction_marks r
      JOIN users u ON u.id = r.user_id
      WHERE r.kind = 'comment' AND r.target_id IN (${placeholders})
      ORDER BY r.created_at, r.id
    `,
    [...commentIds],
  )) as { target_id: number; emoji: string; user_id: number; name: string }[];
  const byComment = new Map<number, { emoji: string; user_id: number; name: string }[]>();
  for (const row of rows) {
    const list = byComment.get(Number(row.target_id)) ?? [];
    list.push(row);
    byComment.set(Number(row.target_id), list);
  }
  const out: Record<number, IssueReaction[]> = {};
  for (const id of commentIds) out[id] = groupReactions(byComment.get(id) ?? [], viewerId);
  return out;
}

export async function toggleReaction(kind: 'issue' | 'comment', targetId: number, userId: number, emoji: string): Promise<void> {
  const clean = emoji.trim().slice(0, 16);
  if (!clean || !Number.isInteger(targetId) || targetId <= 0) return;
  if (kind === 'comment') {
    if (!(await qGet('SELECT id FROM comments WHERE id = ?', [targetId]))) return;
  } else if (!(await qGet('SELECT id FROM issues WHERE id = ?', [targetId]))) {
    return;
  }
  const existing = (await qGet(
    'SELECT id FROM reaction_marks WHERE kind = ? AND target_id = ? AND user_id = ? AND emoji = ?',
    [kind, targetId, userId, clean],
  )) as { id: number } | undefined;
  if (existing) {
    await qRun('DELETE FROM reaction_marks WHERE id = ?', [existing.id]);
    return;
  }
  await qRun('INSERT INTO reaction_marks (kind, target_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)', [
    kind,
    targetId,
    userId,
    clean,
    now(),
  ]);
}

export async function toggleIssueReaction(key: string, userId: number, emoji: string): Promise<void> {
  const issue = await getIssue(key);
  if (!issue) return;
  await toggleReaction('issue', issue.id, userId, emoji);
}

export async function addComment(
  key: string,
  authorId: number,
  body: string,
  parentId: number | null = null,
  opts?: { skipAutomation?: boolean },
): Promise<void> {

  const issue = await getIssue(key);
  if (!issue || !body.trim()) return;
  let parent: number | null = null;
  if (parentId != null) {
    if (!Number.isInteger(parentId) || parentId <= 0) throw new Error('Parent comment does not exist');
    const row = (await qGet('SELECT id, issue_id FROM comments WHERE id = ?', [parentId])) as
      | { id: number; issue_id: number }
      | undefined;
    if (!row) throw new Error('Parent comment does not exist');
    if (Number(row.issue_id) !== issue.id) throw new Error('Parent comment is not on this issue');
    parent = Number(row.id);
  }
  const stamp = now();
  const clean = body.trim();
  await qRun('INSERT INTO comments (issue_id, author_id, body, parent_id, created_at) VALUES (?, ?, ?, ?, ?)', [issue.id,
    authorId,
    clean,
    parent,
    stamp]);
  await qRun('UPDATE issues SET updated_at = ? WHERE id = ?', [stamp, issue.id]);
  await logActivity(issue.id, authorId, 'comment', clean, stamp);
  try {
    const { notifyOnIssueComment } = require('./notify') as typeof import('./notify');
    await notifyOnIssueComment(issue, authorId, clean);
  } catch (err) {
    console.error('[notify] comment hook failed', err);
  }
  try {
    const { fireIssueCommentAdded } = require('./webhooks') as typeof import('./webhooks');
    await fireIssueCommentAdded({ issue, authorId, body: clean });
  } catch (err) {
    console.error('[webhooks] addComment hook failed', err);
  }
  if (opts?.skipAutomation) return;
  try {
    const { runAutomations } = require('./automation') as typeof import('./automation');
    await runAutomations({
      event: 'comment_added',
      issueKey: key,
      toStatus: issue.status,
      authorId,
      commentBody: clean,
    });
  } catch (err) {
    console.error('[automation] addComment hook failed', err);
  }
}

export async function createNotification(input: {
  userId: number;
  kind: string;
  title: string;
  body?: string;
  href?: string | null;
}): Promise<number> {
  const stamp = now();
  return await qInsertReturningId(
    `INSERT INTO notifications (user_id, kind, title, body, href, read_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [
      input.userId,
      input.kind.slice(0, 40),
      input.title.slice(0, 200),
      (input.body ?? '').slice(0, 2000),
      input.href ? input.href.slice(0, 400) : null,
      stamp,
    ],
  );
}

export async function listNotifications(userId: number, limit = 40): Promise<Notification[]> {
  const capped = Math.min(Math.max(limit, 1), 100);
  return ((await qAll(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`, [userId, capped])) as Record<string, unknown>[]).map(mapNotification);
}

export async function unreadNotificationCount(userId: number): Promise<number> {
  const row = (await qGet(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`, [userId])) as { n: number };
  return Number(row.n) || 0;
}

export async function markNotificationRead(id: number, userId: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  await qRun(`UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?`, [now(), id, userId]);
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  await qRun(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`, [now(), userId]);
}

export async function listSpaces(siteId?: number): Promise<Space[]> {
  if (typeof siteId === 'number') {
    return ((await qAll(`SELECT * FROM spaces WHERE kind = 'personal' OR site_id = ? ORDER BY kind DESC, key`, [siteId])) as Record<string, unknown>[]).map(mapSpace);
  }
  return ((await qAll('SELECT * FROM spaces ORDER BY kind DESC, key')) as Record<string, unknown>[]).map(mapSpace);
}

export async function listTeamSpaces(siteId?: number): Promise<Space[]> {
  if (typeof siteId === 'number') {
    return ((await qAll(`SELECT * FROM spaces WHERE kind = 'team' AND site_id = ? ORDER BY key`, [siteId])) as Record<string, unknown>[]).map(mapSpace);
  }
  return (await listSpaces()).filter((space) => space.kind === 'team');
}

export async function getSpace(key: string): Promise<Space | undefined> {
  const row = (await qGet('SELECT * FROM spaces WHERE key = ?', [key])) as Record<string, unknown> | undefined;
  return row ? mapSpace(row) : undefined;
}

export async function getPersonalSpace(userId: number): Promise<Space | undefined> {
  const row = (await qGet(`SELECT * FROM spaces WHERE kind = 'personal' AND owner_user_id = ? LIMIT 1`, [userId])) as Record<string, unknown> | undefined;
  return row ? mapSpace(row) : undefined;
}

export async function ensurePersonalSpace(userId: number): Promise<Space> {
  const existing = await getPersonalSpace(userId);
  if (existing) return existing;
  const user = await getUser(userId);
  if (!user) throw new Error('Unknown user');
  const first = user.name.split(/\s+/)[0] || 'Me';
  const key = `U${userId}`;
  const stamp = now();
  const hq = await getSiteByKey(DEFAULT_SITE_KEY);
  await qRun(`INSERT INTO spaces (key, name, description, kind, owner_user_id, site_id) VALUES (?, ?, ?, 'personal', ?, ?)`, [key, `${first}'s space`, 'Notes, drafts, and personal pages.', userId, hq?.id ?? 1]);
  const spaceRow = await qGet(`SELECT id FROM spaces WHERE key = ? LIMIT 1`, [key]) as { id: number } | undefined;
  const spaceId = spaceRow?.id ?? 0;
  await qRun(`INSERT INTO pages (space_id, parent_id, slug, title, body, author_id, updated_at) VALUES (?, NULL, 'overview', ?, ?, ?, ?)`, [spaceId,
    'Home',
    `This is ${first}'s personal space. Switch to a team space from the sidebar when you need the handbook or engineering docs.`,
    userId,
    stamp]);
  await addSpaceMember(spaceId, userId);
  const ps = await getPersonalSpace(userId);
  if (!ps) throw new Error('Failed to create personal space');
  return ps;
}

/** Seed roles + team space membership without locking out existing demos. */
async function ensureAclSeed(): Promise<void> {
  // Keep existing accounts as writers; only invent a demo viewer when missing.
  await qInsertReturningId(`UPDATE users SET role = 'admin' WHERE id = 1 AND role NOT IN ('admin', 'member', 'viewer')`);
  await qRun(`UPDATE users SET role = 'member' WHERE id IN (2, 3) AND role NOT IN ('admin', 'member', 'viewer')`);
  const viewer = (await qGet(`SELECT id FROM users WHERE email = 'viewer@example.com'`)) as { id: number } | undefined;
  if (!viewer) {
    await qRun(`INSERT INTO users (name, email, role) VALUES (?, ?, 'viewer')`, ['Rita Viewer',
      'viewer@example.com',]);
  } else {
    await qRun(`UPDATE users SET role = 'viewer' WHERE id = ?`, [viewer.id]);
  }
  // Team spaces: every admin/member is a member; viewers are not.
  const teams = (await qAll(`SELECT id FROM spaces WHERE kind = 'team'`)) as { id: number }[];
  const writers = (await qAll(`SELECT id FROM users WHERE role IN ('admin', 'member')`)) as { id: number }[];
  for (const space of teams) {
    for (const user of writers) await addSpaceMember(space.id, user.id);
  }
  // Personal spaces: owner is a member.
  const personal = (await qAll(`SELECT id, owner_user_id FROM spaces WHERE kind = 'personal' AND owner_user_id IS NOT NULL`)) as { id: number; owner_user_id: number }[];
  for (const space of personal) await addSpaceMember(space.id, space.owner_user_id);
}

// ensureAclSeed(); — call explicitly when needed (async)
// Permission schemes, project roles, space_permissions (own module; after ACL user seed).
((async () => {
  require('@/lib/permissions') as typeof import('@/lib/permissions');
})());

const PAGE_SELECT = `
  SELECT pg.*, s.key AS space_key
  FROM pages pg
  JOIN spaces s ON s.id = pg.space_id
`;

export async function pagesInSpace(spaceKey: string, siteId?: number): Promise<WikiPage[]> {
  if (typeof siteId === 'number') {
    // Personal spaces are visible from any site; team spaces must match site_id.
    return ((await qAll(`${PAGE_SELECT}
           WHERE s.key = ?
             AND (s.kind = 'personal' OR s.site_id = ?)
           ORDER BY pg.title`, [spaceKey, siteId])) as Record<string, unknown>[]).map(mapPage);
  }
  return ((await qAll(`${PAGE_SELECT} WHERE s.key = ? ORDER BY pg.title`, [spaceKey])) as Record<string, unknown>[]).map(mapPage);
}

export async function getPage(spaceKey: string, slug: string): Promise<WikiPage | undefined> {
  const row = (await qGet(`${PAGE_SELECT} WHERE s.key = ? AND pg.slug = ?`, [spaceKey, slug])) as
    | Record<string, unknown>
    | undefined;
  return row ? mapPage(row) : undefined;
}

export async function getPageById(id: number): Promise<WikiPage | undefined> {
  if (!Number.isInteger(id) || id <= 0) return undefined;
  const row = (await qGet(`${PAGE_SELECT} WHERE pg.id = ?`, [id])) as Record<string, unknown> | undefined;
  return row ? mapPage(row) : undefined;
}

export async function listPageComments(pageId: number): Promise<Comment[]> {
  return ((await qAll('SELECT * FROM page_comments WHERE page_id = ? ORDER BY id', [pageId])) as Record<string, unknown>[]).map(mapComment);
}

export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return slug || 'page';
}

export async function createPage(input: {
  spaceKey: string;
  parentId: number | null;
  title: string;
  body: string;
  authorId: number;
}): Promise<WikiPage> {
  const space = await getSpace(input.spaceKey);
  if (!space) throw new Error('Unknown space');
  let slug = await slugify(input.title);
  const takenSql = 'SELECT id FROM pages WHERE space_id = ? AND slug = ?';
  if (await qGet(takenSql, [space.id, slug])) slug = `${slug}-${Date.now().toString(36)}`;
  const stamp = now();
  await qRun(`
    INSERT INTO pages (space_id, parent_id, slug, title, body, author_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [space.id, input.parentId, slug, input.title, input.body, input.authorId, stamp]);
  const created = await getPage(space.key, slug);
  if (!created) throw new Error('Failed to create page');
  return created;
}

export async function updatePage(
  spaceKey: string,
  slug: string,
  title: string,
  body: string,
  opts?: { authorId?: number; labels?: string[]; properties?: { key: string; value: string }[] },
): Promise<void> {

  const page = await getPage(spaceKey, slug);
  if (!page) return;
  const { savePageVersion, setPageLabels, setPageProperties } = require('@/lib/wikiExtras') as typeof import('@/lib/wikiExtras');
  await savePageVersion(page.id, page.title, page.body, opts?.authorId ?? page.authorId);
  await qRun('UPDATE pages SET title = ?, body = ?, updated_at = ? WHERE id = ?', [title, body, now(), page.id]);
  if (opts?.labels) await setPageLabels(page.id, opts.labels);
  if (opts?.properties) await setPageProperties(page.id, opts.properties);
}

export async function addPageComment(spaceKey: string, slug: string, authorId: number, body: string): Promise<void> {
  const page = await getPage(spaceKey, slug);
  if (!page || !body.trim()) return;
  await qRun('INSERT INTO page_comments (page_id, author_id, body, created_at) VALUES (?, ?, ?, ?)', [page.id, authorId, body.trim(), now()]);
}

export async function searchAll(q: string): Promise<{ issues: Issue[]; pages: WikiPage[] }> {
  const like = `%${q}%`;
  const issues = ((await qAll(`${ISSUE_SELECT} WHERE i.summary LIKE ? OR i.description LIKE ? OR i.labels LIKE ? ORDER BY p.key, i.num LIMIT 40`, [like, like, like])) as Record<string, unknown>[]).map(mapIssue);
  const pages = ((await qAll(`${PAGE_SELECT} WHERE pg.title LIKE ? OR pg.body LIKE ? ORDER BY pg.title LIMIT 40`, [like, like])) as Record<string, unknown>[]).map(mapPage);
  return { issues, pages };
}

export async function counts(userId: number, projectKey: string): Promise<{ open: number; review: number; mine: number }> {
  const open = (await qGet(`
    SELECT COUNT(*) AS n FROM issues i JOIN projects p ON p.id = i.project_id
    WHERE p.key = ? AND i.status != 'done'
  `, [projectKey])) as { n: number };
  const review = (await qGet(`
    SELECT COUNT(*) AS n FROM issues i JOIN projects p ON p.id = i.project_id
    WHERE p.key = ? AND i.status = 'in_review'
  `, [projectKey])) as { n: number };
  const mine = (await qGet(`
    SELECT COUNT(*) AS n FROM issues i JOIN projects p ON p.id = i.project_id
    WHERE p.key = ? AND i.assignee_id = ? AND i.status != 'done'
  `, [projectKey, userId])) as { n: number };
  return { open: open.n, review: review.n, mine: mine.n };
}

const PRIORITY_RANK = `CASE i.priority
  WHEN 'blocker' THEN 0 WHEN 'highest' THEN 1 WHEN 'high' THEN 2
  WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`;

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function isWatching(issueId: number, userId: number): Promise<boolean> {
  return Boolean(await qGet('SELECT 1 FROM issue_watchers WHERE issue_id = ? AND user_id = ?', [issueId, userId]));
}

export async function toggleWatch(issueId: number, userId: number): Promise<boolean> {
  if (!(await getIssueById(issueId)) || !(await getUser(userId))) return false;
  if (await isWatching(issueId, userId)) {
    await qRun('DELETE FROM issue_watchers WHERE issue_id = ? AND user_id = ?', [issueId, userId]);
    return false;
  }
  await qRun('INSERT INTO issue_watchers (issue_id, user_id, created_at) VALUES (?, ?, ?)', [
    issueId,
    userId,
    now(),
  ]);
  return true;
}

export async function listWatching(userId: number, projectKey: string): Promise<Issue[]> {
  const rows = (await qAll(`
    ${ISSUE_SELECT}
    JOIN issue_watchers w ON w.issue_id = i.id
    WHERE p.key = ? AND w.user_id = ?
    ORDER BY ${PRIORITY_RANK}, i.num
  `, [projectKey, userId])) as Record<string, unknown>[];
  return rows.map(mapIssue);
}

export async function listInvolved(userId: number, projectKey: string): Promise<Issue[]> {
  const rows = (await qAll(`
    ${ISSUE_SELECT}
    WHERE p.key = ?
      AND (i.assignee_id IS NULL OR i.assignee_id != ?)
      AND i.reporter_id != ?
      AND i.id IN (
        SELECT issue_id FROM activity WHERE author_id = ?
        UNION
        SELECT issue_id FROM comments WHERE author_id = ?
        UNION
        SELECT issue_id FROM worklogs WHERE user_id = ?
        UNION
        SELECT target_id FROM reaction_marks WHERE kind = 'issue' AND user_id = ?
        UNION
        SELECT c.issue_id FROM reaction_marks r
          JOIN comments c ON c.id = r.target_id
          WHERE r.kind = 'comment' AND r.user_id = ?
      )
    ORDER BY i.updated_at DESC, i.num
  `, [projectKey, userId, userId, userId, userId, userId, userId, userId])) as Record<string, unknown>[];
  return rows.map(mapIssue);
}

export async function listNeedsAction(userId: number, projectKey: string): Promise<Issue[]> {
  const today = todayStamp();
  const rows = (await qAll(`
    ${ISSUE_SELECT}
    WHERE p.key = ?
      AND i.assignee_id = ?
      AND i.status != 'done'
      AND (
        i.priority IN ('blocker', 'highest', 'high')
        OR i.status = 'in_review'
        OR (i.due_on IS NOT NULL AND i.due_on <= ?)
      )
    ORDER BY
      CASE WHEN i.due_on IS NOT NULL AND i.due_on <= ? THEN 0 ELSE 1 END,
      ${PRIORITY_RANK},
      CASE WHEN i.due_on IS NULL THEN 1 ELSE 0 END,
      i.due_on ASC,
      i.num
  `, [projectKey, userId, today, today])) as Record<string, unknown>[];
  return rows.map(mapIssue);
}

export async function listDueCalendar(userId: number, projectKey: string, year: number, month: number): Promise<Issue[]> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  const rows = (await qAll(`
    ${ISSUE_SELECT}
    WHERE p.key = ?
      AND i.due_on IS NOT NULL
      AND i.due_on >= ? AND i.due_on < ?
      AND (
        i.assignee_id = ?
        OR EXISTS (SELECT 1 FROM issue_watchers w WHERE w.issue_id = i.id AND w.user_id = ?)
      )
    ORDER BY i.due_on, i.num
  `, [projectKey, start, end, userId, userId])) as Record<string, unknown>[];
  return rows.map(mapIssue);
}

export type FeedEntry = {
  id: number;
  issueId: number;
  issueKey: string;
  summary: string;
  authorId: number | null;
  authorName: string | null;
  kind: string;
  detail: string;
  createdAt: string;
};

export async function listRecentFeed(projectKey: string, limit = 24): Promise<FeedEntry[]> {
  const rows = (await qAll(`
    SELECT a.id, a.issue_id, a.author_id, a.kind, a.detail, a.created_at,
           i.num, i.summary, p.key AS project_key, u.name AS author_name
    FROM activity a
    JOIN issues i ON i.id = a.issue_id
    JOIN projects p ON p.id = i.project_id
    LEFT JOIN users u ON u.id = a.author_id
    WHERE p.key = ?
    ORDER BY a.id DESC
    LIMIT ?
  `, [projectKey, limit])) as Record<string, unknown>[];
  return rows.map((row) => {
    const projectKeyValue = String(row.project_key);
    const num = Number(row.num);
    return {
      id: Number(row.id),
      issueId: Number(row.issue_id),
      issueKey: `${projectKeyValue}-${num}`,
      summary: String(row.summary),
      authorId: row.author_id == null ? null : Number(row.author_id),
      authorName: row.author_name == null ? null : String(row.author_name),
      kind: String(row.kind),
      detail: String(row.detail),
      createdAt: String(row.created_at),
    };
  });
}

export type ActivityDayCount = { day: string; count: number };

/** Daily activity counts for a project over the last `days` calendar days (inclusive of today). */
export async function listProjectActivityByDay(projectKey: string, days = 84): Promise<ActivityDayCount[]> {
  const capped = Math.max(7, Math.min(120, Math.floor(days)));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (capped - 1));
  const startIso = start.toISOString();

  const rows = (await qAll(`
    SELECT date(a.created_at) AS day, COUNT(*) AS n
    FROM activity a
    JOIN issues i ON i.id = a.issue_id
    JOIN projects p ON p.id = i.project_id
    WHERE p.key = ?
      AND a.created_at >= ?
    GROUP BY date(a.created_at)
    ORDER BY day
  `, [projectKey, startIso])) as Record<string, unknown>[];

  return rows.map((row) => ({
    day: String(row.day).slice(0, 10),
    count: Number(row.n) || 0,
  }));
}

// Demo due/watch seed handled by db/seed.sql

function mapEventType(row: Record<string, unknown>): CalendarEventType {
  const scope = String(row.scope);
  return {
    id: Number(row.id),
    name: String(row.name),
    color: String(row.color),
    scope: scope === 'personal' || scope === 'project' ? scope : 'both',
    projectId: row.project_id == null ? null : Number(row.project_id),
    ownerUserId: row.owner_user_id == null ? null : Number(row.owner_user_id),
    system: row.is_system === true || Number(row.is_system) === 1,
    createdAt: String(row.created_at),
  };
}

/** Normalize pg DATE / Date / ISO strings to YYYY-MM-DD for calendar keys. */
function asIsoDay(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value ?? '');
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (match) return match[1];
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return raw.slice(0, 10);
}

function asClock(value: unknown): string | null {
  if (value == null || value === '') return null;
  const raw = String(value);
  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return raw;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function mapEvent(row: Record<string, unknown>, attendees: CalendarAttendee[] = []): CalendarEvent {
  const scope = String(row.scope) === 'project' ? 'project' : 'personal';
  return {
    id: Number(row.id),
    title: String(row.title),
    notes: String(row.notes ?? ''),
    typeId: Number(row.type_id),
    typeName: String(row.type_name),
    typeColor: String(row.type_color),
    scope,
    ownerUserId: row.owner_user_id == null ? null : Number(row.owner_user_id),
    projectId: row.project_id == null ? null : Number(row.project_id),
    startsOn: asIsoDay(row.starts_on),
    endsOn: asIsoDay(row.ends_on),
    startTime: asClock(row.start_time),
    endTime: asClock(row.end_time),
    createdBy: Number(row.created_by),
    createdByName: String(row.created_by_name ?? 'Someone'),
    attendees,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const EVENT_SELECT = `
  SELECT e.*, t.name AS type_name, t.color AS type_color, u.name AS created_by_name
  FROM calendar_events e
  JOIN calendar_event_types t ON t.id = e.type_id
  JOIN users u ON u.id = e.created_by
`;

async function listEventAttendees(eventId: number): Promise<CalendarAttendee[]> {
  const rows = (await qAll(
    `
    SELECT u.id, u.name, u.email
    FROM calendar_event_attendees a
    JOIN users u ON u.id = a.user_id
    WHERE a.event_id = ?
    ORDER BY u.name
  `,
    [eventId],
  )) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
  }));
}

async function setEventAttendees(eventId: number, userIds: number[]): Promise<void> {
  await qRun('DELETE FROM calendar_event_attendees WHERE event_id = ?', [eventId]);
  const unique = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))];
  for (const userId of unique) {
    await qRun(
      'INSERT INTO calendar_event_attendees (event_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
      [eventId, userId],
    );
  }
}

export async function ensureCalendarSeed(): Promise<void> {
  const typeCount = (await qGet('SELECT COUNT(*) AS n FROM calendar_event_types')) as { n: number };
  if (Number(typeCount.n) === 0) {
    const stamp = now();
    const insertSql = `
      INSERT INTO calendar_event_types (name, color, scope, project_id, owner_user_id, is_system, created_at)
      VALUES (?, ?, 'both', NULL, NULL, TRUE, ?)
    `;
    await qRun(insertSql, ['Meeting', '#005eb8', stamp]);
    await qRun(insertSql, ['Deadline', '#c9372c', stamp]);
    await qRun(insertSql, ['Milestone', '#b38600', stamp]);
    await qRun(insertSql, ['Reminder', '#6b7280', stamp]);
    await qRun(insertSql, ['Focus', '#0f766e', stamp]);
  } else {
    // Keep system catalog complete even if an older seed only inserted a subset
    const stamp = now();
    const required: Array<[string, string]> = [
      ['Meeting', '#005eb8'],
      ['Deadline', '#c9372c'],
      ['Milestone', '#b38600'],
      ['Reminder', '#6b7280'],
      ['Focus', '#0f766e'],
    ];
    for (const [name, color] of required) {
      const exists = (await qGet(
        `SELECT id FROM calendar_event_types WHERE lower(name) = lower(?) AND is_system IS TRUE LIMIT 1`,
        [name],
      )) as { id: number } | undefined;
      if (!exists) {
        await qRun(
          `INSERT INTO calendar_event_types (name, color, scope, project_id, owner_user_id, is_system, created_at)
           VALUES (?, ?, 'both', NULL, NULL, TRUE, ?)`,
          [name, color, stamp],
        );
      }
    }
  }
  const eventCount = (await qGet('SELECT COUNT(*) AS n FROM calendar_events')) as { n: number };
  if (eventCount.n === 0) {
    const stamp = now();
    const meeting = (await qGet(`SELECT id FROM calendar_event_types WHERE name = 'Meeting' LIMIT 1`)) as { id: number } | undefined;
    const deadline = (await qGet(`SELECT id FROM calendar_event_types WHERE name = 'Deadline' LIMIT 1`)) as { id: number } | undefined;
    const focus = (await qGet(`SELECT id FROM calendar_event_types WHERE name = 'Focus' LIMIT 1`)) as { id: number } | undefined;
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    if (meeting) {
      await qRun(`
        INSERT INTO calendar_events (
          title, notes, type_id, scope, owner_user_id, project_id, starts_on, ends_on, start_time, end_time, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'project', NULL, 1, ?, ?, ?, ?, 1, ?, ?)
      `, ['Checkout reliability sync', 'Align on the timeout retry path.', meeting.id, day(1), day(1), '10:00', '10:30', stamp, stamp]);
    }
    if (deadline) {
      await qRun(`
        INSERT INTO calendar_events (
          title, notes, type_id, scope, owner_user_id, project_id, starts_on, ends_on, start_time, end_time, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'project', NULL, 1, ?, ?, NULL, NULL, 1, ?, ?)
      `, ['Sprint 14 review', 'Demo the idempotency work.', deadline.id, day(5), day(5), stamp, stamp]);
    }
    if (focus) {
      await qRun(`
        INSERT INTO calendar_events (
          title, notes, type_id, scope, owner_user_id, project_id, starts_on, ends_on, start_time, end_time, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'personal', 1, NULL, ?, ?, ?, ?, 1, ?, ?)
      `, ['Deep work block', 'No meetings.', focus.id, day(0), day(0), '14:00', '16:00', stamp, stamp]);
    }
  }
}

async function ensureConfluenceMacrosPage(): Promise<void> {
  const space = await getSpace('ENG');
  if (!space) return;
  const existing = await getPage('ENG', 'confluence-macros-migration');
  if (existing) return;
  const stamp = now();
  const body = `<h1>Confluence macros → Quetzal Wiki</h1>
<p>Inventory of Confluence Cloud editor macros (Atlassian Support) plus common legacy macros, prioritized for Quetzal TipTap wiki.</p>
<p>Source: <a href="https://support.atlassian.com/confluence-cloud/docs/what-are-macros/">What are macros?</a></p>
<h2>P0 — build first in Quetzal</h2>
<ul>
<li><strong>Table of Contents / TOC Zone</strong> — auto headings outline</li>
<li><strong>Children Display / Child items</strong> — list child pages (we have PageTree)</li>
<li><strong>Include Page / Include content</strong> — embed another wiki page</li>
<li><strong>Excerpt + Excerpt Include</strong> — reusable snippets</li>
<li><strong>Code Block / Code Snippet</strong> — TipTap code block (done)</li>
<li><strong>Info / Tip / Note / Warning / Panel / Status</strong> — callout panels</li>
<li><strong>Anchor</strong> — deep links inside a page</li>
<li><strong>Attachments</strong> — files on a page (needs upload storage)</li>
</ul>
<h2>P1 — content discovery</h2>
<ul>
<li>Content by Label / Filter by label</li>
<li>Labels List / Popular Labels / Related Labels</li>
<li>Page Tree / Page Tree Search</li>
<li>Page Index</li>
<li>Recently Updated / Recently Updated Dashboard</li>
<li>Livesearch</li>
<li>Spaces List</li>
<li>Blog Posts</li>
</ul>
<h2>P2 — people &amp; activity</h2>
<ul>
<li>Contributors / Contributors Summary</li>
<li>User List / User Profile / Profile Picture</li>
<li>Change History</li>
<li>Task Report</li>
<li>Decision Report</li>
<li>Create from Template</li>
</ul>
<h2>P3 — embeds &amp; reports</h2>
<ul>
<li>iFrame</li>
<li>Widget Connector (YouTube, etc.)</li>
<li>PDF / Microsoft Office / OneDrive</li>
<li>Gallery / Multimedia</li>
<li>Chart</li>
<li>Content Report Table</li>
<li>Content Properties / Content Properties Report (Page Properties)</li>
<li>Roadmap Planner</li>
<li>Jira Issues / Jira Work Items / Jira Chart / Jira Roadmap</li>
<li>Network</li>
</ul>
<h2>Legacy editor macros (still migrate if present in exports)</h2>
<ul>
<li>Section + Column</li>
<li>Noformat</li>
<li>Cheese (joke)</li>
<li>Lorem Ipsum</li>
<li>Favorite Pages</li>
<li>Global Reports</li>
<li>Search Results</li>
<li>Space Attachments / Space Details</li>
<li>Content by User</li>
<li>Create Space Button</li>
<li>Recently Used Labels</li>
<li>JUnit Report</li>
<li>Google Drive</li>
<li>Navigation Map</li>
</ul>
<h2>Full Cloud editor list</h2>
<ol>
<li>Anchor</li><li>Attachments</li><li>Blog Posts</li><li>Change-History</li><li>Chart</li>
<li>Children Display</li><li>Content by Label</li><li>Content Report Table</li><li>Contributors</li>
<li>Contributors Summary</li><li>Create from Template</li><li>Excerpt Include</li><li>Excerpt</li>
<li>Gallery</li><li>iFrame</li><li>Include Page</li><li>Microsoft Office</li><li>Jira Chart</li>
<li>Jira Issues</li><li>Jira Roadmap</li><li>Labels List</li><li>Livesearch</li>
<li>Microsoft OneDrive for Business</li><li>Network</li><li>Page Index</li>
<li>Content Properties</li><li>Content Properties Report</li><li>Page Tree</li><li>Page Tree Search</li>
<li>PDF</li><li>Popular Labels</li><li>Profile Picture</li><li>Recently Updated Dashboard</li>
<li>Recently Updated</li><li>Related Labels</li><li>Roadmap Planner</li><li>Spaces List</li>
<li>Table of Contents</li><li>Table of Content Zone</li><li>Task Report</li><li>User List</li>
<li>User Profile</li><li>Widget Connector</li>
</ol>
<p>Plus Marketplace macros (instance-specific) — export and triage separately.</p>`;
  const parent = await getPage('ENG', 'overview');
  await qRun(`INSERT INTO pages (space_id, parent_id, slug, title, body, author_id, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)`, [space.id, parent?.id ?? null, 'confluence-macros-migration', 'Confluence macros migration', body, stamp]);
}

// ensureConfluenceMacrosPage(); — call explicitly when needed (async)
// Ensure wiki macro extras tables/templates exist + seed a few labels / blog post.
// Deferred wiki seed — run via db/seed.sql or ensureDbReady.

export async function listEventTypes(opts: {
  userId: number;
  projectId: number;
  scope?: CalendarScope | 'all';
}): Promise<CalendarEventType[]> {
  await ensureCalendarSeed();
  const rows = (await qAll(`
    SELECT * FROM calendar_event_types
    WHERE
      is_system IS TRUE
      OR (owner_user_id = ? AND (scope = 'personal' OR scope = 'both'))
      OR (project_id = ? AND (scope = 'project' OR scope = 'both'))
      OR (project_id IS NULL AND owner_user_id IS NULL AND scope = 'both')
    ORDER BY is_system DESC, lower(name)
  `, [opts.userId, opts.projectId])) as Record<string, unknown>[];
  let types = rows.map(mapEventType);
  if (opts.scope === 'personal') types = types.filter((item) => item.scope === 'personal' || item.scope === 'both');
  if (opts.scope === 'project') types = types.filter((item) => item.scope === 'project' || item.scope === 'both');
  return types;
}

export async function getEventType(id: number): Promise<CalendarEventType | undefined> {
  const row = (await qGet('SELECT * FROM calendar_event_types WHERE id = ?', [id])) as Record<string, unknown> | undefined;
  return row ? mapEventType(row) : undefined;
}

export async function createEventType(input: {
  name: string;
  color: string;
  scope: CalendarTypeScope;
  userId: number;
  projectId: number;
}): Promise<CalendarEventType> {
  const name = input.name.trim().slice(0, 40);
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#005eb8';
  if (!name) throw new Error('Type name required');
  const stamp = now();
  const projectId = input.scope === 'personal' ? null : input.projectId;
  const ownerUserId = input.scope === 'project' ? null : input.userId;
  const id = await qInsertReturningId(`INSERT INTO calendar_event_types (name, color, scope, project_id, owner_user_id, is_system, created_at) VALUES (?, ?, ?, ?, ?, FALSE, ?)`, [name, color, input.scope === 'both' ? 'both' : input.scope, projectId, ownerUserId, stamp]);
  const et = await getEventType(id);
  if (!et) throw new Error('Failed to create event type');
  return et;
}

export async function updateEventType(id: number, userId: number, patch: { name?: string; color?: string }): Promise<CalendarEventType | undefined> {
  const current = await getEventType(id);
  if (!current || current.system) return current;
  if (current.ownerUserId && current.ownerUserId !== userId) return undefined;
  const name = patch.name?.trim().slice(0, 40) || current.name;
  const color = patch.color && /^#[0-9a-fA-F]{6}$/.test(patch.color) ? patch.color : current.color;
  await qInsertReturningId('UPDATE calendar_event_types SET name = ?, color = ? WHERE id = ?', [name, color, id]);
  return await getEventType(id);
}

export async function deleteEventType(id: number, userId: number): Promise<boolean> {
  const current = await getEventType(id);
  if (!current || current.system) return false;
  if (current.ownerUserId && current.ownerUserId !== userId) return false;
  const used = (await qGet('SELECT COUNT(*) AS n FROM calendar_events WHERE type_id = ?', [id])) as { n: number };
  if (used.n > 0) return false;
  await qRun('DELETE FROM calendar_event_types WHERE id = ?', [id]);
  return true;
}

export async function getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
  const row = (await qGet(`${EVENT_SELECT} WHERE e.id = ?`, [id])) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return mapEvent(row, await listEventAttendees(id));
}

export async function listCalendarEvents(opts: {
  scope: CalendarScope;
  userId: number;
  projectId: number;
  from: string;
  to: string;
}): Promise<CalendarEvent[]> {
  await ensureCalendarSeed();
  if (opts.scope === 'personal') {
    const rows = (await qAll(`
      ${EVENT_SELECT}
      WHERE e.scope = 'personal'
        AND e.owner_user_id = ?
        AND e.starts_on < ?
        AND e.ends_on >= ?
      ORDER BY e.starts_on, e.start_time, e.id
    `, [opts.userId, opts.to, opts.from])) as Record<string, unknown>[];
    return rows.map((row) => mapEvent(row));
  }
  const rows = (await qAll(`
    ${EVENT_SELECT}
    WHERE e.scope = 'project'
      AND e.project_id = ?
      AND e.starts_on < ?
      AND e.ends_on >= ?
    ORDER BY e.starts_on, e.start_time, e.id
  `, [opts.projectId, opts.to, opts.from])) as Record<string, unknown>[];
  return rows.map((row) => mapEvent(row));
}

export async function createCalendarEvent(input: {
  title: string;
  notes: string;
  typeId: number;
  scope: CalendarScope;
  userId: number;
  projectId: number;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  attendeeIds?: number[];
}): Promise<CalendarEvent> {
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new Error('Title required');
  const type = await getEventType(input.typeId);
  if (!type) throw new Error('Unknown type');
  const startsOn = input.startsOn;
  const endsOn = input.endsOn || input.startsOn;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) throw new Error('Bad dates');
  const stamp = now();
  const id = await qInsertReturningId(
    `
    INSERT INTO calendar_events (
      title, notes, type_id, scope, owner_user_id, project_id, starts_on, ends_on, start_time, end_time, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      title,
      input.notes.trim().slice(0, 2000),
      input.typeId,
      input.scope,
      input.scope === 'personal' ? input.userId : null,
      input.scope === 'project' ? input.projectId : null,
      startsOn,
      endsOn < startsOn ? startsOn : endsOn,
      input.startTime,
      input.endTime,
      input.userId,
      stamp,
      stamp,
    ],
  );
  await setEventAttendees(id, input.attendeeIds ?? []);
  return (await getCalendarEvent(id))!;
}

export async function updateCalendarEvent(
  id: number,
  userId: number,
  patch: {
    title: string;
    notes: string;
    typeId: number;
    startsOn: string;
    endsOn: string;
    startTime: string | null;
    endTime: string | null;
    attendeeIds?: number[];
  },
): Promise<CalendarEvent | undefined> {

  const current = await getCalendarEvent(id);
  if (!current) return undefined;
  if (current.scope === 'personal' && current.ownerUserId !== userId) return undefined;
  const type = await getEventType(patch.typeId);
  if (!type) return undefined;
  const title = patch.title.trim().slice(0, 160);
  if (!title) return undefined;
  const endsOn = patch.endsOn < patch.startsOn ? patch.startsOn : patch.endsOn;
  await qRun(`
    UPDATE calendar_events
    SET title = ?, notes = ?, type_id = ?, starts_on = ?, ends_on = ?, start_time = ?, end_time = ?, updated_at = ?
    WHERE id = ?
  `, [title, (patch.notes ?? '').trim().slice(0, 2000), patch.typeId, patch.startsOn, endsOn, patch.startTime, patch.endTime, now(), id]);
  if (patch.attendeeIds) await setEventAttendees(id, patch.attendeeIds);
  return await getCalendarEvent(id);
}

export async function deleteCalendarEvent(id: number, userId: number): Promise<boolean> {
  const current = await getCalendarEvent(id);
  if (!current) return false;
  if (current.scope === 'personal' && current.ownerUserId !== userId) return false;
  await qRun('DELETE FROM calendar_events WHERE id = ?', [id]);
  return true;
}

export async function listIssueDueMarkers(projectKey: string, from: string, to: string): Promise<Array<{
  key: string;
  summary: string;
  dueOn: string;
}>> {
  const rows = (await qAll(`
    SELECT i.num, i.summary, i.due_on, p.key AS project_key
    FROM issues i
    JOIN projects p ON p.id = i.project_id
    WHERE p.key = ?
      AND i.due_on IS NOT NULL
      AND i.due_on >= ? AND i.due_on < ?
      AND i.status != 'done'
    ORDER BY i.due_on, i.num
  `, [projectKey, from, to])) as Array<{ num: number; summary: string; due_on: string; project_key: string }>;
  return rows.map((row) => ({
    key: `${row.project_key}-${row.num}`,
    summary: row.summary,
    dueOn: row.due_on,
  }));
}
