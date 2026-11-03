import { redirect } from 'next/navigation';
import { canWriteIssues } from '@/lib/acl';
import { currentUser } from '@/lib/session';

/** Legacy URL — open the create modal on the list instead of a full page. */
export default async function NewHelpdeskTicketPage() {
  const me = await currentUser();
  if (!await canWriteIssues(me)) redirect('/helpdesk');
  redirect('/helpdesk?new=1');
}
