import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const DEFAULT_URL = 'postgresql://tomy.berrios@127.0.0.1:5432/quetzal';

export function quetzalDatabaseUrl(): string {
  return process.env.QUETZAL_DATABASE_URL?.trim() || DEFAULT_URL;
}

declare global {
  // eslint-disable-next-line no-var
  var __quetzalPgPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool({
    connectionString: quetzalDatabaseUrl(),
    max: Number(process.env.QUETZAL_PG_POOL_MAX || 10),
    options: '-c search_path=quetzal,public',
  });
}

/** Shared Pool (search_path=quetzal). Reused across hot reloads in Next. */
export function getPool(): Pool {
  if (!globalThis.__quetzalPgPool) {
    globalThis.__quetzalPgPool = createPool();
  }
  return globalThis.__quetzalPgPool;
}

export type SqlParams = ReadonlyArray<unknown>;

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: SqlParams = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as unknown[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: SqlParams = [],
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function execute(sql: string, params: SqlParams = []): Promise<number> {
  const result = await getPool().query(sql, params as unknown[]);
  return result.rowCount ?? 0;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO quetzal, public');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function txQuery<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: SqlParams = [],
): Promise<T[]> {
  const result = await client.query<T>(sql, params as unknown[]);
  return result.rows;
}

export async function txQueryOne<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  sql: string,
  params: SqlParams = [],
): Promise<T | undefined> {
  const rows = await txQuery<T>(client, sql, params);
  return rows[0];
}

export async function txExecute(client: PoolClient, sql: string, params: SqlParams = []): Promise<number> {
  const result = await client.query(sql, params as unknown[]);
  return result.rowCount ?? 0;
}

/** Normalize pg values (Date, boolean, bigint) for existing string/number mappers. */
export function pgVal(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export function pgRow(row: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!row) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = pgVal(value);
  return out;
}

export function pgRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => pgRow(row)!);
}

export async function pingDb(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
  }
}
