import { createHmac } from 'node:crypto';
import type { Issue } from '@/lib/types';
import type { HelpdeskTicket } from '@/lib/helpdesk';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';

export const WEBHOOK_EVENTS = [
  'issue.status_changed',
  'issue.comment_added',
  'helpdesk.created',
  'helpdesk.status_changed',
  'helpdesk.note_added',
  'helpdesk.csat_submitted',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: number;
  url: string;
  secret: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: string;
}

export type WebhookPayload = {
  event: WebhookEvent;
  at: string;
  issue?: {
    id: number;
    key: string;
    projectKey: string;
    summary: string;
    status: Issue['status'];
    priority: Issue['priority'];
    type: Issue['type'];
    assigneeId: number | null;
    reporterId: number;
  };
  helpdesk?: {
    id: number;
    key: string;
    summary: string;
    status: string;
    priority: string;
    type: string;
    assigneeId: number | null;
    requesterId: number;
  };
  fromStatus?: string | null;
  toStatus?: string | null;
  comment?: { body: string; authorId: number } | null;
  note?: { body: string; authorId: number } | null;
  csat?: { score: number; comment: string } | null;
  authorId?: number | null;
};

function stamp(): string {
  return new Date().toISOString();
}

function parseEvents(raw: unknown): WebhookEvent[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is WebhookEvent =>
      (WEBHOOK_EVENTS as readonly string[]).includes(String(item)),
    );
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseEvents(JSON.parse(raw));
    } catch {
      return raw
        .split(',')
        .map((part) => part.trim())
        .filter((part): part is WebhookEvent =>
          (WEBHOOK_EVENTS as readonly string[]).includes(part),
        );
    }
  }
  return ['issue.status_changed', 'issue.comment_added'];
}

function mapWebhook(row: Record<string, unknown>): Webhook {
  const enabled =
    row.enabled === true ||
    Number(row.enabled ?? 0) === 1 ||
    String(row.enabled) === 't';
  return {
    id: Number(row.id),
    url: String(row.url),
    secret: String(row.secret ?? ''),
    events: parseEvents(row.events),
    enabled,
    createdAt: String(row.created_at),
  };
}

let webhooksReady: Promise<void> | null = null;

