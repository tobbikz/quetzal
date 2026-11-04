import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';
import {
  HELPDESK_PRIORITIES,
  HELPDESK_STATUSES,
  HELPDESK_TYPES,
  type HelpdeskPriority,
  type HelpdeskStatus,
  type HelpdeskType,
} from '@/lib/helpdeskMeta';
import {
  computeSlaBreached,
  DEFAULT_SLA_POLICIES,
  duesFromPolicy,
  type SlaPolicy,
} from '@/lib/sla';

export type { HelpdeskType, HelpdeskStatus, HelpdeskPriority } from '@/lib/helpdeskMeta';
export {
  HELPDESK_TYPES,
  HELPDESK_STATUSES,
  HELPDESK_PRIORITIES,
  HELPDESK_TYPE_LABEL,
  HELPDESK_STATUS_LABEL,
  tagForHelpdeskStatus,
  tagForHelpdeskType,
} from '@/lib/helpdeskMeta';
export {
  computeSlaBreached,
  labelForSlaBadge,
  slaBadgeState,
  tagForSlaBadge,
  type SlaBadgeKind,
  type SlaBadgeState,
} from '@/lib/sla';


export interface HelpdeskTicket {
  id: number;
  key: string;
  num: number;
  type: HelpdeskType;
  status: HelpdeskStatus;
  priority?: HelpdeskPriority | string;
  summary: string;
  body: string;
  labels: string;
  due: string | null;
  requesterId: number;
  assigneeId: number | null;
  createdAt: string;
  updatedAt: string;
  responseDue: string | null;
  resolveDue: string | null;
  responseMetAt: string | null;
  resolveMetAt: string | null;
  slaBreached: boolean;
  siteId: number | null;
}

export interface HelpdeskNote {
  id: number;
  ticketId: number;
  authorId: number;
  body: string;
  createdAt: string;
}

function isPriority(value: string): value is HelpdeskPriority {
  return HELPDESK_PRIORITIES.includes(value as HelpdeskPriority);
}

function stamp(): string {
  return new Date().toISOString();
}

