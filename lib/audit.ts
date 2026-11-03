import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { UserRole } from './types';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';

export const DB_PATH = '';
export type AuditAction =
  | 'login'
  | 'issue_create'
  | 'issue_status'
  | 'wiki_save'
  | 'wiki_create'
  | 'user_role'
  | 'backup_export';

export interface AuditEntry {
  id: number;
  actorId: number | null;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAt: string;
  actorName: string | null;
}

/** Core tables included in JSON backup (no binary blobs / WAL). */
export const CORE_EXPORT_TABLES = [
  'users',
  'projects',
  'sprints',
  'issues',
  'comments',
  'spaces',
  'pages',
  'page_comments',
  'activity',
  'worklogs',
  'workflows',
  'workflow_steps',
  'sites',
  'site_members',
  'notifications',
  'audit_log',
] as const;

export async function ensureAudit(): Promise<void> {
  /* DDL skipped — migrations */ void 0;
}

// deferred: await ensureAudit();
function stamp(): string {
  return new Date().toISOString();
}

/** Append an audit row. Never throws into callers — logging must not block product flows. */
export async function writeAudit(input: {
  actorId?: number | null;
  action: AuditAction | string;
  entityType?: string;
  entityId?: string | number | null;
  detail?: string;
}): Promise<void> {
  try {
    await ensureAudit();
    await qRun(`INSERT INTO audit_log (actor_id, action, entity_type, entity_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`, [input.actorId ?? null,
      String(input.action).slice(0, 80),
      (input.entityType ?? '').slice(0, 80),
      String(input.entityId ?? '').slice(0, 120),
      (input.detail ?? '').slice(0, 2000),
      stamp(),]);
  } catch (err) {
    console.error('[audit] write failed', err);
  }
}

export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  await ensureAudit();
  const capped = Math.min(Math.max(limit, 1), 1000);
  return (
    await qAll(`SELECT a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.detail, a.created_at,
                u.name AS actor_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.actor_id
         ORDER BY a.id DESC
         LIMIT ?`, [capped]) as Record<string, unknown>[]
  ).map((row) => ({
    id: Number(row.id),
    actorId: row.actor_id == null ? null : Number(row.actor_id),
    action: String(row.action),
    entityType: String(row.entity_type ?? ''),
    entityId: String(row.entity_id ?? ''),
    detail: String(row.detail ?? ''),
    createdAt: String(row.created_at),
    actorName: row.actor_name == null ? null : String(row.actor_name),
  }));
}

async function tableExists(name: string): Promise<boolean> {
  const row = await qGet(`SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'quetzal' AND table_name = ?`, [name]) as { ok: number } | undefined;
  return Boolean(row);
}

/** JSON dump of core tables that exist. Safe for admin download. */
export async function exportCoreTablesJson(): Promise<string> {
  await ensureAudit();
  const payload: Record<string, unknown[]> = {};
  for (const table of CORE_EXPORT_TABLES) {
    if (!(await tableExists(table))) continue;
    try {
      payload[table] = await qAll(`SELECT * FROM "${table}"`) as unknown[];
    } catch (err) {
      console.error(`[audit] export table ${table} failed`, err);
      payload[table] = [];
    }
  }
  return JSON.stringify(
    {
      exportedAt: stamp(),
      source: 'quetzal.db',
      tables: payload,
    },
    null,
    2,
  );
}

/** Copy live DB to a temp path under data/ for download (avoids locking the WAL file mid-stream). */
export function copyDbForDownload(): { path: string; filename: string; bytes: number } {
  if (!existsSync(DB_PATH)) {
    throw new Error('Database file missing');
  }
  const filename = `quetzal-backup-${stamp().replace(/[:.]/g, '-')}.db`;
  const dest = join(process.cwd(), 'data', filename);
  // Checkpoint WAL so the copy is consistent when possible.
  try {
    /* DDL skipped — migrations */ void 0;
  } catch {
    /* ignore — still copy main file */
  }
  copyFileSync(DB_PATH, dest);
  return { path: dest, filename, bytes: statSync(dest).size };
}

export async function countAdmins(): Promise<number> {
  const row = await qGet(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`) as { n: number };
  return Number(row.n);
}

/**
 * Change application role. Refuses demoting the last admin (never lock out).
 */
export async function setUserRole(
  userId: number,
  role: UserRole,
  actorId?: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = await qGet('SELECT id, role FROM users WHERE id = ?', [userId]) as
    | { id: number; role: string }
    | undefined;
  if (!target) return { ok: false, error: 'User not found' };
  if (role !== 'admin' && role !== 'member' && role !== 'viewer') {
    return { ok: false, error: 'Invalid role' };
  }
  if (target.role === 'admin' && role !== 'admin' && await countAdmins() <= 1) {
    return { ok: false, error: 'Cannot demote the last admin' };
  }
  if (target.role === role) return { ok: true };
  await qRun('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  await writeAudit({
    actorId,
    action: 'user_role',
    entityType: 'user',
    entityId: userId,
    detail: `${target.role}→${role}`,
  });
  return { ok: true };
}
