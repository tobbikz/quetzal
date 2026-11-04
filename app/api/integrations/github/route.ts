import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getConnectors } from '@/lib/connectors';
import { processGithubWebhook } from '@/lib/githubSync';

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
 * GitHub webhook receiver — verifies signature when secret is set,
 * then syncs issues / PRs / comments into Quetzal Work.
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

  const event = request.headers.get('x-github-event') ?? 'unknown';
  const delivery = request.headers.get('x-github-delivery') ?? '';

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    const result = await processGithubWebhook(event, payload);
    console.log('[github-webhook]', { event, delivery, action: payload.action, result });
    return NextResponse.json({
      ok: true,
      received: true,
      event,
      delivery,
      sync: result,
    });
  } catch (err) {
    console.error('[github-webhook] sync failed', err);
    return NextResponse.json(
      { error: 'sync failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
