import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createNotification,
  getIssue,
  getUser,
  listUsers,
} from '@/lib/db';
import type { Issue } from '@/lib/types';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';

export type NotifyPayload = {
  userId: number;
  kind: string;
  title: string;
  body?: string;
  href?: string | null;
};


export type NotifyChannelSettings = {
  id: number;
  mailEnabled: boolean;
  slackEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  slackWebhookUrl: string;
  updatedAt: string;
};

/** Effective config after env overrides (QUETZAL_SMTP_* / QUETZAL_SLACK_WEBHOOK). */
export type EffectiveNotifyConfig = NotifyChannelSettings & {
  smtpFromEnv: boolean;
  slackFromEnv: boolean;
  mailReady: boolean;
  slackReady: boolean;
};

function stamp(): string {
  return new Date().toISOString();
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim();
}

export async function ensureNotificationChannels(): Promise<void> {
  /* DDL skipped — migrations */ void 0;
  const existing = await qGet('SELECT id FROM notification_channels WHERE id = 1') as { id: number } | undefined;
  if (!existing) {
    await qRun(`INSERT INTO notification_channels (
           id, mail_enabled, slack_enabled, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
           slack_webhook_url, updated_at
         ) VALUES (1, FALSE, FALSE, '', 587, '', '', '', '', ?)`, [stamp()]);
  }
}

// deferred: await ensureNotificationChannels();
function mapSettings(row: Record<string, unknown>): NotifyChannelSettings {
  const port = Number(row.smtp_port);
  return {
    id: Number(row.id),
    mailEnabled:
      row.mail_enabled === true ||
      Number(row.mail_enabled ?? 0) === 1 ||
      String(row.mail_enabled) === 't',
    slackEnabled:
      row.slack_enabled === true ||
      Number(row.slack_enabled ?? 0) === 1 ||
      String(row.slack_enabled) === 't',
    smtpHost: String(row.smtp_host ?? ''),
    smtpPort: Number.isFinite(port) && port > 0 ? Math.trunc(port) : 587,
    smtpUser: String(row.smtp_user ?? ''),
    smtpPass: String(row.smtp_pass ?? ''),
    smtpFrom: String(row.smtp_from ?? ''),
    slackWebhookUrl: String(row.slack_webhook_url ?? ''),
    updatedAt: String(row.updated_at ?? stamp()),
  };
}

export async function getNotifyChannelSettings(): Promise<NotifyChannelSettings> {
  await ensureNotificationChannels();
  const row = await qGet('SELECT * FROM notification_channels WHERE id = 1') as Record<string, unknown> | undefined;
  if (!row) {
    return {
      id: 1,
      mailEnabled: false,
      slackEnabled: false,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPass: '',
      smtpFrom: '',
      slackWebhookUrl: '',
      updatedAt: stamp(),
    };
  }
  return mapSettings(row);
}

export async function saveNotifyChannelSettings(input: {
  mailEnabled: boolean;
  slackEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  slackWebhookUrl?: string;
  /** When false, keep existing smtp_pass (UI blank = leave unchanged). */
  updateSmtpPass?: boolean;
}): Promise<NotifyChannelSettings> {
  await ensureNotificationChannels();
  const current = await getNotifyChannelSettings();
  const smtpHost = (input.smtpHost ?? current.smtpHost).trim().slice(0, 255);
  const rawPort = input.smtpPort ?? current.smtpPort;
  const smtpPort =
    Number.isFinite(rawPort) && Number(rawPort) > 0 ? Math.trunc(Number(rawPort)) : 587;
  const smtpUser = (input.smtpUser ?? current.smtpUser).trim().slice(0, 255);
  const smtpPass =
    input.updateSmtpPass === false
      ? current.smtpPass
      : (input.smtpPass ?? current.smtpPass).slice(0, 500);
  const smtpFrom = (input.smtpFrom ?? current.smtpFrom).trim().slice(0, 255);
  const slackWebhookUrl = (input.slackWebhookUrl ?? current.slackWebhookUrl).trim().slice(0, 2000);
  const updatedAt = stamp();
  await qRun(`UPDATE notification_channels
       SET mail_enabled = ?, slack_enabled = ?, smtp_host = ?, smtp_port = ?,
           smtp_user = ?, smtp_pass = ?, smtp_from = ?, slack_webhook_url = ?, updated_at = ?
       WHERE id = 1`, [input.mailEnabled,
      input.slackEnabled,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      slackWebhookUrl,
      updatedAt,]);
  return await getNotifyChannelSettings();
}

