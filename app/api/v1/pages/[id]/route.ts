import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/apiAuth';
import { toApiPage } from '@/lib/apiV1';
import { getPageById } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/v1/pages/:id — wiki page by numeric id */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth(_request);
  if (denied) return denied;

  const { id } = await params;
  const pageId = Number(id);
  if (!Number.isInteger(pageId) || pageId <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const page = await getPageById(pageId);
  if (!page) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(toApiPage(page));
}
