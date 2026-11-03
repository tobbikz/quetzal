import {
  listIssues,
  listNotifications,
  listProjects,
  listRecentFeed,
  listSprints,
  listUsers,
  type FeedEntry,
} from '@/lib/db';
import { STATUSES } from '@/lib/format';
import { listSlaBreachedTickets, type HelpdeskTicket } from '@/lib/helpdesk';
import { runJql } from '@/lib/jql';
import type { Issue, IssueStatus, Notification, Sprint } from '@/lib/types';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export const GADGET_TYPES = [
  'jql_count',
  'status_breakdown',
  'recent_activity',
  'sla_breached',
  'my_open_issues',
  'my_due_soon',
  'my_mentions',
  'sprint_burndown',
  'sprint_commitment',
  'sprint_blockers',
] as const;
export type GadgetType = (typeof GADGET_TYPES)[number];

export const GADGET_TYPE_LABEL: Record<GadgetType, string> = {
  jql_count: 'QQL count',
  status_breakdown: 'Status breakdown',
  recent_activity: 'Recent activity',
  sla_breached: 'SLA breached',
  my_open_issues: 'My open work',
  my_due_soon: 'Due soon',
  my_mentions: 'My mentions',
  sprint_burndown: 'Sprint burndown',
  sprint_commitment: 'Sprint commitment',
  sprint_blockers: 'Sprint blockers',
};

export const GADGET_TYPE_HELP: Record<GadgetType, string> = {
  jql_count: 'A single number from a QQL query. Great for KPIs.',
  status_breakdown: 'Horizontal bars by status for a project.',
  recent_activity: 'Last N events in a project feed.',
  sla_breached: 'Helpdesk tickets past SLA.',
  my_open_issues: 'Issues assigned to you that are not done.',
  my_due_soon: 'Your issues with a due date in the next 7 days.',
  my_mentions: 'Latest @-mentions in comments and pages.',
  sprint_burndown: 'Points remaining over the days of the active sprint.',
  sprint_commitment: 'Points committed vs delivered for the active sprint.',
  sprint_blockers: 'High-priority or blocked issues in the active sprint.',
};

export const GADGET_TYPE_CATEGORY: Record<GadgetType, string> = {
  jql_count: 'Counts',
  status_breakdown: 'Breakdown',
  recent_activity: 'Activity',
  sla_breached: 'Service',
  my_open_issues: 'Personal',
  my_due_soon: 'Personal',
  my_mentions: 'Personal',
  sprint_burndown: 'Sprint',
  sprint_commitment: 'Sprint',
  sprint_blockers: 'Sprint',
};