/** Merge DB settings with env. Env wins when the variable is non-empty. */
export async function getEffectiveNotifyConfig(): Promise<EffectiveNotifyConfig> {
  const db = await getNotifyChannelSettings();
  const envHost = env('QUETZAL_SMTP_HOST');
  const envPort = env('QUETZAL_SMTP_PORT');
  const envUser = env('QUETZAL_SMTP_USER');
  const envPass = env('QUETZAL_SMTP_PASS');
  const envFrom = env('QUETZAL_SMTP_FROM');
  const envSlack = env('QUETZAL_SLACK_WEBHOOK');

  const smtpFromEnv = Boolean(envHost || envPort || envUser || envPass || envFrom);
  const slackFromEnv = Boolean(envSlack);

  const smtpHost = envHost || db.smtpHost;
  const smtpPort = envPort ? Number(envPort) || db.smtpPort : db.smtpPort;
  const smtpUser = envUser || db.smtpUser;
  const smtpPass = envPass || db.smtpPass;
  const smtpFrom = envFrom || db.smtpFrom;
  const slackWebhookUrl = envSlack || db.slackWebhookUrl;

  const mailEnabled = db.mailEnabled || Boolean(envHost && envFrom);
  const slackEnabled = db.slackEnabled || Boolean(envSlack);

  return {
    ...db,
    mailEnabled,
    slackEnabled,
    smtpHost,
    smtpPort: Number.isFinite(smtpPort) && smtpPort > 0 ? Math.trunc(smtpPort) : 587,
    smtpUser,
    smtpPass,
    smtpFrom,
    slackWebhookUrl,
    smtpFromEnv,
    slackFromEnv,
    mailReady: Boolean(mailEnabled && smtpHost && smtpFrom),
    slackReady: Boolean(slackEnabled && slackWebhookUrl.startsWith('http')),
  };
}

function appBaseUrl(): string {
  const fromEnv = env('QUETZAL_BASE_URL') || env('QUETZAL_APP_URL');
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'http://127.0.0.1:3210';
}

function absoluteHref(href?: string | null): string | null {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `${appBaseUrl()}${href}`;
  return href;
}

async function sendSlackWebhook(payload: NotifyPayload): Promise<void> {
  const cfg = await getEffectiveNotifyConfig();
  if (!cfg.slackReady) {
    console.log('[notify:slack:skip]', { reason: 'not configured', kind: payload.kind });
    return;
  }
  const link = absoluteHref(payload.href);
  const textLines = [
    `*${payload.title}*`,
    payload.body?.trim() ? payload.body.trim() : null,
    link ? `<${link}|Open in Quetzal>` : null,
  ].filter(Boolean);
  const res = await fetch(cfg.slackWebhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: textLines.join('\n'),
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: textLines.join('\n') },
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Slack webhook HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function sendMail(payload: NotifyPayload & { email?: string }): Promise<void> {
  const cfg = await getEffectiveNotifyConfig();
  const to = (payload.email ?? '').trim();
  if (!to) {
    console.log('[notify:mail:skip]', { reason: 'no recipient email', userId: payload.userId });
    return;
  }
  if (!cfg.mailReady) {
    console.log('[notify:mail:skip]', { reason: 'not configured', to, kind: payload.kind });
    return;
  }

  let nodemailer: typeof import('nodemailer');
  try {
    nodemailer = await import('nodemailer');
  } catch (err) {
    console.error('[notify:mail] nodemailer not available', err);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
  });

  const link = absoluteHref(payload.href);
  const text = [payload.title, payload.body?.trim() || '', link ? `Open: ${link}` : '']
    .filter(Boolean)
    .join('\n\n');

  await transporter.sendMail({
    from: cfg.smtpFrom,
    to,
    subject: `[Quetzal] ${payload.title}`.slice(0, 200),
    text,
  });
}

function safeChannel(label: string, run: () => Promise<void>): void {
  void run().catch((err) => {
    console.error(`[notify:${label}]`, err);
  });
}

/** Outbound channels — failures are logged; never throw to callers. */
export const channels = {
  mail(payload: NotifyPayload & { email?: string }): void {
    safeChannel('mail', () => sendMail(payload));
  },
  slack(payload: NotifyPayload): void {
    safeChannel('slack', () => sendSlackWebhook(payload));
  },
};

