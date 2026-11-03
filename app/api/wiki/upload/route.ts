import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPage } from '@/lib/db';
import { UPLOADS_DIR, addPageAttachment } from '@/lib/wikiExtras';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const form = await request.formData();
  const space = String(form.get('space') || '').toUpperCase();
  const slug = String(form.get('slug') || '');
  const file = form.get('file');
  if (!space || !slug || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file/space/slug' }, { status: 400 });
  }
  const page = await getPage(space, slug);
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const jar = await cookies();
  const userId = Number(jar.get('quetzal_uid')?.value) || 1;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > 8_000_000) {
    return NextResponse.json({ error: 'File too large (8MB max)' }, { status: 400 });
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file';
  const stored = `${page.id}-${Date.now().toString(36)}-${safe}`;
  mkdirSync(UPLOADS_DIR, { recursive: true });
  writeFileSync(join(UPLOADS_DIR, stored), bytes);

  const attachment = await addPageAttachment({
    pageId: page.id,
    filename: file.name || safe,
    storedName: stored,
    mime: file.type || 'application/octet-stream',
    size: bytes.length,
    uploadedBy: userId,
  });

  return NextResponse.json({ ok: true, attachment });
}
