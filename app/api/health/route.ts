import { NextResponse } from 'next/server';
import { log } from '@/lib/log';
import { pingDb } from '@/lib/pg';

export const dynamic = 'force-dynamic';

/** Liveness + Postgres ping (`QUETZAL_DATABASE_URL`, schema `quetzal`). */
export async function GET() {
  const db = await pingDb();
  const ok = db.ok;
  const body = {
    status: ok ? 'ok' : 'degraded',
    service: 'quetzal',
    time: new Date().toISOString(),
    db: {
      ok: db.ok,
      latencyMs: db.latencyMs,
      ...(db.error ? { error: db.error } : {}),
    },
  };

  log.info('health.check', {
    status: body.status,
    dbOk: db.ok,
    latencyMs: db.latencyMs,
  });

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
