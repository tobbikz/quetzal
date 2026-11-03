import type { User } from '@/lib/types';

/** Agent desk (/helpdesk). Admins always count as agents. */
export function canAccessHelpdeskDesk(user: User): boolean {
  if (user.role === 'admin') return true;
  return Boolean(user.helpdeskAgent);
}

/** Automation nav + rules UI. */
export function canManageAutomation(user: User): boolean {
  return user.role === 'admin';
}

/** Ticket detail for non-desk users: own request or assigned. */
export function canViewHelpdeskTicket(
  user: User,
  ticket: { requesterId: number; assigneeId: number | null },
): boolean {
  if (canAccessHelpdeskDesk(user)) return true;
  if (ticket.requesterId === user.id) return true;
  if (ticket.assigneeId != null && ticket.assigneeId === user.id) return true;
  return false;
}

export function canCreateHelpdeskTicket(user: User): boolean {
  return user.role === 'admin' || user.role === 'member';
}
