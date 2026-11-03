import { NextResponse } from 'next/server';
import { suggestJql } from '@/lib/jql';

export const dynamic = 'force-dynamic';

/** Autocomplete field names / operators / values for the JQL bar. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const cursorRaw = url.searchParams.get('cursor');
  const cursor = cursorRaw != null && cursorRaw !== '' ? Number(cursorRaw) : q.length;
  const suggestions = await suggestJql(q, Number.isFinite(cursor) ? cursor : q.length);
  return NextResponse.json({ suggestions });
}
