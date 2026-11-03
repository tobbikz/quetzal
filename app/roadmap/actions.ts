'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { assertCanEditIssues } from '@/lib/acl';
import { getIssue, setIssueSchedule } from '@/lib/db';
import { linkBlocks, unlinkBlocks } from '@/lib/issueLinks';
import { CAPACITY_COOKIE, parseCapacity } from '@/lib/roadmapCapacity';
import { requireUser } from '@/lib/session';

function text(value: FormDataEntryValue | null, max = 4000): string {
  return String(value ?? '').trim().slice(0, max);
}

function dayOrNull(raw: string): string | null {
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export async function updateRoadmapScheduleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const key = text(formData.get('key'), 20).toUpperCase();
  const issue = await getIssue(key);
  if (!issue) return;
  assertCanEditIssues(user, issue.projectKey);
  const startRaw = text(formData.get('start'), 10);
  const dueRaw = text(formData.get('due'), 10);
  const hasStart = formData.has('start');
  const hasDue = formData.has('due');
  await setIssueSchedule(key, user.id, {
    startOn: hasStart ? dayOrNull(startRaw) : undefined,
    dueOn: hasDue ? dayOrNull(dueRaw) : undefined,
  });
  revalidatePath('/roadmap');
  revalidatePath(`/issues/${key}`);
  revalidatePath('/board');
  revalidatePath('/backlog');
}

export async function setRoadmapCapacityAction(formData: FormData): Promise<void> {
  await requireUser();
  const pts = parseCapacity(text(formData.get('capacity'), 6));
  const jar = await cookies();
  jar.set(CAPACITY_COOKIE, String(pts), {
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/roadmap');
}

export async function addBlockLinkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const fromKey = text(formData.get('from'), 20).toUpperCase();
  const toKey = text(formData.get('to'), 20).toUpperCase();
  const from = await getIssue(fromKey);
  if (!from) return;
  assertCanEditIssues(user, from.projectKey);
  linkBlocks(fromKey, toKey);
  revalidatePath('/roadmap');
}

export async function removeBlockLinkAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const fromKey = text(formData.get('from'), 20).toUpperCase();
  const toKey = text(formData.get('to'), 20).toUpperCase();
  const from = await getIssue(fromKey);
  if (!from) return;
  assertCanEditIssues(user, from.projectKey);
  unlinkBlocks(fromKey, toKey);
  revalidatePath('/roadmap');
}
