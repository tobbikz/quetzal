import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getConnectors } from '@/lib/connectors';

export const runtime = 'nodejs';

function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * GitHub webhook receiver stub — verifies signature when secret is set,
 * acknowledges delivery. Payload routing to Quetzal issues is a follow-up.
 */
export async function POST(request: Request) {
  const connectors = await getConnectors();
  if (!connectors.githubEnabled) {
    return NextResponse.json({ error: 'github connector disabled' }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (connectors.githubWebhookSecret) {
    if (!verifySignature(connectors.githubWebhookSecret, raw, signature)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  }

  let event = request.headers.get('x-github-event') ?? 'unknown';
  let delivery = request.headers.get('x-github-delivery') ?? '';
  let action: string | undefined;
  try {
    const parsed = JSON.parse(raw) as { action?: string };
    action = parsed.action;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  console.log('[github-webhook]', { event, delivery, action });
  return NextResponse.json({
    ok: true,
    received: true,
    event,
    delivery,
    action: action ?? null,
    note: 'Acknowledged — issue/PR sync not wired yet',
  });
}
