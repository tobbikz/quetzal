import { NextResponse } from 'next/server';
import { getIssue } from '@/lib/db';
import { toIssuePreview } from '@/lib/preview';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const issue = await getIssue(key.toUpperCase());
  if (!issue) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(await toIssuePreview(issue));
}
