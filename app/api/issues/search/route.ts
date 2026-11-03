import { NextResponse } from 'next/server';
import { searchIssuesByKeyPrefix } from '@/lib/db';
import { toIssuePreview } from '@/lib/preview';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json([]);
  const issues = (await searchIssuesByKeyPrefix(q, 8)).map(toIssuePreview);
  return NextResponse.json(issues);
}
