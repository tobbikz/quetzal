import { listUsers } from '@/lib/db';
import { assignHelpdeskTicket, listSlaBreachedTickets, type HelpdeskTicket } from '@/lib/helpdesk';
import { ensureCsatInvite, getCsatForTicket } from '@/lib/helpdeskExtras';
import { notifyUser } from '@/lib/notify';
import { qGet, qRun } from '@/lib/sql';

function stamp(): string {
  return new Date().toISOString();
}

function appBaseUrl(): string {
  const fromEnv = String(process.env.QUETZAL_BASE_URL ?? process.env.QUETZAL_APP_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  return fromEnv || 'http://127.0.0.1:3210';
}

async function ensureLogTable(): Promise<void> {
  await qRun(`CREATE TABLE IF NOT EXISTS helpdesk_automation_log (
    id BIGSERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ticket_id, kind)
  )`);
}

async function alreadyLogged(ticketId: number, kind: string): Promise<boolean> {
  await ensureLogTable();
  const row = await qGet('SELECT 1 AS ok FROM helpdesk_automation_log WHERE ticket_id = ? AND kind = ?', [
    ticketId,
    kind,
  ]);
  return Boolean(row);
}

async function logOnce(ticketId: number, kind: string, detail: string): Promise<boolean> {
  if (await alreadyLogged(ticketId, kind)) return false;
  await ensureLogTable();
  try {
    await qRun(
      `INSERT INTO helpdesk_automation_log (ticket_id, kind, detail, created_at) VALUES (?, ?, ?, ?)`,
      [ticketId, kind, detail.slice(0, 500), stamp()],
    );
    return true;
  } catch {
    return false;
  }
}

/** Pick helpdesk agent with fewest open assigned tickets (admins count as agents). */
export async function pickHelpdeskAgentId(): Promise<number | null> {
  const people = await listUsers();
  const agents = people.filter((u) => u.helpdeskAgent || u.role === 'admin');
  if (!agents.length) return null;

  let best: { id: number; load: number } | null = null;
  for (const agent of agents) {
    const row = (await qGet(
      `SELECT COUNT(*)::int AS n FROM helpdesk_tickets
       WHERE assignee_id = ? AND status NOT IN ('resolved', 'closed')`,
      [agent.id],
    )) as { n: number } | undefined;
    const load = Number(row?.n ?? 0);
    if (!best || load < best.load) best = { id: agent.id, load };
  }
  return best?.id ?? null;
}

/** Auto-assign when ticket is created without an assignee. */
export async function autoAssignHelpdeskTicket(
  ticket: HelpdeskTicket,
): Promise<HelpdeskTicket | undefined> {
  if (ticket.assigneeId != null) return ticket;
  const agentId = await pickHelpdeskAgentId();
  if (agentId == null) return ticket;
  const updated = await assignHelpdeskTicket(ticket.key, agentId);
  if (updated) {
    await logOnce(ticket.id, 'auto_assign', `assignee=${agentId}`);
    await notifyUser({
      userId: agentId,
      kind: 'helpdesk_auto_assign',
      title: `Auto-assigned ${ticket.key}`,
      body: ticket.summary,
      href: `/helpdesk/${ticket.key}`,
    });
  }
  return updated ?? ticket;
}

/** Email/in-app CSAT invite to requester after resolve/close. */
export async function notifyCsatInvite(ticket: HelpdeskTicket): Promise<void> {
  try {
    const csat = (await getCsatForTicket(ticket.id)) ?? (await ensureCsatInvite(ticket.id));
    if (csat.submittedAt) return;
    if (!(await logOnce(ticket.id, 'csat_invite', csat.token))) return;
    const href = `${appBaseUrl()}/csat/${csat.token}`;
    await notifyUser({
      userId: ticket.requesterId,
      kind: 'helpdesk_csat',
      title: `How did we do on ${ticket.key}?`,
      body: `Rate your experience: ${href}`,
      href: `/csat/${csat.token}`,
    });
  } catch (err) {
    console.error('[helpdeskAutomation] csat invite', err);
  }
}

/** Cron: notify assignees (or admins) about newly breached SLA tickets. */
export async function tickHelpdeskSlaBreaches(): Promise<{
  evaluated: number;
  notified: number;
  skipped: number;
}> {
  await ensureLogTable();
  const breached = await listSlaBreachedTickets();
  let notified = 0;
  let skipped = 0;

  for (const ticket of breached) {
    if (await alreadyLogged(ticket.id, 'sla_breach')) {
      skipped += 1;
      continue;
    }
    const recipients = new Set<number>();
    if (ticket.assigneeId) recipients.add(ticket.assigneeId);
    else {
      for (const u of await listUsers()) {
        if (u.helpdeskAgent || u.role === 'admin') recipients.add(u.id);
      }
    }
    if (!(await logOnce(ticket.id, 'sla_breach', ticket.key))) {
      skipped += 1;
      continue;
    }
    for (const userId of recipients) {
      await notifyUser({
        userId,
        kind: 'helpdesk_sla_breach',
        title: `SLA breached: ${ticket.key}`,
        body: ticket.summary,
        href: `/helpdesk/${ticket.key}`,
      });
    }
    notified += 1;
  }

  return { evaluated: breached.length, notified, skipped };
}

export async function runHelpdeskCreateAutomation(
  ticket: HelpdeskTicket,
): Promise<HelpdeskTicket> {
  try {
    const assigned = await autoAssignHelpdeskTicket(ticket);
    return assigned ?? ticket;
  } catch (err) {
    console.error('[helpdeskAutomation] create', err);
    return ticket;
  }
}

export async function runHelpdeskResolveAutomation(ticket: HelpdeskTicket): Promise<void> {
  await notifyCsatInvite(ticket);
}