export async function notifyUser(payload: NotifyPayload): Promise<number | null> {
  try {
    if (!Number.isInteger(payload.userId) || payload.userId <= 0) return null;
    if (!payload.title.trim()) return null;
    const id = await createNotification({
      userId: payload.userId,
      kind: payload.kind || 'info',
      title: payload.title.trim(),
      body: payload.body ?? '',
      href: payload.href ?? null,
    });
    const user = await getUser(payload.userId);
    channels.mail({ ...payload, email: user?.email });
    channels.slack(payload);
    return id;
  } catch (err) {
    console.error('[notifyUser]', err);
    return null;
  }
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function plainText(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function snippet(body: string, max = 140): string {
  const text = plainText(body);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

async function mentionedUserIds(body: string): Promise<number[]> {
  const text = plainText(body);
  const users = [...(await listUsers())].sort((a, b) => b.name.length - a.name.length);
  const found = new Set<number>();
  for (const user of users) {
    const re = new RegExp(`@${escapeRe(user.name)}(?![\\w])`, 'i');
    if (re.test(text)) found.add(user.id);
  }
  return [...found];
}

function mentionedIssueKeys(body: string): string[] {
  const text = plainText(body);
  const matches = text.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? [];
  return [...new Set(matches)];
}

type HelpdeskNotifyTicket = {
  id: number;
  key: string;
  summary: string;
  status: string;
  assigneeId: number | null;
  requesterId: number;
};

/** Fan-out for helpdesk lifecycle — never throws into ticket paths. */
export async function notifyOnHelpdeskEvent(input: {
  kind: 'created' | 'status' | 'note';
  ticket: HelpdeskNotifyTicket;
  fromStatus?: string;
  toStatus?: string;
  authorId?: number;
  body?: string;
}): Promise<void> {
  try {
    const href = `/helpdesk/${input.ticket.key}`;
    const recipients = new Set<number>();
    if (input.ticket.assigneeId) recipients.add(input.ticket.assigneeId);
    if (input.ticket.requesterId) recipients.add(input.ticket.requesterId);
    if (input.authorId) recipients.delete(input.authorId);

    let title = `${input.ticket.key}: ${input.ticket.summary}`;
    let body = '';
    if (input.kind === 'created') {
      title = `New helpdesk ${input.ticket.key}`;
      body = input.ticket.summary;
    } else if (input.kind === 'status') {
      title = `${input.ticket.key} → ${input.toStatus ?? input.ticket.status}`;
      body = input.fromStatus
        ? `Status changed from ${input.fromStatus} to ${input.toStatus}`
        : `Status is now ${input.toStatus}`;
    } else {
      title = `Note on ${input.ticket.key}`;
      body = snippet(input.body ?? '', 160);
    }

    for (const userId of recipients) {
      await notifyUser({
        userId,
        kind: `helpdesk_${input.kind}`,
        title,
        body,
        href,
      });
    }

    // Mirror to Teams when configured (best-effort).
    try {
      const { postTeamsMessage } = await import('@/lib/connectors');
      await postTeamsMessage([title, body, absoluteHref(href)].filter(Boolean).join('\n'));
    } catch (err) {
      console.error('[notify:teams]', err);
    }
  } catch (err) {
    console.error('[notifyOnHelpdeskEvent]', err);
  }
}

/** Fan-out after addComment — never throws into the comment path. */
export async function notifyOnIssueComment(issue: Issue, authorId: number, body: string): Promise<void> {
  try {
    const author = await getUser(authorId);
    const authorName = author?.name ?? 'Someone';
    const href = `/issues/${issue.key}?tab=comments`;
    const preview = snippet(body);
    const recipients = new Map<number, { kind: string; title: string }>();

    if (issue.assigneeId && issue.assigneeId !== authorId) {
      recipients.set(issue.assigneeId, {
        kind: 'comment',
        title: `${authorName} commented on ${issue.key}`,
      });
    }

    for (const userId of await mentionedUserIds(body)) {
      if (userId === authorId) continue;
      recipients.set(userId, {
        kind: 'mention',
        title: `${authorName} mentioned you on ${issue.key}`,
      });
    }

    for (const key of mentionedIssueKeys(body)) {
      if (key === issue.key) continue;
      const other = await getIssue(key);
      if (!other?.assigneeId || other.assigneeId === authorId) continue;
      if (recipients.has(other.assigneeId)) continue;
      recipients.set(other.assigneeId, {
        kind: 'issue_mention',
        title: `${authorName} mentioned ${key} on ${issue.key}`,
      });
    }

    for (const [userId, meta] of recipients) {
      await notifyUser({
        userId,
        kind: meta.kind,
        title: meta.title,
        body: preview,
        href,
      });
    }
  } catch (err) {
    console.error('[notifyOnIssueComment]', err);
  }
}
