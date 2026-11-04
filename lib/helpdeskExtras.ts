import { randomBytes } from 'node:crypto';
import { qAll, qGet, qInsertReturningId, qRun } from '@/lib/sql';

export type HelpdeskMacro = {
  id: number;
  name: string;
  body: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type HelpdeskCsat = {
  id: number;
  ticketId: number;
  score: number | null;
  comment: string;
  token: string;
  submittedAt: string | null;
  createdAt: string;
};

function stamp(): string {
  return new Date().toISOString();
}

let extrasReady: Promise<void> | null = null;

export async function ensureHelpdeskExtras(): Promise<void> {
  if (!extrasReady) {
    extrasReady = (async () => {
      await qRun(`CREATE TABLE IF NOT EXISTS helpdesk_macros (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await qRun(`CREATE TABLE IF NOT EXISTS helpdesk_csat (
        id BIGSERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
        score SMALLINT,
        comment TEXT NOT NULL DEFAULT '',
        token TEXT NOT NULL UNIQUE,
        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await qRun(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_helpdesk_csat_ticket ON helpdesk_csat (ticket_id)`,
      );
      const count = await qGet<{ n: number }>('SELECT COUNT(*)::int AS n FROM helpdesk_macros');
      if (!Number(count?.n ?? 0)) {
        const at = stamp();
        await qRun(
          `INSERT INTO helpdesk_macros (name, body, created_at, updated_at) VALUES
            ('Acknowledge', 'Thanks for reaching out — we are looking into this and will update you shortly.', ?, ?),
            ('Need more info', 'Could you share steps to reproduce, expected vs actual behavior, and any screenshots?', ?, ?),
            ('Resolved', 'We believe this is resolved. Please confirm or reopen if the issue continues.', ?, ?)`,
          [at, at, at, at, at, at],
        );
      }
    })().catch((err) => {
      extrasReady = null;
      throw err;
    });
  }
  await extrasReady;
}

function mapMacro(row: Record<string, unknown>): HelpdeskMacro {
  return {
    id: Number(row.id),
    name: String(row.name),
    body: String(row.body ?? ''),
    createdBy: row.created_by == null ? null : Number(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCsat(row: Record<string, unknown>): HelpdeskCsat {
  return {
    id: Number(row.id),
    ticketId: Number(row.ticket_id),
    score: row.score == null ? null : Number(row.score),
    comment: String(row.comment ?? ''),
    token: String(row.token),
    submittedAt: row.submitted_at == null ? null : String(row.submitted_at),
    createdAt: String(row.created_at),
  };
}

export async function listHelpdeskMacros(): Promise<HelpdeskMacro[]> {
  await ensureHelpdeskExtras();
  return ((await qAll('SELECT * FROM helpdesk_macros ORDER BY name')) as Record<string, unknown>[]).map(
    mapMacro,
  );
}

export async function createHelpdeskMacro(input: {
  name: string;
  body: string;
  createdBy?: number | null;
}): Promise<HelpdeskMacro> {
  await ensureHelpdeskExtras();
  const at = stamp();
  const id = await qInsertReturningId(
    `INSERT INTO helpdesk_macros (name, body, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [
      input.name.trim().slice(0, 80) || 'Macro',
      input.body.trim().slice(0, 4000),
      input.createdBy ?? null,
      at,
      at,
    ],
  );
  const row = (await qGet('SELECT * FROM helpdesk_macros WHERE id = ?', [id])) as Record<
    string,
    unknown
  >;
  return mapMacro(row);
}

export async function deleteHelpdeskMacro(id: number): Promise<boolean> {
  await ensureHelpdeskExtras();
  return (await qRun('DELETE FROM helpdesk_macros WHERE id = ?', [id])) > 0;
}

export async function getHelpdeskMacro(id: number): Promise<HelpdeskMacro | undefined> {
  await ensureHelpdeskExtras();
  const row = (await qGet('SELECT * FROM helpdesk_macros WHERE id = ?', [id])) as
    | Record<string, unknown>
    | undefined;
  return row ? mapMacro(row) : undefined;
}

export async function ensureCsatInvite(ticketId: number): Promise<HelpdeskCsat> {
  await ensureHelpdeskExtras();
  const existing = (await qGet('SELECT * FROM helpdesk_csat WHERE ticket_id = ?', [ticketId])) as
    | Record<string, unknown>
    | undefined;
  if (existing) return mapCsat(existing);
  const token = randomBytes(16).toString('hex');
  const id = await qInsertReturningId(
    `INSERT INTO helpdesk_csat (ticket_id, score, comment, token, created_at) VALUES (?, NULL, '', ?, ?)`,
    [ticketId, token, stamp()],
  );
  const row = (await qGet('SELECT * FROM helpdesk_csat WHERE id = ?', [id])) as Record<
    string,
    unknown
  >;
  return mapCsat(row);
}

export async function getCsatByToken(token: string): Promise<HelpdeskCsat | undefined> {
  await ensureHelpdeskExtras();
  const row = (await qGet('SELECT * FROM helpdesk_csat WHERE token = ?', [token.trim()])) as
    | Record<string, unknown>
    | undefined;
  return row ? mapCsat(row) : undefined;
}

export async function getCsatForTicket(ticketId: number): Promise<HelpdeskCsat | undefined> {
  await ensureHelpdeskExtras();
  const row = (await qGet('SELECT * FROM helpdesk_csat WHERE ticket_id = ?', [ticketId])) as
    | Record<string, unknown>
    | undefined;
  return row ? mapCsat(row) : undefined;
}

export async function submitCsat(
  token: string,
  score: number,
  comment: string,
): Promise<HelpdeskCsat | undefined> {
  await ensureHelpdeskExtras();
  const row = await getCsatByToken(token);
  if (!row || row.submittedAt) return row;
  if (!Number.isInteger(score) || score < 1 || score > 5) return undefined;
  const at = stamp();
  await qRun(
    `UPDATE helpdesk_csat SET score = ?, comment = ?, submitted_at = ? WHERE token = ? AND submitted_at IS NULL`,
    [score, comment.trim().slice(0, 2000), at, token.trim()],
  );
  return getCsatByToken(token);
}
