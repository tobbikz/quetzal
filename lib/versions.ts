import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export interface Component {
  id: number;
  projectId: number;
  name: string;
}

export interface Version {
  id: number;
  projectId: number;
  name: string;
  released: boolean;
  releaseDate: string | null;
}

export interface VersionIssue {
  id: number;
  key: string;
  summary: string;
  status: string;
  type: string;
  fixVersionId: number | null;
  componentId: number | null;
}

function mapComponent(row: Record<string, unknown>): Component {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    name: String(row.name),
  };
}

function toIsoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const d = String(parsed.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mapVersion(row: Record<string, unknown>): Version {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    name: String(row.name),
    released: row.released === true || row.released === 't' || Number(row.released) === 1,
    releaseDate: toIsoDate(row.release_date),
  };
}

async function ensureColumn(table: string, column: string, ddl: string): Promise<void> {
  const cols = await qAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'quetzal' AND table_name = $1`,
    [table],
  );
  if (cols.length === 0) return;
  if (cols.some((item) => item.column_name === column)) return;
  await qRun(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

/** Create components/versions tables, ALTER issues, seed OPS samples. */
export function ensureVersions(): void {
  /* DDL skipped — migrations */ void 0;

  ensureColumn('issues', 'component_id', 'component_id INTEGER REFERENCES components(id)');
  ensureColumn('issues', 'fix_version_id', 'fix_version_id INTEGER REFERENCES versions(id)');

  seedOps();
}

async function seedOps(): Promise<void> {
  const ops = await qGet(`SELECT id FROM projects WHERE key = 'OPS'`) as { id: number } | undefined;
  if (!ops) return;

  const componentCount = await qGet(`SELECT COUNT(*) AS n FROM components WHERE project_id = ?`, [ops.id]) as { n: number };
  if (componentCount.n === 0) {
    await qRun(`INSERT INTO components (project_id, name) VALUES (?, ?)`, [ops.id, 'Payments']);
    await qRun(`INSERT INTO components (project_id, name) VALUES (?, ?)`, [ops.id, 'Register']);
  }

  const versionCount = await qGet(`SELECT COUNT(*) AS n FROM versions WHERE project_id = ?`, [ops.id]) as { n: number };
  if (versionCount.n === 0) {
    await qRun(`INSERT INTO versions (project_id, name, released, release_date) VALUES (?, ?, TRUE, ?)`, [ops.id, '1.0.0', '2026-09-15']);
    await qRun(`INSERT INTO versions (project_id, name, released, release_date) VALUES (?, ?, FALSE, NULL)`, [ops.id, '1.1.0']);
  }

  // Attach a couple of OPS issues so /releases has content without overwriting user edits.
  const v100 = await qGet(`SELECT id FROM versions WHERE project_id = ? AND name = '1.0.0'`, [ops.id]) as { id: number } | undefined;
  const v110 = await qGet(`SELECT id FROM versions WHERE project_id = ? AND name = '1.1.0'`, [ops.id]) as { id: number } | undefined;
  const payments = await qGet(`SELECT id FROM components WHERE project_id = ? AND name = 'Payments'`, [ops.id]) as { id: number } | undefined;
  const register = await qGet(`SELECT id FROM components WHERE project_id = ? AND name = 'Register'`, [ops.id]) as { id: number } | undefined;

  if (v100 && payments) {
    await qRun(`UPDATE issues SET fix_version_id = COALESCE(fix_version_id, ?), component_id = COALESCE(component_id, ?)
       WHERE project_id = ? AND num = 6`, [v100.id, register?.id ?? payments.id, ops.id]);
  }
  if (v110 && payments) {
    await qRun(`UPDATE issues SET fix_version_id = COALESCE(fix_version_id, ?), component_id = COALESCE(component_id, ?)
       WHERE project_id = ? AND num IN (2, 4)`, [v110.id, payments.id, ops.id]);
  }
}

// deferred: await ensureVersions();
export async function listComponents(projectId: number): Promise<Component[]> {
  return (
    await qAll(`SELECT * FROM components WHERE project_id = ? ORDER BY name`, [projectId]) as Record<
      string,
      unknown
    >[]
  ).map(mapComponent);
}

export async function getComponent(id: number): Promise<Component | undefined> {
  const row = await qGet(`SELECT * FROM components WHERE id = ?`, [id]) as Record<string, unknown> | undefined;
  return row ? mapComponent(row) : undefined;
}

export async function listVersions(projectId: number): Promise<Version[]> {
  return (
    await qAll(`SELECT * FROM versions WHERE project_id = ? ORDER BY released ASC, release_date IS NULL, release_date DESC, name`, [projectId]) as Record<string, unknown>[]
  ).map(mapVersion);
}

export async function getVersion(id: number): Promise<Version | undefined> {
  const row = await qGet(`SELECT * FROM versions WHERE id = ?`, [id]) as Record<string, unknown> | undefined;
  return row ? mapVersion(row) : undefined;
}

export async function listIssuesForVersion(versionId: number): Promise<VersionIssue[]> {
  const rows = await qAll(`SELECT i.id, i.num, i.summary, i.status, i.type, i.fix_version_id, i.component_id, p.key AS project_key
       FROM issues i
       JOIN projects p ON p.id = i.project_id
       WHERE i.fix_version_id = ?
       ORDER BY i.num`, [versionId]) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    key: `${row.project_key}-${row.num}`,
    summary: String(row.summary),
    status: String(row.status),
    type: String(row.type),
    fixVersionId: row.fix_version_id == null ? null : Number(row.fix_version_id),
    componentId: row.component_id == null ? null : Number(row.component_id),
  }));
}

export async function listUnscheduledIssues(projectId: number): Promise<VersionIssue[]> {
  const rows = await qAll(`SELECT i.id, i.num, i.summary, i.status, i.type, i.fix_version_id, i.component_id, p.key AS project_key
       FROM issues i
       JOIN projects p ON p.id = i.project_id
       WHERE i.project_id = ? AND i.fix_version_id IS NULL
       ORDER BY i.num`, [projectId]) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    key: `${row.project_key}-${row.num}`,
    summary: String(row.summary),
    status: String(row.status),
    type: String(row.type),
    fixVersionId: null,
    componentId: row.component_id == null ? null : Number(row.component_id),
  }));
}

/**
 * Release Kanban lane classifier.
 *
 * The schema has only `released` (bool) + `release_date`. We derive the
 * in-flight "Releasing" lane from the target date and in-progress work:
 *
 *   Released  = released = true
 *   Releasing = !released AND release_date within [today - 60d, today + 7d]
 *               — or no release_date but at least one active issue
 *   Unreleased = everything else (no date / far-future / cold backlog)
 *
 * This avoids a schema migration: setting a target date in the next week
 * moves a version from Unreleased → Releasing; the Mark released action
 * promotes it to Released.
 */
export type ReleaseLane = 'unreleased' | 'releasing' | 'released';

export function classifyVersion(
  version: Pick<Version, 'released' | 'releaseDate'>,
  options: { hasActiveIssues?: boolean; today?: Date } = {},
): ReleaseLane {
  if (version.released) return 'released';
  const today = options.today ?? new Date();
  const todayIso = isoDate(today);
  if (version.releaseDate) {
    const horizonIso = isoDate(addDays(today, 7));
    const pastIso = isoDate(addDays(today, -60));
    if (version.releaseDate <= horizonIso && version.releaseDate >= pastIso) {
      return 'releasing';
    }
    return 'unreleased';
  }
  if (options.hasActiveIssues) return 'releasing';
  return 'unreleased';
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, delta: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + delta);
  return copy;
}

export interface VersionSummary {
  version: Version;
  lane: ReleaseLane;
  issues: VersionIssue[];
  total: number;
  done: number;
  inProgress: number;
  inReview: number;
  todo: number;
  blockers: number;
  bugs: number;
  points: number;
  components: Component[];
  leadDays: number | null;
  daysToTarget: number | null;
}

export async function summarizeVersion(
  version: Version,
  components: Component[],
  today: Date = new Date(),
): Promise<VersionSummary> {
  const issues = await listIssuesForVersion(version.id);
  const pointsRow = (await qGet(
    `SELECT COALESCE(SUM(points),0)::int AS pts FROM issues WHERE fix_version_id = ?`,
    [version.id],
  )) as { pts: number } | undefined;
  const points = Number(pointsRow?.pts ?? 0);

  let done = 0;
  let inProgress = 0;
  let inReview = 0;
  let todo = 0;
  let blockers = 0;
  let bugs = 0;
  const componentIds = new Set<number>();
  for (const item of issues) {
    if (item.componentId != null) componentIds.add(item.componentId);
    if (item.type === 'bug') bugs += 1;
    switch (item.status) {
      case 'done':
        done += 1;
        break;
      case 'in_progress':
        inProgress += 1;
        break;
      case 'in_review':
        inReview += 1;
        break;
      case 'todo':
      default:
        todo += 1;
        break;
    }
    if (item.status !== 'done' && item.type === 'bug') blockers += 1;
  }

  const hasActive = inProgress + inReview > 0;
  const lane = classifyVersion(version, { hasActiveIssues: hasActive, today });
  const total = issues.length;

  let daysToTarget: number | null = null;
  if (version.releaseDate) {
    const target = new Date(`${version.releaseDate}T00:00:00`);
    const diffMs = target.getTime() - new Date(isoDate(today) + 'T00:00:00').getTime();
    daysToTarget = Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  let leadDays: number | null = null;
  if (version.released && version.releaseDate) {
    const earliest = (await qGet(
      `SELECT MIN(created_at)::text AS first FROM issues WHERE fix_version_id = ?`,
      [version.id],
    )) as { first: string | null } | undefined;
    if (earliest?.first) {
      const first = new Date(earliest.first);
      const released = new Date(`${version.releaseDate}T00:00:00`);
      leadDays = Math.max(0, Math.round((released.getTime() - first.getTime()) / 86_400_000));
    }
  }

  const includedComponents = components.filter((c) => componentIds.has(c.id));
  return {
    version,
    lane,
    issues,
    total,
    done,
    inProgress,
    inReview,
    todo,
    blockers,
    bugs,
    points,
    components: includedComponents,
    leadDays,
    daysToTarget,
  };
}

export async function summarizeAllVersions(
  projectId: number,
  today: Date = new Date(),
): Promise<{ components: Component[]; summaries: VersionSummary[] }> {
  const components = await listComponents(projectId);
  const versions = await listVersions(projectId);
  const summaries = await Promise.all(versions.map((v) => summarizeVersion(v, components, today)));
  return { components, summaries };
}

/** Flip a version to released (and stamp release_date today if missing). */
export async function markVersionReleased(versionId: number, when: Date = new Date()): Promise<void> {
  const existing = (await qGet(
    `SELECT release_date FROM versions WHERE id = ?`,
    [versionId],
  )) as { release_date: string | null } | undefined;
  const date = existing?.release_date ?? isoDate(when);
  await qRun(`UPDATE versions SET released = TRUE, release_date = ? WHERE id = ?`, [date, versionId]);
}

/** Un-release (keep release_date so history is preserved). */
export async function unmarkVersionReleased(versionId: number): Promise<void> {
  await qRun(`UPDATE versions SET released = FALSE WHERE id = ?`, [versionId]);
}

/** Set target release date so the version slides into the Releasing lane. */
export async function setVersionReleaseDate(versionId: number, iso: string | null): Promise<void> {
  await qRun(`UPDATE versions SET release_date = ? WHERE id = ?`, [iso, versionId]);
}
