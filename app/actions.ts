'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  addComment,
  addPageComment,
  assignIssue,
  completeSprint,
  createCalendarEvent,
  createEventType,
  createIssue,
  createPage,
  createSprint,
  deleteCalendarEvent,
  deleteEventType,
  getIssue,
  markAllNotificationsRead,
  markNotificationRead,
  saveIssueField,
  setIssueStatus,
  startSprint,
  toggleReaction,
  toggleWatch,
  updateCalendarEvent,
  updateEventType,
  updateIssue,
  updatePage,
} from '@/lib/db';
import { isIssueLinkType, linkIssues, unlinkIssues } from '@/lib/issueLinks';
import { toggleVote } from '@/lib/watchers';
import {
  importAttachmentsFromFiles,
  importAttachmentsFromJson,
  importAttachmentsFromZip,
  importIssuesFromCsv,
  importIssuesFromJson,
  importPagesFromJson,
  importUsersFromCsv,
  importUsersFromJson,
  type ImportCounts,
} from '@/lib/import';
import {
  assertCanCreateIssues,
  assertCanEditIssues,
  assertCanWriteIssues,
  assertCanWriteWiki,
} from '@/lib/acl';
import { writeAudit } from '@/lib/audit';
import { saveIssueCustomValuesFromForm, setIssueCustomValue } from '@/lib/customFields';
import {
  addWorklog,
  setOriginalEstimate,
  setRemainingEstimate,
} from '@/lib/timeTracking';
import { createBoard, deleteBoard, updateBoard, type BoardScope } from '@/lib/boards';
import type { CalendarScope, CalendarTypeScope, IssueStatus, IssueType, Priority } from '@/lib/types';
import { currentProject, requireUser } from '@/lib/session';
import {
  isoDate,
  markVersionReleased,
  setVersionReleaseDate,
  unmarkVersionReleased,
} from '@/lib/versions';
import { canWriteIssues } from '@/lib/acl';

function text(value: FormDataEntryValue | null, max = 4000): string {
  return String(value ?? '').trim().slice(0, max);
}

function optionalId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function nextPath(formData: FormData, fallback: string): string {
  const next = text(formData.get('next'), 200);
  return next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

function forbiddenMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  if (!error.message.startsWith('Forbidden')) return null;
  return error.message.replace(/^Forbidden:\s*/i, '').trim() || 'You cannot perform this action';
}

function assertEditOrRedirect(user: Parameters<typeof assertCanEditIssues>[0], projectKey: string, issueKey: string): void {
  try {
    assertCanEditIssues(user, projectKey);
  } catch (error) {
    const message = forbiddenMessage(error);
    if (message) {
      redirect(`/issues/${issueKey}?err=${encodeURIComponent(message)}`);
    }
    throw error;
  }
}

export async function switchProjectAction(formData: FormData): Promise<void> {
  const jar = await cookies();
  const project = text(formData.get('project'), 12).toUpperCase();
  if (project) jar.set('quetzal_project', project, { path: '/' });
  redirect(nextPath(formData, '/'));
}

async function assertReleaseWriter(): Promise<void> {
  const user = await requireUser();
  const project = await currentProject();
  const allowed = await canWriteIssues(user, project.key);
  if (!allowed) throw new Error('Forbidden: cannot change releases');
}

export async function startVersionReleaseAction(formData: FormData): Promise<void> {
  await assertReleaseWriter();
  const versionId = optionalId(formData.get('version'));
  if (!versionId) return;
  await setVersionReleaseDate(versionId, isoDate(new Date()));
  revalidatePath('/releases');
  redirect(nextPath(formData, '/releases'));
}

export async function markVersionReleasedAction(formData: FormData): Promise<void> {
  await assertReleaseWriter();
  const versionId = optionalId(formData.get('version'));
  if (!versionId) return;
  await markVersionReleased(versionId);
  revalidatePath('/releases');
  redirect(nextPath(formData, '/releases'));
}

export async function unmarkVersionReleasedAction(formData: FormData): Promise<void> {
  await assertReleaseWriter();
  const versionId = optionalId(formData.get('version'));
  if (!versionId) return;
  await unmarkVersionReleased(versionId);
  revalidatePath('/releases');
  redirect(nextPath(formData, '/releases'));
}