export async function ensureWebhooksTable(): Promise<void> {
  if (!webhooksReady) {
    webhooksReady = (async () => {
      await qRun(`CREATE TABLE IF NOT EXISTS webhooks (
        id BIGSERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        secret TEXT NOT NULL DEFAULT '',
        events JSONB NOT NULL DEFAULT '["issue.status_changed","issue.comment_added"]'::jsonb,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await qRun(`CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks (enabled)`);
    })().catch((err) => {
      webhooksReady = null;
      throw err;
    });
  }
  await webhooksReady;
}

export async function listWebhooks(): Promise<Webhook[]> {
  await ensureWebhooksTable();
  return ((await qAll(`SELECT * FROM webhooks ORDER BY id`)) as Record<string, unknown>[]).map(
    mapWebhook,
  );
}

export async function listEnabledWebhooksFor(event: WebhookEvent): Promise<Webhook[]> {
  return (await listWebhooks()).filter((hook) => hook.enabled && hook.events.includes(event));
}

export async function createWebhook(input: {
  url: string;
  secret?: string;
  events?: WebhookEvent[];
  enabled?: boolean;
}): Promise<Webhook> {
  await ensureWebhooksTable();
  const url = input.url.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('url must be http(s)');
  const events = input.events?.length ? input.events : [...WEBHOOK_EVENTS];
  const enabled = input.enabled !== false;
  const id = await qInsertReturningId(
    `INSERT INTO webhooks (url, secret, events, enabled, created_at)
       VALUES (?, ?, ?::jsonb, ?, ?)`,
    [url, (input.secret ?? '').trim(), JSON.stringify(events), enabled, stamp()],
  );
  const row = (await qGet(`SELECT * FROM webhooks WHERE id = ?`, [id])) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new Error('webhook insert failed');
  return mapWebhook(row);
}

export async function setWebhookEnabled(id: number, enabled: boolean): Promise<boolean> {
  await ensureWebhooksTable();
  const result = await qRun(`UPDATE webhooks SET enabled = ? WHERE id = ?`, [enabled, id]);
  return result > 0;
}

export async function deleteWebhook(id: number): Promise<boolean> {
  await ensureWebhooksTable();
  const result = await qRun(`DELETE FROM webhooks WHERE id = ?`, [id]);
  return result > 0;
}

function issueSlice(issue: Issue): NonNullable<WebhookPayload['issue']> {
  return {
    id: issue.id,
    key: issue.key,
    projectKey: issue.projectKey,
    summary: issue.summary,
    status: issue.status,
    priority: issue.priority,
    type: issue.type,
    assigneeId: issue.assigneeId,
    reporterId: issue.reporterId,
  };
}

function helpdeskSlice(ticket: HelpdeskTicket): NonNullable<WebhookPayload['helpdesk']> {
  return {
    id: ticket.id,
    key: ticket.key,
    summary: ticket.summary,
    status: ticket.status,
    priority: String(ticket.priority ?? 'medium'),
    type: ticket.type,
    assigneeId: ticket.assigneeId,
    requesterId: ticket.requesterId,
  };
}

function signBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

async function deliver(hook: Webhook, payload: WebhookPayload): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'Quetzal-Webhooks/1.0',
    'x-quetzal-event': payload.event,
  };
  if (hook.secret) {
    headers['x-quetzal-signature'] = `sha256=${signBody(hook.secret, body)}`;
  }
  const res = await fetch(hook.url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`webhook ${hook.id} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

/** Fire matching webhooks (async, non-blocking for callers). */
export async function fireWebhooks(
  payload: Omit<WebhookPayload, 'at'> & { at?: string },
): Promise<void> {
  const full: WebhookPayload = { ...payload, at: payload.at ?? stamp() };
  const hooks = await listEnabledWebhooksFor(full.event);
  if (!hooks.length) return;

  void Promise.allSettled(
    hooks.map(async (hook) => {
      try {
        await deliver(hook, full);
      } catch (err) {
        console.error('[webhooks] delivery failed', { id: hook.id, event: full.event, err });
      }
    }),
  ).catch((err) => {
    console.error('[webhooks] batch failed', err);
  });
}

export async function fireIssueStatusChanged(input: {
  issue: Issue;
  fromStatus: Issue['status'];
  toStatus: Issue['status'];
  authorId?: number | null;
}): Promise<void> {
  await fireWebhooks({
    event: 'issue.status_changed',
    issue: issueSlice(input.issue),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    authorId: input.authorId ?? null,
  });
}

export async function fireIssueCommentAdded(input: {
  issue: Issue;
  authorId: number;
  body: string;
}): Promise<void> {
  await fireWebhooks({
    event: 'issue.comment_added',
    issue: issueSlice(input.issue),
    comment: { body: input.body, authorId: input.authorId },
    authorId: input.authorId,
  });
}

export async function fireHelpdeskCreated(ticket: HelpdeskTicket): Promise<void> {
  await fireWebhooks({
    event: 'helpdesk.created',
    helpdesk: helpdeskSlice(ticket),
    authorId: ticket.requesterId,
  });
}

export async function fireHelpdeskStatusChanged(input: {
  ticket: HelpdeskTicket;
  fromStatus: string;
  toStatus: string;
  authorId?: number | null;
}): Promise<void> {
  await fireWebhooks({
    event: 'helpdesk.status_changed',
    helpdesk: helpdeskSlice(input.ticket),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    authorId: input.authorId ?? null,
  });
}

export async function fireHelpdeskNoteAdded(input: {
  ticket: HelpdeskTicket;
  authorId: number;
  body: string;
}): Promise<void> {
  await fireWebhooks({
    event: 'helpdesk.note_added',
    helpdesk: helpdeskSlice(input.ticket),
    note: { body: input.body, authorId: input.authorId },
    authorId: input.authorId,
  });
}

export async function fireHelpdeskCsatSubmitted(input: {
  ticket: HelpdeskTicket;
  score: number;
  comment: string;
}): Promise<void> {
  await fireWebhooks({
    event: 'helpdesk.csat_submitted',
    helpdesk: helpdeskSlice(input.ticket),
    csat: { score: input.score, comment: input.comment },
  });
}