export type Dashboard = {
  id: number;
  ownerUserId: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardGadget = {
  id: number;
  dashboardId: number;
  type: GadgetType;
  config: Record<string, unknown>;
  position: number;
  createdAt: string;
};

export type JqlCountPayload = {
  kind: 'jql_count';
  title: string;
  jql: string;
  count: number;
  error: string | null;
};

export type StatusBreakdownPayload = {
  kind: 'status_breakdown';
  title: string;
  projectKey: string;
  counts: Record<IssueStatus, number>;
  total: number;
};

export type RecentActivityPayload = {
  kind: 'recent_activity';
  title: string;
  projectKey: string;
  items: FeedEntry[];
};

export type SlaBreachedPayload = {
  kind: 'sla_breached';
  title: string;
  count: number;
  tickets: HelpdeskTicket[];
};

export type MyOpenIssuesPayload = {
  kind: 'my_open_issues';
  title: string;
  count: number;
  items: Issue[];
};

export type MyDueSoonPayload = {
  kind: 'my_due_soon';
  title: string;
  count: number;
  items: Issue[];
  windowDays: number;
};

export type MyMentionsPayload = {
  kind: 'my_mentions';
  title: string;
  unread: number;
  items: Notification[];
};

export type BurndownDay = { day: string; remaining: number; ideal: number };

export type SprintBurndownPayload = {
  kind: 'sprint_burndown';
  title: string;
  projectKey: string;
  sprint: Sprint | null;
  totalPoints: number;
  remainingPoints: number;
  donePoints: number;
  days: BurndownDay[];
};

export type SprintCommitmentPayload = {
  kind: 'sprint_commitment';
  title: string;
  projectKey: string;
  sprint: Sprint | null;
  committedPoints: number;
  donePoints: number;
  totalIssues: number;
  doneIssues: number;
};

export type SprintBlockersPayload = {
  kind: 'sprint_blockers';
  title: string;
  projectKey: string;
  sprint: Sprint | null;
  items: Issue[];
};

export type GadgetPayload =
  | JqlCountPayload
  | StatusBreakdownPayload
  | RecentActivityPayload
  | SlaBreachedPayload
  | MyOpenIssuesPayload
  | MyDueSoonPayload
  | MyMentionsPayload
  | SprintBurndownPayload
  | SprintCommitmentPayload
  | SprintBlockersPayload;

function stamp(): string {
  return new Date().toISOString();
}

function mapDashboard(row: Record<string, unknown>): Dashboard {
  return {
    id: Number(row.id),
    ownerUserId: Number(row.owner_user_id),
    name: String(row.name),
    description: String(row.description ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function parseConfig(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapGadget(row: Record<string, unknown>): DashboardGadget {
  const type = String(row.type);
  return {
    id: Number(row.id),
    dashboardId: Number(row.dashboard_id),
    type: (GADGET_TYPES as readonly string[]).includes(type) ? (type as GadgetType) : 'jql_count',
    config: parseConfig(row.config_json),
    position: Number(row.position ?? 0),
    createdAt: String(row.created_at),
  };
}

function isGadgetType(value: string): value is GadgetType {
  return (GADGET_TYPES as readonly string[]).includes(value);
}

function configString(config: Record<string, unknown>, key: string, fallback = ''): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

function configNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Marker that identifies a seeded template dashboard (used for idempotent reseed). */
const SEED_MARKERS = {
  ops: '[seed:ops-overview]',
  sprint: '[seed:sprint-health]',
  personal: '[seed:personal-home]',
} as const;

type GadgetSeed = { type: GadgetType; config: Record<string, unknown>; position: number };

/** Lazy init hook — ensures per-user & shared default dashboards exist (idempotent). */
export async function ensureDashboards(_forUserId?: number): Promise<void> {
  await seedSharedDefaults();
  // Personal Home dashboards are no longer seeded; also delete any stragglers
  // (users explicitly asked to remove Personal from Dashboards hub).
  await cleanupPersonalHomeDashboards();
  // Legacy Ops-overview gadgets stored `status != done` which the JQL parser
  // rejects (`Unexpected character '!'`). Rewrite in place so existing DB rows
  // start working again without a manual migration.
  await repairLegacyJqlOperators();
}

/** Delete any Personal Home dashboards seeded by earlier versions. */
async function cleanupPersonalHomeDashboards(): Promise<void> {
  await qRun(`DELETE FROM dashboards WHERE description LIKE ?`, [`%${SEED_MARKERS.personal}%`]);
}

/** One-shot rewrite of `status != done` → `NOT status = done` in stored jql_count configs. */
async function repairLegacyJqlOperators(): Promise<void> {
  // config_json is JSONB in Postgres — compare against the extracted string.
  const rows = (await qAll(
    `SELECT id, config_json FROM dashboard_gadgets
       WHERE type = 'jql_count' AND (config_json->>'jql') LIKE ?`,
    ['%!=%'],
  )) as Array<{ id: number; config_json: unknown }>;
  for (const row of rows) {
    const config: Record<string, unknown> =
      typeof row.config_json === 'string'
        ? safeJsonParse(row.config_json)
        : (row.config_json as Record<string, unknown>) ?? {};
    const jql = typeof config.jql === 'string' ? config.jql : '';
    if (!jql.includes('!=')) continue;
    // Replace `<field> != <value>` with `NOT <field> = <value>`.
    const rewritten = jql.replace(
      /\b(project|status|type|assignee|summary|labels|priority|created|updated|due)\s*!=\s*/gi,
      'NOT $1 = ',
    );
    if (rewritten === jql) continue;
    config.jql = rewritten;
    await qRun(`UPDATE dashboard_gadgets SET config_json = ? WHERE id = ?`, [
      JSON.stringify(config),
      row.id,
    ]);
  }
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function insertDashboardWithGadgets(
  ownerUserId: number,
  name: string,
  description: string,
  seeds: GadgetSeed[],
): Promise<number> {
  const now = stamp();
  const dashboardId = await qInsertReturningId(
    `INSERT INTO dashboards (owner_user_id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    [ownerUserId, name, description, now, now],
  );
  for (const seed of seeds) {
    await qRun(
      `INSERT INTO dashboard_gadgets (dashboard_id, type, config_json, position, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      [dashboardId, seed.type, JSON.stringify(seed.config), seed.position, now],
    );
  }
  return dashboardId;
}

async function seedSharedDefaults(): Promise<void> {
  const admin =
    ((await qGet(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`)) as
      | { id: number }
      | undefined) ??
    ((await qGet(`SELECT id FROM users WHERE id = 1`)) as { id: number } | undefined);
  if (!admin) return;

  const projectKey =
    (((await qGet(`SELECT key FROM projects ORDER BY id LIMIT 1`)) as { key: string } | undefined)
      ?.key) ?? 'OPS';

  // Ops overview + Sprint Health are the two shared defaults (always ensure both).
  const opsExisting = (await qGet(
    `SELECT id FROM dashboards WHERE description LIKE ? LIMIT 1`,
    [`%${SEED_MARKERS.ops}%`],
  )) as { id: number } | undefined;
  if (!opsExisting) {
    await insertDashboardWithGadgets(
      admin.id,
      'Ops overview',
      `Project board: QQL count, status mix, activity, SLA breaches. ${SEED_MARKERS.ops}`,
      [
        {
          type: 'jql_count',
          position: 0,
          config: { title: 'Open issues', jql: `project = ${projectKey} AND NOT status = done` },
        },
        {
          type: 'status_breakdown',
          position: 1,
          config: { title: 'Status breakdown', projectKey },
        },
        {
          type: 'recent_activity',
          position: 2,
          config: { title: 'Recent activity', projectKey, limit: 8 },
        },
        { type: 'sla_breached', position: 3, config: { title: 'SLA breached' } },
      ],
    );
  }

  // Sprint Health (shared, admin-owned, project scope).
  const sprintExisting = (await qGet(
    `SELECT id FROM dashboards WHERE description LIKE ? LIMIT 1`,
    [`%${SEED_MARKERS.sprint}%`],
  )) as { id: number } | undefined;
  if (!sprintExisting) {
    await insertDashboardWithGadgets(
      admin.id,
      'Sprint Health',
      `Active-sprint desk: burndown, commitment, blockers, status mix. ${SEED_MARKERS.sprint}`,
      [
        {
          type: 'sprint_burndown',
          position: 0,
          config: { title: 'Burndown', projectKey },
        },
        {
          type: 'sprint_commitment',
          position: 1,
          config: { title: 'Commitment vs delivered', projectKey },
        },
        {
          type: 'sprint_blockers',
          position: 2,
          config: { title: 'Blockers & at-risk', projectKey },
        },
        {
          type: 'status_breakdown',
          position: 3,
          config: { title: 'Status mix', projectKey },
        },
      ],
    );
  }
}

export async function listDashboards(ownerUserId?: number): Promise<Dashboard[]> {
  await ensureDashboards(ownerUserId);
  if (typeof ownerUserId === 'number') {
    return (
      await qAll(
        `SELECT * FROM dashboards
           WHERE owner_user_id = ?
              OR description LIKE ?
              OR description LIKE ?
           ORDER BY lower(name), id`,
        [ownerUserId, `%${SEED_MARKERS.sprint}%`, `%${SEED_MARKERS.ops}%`],
      ) as Record<string, unknown>[]
    ).map(mapDashboard);
  }
  return (
    await qAll(`SELECT * FROM dashboards ORDER BY lower(name), id`) as Record<string, unknown>[]
  ).map(mapDashboard);
}

/** Mark whether a dashboard was seeded by one of our templates and which. */
export function dashboardTemplate(d: Dashboard): 'ops' | 'sprint' | 'personal' | null {
  const desc = d.description || '';
  if (desc.includes(SEED_MARKERS.sprint)) return 'sprint';
  if (desc.includes(SEED_MARKERS.personal)) return 'personal';
  if (desc.includes(SEED_MARKERS.ops)) return 'ops';
  return null;
}

/** Shared seeded defaults (Sprint Health, Ops overview) cannot be deleted. */
export function isProtectedDashboard(d: Dashboard): boolean {
  const template = dashboardTemplate(d);
  return template === 'sprint' || template === 'ops';
}

/** Human-friendly description, stripping internal seed markers. */
export function dashboardDisplayDescription(d: Dashboard): string {
  let desc = d.description || '';
  for (const marker of Object.values(SEED_MARKERS)) {
    desc = desc.replaceAll(marker, '');
  }
  return desc.trim();
}

export async function getDashboard(id: number): Promise<Dashboard | undefined> {
  await ensureDashboards();
  const row = await qGet(`SELECT * FROM dashboards WHERE id = ?`, [id]) as
    | Record<string, unknown>
    | undefined;
  return row ? mapDashboard(row) : undefined;
}

export async function listGadgets(dashboardId: number): Promise<DashboardGadget[]> {
  await ensureDashboards();
  return (
    await qAll(`SELECT * FROM dashboard_gadgets
         WHERE dashboard_id = ?
         ORDER BY position ASC, id ASC`, [dashboardId]) as Record<string, unknown>[]
  ).map(mapGadget);
}

export async function createDashboard(
  ownerUserId: number,
  name: string,
  description = '',
): Promise<Dashboard> {
  await ensureDashboards();
  const cleaned = name.trim().slice(0, 120);
  if (!cleaned) throw new Error('Dashboard name is required');
  const now = stamp();
  const result = await qInsertReturningId(`INSERT INTO dashboards (owner_user_id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`, [ownerUserId, cleaned, description.trim().slice(0, 400), now, now]);
  const dash = await getDashboard(result);
  if (!dash) throw new Error('Failed to create dashboard');
  return dash;
}

export async function deleteDashboard(id: number, ownerUserId: number): Promise<boolean> {
  await ensureDashboards();
  const dash = await getDashboard(id);
  if (!dash || isProtectedDashboard(dash)) return false;
  const result = await qInsertReturningId(`DELETE FROM dashboards WHERE id = ? AND owner_user_id = ?`, [id, ownerUserId]);
  return Number(result) > 0;
}

async function touchDashboard(dashboardId: number): Promise<void> {
  await qRun(`UPDATE dashboards SET updated_at = ? WHERE id = ?`, [stamp(), dashboardId]);
}

export async function addGadget(
  dashboardId: number,
  type: GadgetType,
  config: Record<string, unknown> = {},
  position?: number,
): Promise<DashboardGadget> {

  await ensureDashboards();
  if (!(await getDashboard(dashboardId))) throw new Error('Dashboard not found');
  if (!isGadgetType(type)) throw new Error('Unknown gadget type');

  const maxPos = await qGet(`SELECT COALESCE(MAX(position), -1) AS n FROM dashboard_gadgets WHERE dashboard_id = ?`, [dashboardId]) as { n: number };
  const pos =
    typeof position === 'number' && Number.isFinite(position)
      ? Math.max(0, Math.floor(position))
      : Number(maxPos.n) + 1;

  const now = stamp();
  const result = await qRun(`INSERT INTO dashboard_gadgets (dashboard_id, type, config_json, position, created_at)
       VALUES (?, ?, ?, ?, ?)`, [dashboardId, type, JSON.stringify(config ?? {}), pos, now]);
  await touchDashboard(dashboardId);
  const row = await qGet(`SELECT * FROM dashboard_gadgets WHERE id = ?`, [result]) as Record<string, unknown>;
  return mapGadget(row);
}

export async function removeGadget(gadgetId: number, ownerUserId: number): Promise<boolean> {
  await ensureDashboards();
  const row = await qGet(`SELECT g.id, g.dashboard_id
       FROM dashboard_gadgets g
       JOIN dashboards d ON d.id = g.dashboard_id
       WHERE g.id = ? AND d.owner_user_id = ?`, [gadgetId, ownerUserId]) as { id: number; dashboard_id: number } | undefined;
  if (!row) return false;
  await qRun(`DELETE FROM dashboard_gadgets WHERE id = ?`, [gadgetId]);
  await touchDashboard(row.dashboard_id);
  return true;
}

export function canEditDashboard(dashboard: Dashboard, userId: number, role: string): boolean {
  return dashboard.ownerUserId === userId || role === 'admin';
}

export async function resolveGadget(
  gadget: DashboardGadget,
  ctx: { userId: number; projectKey: string; siteId?: number },
): Promise<GadgetPayload> {
  const config = gadget.config;
  const titleFallback = GADGET_TYPE_LABEL[gadget.type];

  if (gadget.type === 'jql_count') {
    const jql =
      configString(config, 'jql') ||
      `project = ${ctx.projectKey} AND NOT status = done`;
    const title = configString(config, 'title') || 'QQL count';
    const result = await runJql(jql, {
      currentUserId: ctx.userId,
      defaultProjectKey: ctx.projectKey,
    });
    if (!result.ok) {
      return { kind: 'jql_count', title, jql, count: 0, error: result.error };
    }
    return { kind: 'jql_count', title, jql, count: result.issues.length, error: null };
  }

  if (gadget.type === 'status_breakdown') {
    const projectKey = configString(config, 'projectKey') || ctx.projectKey;
    const title = configString(config, 'title') || `Status · ${projectKey}`;
    const issues = await listIssues({ projectKey });
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<IssueStatus, number>;
    for (const issue of issues) counts[issue.status] += 1;
    return {
      kind: 'status_breakdown',
      title,
      projectKey,
      counts,
      total: issues.length,
    };
  }

  if (gadget.type === 'recent_activity') {
    const projectKey = configString(config, 'projectKey') || ctx.projectKey;
    const title = configString(config, 'title') || `Activity · ${projectKey}`;
    const limit = Math.min(configNumber(config, 'limit', 8), 40);
    return {
      kind: 'recent_activity',
      title,
      projectKey,
      items: await listRecentFeed(projectKey, limit),
    };
  }

  if (gadget.type === 'sla_breached') {
    const title = configString(config, 'title') || 'SLA breached';
    const tickets = (await listSlaBreachedTickets(ctx.siteId)).slice(0, 12);
    return {
      kind: 'sla_breached',
      title,
      count: tickets.length,
      tickets,
    };
  }

  if (gadget.type === 'my_open_issues') {
    const title = configString(config, 'title') || 'My open work';
    const limit = Math.min(configNumber(config, 'limit', 10), 40);
    const assigned = await listIssues({ assigneeId: ctx.userId });
    const open = assigned
      .filter((issue) => issue.status !== 'done')
      .sort(sortByPriorityDue)
      .slice(0, limit);
    return { kind: 'my_open_issues', title, count: open.length, items: open };
  }

  if (gadget.type === 'my_due_soon') {
    const title = configString(config, 'title') || 'Due soon';
    const windowDays = Math.min(configNumber(config, 'windowDays', 7), 60);
    const assigned = await listIssues({ assigneeId: ctx.userId });
    const now = new Date();
    const horizon = new Date(now.getTime() + windowDays * 86400000);
    const due = assigned
      .filter((issue) => issue.status !== 'done' && issue.dueOn)
      .filter((issue) => {
        const d = new Date(issue.dueOn as string);
        return !Number.isNaN(d.getTime()) && d <= horizon;
      })
      .sort((a, b) => String(a.dueOn).localeCompare(String(b.dueOn)))
      .slice(0, 20);
    return { kind: 'my_due_soon', title, count: due.length, items: due, windowDays };
  }

  if (gadget.type === 'my_mentions') {
    const title = configString(config, 'title') || 'My mentions';
    const limit = Math.min(configNumber(config, 'limit', 8), 40);
    const all = await listNotifications(ctx.userId, Math.max(limit * 3, 24));
    const items = all
      .filter(
        (notification) =>
          notification.kind === 'mention' || notification.kind === 'issue_mention',
      )
      .slice(0, limit);
    const unread = items.filter((n) => n.readAt == null).length;
    return { kind: 'my_mentions', title, items, unread };
  }

  if (gadget.type === 'sprint_burndown') {
    const projectKey = configString(config, 'projectKey') || ctx.projectKey;
    const title = configString(config, 'title') || `Burndown · ${projectKey}`;
    const sprint = await findActiveSprint(projectKey);
    const issues = sprint
      ? (await listIssues({ projectKey, sprintId: sprint.id }))
      : [];
    const totalPoints = issues.reduce((sum, i) => sum + (i.points ?? 0), 0);
    const donePoints = issues
      .filter((i) => i.status === 'done')
      .reduce((sum, i) => sum + (i.points ?? 0), 0);
    const remainingPoints = Math.max(0, totalPoints - donePoints);
    const days = burndownSeries(issues, totalPoints, 10);
    return {
      kind: 'sprint_burndown',
      title,
      projectKey,
      sprint,
      totalPoints,
      remainingPoints,
      donePoints,
      days,
    };
  }

  if (gadget.type === 'sprint_commitment') {
    const projectKey = configString(config, 'projectKey') || ctx.projectKey;
    const title = configString(config, 'title') || `Commitment · ${projectKey}`;
    const sprint = await findActiveSprint(projectKey);
    const issues = sprint ? await listIssues({ projectKey, sprintId: sprint.id }) : [];
    const committed = issues.reduce((sum, i) => sum + (i.points ?? 0), 0);
    const done = issues
      .filter((i) => i.status === 'done')
      .reduce((sum, i) => sum + (i.points ?? 0), 0);
    const doneIssues = issues.filter((i) => i.status === 'done').length;
    return {
      kind: 'sprint_commitment',
      title,
      projectKey,
      sprint,
      committedPoints: committed,
      donePoints: done,
      totalIssues: issues.length,
      doneIssues,
    };
  }

  // sprint_blockers
  const projectKey = configString(config, 'projectKey') || ctx.projectKey;
  const title = configString(config, 'title') || `Blockers · ${projectKey}`;
  const sprint = await findActiveSprint(projectKey);
  const issues = sprint ? await listIssues({ projectKey, sprintId: sprint.id }) : [];
  const blockers = issues
    .filter((i) => isBlocker(i) && i.status !== 'done')
    .sort(sortByPriorityDue)
    .slice(0, 8);
  return {
    kind: 'sprint_blockers',
    title,
    projectKey,
    sprint,
    items: blockers,
  };
}

const PRIORITY_WEIGHT: Record<string, number> = {
  blocker: 0,
  highest: 1,
  high: 2,
  medium: 3,
  low: 4,
  lowest: 5,
};

function sortByPriorityDue(a: Issue, b: Issue): number {
  const pa = PRIORITY_WEIGHT[a.priority] ?? 9;
  const pb = PRIORITY_WEIGHT[b.priority] ?? 9;
  if (pa !== pb) return pa - pb;
  const da = a.dueOn ?? '~';
  const db = b.dueOn ?? '~';
  return da.localeCompare(db);
}

function isBlocker(issue: Issue): boolean {
  if (issue.priority === 'blocker' || issue.priority === 'highest') return true;
  const labels = (issue.labels || '').toLowerCase();
  return labels.includes('blocked') || labels.includes('sev1');
}

async function findActiveSprint(projectKey: string): Promise<Sprint | null> {
  const project = (await listProjects()).find((p) => p.key === projectKey);
  if (!project) return null;
  const sprints = await listSprints(project.id);
  const active = sprints.find((s) => s.state === 'active');
  return active ?? sprints[sprints.length - 1] ?? null;
}

function burndownSeries(issues: Issue[], total: number, span: number): BurndownDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (span - 1));
  const doneByDay = new Map<string, number>();
  for (const issue of issues) {
    if (issue.status !== 'done' || issue.points == null) continue;
    const closedAt = new Date(issue.updatedAt);
    if (Number.isNaN(closedAt.getTime())) continue;
    const dayKey = closedAt.toISOString().slice(0, 10);
    doneByDay.set(dayKey, (doneByDay.get(dayKey) ?? 0) + (issue.points ?? 0));
  }
  const days: BurndownDay[] = [];
  let cumulativeDone = 0;
  for (let i = 0; i < span; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    cumulativeDone += doneByDay.get(key) ?? 0;
    const remaining = Math.max(0, total - cumulativeDone);
    const ideal = Math.max(0, Math.round(total - (total * i) / Math.max(1, span - 1)));
    days.push({ day: key, remaining, ideal });
  }
  return days;
}

export async function ownerName(userId: number): Promise<string> {
  return (await listUsers()).find((user) => user.id === userId)?.name ?? `User ${userId}`;
}

export async function defaultProjectKey(): Promise<string> {
  return (await listProjects())[0]?.key ?? 'OPS';
}
