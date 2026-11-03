import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export type SavedFilter = {
  id: number;
  userId: number;
  name: string;
  jql: string;
  createdAt: string;
};

function stamp(): string {
  return new Date().toISOString();
}

function mapFilter(row: Record<string, unknown>): SavedFilter {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    name: String(row.name),
    jql: String(row.jql),
    createdAt: String(row.created_at),
  };
}

/** Create saved_filters table (per-user named JQL bookmarks). */
export function ensureSavedFilters(): void {
  /* DDL skipped — migrations */ void 0;
}

// deferred: await ensureSavedFilters();
export async function listSavedFilters(userId: number): Promise<SavedFilter[]> {
  await ensureSavedFilters();
  return (
    await qAll(`SELECT id, user_id, name, jql, created_at
         FROM saved_filters
         WHERE user_id = ?
         ORDER BY lower(name)`, [userId]) as Record<string, unknown>[]
  ).map(mapFilter);
}

export async function getSavedFilter(id: number, userId: number): Promise<SavedFilter | undefined> {
  await ensureSavedFilters();
  const row = await qGet(`SELECT id, user_id, name, jql, created_at
       FROM saved_filters
       WHERE id = ? AND user_id = ?`, [id, userId]) as Record<string, unknown> | undefined;
  return row ? mapFilter(row) : undefined;
}

/** Insert or update by (user_id, name). Returns the row id. */
export async function upsertSavedFilter(userId: number, name: string, jql: string): Promise<number> {
  await ensureSavedFilters();
  const cleanedName = name.trim().slice(0, 80);
  const cleanedJql = jql.trim().slice(0, 500);
  if (!cleanedName) throw new Error('Filter name is required');
  if (!cleanedJql) throw new Error('QQL is required');

  const existing = await qGet(`SELECT id FROM saved_filters WHERE user_id = ? AND name = ?`, [userId, cleanedName]) as { id: number } | undefined;

  if (existing) {
    await qRun(`UPDATE saved_filters SET jql = ? WHERE id = ? AND user_id = ?`, [cleanedJql,
      existing.id,
      userId,]);
    return existing.id;
  }

  const id = await qInsertReturningId(`INSERT INTO saved_filters (user_id, name, jql, created_at) VALUES (?, ?, ?, ?)`, [userId, cleanedName, cleanedJql, stamp()]);
  return id;
}

export async function deleteSavedFilter(id: number, userId: number): Promise<boolean> {
  await ensureSavedFilters();
  const result = await qRun(`DELETE FROM saved_filters WHERE id = ? AND user_id = ?`, [id, userId]);
  return result > 0;
}
