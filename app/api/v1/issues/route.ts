import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/apiAuth';
import { labelsToCsv, parseIssueType, parsePriority, toApiIssue } from '@/lib/apiV1';
import { createIssue, getUser, listIssues, listUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function defaultReporterId(): Promise<number> {
  const admin = (await listUsers()).find((user) => user.role === 'admin');
  return admin?.id ?? (await listUsers())[0]?.id ?? 1;
}

/** GET /api/v1/issues?project=OPS&status=todo&type=bug&q=…&limit=50 */
export async function GET(request: Request) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const project = url.searchParams.get('project')?.trim() || undefined;
  const status = url.searchParams.get('status')?.trim() || undefined;
  const type = url.searchParams.get('type')?.trim() || undefined;
  const q = url.searchParams.get('q')?.trim() || undefined;
  const label = url.searchParams.get('label')?.trim() || undefined;
  const limitRaw = Number(url.searchParams.get('limit') ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;

  const issues = (await listIssues({
    projectKey: project,
    status,
    type,
    q,
    label,
  })).slice(0, limit);

  return NextResponse.json({
    issues: issues.map(toApiIssue),
    count: issues.length,
  });
}

/**
 * POST /api/v1/issues
 * Body JSON: { projectKey|project, summary, description?, type?, priority?, assigneeId?, reporterId?, labels?, dueOn? }
 */
export async function POST(request: Request) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const projectKey = String(body.projectKey ?? body.project ?? '')
    .trim()
    .toUpperCase();
  const summary = String(body.summary ?? '').trim();
  if (!projectKey) {
    return NextResponse.json({ error: 'project_required', hint: 'Provide projectKey' }, { status: 400 });
  }
  if (!summary) {
    return NextResponse.json({ error: 'summary_required' }, { status: 400 });
  }

  const type = parseIssueType(body.type, 'task');
  if (!type) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  const priority = parsePriority(body.priority, 'medium');
  if (!priority) {
    return NextResponse.json({ error: 'invalid_priority' }, { status: 400 });
  }

  let reporterId = await defaultReporterId();
  if (body.reporterId != null) {
    const id = Number(body.reporterId);
    if (!Number.isInteger(id) || !await getUser(id)) {
      return NextResponse.json({ error: 'invalid_reporterId' }, { status: 400 });
    }
    reporterId = id;
  }

  let assigneeId: number | null = null;
  if (body.assigneeId != null && body.assigneeId !== '') {
    const id = Number(body.assigneeId);
    if (!Number.isInteger(id) || !await getUser(id)) {
      return NextResponse.json({ error: 'invalid_assigneeId' }, { status: 400 });
    }
    assigneeId = id;
  }

  try {
    const created = await createIssue({
      projectKey,
      type,
      summary: summary.slice(0, 400),
      description: String(body.description ?? '').slice(0, 20000),
      priority,
      assigneeId,
      reporterId,
      sprintId: null,
      parentKey: body.parentKey ? String(body.parentKey).toUpperCase() : null,
      points:
        body.points == null || body.points === ''
          ? null
          : Number.isFinite(Number(body.points))
            ? Number(body.points)
            : null,
      labels: labelsToCsv(body.labels),
      dueOn: body.dueOn ? String(body.dueOn).slice(0, 10) : null,
    });
    return NextResponse.json(toApiIssue(created), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed';
    const status = /unknown project/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
