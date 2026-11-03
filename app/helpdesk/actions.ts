'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertCanWriteIssues } from '@/lib/acl';
import {
  addHelpdeskNote,
  assignHelpdeskTicket,
  createHelpdeskTicket,
  getHelpdeskTicket,
  HELPDESK_TYPES,
  setHelpdeskStatus,
  type HelpdeskPriority,
  type HelpdeskStatus,
  type HelpdeskType,
} from '@/lib/helpdesk';
import { currentSite, requireUser } from '@/lib/session';

async function requireTicketOnCurrentSite(key: string) {
  const site = await currentSite();
  const ticket = await getHelpdeskTicket(key);
  if (!ticket || ticket.siteId !== site.id) return null;
  return ticket;
}

function text(value: FormDataEntryValue | null, max = 4000): string {
  return String(value ?? '').trim().slice(0, max);
}

function optionalId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseType(raw: string): HelpdeskType {
  return HELPDESK_TYPES.includes(raw as HelpdeskType) ? (raw as HelpdeskType) : 'request';
}

export async function applyHelpdeskFilters(formData: FormData): Promise<void> {
  const params = new URLSearchParams();
  for (const key of ['status', 'type', 'priority', 'queue', 'q'] as const) {
    const value = text(formData.get(key), 80);
    if (value) params.set(key, value);
  }
  // Exact priority wins over queue bucket.
  if (params.has('priority')) params.delete('queue');
  const query = params.toString();
  redirect(query ? `/helpdesk?${query}` : '/helpdesk');
}

export async function createHelpdeskTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertCanWriteIssues(user);
  const site = await currentSite();
  const ticket = await createHelpdeskTicket({
    type: parseType(text(formData.get('type'), 20)),
    summary: text(formData.get('summary'), 180),
    body: text(formData.get('body'), 50000),
    priority: text(formData.get('priority'), 20) as HelpdeskPriority,
    labels: text(formData.get('labels'), 200),
    due: text(formData.get('due'), 32) || null,
    requesterId: user.id,
    assigneeId: optionalId(formData.get('assignee')),
    siteId: site.id,
  });
  redirect(`/helpdesk/${ticket.key}`);
}

export async function updateHelpdeskStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertCanWriteIssues(user);
  const key = text(formData.get('key'), 20).toUpperCase();
  const ticket = await requireTicketOnCurrentSite(key);
  if (!ticket) redirect('/helpdesk');
  const status = text(formData.get('status'), 20) as HelpdeskStatus;
  await setHelpdeskStatus(key, status);
  const assignee = formData.get('assignee');
  if (assignee !== null) {
    await assignHelpdeskTicket(key, optionalId(assignee));
  }
  revalidatePath(`/helpdesk/${key}`);
  revalidatePath('/helpdesk');
  revalidatePath('/helpdesk/sla');
  redirect(`/helpdesk/${key}`);
}

export async function addHelpdeskNoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  assertCanWriteIssues(user);
  const key = text(formData.get('key'), 20).toUpperCase();
  const ticket = await requireTicketOnCurrentSite(key);
  if (!ticket) redirect('/helpdesk');
  await addHelpdeskNote(key, user.id, text(formData.get('body'), 4000));
  revalidatePath(`/helpdesk/${key}`);
  revalidatePath('/helpdesk/sla');
  redirect(`/helpdesk/${key}`);
}
