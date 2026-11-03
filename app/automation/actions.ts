'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertCanManageAutomation } from '@/lib/acl';
import {
  AUTOMATION_TRIGGERS,
  createAutomationRule,
  setAutomationRuleEnabled,
  type AutomationAction,
  type AutomationConditions,
  type AutomationTrigger,
} from '@/lib/automation';
import { STATUSES } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { IssueStatus } from '@/lib/types';

function text(value: FormDataEntryValue | null, max = 4000): string {
  return String(value ?? '').trim().slice(0, max);
}

function optionalId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function statusOrEmpty(raw: string): string {
  return STATUSES.includes(raw as IssueStatus) ? raw : '';
}

function parseTrigger(raw: string): AutomationTrigger {
  return (AUTOMATION_TRIGGERS as readonly string[]).includes(raw)
    ? (raw as AutomationTrigger)
    : 'status_changed';
}

export async function createAutomationRuleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertCanManageAutomation(user);

  const name = text(formData.get('name'), 120);
  const triggerEvent = parseTrigger(text(formData.get('trigger_event'), 40));
  const fromStatus = statusOrEmpty(text(formData.get('from_status'), 40));
  const toStatus = statusOrEmpty(text(formData.get('to_status'), 40));
  const statusFilter = statusOrEmpty(text(formData.get('status'), 40));
  const withinRaw = text(formData.get('within_days'), 10);
  const actionType = text(formData.get('action_type'), 40);
  const actionUserId = optionalId(formData.get('action_user_id'));
  const actionBody = text(formData.get('action_body'), 2000);
  const actionTitle = text(formData.get('action_title'), 200);

  const conditions: AutomationConditions = {};
  if (triggerEvent === 'status_changed') {
    if (fromStatus) conditions.from_status = fromStatus;
    if (toStatus) conditions.to_status = toStatus;
  } else if (statusFilter) {
    conditions.status = statusFilter;
  }
  if (triggerEvent === 'due_approaching') {
    const within = Number(withinRaw);
    conditions.within_days = Number.isFinite(within) && within > 0 ? Math.min(Math.floor(within), 90) : 3;
  }

  let actions: AutomationAction[] = [];
  if (actionType === 'notify_user') {
    if (!actionUserId) throw new Error('notify_user needs a user');
    actions = [
      {
        type: 'notify_user',
        user_id: actionUserId,
        title: actionTitle || undefined,
        body: actionBody || undefined,
      },
    ];
  } else if (actionType === 'set_assignee') {
    actions = [{ type: 'set_assignee', user_id: actionUserId }];
  } else if (actionType === 'add_comment') {
    if (!actionBody) throw new Error('add_comment needs a body');
    actions = [{ type: 'add_comment', body: actionBody }];
  } else {
    throw new Error('Unknown action type');
  }

  await createAutomationRule({
    name,
    triggerEvent,
    conditions,
    actions,
  });

  revalidatePath('/automation');
  redirect('/automation');
}

export async function toggleAutomationRuleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertCanManageAutomation(user);
  const id = Number(text(formData.get('id'), 20));
  const enabled = text(formData.get('enabled'), 10) === '1';
  await setAutomationRuleEnabled(id, enabled);
  revalidatePath('/automation');
  redirect('/automation');
}