function mapTicket(row: Record<string, unknown>): HelpdeskTicket {
  const typeRaw = String(row.type);
  const status = String(row.status);
  const priorityRaw = String(row.priority ?? 'medium');
  const statusNorm: HelpdeskStatus =
    status === 'in_progress' || status === 'resolved' || status === 'closed' ? status : 'open';
  const fields = {
    status: statusNorm,
    responseDue: row.response_due == null || row.response_due === '' ? null : String(row.response_due),
    resolveDue: row.resolve_due == null || row.resolve_due === '' ? null : String(row.resolve_due),
    responseMetAt:
      row.response_met_at == null || row.response_met_at === '' ? null : String(row.response_met_at),
    resolveMetAt:
      row.resolve_met_at == null || row.resolve_met_at === '' ? null : String(row.resolve_met_at),
    slaBreached: row.sla_breached === true || Number(row.sla_breached ?? 0) === 1,
  };
  const liveBreached = computeSlaBreached(fields);
  return {
    id: Number(row.id),
    key: String(row.key),
    num: Number(row.num),
    type: isType(typeRaw) ? typeRaw : 'request',
    status: statusNorm,
    priority: isPriority(priorityRaw) ? priorityRaw : 'medium',
    summary: String(row.summary),
    body: String(row.body ?? ''),
    labels: String(row.labels ?? ''),
    due: row.due == null || row.due === '' ? null : String(row.due),
    requesterId: Number(row.requester_id),
    assigneeId: row.assignee_id == null ? null : Number(row.assignee_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    responseDue: fields.responseDue,
    resolveDue: fields.resolveDue,
    responseMetAt: fields.responseMetAt,
    resolveMetAt: fields.resolveMetAt,
    slaBreached: liveBreached,
    siteId: row.site_id == null ? null : Number(row.site_id),
  };
}

function mapNote(row: Record<string, unknown>): HelpdeskNote {
  return {
    id: Number(row.id),
    ticketId: Number(row.ticket_id),
    authorId: Number(row.author_id),
    body: String(row.body),
    createdAt: String(row.created_at),
  };
}

function isType(value: string): value is HelpdeskType {
  return HELPDESK_TYPES.includes(value as HelpdeskType);
}

function isStatus(value: string): value is HelpdeskStatus {
  return HELPDESK_STATUSES.includes(value as HelpdeskStatus);
}

function mapPolicy(row: Record<string, unknown>): SlaPolicy {
  return {
    type: String(row.type),
    priority: String(row.priority ?? ''),
    responseMinutes: Number(row.response_minutes),
    resolveMinutes: Number(row.resolve_minutes),
  };
}

export async function getSlaPolicy(type: string): Promise<SlaPolicy> {
  const row = await qGet('SELECT * FROM sla_policies WHERE type = ?', [type]) as Record<string, unknown> | undefined;
  if (row) return mapPolicy(row);
  const fallback = await qGet('SELECT * FROM sla_policies WHERE type = ?', ['request']) as Record<string, unknown> | undefined;
  if (fallback) return mapPolicy(fallback);
  return DEFAULT_SLA_POLICIES.find((p) => p.type === 'request') ?? ({
    type: 'request',
    priority: '',
    responseMinutes: 120,
    resolveMinutes: 2880,
  } as SlaPolicy);
}

async function persistSlaBreached(ticketId: number, ticket: HelpdeskTicket): Promise<void> {
  const breached = computeSlaBreached(ticket) ? 1 : 0;
  await qRun('UPDATE helpdesk_tickets SET sla_breached = ? WHERE id = ?', [breached, ticketId]);
}

async function markResponseMet(ticket: HelpdeskTicket, at: string): Promise<void> {
  if (ticket.responseMetAt) {
    await persistSlaBreached(ticket.id, ticket);
    return;
  }
  await qRun('UPDATE helpdesk_tickets SET response_met_at = ?, updated_at = ?, sla_breached = ? WHERE id = ?', [
    at,
    at,
    computeSlaBreached({ ...ticket, responseMetAt: at }) ? 1 : 0,
    ticket.id,
  ]);
}

async function markResolveMet(ticket: HelpdeskTicket, at: string): Promise<void> {
  if (ticket.resolveMetAt) {
    await persistSlaBreached(ticket.id, { ...ticket, status: ticket.status });
    return;
  }
  await qRun('UPDATE helpdesk_tickets SET resolve_met_at = ?, updated_at = ?, sla_breached = ? WHERE id = ?', [
    at,
    at,
    computeSlaBreached({ ...ticket, resolveMetAt: at }) ? 1 : 0,
    ticket.id,
  ]);
}

async function backfillMissingSlaDues(): Promise<void> {
  const rows = await qAll(`SELECT id, type, status, created_at, response_due, resolve_due, response_met_at, resolve_met_at, assignee_id
       FROM helpdesk_tickets
       WHERE response_due IS NULL OR resolve_due IS NULL`) as Record<string, unknown>[];
  if (rows.length === 0) return;
  const updateSql = `
    UPDATE helpdesk_tickets
    SET response_due = ?, resolve_due = ?, response_met_at = COALESCE(response_met_at, ?),
        resolve_met_at = COALESCE(resolve_met_at, ?), sla_breached = ?
    WHERE id = ?
  `;
  for (const row of rows) {
    const type = String(row.type);
    const created = String(row.created_at);
    const policy = await getSlaPolicy(type);
    const dues = duesFromPolicy(created, policy);
    const status = String(row.status);
    const responseMet =
      row.response_met_at != null && row.response_met_at !== ''
        ? String(row.response_met_at)
        : row.assignee_id != null
          ? created
          : null;
    const resolveMet =
      row.resolve_met_at != null && row.resolve_met_at !== ''
        ? String(row.resolve_met_at)
        : status === 'resolved' || status === 'closed'
          ? String(row.created_at)
          : null;
    const breached = computeSlaBreached({
      status,
      responseDue: dues.responseDue,
      resolveDue: dues.resolveDue,
      responseMetAt: responseMet,
      resolveMetAt: resolveMet,
      slaBreached: false,
    })
      ? 1
      : 0;
    await qRun(updateSql, [dues.responseDue, dues.resolveDue, responseMet, resolveMet, breached, Number(row.id)]);
  }
}

/** Create helpdesk tables and seed demo tickets if empty. */
export async function ensureHelpdesk(): Promise<void> {
  /* DDL skipped */ void 0;

  for (const ddl of [
    `ALTER TABLE helpdesk_tickets ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`,
    `ALTER TABLE helpdesk_tickets ADD COLUMN labels TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE helpdesk_tickets ADD COLUMN due TEXT`,
    `ALTER TABLE helpdesk_tickets ADD COLUMN response_due TEXT`,
    `ALTER TABLE helpdesk_tickets ADD COLUMN resolve_due TEXT`,
    `ALTER TABLE helpdesk_tickets ADD COLUMN response_met_at TEXT`,
    `ALTER TABLE helpdesk_tickets ADD COLUMN resolve_met_at TEXT`,
    `ALTER TABLE helpdesk_tickets ADD COLUMN sla_breached INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN helpdesk_agent BOOLEAN NOT NULL DEFAULT FALSE`,
  ]) {
    try {
      await qRun(ddl);
    } catch {
      /* column already exists */
    }
  }

  /* Seed agents: Ana (admin) + Luis (member) for local demos. */
  try {
    await qRun(
      `UPDATE users SET helpdesk_agent = TRUE WHERE email IN (?, ?) OR role = 'admin'`,
      ['ana@example.com', 'luis@example.com'],
    );
  } catch {
    /* ignore */
  }

  const upsertPolicySql = `
    INSERT INTO sla_policies (type, priority, response_minutes, resolve_minutes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(type, priority) DO UPDATE SET
      response_minutes = excluded.response_minutes,
      resolve_minutes = excluded.resolve_minutes
  `;
  for (const policy of DEFAULT_SLA_POLICIES) {
    await qRun(upsertPolicySql, [
      policy.type,
      policy.priority,
      policy.responseMinutes,
      policy.resolveMinutes,
    ]);
  }

  const count = await qGet('SELECT COUNT(*) AS n FROM helpdesk_tickets') as { n: number };
  if (count.n > 0) {
    await backfillMissingSlaDues();
    return;
  }

  const users = await qGet('SELECT COUNT(*) AS n FROM users') as { n: number };
  if (users.n === 0) return;

  const at = stamp();
  const incidentPolicy = await getSlaPolicy('incident');
  const requestPolicy = await getSlaPolicy('request');
  const requestDues = duesFromPolicy(at, requestPolicy);
  const incidentDues = duesFromPolicy(at, incidentPolicy);

  await qRun('BEGIN');
  const insertSql = `
    INSERT INTO helpdesk_tickets (
      id, key, num, type, status, priority, summary, body, requester_id, assignee_id, created_at, updated_at,
      response_due, resolve_due, response_met_at, resolve_met_at, sla_breached, site_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await qRun(insertSql, [
    1,
    'HD-1',
    1,
    'request',
    'open',
    'high',
    'Reset register PIN',
    'Cashier cannot unlock drawer after password change. Needs a PIN reset for station 3.',
    3,
    1,
    at,
    at,
    requestDues.responseDue,
    requestDues.resolveDue,
    at,
    null,
    false,
    1,
  ]);
  await qRun(insertSql, [
    2,
    'HD-2',
    2,
    'incident',
    'in_progress',
    'blocker',
    'Card reader offline at front counter',
    'Terminal shows "no host" after reboot. Customers are waiting; Luis is on site.',
    2,
    1,
    at,
    at,
    incidentDues.responseDue,
    incidentDues.resolveDue,
    at,
    null,
    false,
    1,
  ]);
  await qRun(insertSql, [
    3,
    'HD-3',
    3,
    'request',
    'resolved',
    'medium',
    'Add Marisol to the Handbook space',
    'New hire needs read access to HAN and ENG spaces for week-one onboarding.',
    1,
    2,
    at,
    at,
    requestDues.responseDue,
    requestDues.resolveDue,
    at,
    at,
    false,
    1,
  ]);
  await qRun(
    `INSERT INTO helpdesk_notes (ticket_id, author_id, body, created_at) VALUES (?, ?, ?, ?)`,
    [2, 1, 'Pulled logs from the reader. Checking network path to the payment host.', at],
  );
  await qRun(
    `INSERT INTO helpdesk_notes (ticket_id, author_id, body, created_at) VALUES (?, ?, ?, ?)`,
    [3, 2, 'Granted HAN + ENG membership. Closing after she confirms login.', at],
  );
  await qRun('COMMIT');
}

export type HelpdeskQueueKey = 'all' | 'urgent' | 'mine' | 'open' | 'breached';
export type HelpdeskQuery = {
  status?: HelpdeskStatus | '';
  type?: HelpdeskType | '';
  q?: string;
  priority?: string;
  siteId?: number;
  queue?: string;
  assigneeId?: number;
  sortByPriority?: boolean;
};

function siteClause(
  siteId: number | undefined,
  clauses: string[],
  params: Array<string | number>,
): void {
  if (typeof siteId === 'number') {
    clauses.push('(site_id IS NULL OR site_id = ?)');
    params.push(siteId);
  }
}

export async function listHelpdeskTickets(query: HelpdeskQuery = {}): Promise<HelpdeskTicket[]> {
  await ensureHelpdesk();
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (query.status && isStatus(query.status)) {
    clauses.push('status = ?');
    params.push(query.status);
  }
  if (query.type && isType(query.type)) {
    clauses.push('type = ?');
    params.push(query.type);
  }
  if (query.priority && isPriority(query.priority)) {
    clauses.push('priority = ?');
    params.push(query.priority);
  }
  if (query.queue === 'urgent' && !query.priority) {
    clauses.push(`(priority IN ('blocker', 'highest', 'high') OR sla_breached = TRUE)`);
  }
  if (query.queue === 'mine' && typeof query.assigneeId === 'number') {
    clauses.push('assignee_id = ?');
    params.push(query.assigneeId);
  }
  if (query.queue === 'open') {
    clauses.push(`status IN ('open', 'in_progress')`);
  }
  if (query.queue === 'breached') {
    clauses.push('sla_breached = TRUE');
  }
  if (typeof query.assigneeId === 'number' && query.queue !== 'mine') {
    clauses.push('assignee_id = ?');
    params.push(query.assigneeId);
  }
  siteClause(query.siteId, clauses, params);
  if (query.q?.trim()) {
    clauses.push('(summary ILIKE ? OR body ILIKE ? OR key ILIKE ?)');
    const like = `%${query.q.trim()}%`;
    params.push(like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const order =
    query.sortByPriority || query.queue === 'urgent' || query.queue === 'breached'
      ? `ORDER BY CASE priority
         WHEN 'blocker' THEN 0 WHEN 'highest' THEN 1 WHEN 'high' THEN 2
         WHEN 'medium' THEN 3 WHEN 'low' THEN 4 WHEN 'lowest' THEN 5 ELSE 6 END,
       updated_at DESC, id DESC`
      : 'ORDER BY updated_at DESC, id DESC';
  const rows = (await qAll(
    `SELECT * FROM helpdesk_tickets ${where} ${order}`,
    [...params],
  )) as Record<string, unknown>[];
  return rows.map(mapTicket);
}

export type HelpdeskQueueCounts = Record<HelpdeskQueueKey, number>;

/** Counts for the agent desk left rail. */
export async function countHelpdeskQueues(
  siteId: number,
  agentId: number,
): Promise<HelpdeskQueueCounts> {
  await ensureHelpdesk();
  const base: Array<string | number> = [siteId];
  const siteSql = '(site_id IS NULL OR site_id = ?)';
  const [all, urgent, mine, open, breached] = await Promise.all([
    qGet<{ n: number }>(`SELECT COUNT(*)::int AS n FROM helpdesk_tickets WHERE ${siteSql}`, base),
    qGet<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM helpdesk_tickets
        WHERE ${siteSql} AND (priority IN ('blocker', 'highest', 'high') OR sla_breached = TRUE)`,
      base,
    ),
    qGet<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM helpdesk_tickets WHERE ${siteSql} AND assignee_id = ?`,
      [...base, agentId],
    ),
    qGet<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM helpdesk_tickets
        WHERE ${siteSql} AND status IN ('open', 'in_progress')`,
      base,
    ),
    qGet<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM helpdesk_tickets WHERE ${siteSql} AND sla_breached = TRUE`,
      base,
    ),
  ]);
  return {
    all: Number(all?.n ?? 0),
    urgent: Number(urgent?.n ?? 0),
    mine: Number(mine?.n ?? 0),
    open: Number(open?.n ?? 0),
    breached: Number(breached?.n ?? 0),
  };
}

export async function getHelpdeskTicketById(id: number): Promise<HelpdeskTicket | undefined> {
  const row = (await qGet('SELECT * FROM helpdesk_tickets WHERE id = ?', [id])) as
    | Record<string, unknown>
    | undefined;
  return row ? mapTicket(row) : undefined;
}

export async function getHelpdeskTicket(key: string): Promise<HelpdeskTicket | undefined> {
  const normalized = key.trim().toUpperCase();
  if (!normalized) return undefined;
  const row = await qGet('SELECT * FROM helpdesk_tickets WHERE key = ?', [normalized]) as Record<string, unknown> | undefined;
  return row ? mapTicket(row) : undefined;
}

export async function createHelpdeskTicket(input: {
  type: HelpdeskType;
  summary: string;
  body?: string;
  priority?: HelpdeskPriority | string;
  labels?: string;
  due?: string | null;
  requesterId: number;
  assigneeId?: number | null;
  siteId?: number | null;
}): Promise<HelpdeskTicket> {
  const type = isType(input.type) ? input.type : 'request';
  const priority = isPriority(String(input.priority ?? '')) ? (input.priority as HelpdeskPriority) : 'medium';
  const summary = input.summary.trim().slice(0, 180) || 'Untitled request';
  const body = (input.body ?? '').trim().slice(0, 50000);
  const labels = (input.labels ?? '').trim().slice(0, 200);
  const due = input.due?.trim() ? input.due.trim().slice(0, 32) : null;
  const at = stamp();
  const next = (
    await qGet('SELECT COALESCE(MAX(num), 0) + 1 AS n FROM helpdesk_tickets') as { n: number }
  ).n;
  const key = `HD-${next}`;
  const policy = await getSlaPolicy(type);
  const dues = duesFromPolicy(at, policy);
  const assigneeId = input.assigneeId ?? null;
  const responseMetAt = assigneeId != null ? at : null;
  const breached = computeSlaBreached({
    status: 'open',
    responseDue: dues.responseDue,
    resolveDue: dues.resolveDue,
    responseMetAt,
    resolveMetAt: null,
    slaBreached: false,
  })
    ? 1
    : 0;
  const result = await qInsertReturningId(`
      INSERT INTO helpdesk_tickets (
        key, num, type, status, priority, summary, body, labels, due,
        requester_id, assignee_id, created_at, updated_at,
        response_due, resolve_due, response_met_at, resolve_met_at, sla_breached, site_id
      ) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `, [key,
      next,
      type,
      priority,
      summary,
      body,
      labels,
      due,
      input.requesterId,
      assigneeId,
      at,
      at,
      dues.responseDue,
      dues.resolveDue,
      responseMetAt,
      breached,
      input.siteId ?? null,]);
  let ticket = await getHelpdeskTicket(key);
  if (!ticket) throw new Error(`Failed to create helpdesk ticket ${key}`);
  void result;
  try {
    const { runHelpdeskCreateAutomation } = await import('@/lib/helpdeskAutomation');
    ticket = await runHelpdeskCreateAutomation(ticket);
  } catch (err) {
    console.error('[helpdesk] create automation', err);
  }
  try {
    const { fireHelpdeskCreated } = await import('@/lib/webhooks');
    const { notifyOnHelpdeskEvent } = await import('@/lib/notify');
    void fireHelpdeskCreated(ticket);
    void notifyOnHelpdeskEvent({ kind: 'created', ticket });
  } catch (err) {
    console.error('[helpdesk] create side-effects', err);
  }
  return ticket;
}

export async function setHelpdeskStatus(key: string, status: HelpdeskStatus): Promise<HelpdeskTicket | undefined> {
  if (!isStatus(status)) return await getHelpdeskTicket(key);
  const ticket = await getHelpdeskTicket(key);
  if (!ticket) return undefined;
  if (ticket.status === status) return ticket;
  const fromStatus = ticket.status;
  const at = stamp();
  await qRun('UPDATE helpdesk_tickets SET status = ?, updated_at = ? WHERE key = ?', [status,
    at,
    ticket.key,]);
  const refreshed = await getHelpdeskTicket(ticket.key);
  if (!refreshed) return undefined;
  if (status === 'resolved' || status === 'closed') {
    await markResolveMet(refreshed, at);
    try {
      const { ensureCsatInvite } = await import('@/lib/helpdeskExtras');
      await ensureCsatInvite(refreshed.id);
      const afterInvite = await getHelpdeskTicket(ticket.key);
      if (afterInvite) {
        const { runHelpdeskResolveAutomation } = await import('@/lib/helpdeskAutomation');
        void runHelpdeskResolveAutomation(afterInvite);
      }
    } catch (err) {
      console.error('[helpdesk] csat invite', err);
    }
  } else {
    await persistSlaBreached(refreshed.id, { ...refreshed, status });
  }
  const finalTicket = await getHelpdeskTicket(ticket.key);
  if (finalTicket) {
    try {
      const { fireHelpdeskStatusChanged } = await import('@/lib/webhooks');
      const { notifyOnHelpdeskEvent } = await import('@/lib/notify');
      void fireHelpdeskStatusChanged({
        ticket: finalTicket,
        fromStatus,
        toStatus: status,
      });
      void notifyOnHelpdeskEvent({
        kind: 'status',
        ticket: finalTicket,
        fromStatus,
        toStatus: status,
      });
    } catch (err) {
      console.error('[helpdesk] status side-effects', err);
    }
  }
  return finalTicket;
}

export async function assignHelpdeskTicket(
  key: string,
  assigneeId: number | null,
): Promise<HelpdeskTicket | undefined> {
  const ticket = await getHelpdeskTicket(key);
  if (!ticket) return undefined;
  const at = stamp();
  await qRun('UPDATE helpdesk_tickets SET assignee_id = ?, updated_at = ? WHERE key = ?', [assigneeId,
    at,
    ticket.key,]);
  const refreshed = await getHelpdeskTicket(ticket.key);
  if (!refreshed) return undefined;
  if (assigneeId != null && !refreshed.responseMetAt) {
    await markResponseMet(refreshed, at);
  } else {
    await persistSlaBreached(refreshed.id, refreshed);
  }
  return await getHelpdeskTicket(ticket.key);
}

export async function listHelpdeskNotes(ticketId: number): Promise<HelpdeskNote[]> {
  const rows = await qAll('SELECT * FROM helpdesk_notes WHERE ticket_id = ? ORDER BY created_at ASC, id ASC', [ticketId]) as Record<string, unknown>[];
  return rows.map(mapNote);
}

export async function addHelpdeskNote(ticketKey: string, authorId: number, body: string): Promise<HelpdeskNote | undefined> {
  const ticket = await getHelpdeskTicket(ticketKey);
  if (!ticket) return undefined;
  const text = body.trim().slice(0, 4000);
  if (!text) return undefined;
  const at = stamp();
  const noteId = await qInsertReturningId(
    `INSERT INTO helpdesk_notes (ticket_id, author_id, body, created_at) VALUES (?, ?, ?, ?)`,
    [ticket.id, authorId, text, at],
  );
  await qRun('UPDATE helpdesk_tickets SET updated_at = ? WHERE id = ?', [at, ticket.id]);
  if (!ticket.responseMetAt) {
    await markResponseMet(ticket, at);
  } else {
    await persistSlaBreached(ticket.id, ticket);
  }
  const row = (await qGet('SELECT * FROM helpdesk_notes WHERE id = ?', [noteId])) as
    | Record<string, unknown>
    | undefined;
  try {
    const { fireHelpdeskNoteAdded } = await import('@/lib/webhooks');
    const { notifyOnHelpdeskEvent } = await import('@/lib/notify');
    void fireHelpdeskNoteAdded({ ticket, authorId, body: text });
    void notifyOnHelpdeskEvent({ kind: 'note', ticket, authorId, body: text });
  } catch (err) {
    console.error('[helpdesk] note side-effects', err);
  }
  return row ? mapNote(row) : undefined;
}

export async function listSlaPolicies(): Promise<SlaPolicy[]> {
  await ensureHelpdesk();
  const rows = await qAll(`SELECT type, priority, response_minutes, resolve_minutes FROM sla_policies ORDER BY type, priority`);
  if (rows.length === 0) return [...DEFAULT_SLA_POLICIES];
  return rows.map((row) => ({
    type: String(row.type),
    priority: String(row.priority ?? ''),
    responseMinutes: Number(row.response_minutes),
    resolveMinutes: Number(row.resolve_minutes),
  }));
}

export async function listSlaBreachedTickets(siteId?: number): Promise<HelpdeskTicket[]> {
  const rows =
    typeof siteId === 'number'
      ? await qAll(
          `SELECT * FROM helpdesk_tickets WHERE sla_breached = TRUE AND (site_id IS NULL OR site_id = ?) ORDER BY updated_at DESC`,
          [siteId],
        )
      : await qAll(`SELECT * FROM helpdesk_tickets WHERE sla_breached = TRUE ORDER BY updated_at DESC`);
  return rows.map(mapTicket);
}

export type HelpdeskQueue = {
  key: string;
  name: string;
  type?: string;
};

export function listHelpdeskQueues(): HelpdeskQueue[] {
  return [
    { key: 'all', name: 'All tickets' },
    { key: 'open', name: 'Open' },
    { key: 'breached', name: 'SLA breached' },
  ];
}

export { DEFAULT_BUSINESS_HOURS } from '@/lib/sla';
