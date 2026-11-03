import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


/* DDL skipped — migrations */ void 0;

function stamp(): string {
  return new Date().toISOString();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function ensureApiTokensTable(): Promise<void> {
  /* DDL skipped — migrations */ void 0;
}

/** Insert a plaintext token (stores only SHA-256). Returns the token id. */
export async function createApiToken(name: string, token: string): Promise<number> {
  await ensureApiTokensTable();
  const clean = token.trim();
  if (!clean) throw new Error('token required');
  const id = await qInsertReturningId(`INSERT INTO api_tokens (name, token_hash, token_prefix, created_at)
       VALUES (?, ?, ?, ?)`, [name.trim().slice(0, 120) || 'api', hashToken(clean), clean.slice(0, 8), stamp()]);
  return id;
}

export async function revokeApiToken(id: number): Promise<boolean> {
  await ensureApiTokensTable();
  const result = await qRun(`UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`, [stamp(), id]);
  return result > 0;
}

export async function listApiTokens(): Promise<
  Array<{
    id: number;
    name: string;
    tokenPrefix: string;
    createdAt: string;
    revokedAt: string | null;
  }>
> {
  await ensureApiTokensTable();
  return (
    (await qAll(`SELECT id, name, token_prefix, created_at, revoked_at
         FROM api_tokens
         ORDER BY id DESC`)) as Record<string, unknown>[]
  ).map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    tokenPrefix: String(row.token_prefix ?? ''),
    createdAt: String(row.created_at),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
  }));
}

async function tokenMatchesDb(token: string): Promise<boolean> {
  await ensureApiTokensTable();
  const digest = hashToken(token);
  const row = (await qGet(
    `SELECT id FROM api_tokens
       WHERE token_hash = ? AND revoked_at IS NULL
       LIMIT 1`,
    [digest],
  )) as { id: number } | undefined;
  return Boolean(row);
}

/** Accept `Authorization: Bearer <token>` via env `QUETZAL_API_TOKEN` or `api_tokens` table. */
export async function isValidApiBearer(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return false;

  const envToken = process.env.QUETZAL_API_TOKEN?.trim();
  if (envToken && safeEqual(bearer, envToken)) return true;

  return await tokenMatchesDb(bearer);
}

export async function requireApiAuth(request: Request): Promise<NextResponse | null> {
  if (await isValidApiBearer(request)) return null;
  return NextResponse.json(
    {
      error: 'unauthorized',
      hint: 'Send Authorization: Bearer $QUETZAL_API_TOKEN (or a token from the api_tokens table)',
    },
    { status: 401 },
  );
}
