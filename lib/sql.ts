import type { PoolClient, QueryResultRow } from 'pg';
import {
  execute,
  pgRow,
  pgRows,
  query,
  queryOne,
  txExecute,
  txQuery,
  txQueryOne,
  type SqlParams,
} from './pg';

/** Convert sqlite-style `?` placeholders to pg `$1..$n`. */
export function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Common sqlite → postgres SQL tweaks (idempotent-ish). */
export function adaptSql(sql: string): string {
  let out = sql;
  out = out.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
  // Append ON CONFLICT DO NOTHING when we stripped OR IGNORE and none exists yet.
  if (/\bINSERT\s+OR\s+IGNORE\b/i.test(sql) && !/\bON\s+CONFLICT\b/i.test(out)) {
    // Leave as INSERT INTO … ; caller should use insertIgnore helper for correctness.
  }
  out = out.replace(/\bprintf\s*\(\s*'%d\|%s'\s*,\s*([^,]+),\s*([^)]+)\)/gi, "($1::text || '|' || $2)");
  out = out.replace(/\bprintf\s*\(\s*'%d\|%s'\s*,/gi, "format('%s|%s',");
  return toPg(out);
}

function withIgnore(sql: string): string {
  let out = sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
  if (/\bINSERT\s+OR\s+IGNORE\b/i.test(sql) && !/\bON\s+CONFLICT\b/i.test(out)) {
    out = out.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  }
  return toPg(out);
}

export async function qAll<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: SqlParams = [],
): Promise<T[]> {
  const rows = await query<T>(adaptSql(sql), params);
  return pgRows(rows as Record<string, unknown>[]) as T[];
}

export async function qGet<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: SqlParams = [],
): Promise<T | undefined> {
  const row = await queryOne<T>(adaptSql(sql), params);
  return pgRow(row as Record<string, unknown> | undefined) as T | undefined;
}

export async function qRun(sql: string, params: SqlParams = []): Promise<number> {
  const hasIgnore = /\bINSERT\s+OR\s+IGNORE\b/i.test(sql);
  return await execute(hasIgnore ? withIgnore(sql) : adaptSql(sql), params);
}

export async function qInsertReturningId(sql: string, params: SqlParams = []): Promise<number> {
  let adapted = adaptSql(sql);
  if (!/\bRETURNING\b/i.test(adapted)) {
    adapted = adapted.replace(/;?\s*$/, ' RETURNING id');
  }
  const row = await queryOne<{ id: number | string }>(adapted, params);
  if (!row) throw new Error('INSERT did not return id');
  return Number(row.id);
}

export async function txAll<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: SqlParams = [],
): Promise<T[]> {
  const rows = await txQuery<T>(client, adaptSql(sql), params);
  return pgRows(rows as Record<string, unknown>[]) as T[];
}

export async function txGet<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: SqlParams = [],
): Promise<T | undefined> {
  const row = await txQueryOne<T>(client, adaptSql(sql), params);
  return pgRow(row as Record<string, unknown> | undefined) as T | undefined;
}

export async function txRun(client: PoolClient, sql: string, params: SqlParams = []): Promise<number> {
  const hasIgnore = /\bINSERT\s+OR\s+IGNORE\b/i.test(sql);
  return await txExecute(client, hasIgnore ? withIgnore(sql) : adaptSql(sql), params);
}
