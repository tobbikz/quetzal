import { readFileSync, unlinkSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { copyDbForDownload, exportCoreTablesJson, writeAudit } from '@/lib/audit';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await currentUser();
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'json').toLowerCase();

  if (format === 'db') {
    let copy: { path: string; filename: string } | null = null;
    try {
      copy = await copyDbForDownload();
      const bytes = readFileSync(copy.path);
      await writeAudit({
        actorId: user.id,
        action: 'backup_export',
        entityType: 'database',
        entityId: 'quetzal.db',
        detail: `format=db bytes=${bytes.byteLength}`,
      });
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${copy.filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      console.error('[admin/backup] db export failed', err);
      return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    } finally {
      if (copy) {
        try {
          unlinkSync(copy.path);
        } catch {
          /* leave orphan for manual cleanup */
        }
      }
    }
  }

  const json = await exportCoreTablesJson();
  await writeAudit({
    actorId: user.id,
    action: 'backup_export',
    entityType: 'database',
    entityId: 'core-tables',
    detail: `format=json bytes=${Buffer.byteLength(json, 'utf8')}`,
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="quetzal-export-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
