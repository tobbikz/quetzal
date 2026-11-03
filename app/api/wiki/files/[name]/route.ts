import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { UPLOADS_DIR, getPageAttachmentByStoredName } from '@/lib/wikiExtras';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name: raw } = await context.params;
  const name = decodeURIComponent(raw || '');
  const attachment = await getPageAttachmentByStoredName(name);
  if (!attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const path = join(UPLOADS_DIR, attachment.storedName);
  if (!existsSync(path)) {
    return NextResponse.json({ error: 'File missing' }, { status: 404 });
  }

  const bytes = readFileSync(path);
  const safeName = attachment.filename.replace(/"/g, '');
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': attachment.mime || 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
