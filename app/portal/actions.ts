'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHelpdeskTicket } from '@/lib/helpdesk';
import { findOrCreateRequester, getRequestType } from '@/lib/portal';
import { currentSite, currentUser } from '@/lib/session';
import { getUserByEmail } from '@/lib/db';

function text(value: FormDataEntryValue | null, max = 4000): string {
  return String(value ?? '').trim().slice(0, max);
}

async function resolveRequester(formData: FormData): Promise<number> {
  const jar = await cookies();
  const authed = jar.get('quetzal_auth')?.value === '1';
  if (authed) {
    const user = await currentUser();
    return user.id;
  }

  const email = text(formData.get('email'), 160).toLowerCase();
  const name = text(formData.get('name'), 80);
  if (!email.includes('@')) {
    redirect('/portal?error=email');
  }

  // Prefer an existing account when the guest types a known email.
  const known = await getUserByEmail(email);
  if (known) return known.id;

  return (await findOrCreateRequester(email, name)).id;
}

export async function createPortalTicketAction(formData: FormData): Promise<void> {
  const typeKey = text(formData.get('request_type'), 40).toLowerCase();
  const requestType = await getRequestType(typeKey);
  if (!requestType) redirect('/portal?error=type');

  const summary = text(formData.get('summary'), 180);
  if (!summary) redirect(`/portal/${requestType.key}?error=summary`);

  const body = text(formData.get('body'), 50000);
  const requesterId = await resolveRequester(formData);
  const site = await currentSite();

  const ticket = await createHelpdeskTicket({
    type: requestType.helpdeskType,
    summary,
    body,
    requesterId,
    siteId: site.id,
    labels: `portal,${requestType.key}`,
  });

  redirect(`/portal/thanks?key=${encodeURIComponent(ticket.key)}`);
}
