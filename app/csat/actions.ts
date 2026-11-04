'use server';

import { redirect } from 'next/navigation';
import { getCsatByToken, submitCsat } from '@/lib/helpdeskExtras';
import { getHelpdeskTicketById } from '@/lib/helpdesk';
import { fireHelpdeskCsatSubmitted } from '@/lib/webhooks';

export async function submitCsatAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '').trim();
  const score = Number(formData.get('score'));
  const comment = String(formData.get('comment') ?? '').trim();
  if (!token || !Number.isInteger(score)) {
    redirect(`/csat/${token || 'missing'}`);
  }
  const updated = await submitCsat(token, score, comment);
  if (updated?.submittedAt && updated.score != null) {
    const ticket = await getHelpdeskTicketById(updated.ticketId);
    if (ticket) {
      void fireHelpdeskCsatSubmitted({
        ticket,
        score: updated.score,
        comment: updated.comment,
      });
    }
  }
  const row = updated ?? (await getCsatByToken(token));
  redirect(`/csat/${row?.token ?? token}?saved=1`);
}