export async function switchSiteAction(formData: FormData): Promise<void> {
  const jar = await cookies();
  const { getSiteByKey, isSiteMember, SITE_COOKIE } = await import('@/lib/sites');
  const user = await requireUser();
  const key = text(formData.get('site'), 12).toUpperCase();
  const site = await getSiteByKey(key);
  if (site && await isSiteMember(site.id, user.id)) {
    jar.set(SITE_COOKIE, site.key, { path: '/' });
  }
  redirect(nextPath(formData, '/'));
}

export async function applyIssueFilters(formData: FormData): Promise<void> {
  const jar = await cookies();
  const project = text(formData.get('project'), 12).toUpperCase();
  if (project) jar.set('quetzal_project', project, { path: '/' });
  const params = new URLSearchParams();
  for (const key of ['who', 'type', 'status', 'assignee', 'q'] as const) {
    const value = text(formData.get(key), 80);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/issues?${query}` : '/issues');
}

export async function applyIssueJql(formData: FormData): Promise<void> {
  const jql = text(formData.get('jql'), 500);
  const params = new URLSearchParams();
  if (jql) params.set('jql', jql);
  const query = params.toString();
  redirect(query ? `/issues?${query}` : '/issues');
}

export async function saveSavedFilterAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const { upsertSavedFilter } = await import('@/lib/savedFilters');
  const name = text(formData.get('name'), 80);
  const jql = text(formData.get('jql'), 500);
  await upsertSavedFilter(user.id, name, jql);
  revalidatePath('/issues');
}

export async function deleteSavedFilterAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const { deleteSavedFilter } = await import('@/lib/savedFilters');
  const id = optionalId(formData.get('id'));
  if (id) await deleteSavedFilter(id, user.id);
  revalidatePath('/issues');
}

export async function setUserAction(formData: FormData): Promise<void> {
  const jar = await cookies();
  const id = optionalId(formData.get('user'));
  if (id) {
    jar.set('quetzal_uid', String(id), { path: '/' });
    jar.set('quetzal_auth', '1', { path: '/' });
  }
  redirect(nextPath(formData, '/'));
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = text(formData.get('email'), 120).toLowerCase();
  const password = text(formData.get('password'), 120);
  const jar = await cookies();
  const { authenticatePassword } = await import('@/lib/auth');
  const result = await authenticatePassword(email, password);

  if (!result.ok) {
    redirect('/login?error=1');
  }

  jar.set('quetzal_uid', String(result.user.id), { path: '/' });
  jar.set('quetzal_auth', '1', { path: '/' });
  await writeAudit({
    actorId: result.user.id,
    action: 'login',
    entityType: 'user',
    entityId: result.user.id,
    detail: result.via === 'ldap' ? 'ldap' : 'password',
  });
  redirect(nextPath(formData, '/'));
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete('quetzal_uid');
  jar.delete('quetzal_auth');
  redirect('/login');
}

export async function loginAsUserAction(formData: FormData): Promise<void> {
  const { quickLoginAllowed } = await import('@/lib/auth');
  if (!quickLoginAllowed()) redirect('/login?error=1');
  const jar = await cookies();
  const id = optionalId(formData.get('user'));
  if (!id) redirect('/login?error=1');
  jar.set('quetzal_uid', String(id), { path: '/' });
  jar.set('quetzal_auth', '1', { path: '/' });
  await writeAudit({
    actorId: id,
    action: 'login',
    entityType: 'user',
    entityId: id,
    detail: 'quick_demo',
  });
  redirect('/');
}

export async function createIssueAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectKey = text(formData.get('project'), 12).toUpperCase();
  assertCanCreateIssues(user, projectKey);
  const pointsRaw = text(formData.get('points'), 4);
  const issue = await createIssue({
    projectKey,
    type: text(formData.get('type'), 20) as IssueType,
    summary: text(formData.get('summary'), 180),
    description: text(formData.get('description'), 50000),
    priority: (text(formData.get('priority'), 20) || 'medium') as Priority,
    assigneeId: optionalId(formData.get('assignee')),
    reporterId: user.id,
    sprintId: optionalId(formData.get('sprint')),
    parentKey: text(formData.get('parent'), 20).toUpperCase() || null,
    points: pointsRaw ? Number(pointsRaw) : null,
    labels: text(formData.get('labels'), 200),
    dueOn: text(formData.get('due'), 10) || null,
  });
  await writeAudit({
    actorId: user.id,
    action: 'issue_create',
    entityType: 'issue',
    entityId: issue.key,
    detail: issue.summary.slice(0, 160),
  });
  await saveIssueCustomValuesFromForm(issue.id, issue.projectId, formData);
  redirect(`/issues/${issue.key}`);
}

export async function saveCustomFieldAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertEditOrRedirect(user, issue.projectKey, key);
  const fieldId = optionalId(formData.get('field_id'));
  if (!fieldId) return;
  await setIssueCustomValue(issue.id, fieldId, text(formData.get('value'), 2000));
  redirect(`/issues/${key}`);
}

export async function updateIssueAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertEditOrRedirect(user, issue.projectKey, key);
  await updateIssue(key, user.id, {
    summary: text(formData.get('summary'), 180),
    description: text(formData.get('description'), 50000),
    status: issue.status,
    priority: issue.priority,
    type: issue.type,
    assigneeId: issue.assigneeId,
    sprintId: issue.sprintId,
    points: issue.points,
    labels: issue.labels,
    dueOn: issue.dueOn,
  });
  redirect(`/issues/${key}`);
}

export async function saveFieldAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertEditOrRedirect(user, issue.projectKey, key);
  await saveIssueField(key, user.id, text(formData.get('field'), 20), text(formData.get('value'), 200));
  redirect(`/issues/${key}`);
}

export async function addWorklogAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertEditOrRedirect(user, issue.projectKey, key);
  const hours = Number(text(formData.get('hours'), 6));
  const minutes = Number(text(formData.get('minutes'), 6));
  const total = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  await addWorklog(key, user.id, total, text(formData.get('note'), 500));
  const tab = text(formData.get('tab'), 20);
  redirect(`/issues/${key}${tab === 'worklog' ? '?tab=worklog' : ''}`);
}

export async function setEstimateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertEditOrRedirect(user, issue.projectKey, key);
  const hours = Number(text(formData.get('hours'), 6));
  const minutes = Number(text(formData.get('minutes'), 6));
  const total = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  const blank = !text(formData.get('hours'), 6) && !text(formData.get('minutes'), 6);
  await setOriginalEstimate(key, user.id, blank ? null : total);
  redirect(`/issues/${key}`);
}

export async function setRemainingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertEditOrRedirect(user, issue.projectKey, key);
  const hours = Number(text(formData.get('hours'), 6));
  const minutes = Number(text(formData.get('minutes'), 6));
  const total = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  const blank = !text(formData.get('hours'), 6) && !text(formData.get('minutes'), 6);
  await setRemainingEstimate(key, user.id, blank ? null : total);
  redirect(`/issues/${key}`);
}

function actorId(): Promise<number> {
  return cookies().then((jar) => Number(jar.get('quetzal_uid')?.value) || 1);
}

export async function moveIssueAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return { ok: false, reason: 'Issue not found' };
  try {
    assertCanEditIssues(user, issue.projectKey);
  } catch (error) {
    const message = forbiddenMessage(error) ?? 'Forbidden';
    return { ok: false, reason: message };
  }
  const toStatus = text(formData.get('status'), 20) as IssueStatus;
  const fromBoard = text(formData.get('source'), 20) === 'board';
  const { canApplyBoardMove, canApplyTransition } = await import('@/lib/workflows');
  const from = issue.status;
  let steps: IssueStatus[] = [toStatus];

  if (fromBoard) {
    const gate = await canApplyBoardMove(issue, toStatus);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    steps = gate.path ?? [toStatus];
  } else {
    const gate = await canApplyTransition(issue, toStatus);
    if (!gate.ok) {
      redirect(`/issues/${key}?wf=${encodeURIComponent(gate.reason)}`);
    }
  }

  let current = from;
  for (const step of steps) {
    if (!(await setIssueStatus(key, step, user.id))) {
      return { ok: false, reason: `Could not move to ${step}` };
    }
    current = step;
  }
  await writeAudit({
    actorId: user.id,
    action: 'issue_status',
    entityType: 'issue',
    entityId: key,
    detail: steps.length > 1 ? `${from}→${steps.join('→')}` : `${from}→${current}`,
  });
  revalidatePath('/board');
  revalidatePath('/backlog');
  revalidatePath('/issues');
  const next = nextPath(formData, '/board');
  if (next !== '/board') revalidatePath(next);
  return { ok: true };
}

export async function createBoardAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await currentProject();
  const name = text(formData.get('name'), 80);
  const description = text(formData.get('description'), 240);
  const jql = text(formData.get('jql'), 500);
  const scopeRaw = text(formData.get('scope'), 20);
  const scope: BoardScope = scopeRaw === 'project' ? 'project' : 'personal';
  const board = await createBoard({
    name,
    description,
    jql,
    scope,
    ownerUserId: user.id,
    projectId: scope === 'project' ? project.id : null,
  });
  await writeAudit({
    actorId: user.id,
    action: 'board_create',
    entityType: 'board',
    entityId: String(board.id),
    detail: `${scope}:${board.name}`,
  });
  revalidatePath('/board');
  redirect(`/board/${board.id}`);
}

export async function updateBoardAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = optionalId(formData.get('id'));
  if (!id) return;
  const board = await updateBoard(id, user.id, {
    name: text(formData.get('name'), 80) || undefined,
    description: text(formData.get('description'), 240),
    jql: text(formData.get('jql'), 500),
  });
  if (!board) return;
  revalidatePath('/board');
  revalidatePath(`/board/${id}`);
  redirect(nextPath(formData, `/board/${id}`));
}

export async function deleteBoardAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = optionalId(formData.get('id'));
  if (!id) return;
  await deleteBoard(id, user.id);
  revalidatePath('/board');
  redirect('/board');
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertEditOrRedirect(user, issue.projectKey, key);
  const next = text(formData.get('status'), 20) as IssueStatus;
  const { canApplyTransition } = await import('@/lib/workflows');
  const gate = await canApplyTransition(issue, next);
  if (!gate.ok) {
    redirect(`/issues/${key}?wf=${encodeURIComponent(gate.reason)}`);
  }
  const from = issue.status;
  if (await setIssueStatus(key, next, user.id)) {
    await writeAudit({
      actorId: user.id,
      action: 'issue_status',
      entityType: 'issue',
      entityId: key,
      detail: `${from}→${next}`,
    });
  }
  redirect(nextPath(formData, `/issues/${key}`));
}

export async function assignMeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertEditOrRedirect(user, issue.projectKey, key);
  await assignIssue(key, user.id, user.id);
  redirect(`/issues/${key}`);
}

export async function startSprintAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertCanWriteIssues(user);
  await startSprint(Number(formData.get('sprint')));
  const project = text(formData.get('project'), 12);
  redirect(project ? `/backlog?project=${project}` : '/backlog');
}

export async function completeSprintAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertCanWriteIssues(user);
  await completeSprint(Number(formData.get('sprint')));
  const project = text(formData.get('project'), 12);
  redirect(project ? `/backlog?project=${project}` : '/backlog');
}

export async function createSprintAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertCanWriteIssues(user);
  const key = text(formData.get('key'), 20).toUpperCase();
  const name = text(formData.get('name'), 80);
  const issue = await getIssue(key);
  if (issue && name) {
    const sprint = await createSprint(issue.projectId, name);
    if (sprint && sprint.projectId === issue.projectId) {
      await saveIssueField(key, user.id, 'sprint', String(sprint.id));
    }
  }
  redirect(key ? `/issues/${key}` : '/issues');
}

export async function toggleReactionAction(formData: FormData): Promise<void> {
  const key = text(formData.get('key'), 20).toUpperCase();
  const kind = text(formData.get('kind'), 12) === 'comment' ? 'comment' : 'issue';
  const targetId = optionalId(formData.get('target'));
  const tab = text(formData.get('tab'), 20);
  if (kind === 'issue') {
    const issue = await getIssue(key);
    if (issue) await toggleReaction('issue', issue.id, await actorId(), text(formData.get('emoji'), 16));
  } else if (targetId) {
    await toggleReaction('comment', targetId, await actorId(), text(formData.get('emoji'), 16));
  }
  const query = tab === 'comments' || tab === 'history' || tab === 'worklog' ? `?tab=${tab}` : '';
  redirect(key ? `/issues/${key}${query}` : '/issues');
}

export async function toggleWatchAction(formData: FormData): Promise<void> {
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (issue) await toggleWatch(issue.id, await actorId());
  revalidatePath('/');
  revalidatePath('/overview');
  redirect(key ? `/issues/${key}` : '/issues');
}

export async function toggleVoteAction(formData: FormData): Promise<void> {
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (issue) await toggleVote(issue.id, await actorId());
  revalidatePath(`/issues/${key}`);
  redirect(key ? `/issues/${key}` : '/issues');
}

export async function addIssueLinkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const other = text(formData.get('other'), 20).toUpperCase();
  const typeRaw = text(formData.get('type'), 20);
  const issue = await getIssue(key);
  if (!issue || !other || !isIssueLinkType(typeRaw)) {
    redirect(key ? `/issues/${key}` : '/issues');
    return;
  }
  assertEditOrRedirect(user, issue.projectKey, key);
  linkIssues(key, other, typeRaw);
  revalidatePath(`/issues/${key}`);
  revalidatePath(`/issues/${other}`);
  revalidatePath('/roadmap');
  redirect(`/issues/${key}`);
}

export async function removeIssueLinkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const from = text(formData.get('from'), 20).toUpperCase();
  const to = text(formData.get('to'), 20).toUpperCase();
  const typeRaw = text(formData.get('type'), 20);
  const issue = await getIssue(key);
  if (!issue || !from || !to || !isIssueLinkType(typeRaw)) {
    redirect(key ? `/issues/${key}` : '/issues');
    return;
  }
  assertEditOrRedirect(user, issue.projectKey, key);
  unlinkIssues(from, to, typeRaw);
  revalidatePath(`/issues/${key}`);
  revalidatePath(`/issues/${from}`);
  revalidatePath(`/issues/${to}`);
  revalidatePath('/roadmap');
  redirect(`/issues/${key}`);
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const jar = await cookies();
  const key = text(formData.get('key'), 20).toUpperCase();
  const authorId = Number(jar.get('quetzal_uid')?.value) || 1;
  const body = text(formData.get('body'), 8000);
  await addComment(key, authorId, body, optionalId(formData.get('parent')));
  const postGithub =
    formData.get('post_to_github') === 'on' || formData.get('post_to_github') === '1';
  if (postGithub && body) {
    try {
      const { postGithubComment } = await import('@/lib/githubOutbound');
      const plain = body
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim();
      const result = await postGithubComment(key, plain || body);
      if (!result.ok) console.warn('[github outbound]', result.reason);
    } catch (err) {
      console.error('[github outbound]', err);
    }
  }
  revalidatePath('/');
  revalidatePath('/notifications');
  const tab = text(formData.get('tab'), 20);
  const query = tab === 'comments' || tab === 'history' || tab === 'worklog' ? `?tab=${tab}` : '';
  redirect(`/issues/${key}${query}`);
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const id = optionalId(formData.get('id'));
  const href = text(formData.get('href'), 200);
  const next = text(formData.get('next'), 200);
  if (id) await markNotificationRead(id, await actorId());
  revalidatePath('/');
  revalidatePath('/notifications');
  const target = href.startsWith('/') && !href.startsWith('//') ? href : nextPath(formData, '/notifications');
  if (next.startsWith('/') && !next.startsWith('//') && next === '/notifications') {
    redirect('/notifications');
  }
  redirect(target);
}

export async function markAllNotificationsReadAction(formData: FormData): Promise<void> {
  await markAllNotificationsRead(await actorId());
  revalidatePath('/');
  revalidatePath('/notifications');
  redirect(nextPath(formData, '/notifications'));
}

export async function createPageAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const space = text(formData.get('space'), 12).toUpperCase();
  assertCanWriteWiki(user, space);
  const { parseLabelsInput, setPageLabels } = await import('@/lib/wikiExtras');
  const page = await createPage({
    spaceKey: space,
    parentId: optionalId(formData.get('parent')),
    title: text(formData.get('title'), 160),
    body: text(formData.get('body'), 20000),
    authorId: user.id,
  });
  const labels = await parseLabelsInput(text(formData.get('labels'), 400));
  if (labels.length) await setPageLabels(page.id, labels);
  await writeAudit({
    actorId: user.id,
    action: 'wiki_create',
    entityType: 'page',
    entityId: `${page.spaceKey}/${page.slug}`,
    detail: page.title.slice(0, 160),
  });
  redirect(`/wiki/${page.spaceKey}/${page.slug}`);
}

export async function updatePageAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const space = text(formData.get('space'), 12).toUpperCase();
  assertCanWriteWiki(user, space);
  const slug = text(formData.get('slug'), 80);
  const title = text(formData.get('title'), 160);
  const { parseLabelsInput, parsePropertiesInput } = await import('@/lib/wikiExtras');
  await updatePage(space, slug, title, text(formData.get('body'), 100000), {
    authorId: user.id,
    labels: await parseLabelsInput(text(formData.get('labels'), 400)),
    properties: await parsePropertiesInput(text(formData.get('properties'), 4000)),
  });
  await writeAudit({
    actorId: user.id,
    action: 'wiki_save',
    entityType: 'page',
    entityId: `${space}/${slug}`,
    detail: title.slice(0, 160),
  });
  redirect(`/wiki/${space}/${slug}`);
}

export async function addPageCommentAction(formData: FormData): Promise<void> {
  const jar = await cookies();
  const space = text(formData.get('space'), 12).toUpperCase();
  const slug = text(formData.get('slug'), 80);
  await addPageComment(space, slug, Number(jar.get('quetzal_uid')?.value) || 1, text(formData.get('body'), 8000));
  redirect(`/wiki/${space}/${slug}`);
}

function calendarReturn(formData: FormData): string {
  return nextPath(formData, '/calendar');
}

export async function saveCalendarEventAction(formData: FormData): Promise<void> {
  const me = await actorId();
  const project = await currentProject();
  const scope = text(formData.get('scope'), 12) === 'project' ? 'project' : 'personal';
  const id = optionalId(formData.get('id'));
  const attendeeIds = formData
    .getAll('invitee')
    .map((value) => optionalId(value))
    .filter((value): value is number => value != null);
  const payload = {
    title: text(formData.get('title'), 160),
    notes: text(formData.get('notes'), 2000),
    typeId: optionalId(formData.get('type')) ?? 0,
    startsOn: text(formData.get('starts_on'), 10),
    endsOn: text(formData.get('ends_on'), 10) || text(formData.get('starts_on'), 10),
    startTime: text(formData.get('start_time'), 5) || null,
    endTime: text(formData.get('end_time'), 5) || null,
    attendeeIds,
  };
  if (id) {
    await updateCalendarEvent(id, me, payload);
  } else {
    await createCalendarEvent({
      ...payload,
      scope: scope as CalendarScope,
      userId: me,
      projectId: project.id,
    });
  }
  revalidatePath('/calendar');
  revalidatePath('/');
  redirect(calendarReturn(formData));
}

export async function deleteCalendarEventAction(formData: FormData): Promise<void> {
  const id = optionalId(formData.get('id'));
  if (id) await deleteCalendarEvent(id, await actorId());
  revalidatePath('/calendar');
  revalidatePath('/');
  redirect(calendarReturn(formData));
}

export async function createEventTypeAction(formData: FormData): Promise<void> {
  const me = await actorId();
  const project = await currentProject();
  const scopeRaw = text(formData.get('scope'), 12);
  const scope: CalendarTypeScope =
    scopeRaw === 'personal' || scopeRaw === 'project' ? scopeRaw : 'both';
  await createEventType({
    name: text(formData.get('name'), 40),
    color: text(formData.get('color'), 7) || '#005eb8',
    scope,
    userId: me,
    projectId: project.id,
  });
  revalidatePath('/calendar');
  redirect(calendarReturn(formData));
}

export async function updateEventTypeAction(formData: FormData): Promise<void> {
  const id = optionalId(formData.get('id'));
  if (id) {
    await updateEventType(id, await actorId(), {
      name: text(formData.get('name'), 40),
      color: text(formData.get('color'), 7),
    });
  }
  revalidatePath('/calendar');
  redirect(calendarReturn(formData));
}

export async function deleteEventTypeAction(formData: FormData): Promise<void> {
  const id = optionalId(formData.get('id'));
  if (id) await deleteEventType(id, await actorId());
  revalidatePath('/calendar');
  redirect(calendarReturn(formData));
}

function importRedirect(
  kind: 'issues' | 'pages' | 'users' | 'attachments',
  counts: ImportCounts,
): never {
  const params = new URLSearchParams({
    kind,
    created: String(counts.created),
    skipped: String(counts.skipped),
    errors: String(counts.errors),
  });
  if (counts.messages.length) {
    params.set('detail', counts.messages.slice(0, 12).join(' · ').slice(0, 800));
  }
  revalidatePath('/issues');
  revalidatePath('/board');
  revalidatePath('/backlog');
  revalidatePath('/wiki');
  revalidatePath('/import');
  redirect(`/import?${params.toString()}`);
}

async function readImportPayload(formData: FormData): Promise<string> {
  const pasted = text(formData.get('payload'), 2_000_000);
  if (pasted) return pasted;
  const file = formData.get('file');
  if (file && typeof file !== 'string' && 'text' in file) {
    const blob = file as File;
    if (blob.size > 0) return (await blob.text()).slice(0, 2_000_000);
  }
  return '';
}

export async function importIssuesAction(formData: FormData): Promise<void> {
  const reporterId = await actorId();
  const format = text(formData.get('format'), 8).toLowerCase() || 'json';
  const defaultProject = text(formData.get('project'), 12).toUpperCase();
  const raw = await readImportPayload(formData);
  if (!raw) {
    importRedirect('issues', {
      created: 0,
      skipped: 0,
      errors: 1,
      messages: ['No JSON/CSV payload provided'],
    });
  }
  const counts =
    format === 'csv'
      ? await importIssuesFromCsv(raw, reporterId, defaultProject)
      : await importIssuesFromJson(raw, reporterId, defaultProject);
  importRedirect('issues', counts);
}

export async function importPagesAction(formData: FormData): Promise<void> {
  const authorId = await actorId();
  const defaultSpace = text(formData.get('space'), 12).toUpperCase();
  const raw = await readImportPayload(formData);
  if (!raw) {
    importRedirect('pages', {
      created: 0,
      skipped: 0,
      errors: 1,
      messages: ['No JSON payload provided'],
    });
  }
  const counts = await importPagesFromJson(raw, authorId, defaultSpace);
  importRedirect('pages', counts);
}

export async function importUsersAction(formData: FormData): Promise<void> {
  const format = text(formData.get('format'), 8).toLowerCase() || 'json';
  const raw = await readImportPayload(formData);
  if (!raw) {
    importRedirect('users', {
      created: 0,
      skipped: 0,
      errors: 1,
      messages: ['No JSON/CSV payload provided'],
    });
  }
  const counts =
    format === 'csv' ? await importUsersFromCsv(raw) : await importUsersFromJson(raw);
  importRedirect('users', counts);
}

export async function importAttachmentsAction(formData: FormData): Promise<void> {
  const uploadedBy = await actorId();
  const defaultSpace = text(formData.get('space'), 12).toUpperCase();
  const slug = text(formData.get('slug'), 80).toLowerCase();
  const mode = text(formData.get('mode'), 12).toLowerCase() || 'json';

  if (mode === 'json') {
    const raw = await readImportPayload(formData);
    if (!raw) {
      importRedirect('attachments', {
        created: 0,
        skipped: 0,
        errors: 1,
        messages: ['No JSON payload provided'],
      });
    }
    importRedirect('attachments', await importAttachmentsFromJson(raw, uploadedBy, defaultSpace));
  }

  const files = formData.getAll('files').filter((f): f is File => typeof f !== 'string' && 'arrayBuffer' in f);
  const single = formData.get('file');
  if (single && typeof single !== 'string' && 'arrayBuffer' in single && (single as File).size > 0) {
    files.push(single as File);
  }

  if (files.length === 0) {
    importRedirect('attachments', {
      created: 0,
      skipped: 0,
      errors: 1,
      messages: ['No files provided'],
    });
  }

  if (!defaultSpace || !slug) {
    importRedirect('attachments', {
      created: 0,
      skipped: 0,
      errors: 1,
      messages: ['Space and page slug are required for file/ZIP upload'],
    });
  }

  const onlyZip =
    files.length === 1 &&
    (files[0].name.toLowerCase().endsWith('.zip') || files[0].type === 'application/zip');

  if (onlyZip) {
    const bytes = Buffer.from(await files[0].arrayBuffer());
    importRedirect(
      'attachments',
      await importAttachmentsFromZip(bytes, defaultSpace, slug, uploadedBy),
    );
  }

  const inputs = [];
  for (const file of files) {
    if (file.size <= 0) continue;
    inputs.push({
      spaceKey: defaultSpace,
      slug,
      filename: file.name || 'file',
      mime: file.type || undefined,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  }
  importRedirect('attachments', await importAttachmentsFromFiles(inputs, uploadedBy));
}
