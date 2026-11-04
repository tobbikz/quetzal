import { randomBytes } from 'node:crypto';
import { qGet, qRun } from '@/lib/sql';

export type IntegrationConnectors = {
  githubWebhookSecret: string;
  githubEnabled: boolean;
  teamsWebhookUrl: string;
  teamsEnabled: boolean;
  emailInboundToken: string;
  emailInboundEnabled: boolean;
  updatedAt: string;
};

function stamp(): string {
  return new Date().toISOString();
}

function asBool(value: unknown): boolean {
  return value === true || Number(value ?? 0) === 1 || String(value) === 't';
}

let ready: Promise<void> | null = null;

export async function ensureConnectors(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await qRun(`CREATE TABLE IF NOT EXISTS integration_connectors (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        github_webhook_secret TEXT NOT NULL DEFAULT '',
        github_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        teams_webhook_url TEXT NOT NULL DEFAULT '',
        teams_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        email_inbound_token TEXT NOT NULL DEFAULT '',
        email_inbound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      const existing = await qGet<{ id: number }>('SELECT id FROM integration_connectors WHERE id = 1');
      if (!existing) {
        await qRun(
          `INSERT INTO integration_connectors (id, email_inbound_token, updated_at) VALUES (1, ?, ?)`,
          [randomBytes(18).toString('hex'), stamp()],
        );
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
}

function mapRow(row: Record<string, unknown>): IntegrationConnectors {
  return {
    githubWebhookSecret: String(row.github_webhook_secret ?? ''),
    githubEnabled: asBool(row.github_enabled),
    teamsWebhookUrl: String(row.teams_webhook_url ?? ''),
    teamsEnabled: asBool(row.teams_enabled),
    emailInboundToken: String(row.email_inbound_token ?? ''),
    emailInboundEnabled: asBool(row.email_inbound_enabled),
    updatedAt: String(row.updated_at ?? stamp()),
  };
}

export async function getConnectors(): Promise<IntegrationConnectors> {
  await ensureConnectors();
  const row = (await qGet('SELECT * FROM integration_connectors WHERE id = 1')) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return {
      githubWebhookSecret: '',
      githubEnabled: false,
      teamsWebhookUrl: '',
      teamsEnabled: false,
      emailInboundToken: '',
      emailInboundEnabled: false,
      updatedAt: stamp(),
    };
  }
  return mapRow(row);
}

export async function saveConnectors(input: {
  githubEnabled: boolean;
  githubWebhookSecret?: string;
  updateGithubSecret?: boolean;
  teamsEnabled: boolean;
  teamsWebhookUrl: string;
  emailInboundEnabled: boolean;
  rotateEmailToken?: boolean;
}): Promise<IntegrationConnectors> {
  await ensureConnectors();
  const current = await getConnectors();
  const githubWebhookSecret =
    input.updateGithubSecret === false
      ? current.githubWebhookSecret
      : (input.githubWebhookSecret ?? current.githubWebhookSecret).trim().slice(0, 200);
  const emailInboundToken = input.rotateEmailToken
    ? randomBytes(18).toString('hex')
    : current.emailInboundToken || randomBytes(18).toString('hex');
  await qRun(
    `UPDATE integration_connectors SET
       github_enabled = ?, github_webhook_secret = ?,
       teams_enabled = ?, teams_webhook_url = ?,
       email_inbound_enabled = ?, email_inbound_token = ?,
       updated_at = ?
     WHERE id = 1`,
    [
      input.githubEnabled,
      githubWebhookSecret,
      input.teamsEnabled,
      input.teamsWebhookUrl.trim().slice(0, 2000),
      input.emailInboundEnabled,
      emailInboundToken,
      stamp(),
    ],
  );
  return getConnectors();
}

/** Post a simple Adaptive Card–ish text payload to Teams incoming webhook. */
export async function postTeamsMessage(text: string): Promise<void> {
  const cfg = await getConnectors();
  if (!cfg.teamsEnabled || !cfg.teamsWebhookUrl.startsWith('http')) return;
  const res = await fetch(cfg.teamsWebhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Teams webhook HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}
