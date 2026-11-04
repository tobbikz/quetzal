import { NextResponse } from 'next/server';
import { getConnectors } from '@/lib/connectors';
import { ensureUserByEmail, listUsers } from '@/lib/db';
import { createHelpdeskTicket } from '@/lib/helpdesk';
import { resolveSiteKey } from '@/lib/sites';

export const runtime = 'nodejs';

type InboundBody = {
  token?: string;
  from?: string;
  fromName?: string;
  subject?: string;
  text?: string;
  html?: string;
};

/**
 * Token-authenticated inbound email → helpdesk ticket.
 * Header: Authorization: Bearer <email_inbound_token>
 * or JSON body.token / ?token=
 */
export async function POST(request: Request) {
  const connectors = await getConnectors();
  if (!connectors.emailInboundEnabled || !connectors.emailInboundToken) {
    return NextResponse.json({ error: 'email inbound disabled' }, { status: 503 });
  }

  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : '';
  const urlToken = new URL(request.url).searchParams.get('token') ?? '';

  let body: InboundBody = {};
  try {
    body = (await request.json()) as InboundBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const token = bearer || urlToken || String(body.token ?? '').trim();
  if (!token || token !== connectors.emailInboundToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const from = String(body.from ?? '').trim().toLowerCase();
  if (!from || !from.includes('@')) {
    return NextResponse.json({ error: 'from email required' }, { status: 400 });
  }

  const subject = String(body.subject ?? '').trim().slice(0, 180) || 'Email request';
  const text = String(body.text ?? body.html ?? '').trim().slice(0, 50000);
  const name = String(body.fromName ?? (from.split('@')[0] || 'Requester')).slice(0, 80);

  const requester = await ensureUserByEmail(from, name, 'viewer', 'local');
  const site = await resolveSiteKey('HQ');
  const agents = (await listUsers()).filter((u) => u.helpdeskAgent || u.role === 'admin');
  const assigneeId = agents[0]?.id ?? null;

  const ticket = await createHelpdeskTicket({
    type: 'request',
    summary: subject,
    body: text || `<p>Inbound email from ${from}</p>`,
    priority: 'medium',
    labels: 'email-inbound',
    due: null,
    requesterId: requester.id,
    assigneeId,
    siteId: site.id,
  });

  return NextResponse.json({
    ok: true,
    key: ticket.key,
    id: ticket.id,
  });
}
