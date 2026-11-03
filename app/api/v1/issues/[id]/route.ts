import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/apiAuth';
import { toApiIssue } from '@/lib/apiV1';
import { getIssue, getIssueById } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function resolveIssue(idOrKey: string) {
  const raw = idOrKey.trim();
  if (/^\d+$/.test(raw)) {
    return await getIssueById(Number(raw));
  }
  return await getIssue(raw.toUpperCase());
}

/** GET /api/v1/issues/:id — numeric id or KEY (e.g. OPS-1) */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth(_request);
  if (denied) return denied;

  const { id } = await params;
  const issue = await resolveIssue(id);
  if (!issue) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(toApiIssue(issue));
}
