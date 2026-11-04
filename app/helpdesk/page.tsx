import Link from 'next/link';
import { Suspense } from 'react';
import { applyHelpdeskFilters, claimHelpdeskTicketAction } from '@/app/helpdesk/actions';
import { OpenHelpdeskFromQuery } from '@/components/CreateHelpdesk';
import { HelpdeskDesk } from '@/components/HelpdeskDesk';
import { PriorityMark } from '@/components/PriorityMark';
import { redirect } from 'next/navigation';
import { canWriteIssues } from '@/lib/acl';
import { canAccessHelpdeskDesk } from '@/lib/capabilities';
import { listUsers } from '@/lib/db';
import { formatWhen, PRIORITY_LABEL } from '@/lib/format';
import {
  countHelpdeskQueues,
  HELPDESK_PRIORITIES,
  HELPDESK_STATUS_LABEL,
  HELPDESK_STATUSES,
  HELPDESK_TYPE_LABEL,
  HELPDESK_TYPES,
  labelForSlaBadge,
  listHelpdeskTickets,
  slaBadgeState,
  tagForHelpdeskStatus,
  tagForHelpdeskType,
  tagForSlaBadge,
  type HelpdeskPriority,
  type HelpdeskQueueKey,
  type HelpdeskStatus,
  type HelpdeskType,
} from '@/lib/helpdesk';
import { currentSite, currentUser } from '@/lib/session';
import type { Priority } from '@/lib/types';

const QUEUE_KEYS = new Set<HelpdeskQueueKey>(['all', 'urgent', 'mine', 'open', 'breached']);

function parseQueue(raw: string | undefined): HelpdeskQueueKey {
  if (raw && QUEUE_KEYS.has(raw as HelpdeskQueueKey)) return raw as HelpdeskQueueKey;
  return 'all';
}

export default async function HelpdeskPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    priority?: string;
    queue?: string;
    q?: string;
    new?: string;
  }>;
}) {
  const query = await searchParams;
  const me = await currentUser();
  if (!canAccessHelpdeskDesk(me)) redirect('/?notice=helpdesk-agents');
  const site = await currentSite();
  const canWrite = await canWriteIssues(me);
  const status = (HELPDESK_STATUSES.includes(query.status as HelpdeskStatus)
    ? query.status
    : '') as HelpdeskStatus | '';
  const type = (HELPDESK_TYPES.includes(query.type as HelpdeskType)
    ? query.type
    : '') as HelpdeskType | '';
  const priority = (HELPDESK_PRIORITIES.includes(query.priority as HelpdeskPriority)
    ? query.priority
    : '') as HelpdeskPriority | '';
  const queue = parseQueue(query.queue);
  const q = query.q?.trim() ?? '';
  const listQueue = priority ? '' : queue === 'all' ? '' : queue;
  const [tickets, counts] = await Promise.all([
    listHelpdeskTickets({
      status,
      type,
      priority,
      queue: listQueue,
      assigneeId: queue === 'mine' ? me.id : undefined,
      q,
      siteId: site.id,
    }),
    countHelpdeskQueues(site.id, me.id),
  ]);
  const people = new Map((await listUsers()).map((person) => [person.id, person.name]));
  const queueLabel =
    queue === 'all'
      ? 'All tickets'
      : queue === 'urgent'
        ? 'Urgent'
        : queue === 'mine'
          ? 'Assigned to me'
          : queue === 'open'
            ? 'Open'
            : 'SLA breached';

  return (
    <HelpdeskDesk
      crumbs={[{ label: 'Helpdesk' }]}
      activeSection="tickets"
      activeQueue={queue}
      counts={counts}
      canCreate={canWrite}
    >
      {canWrite && (
        <Suspense fallback={null}>
          <OpenHelpdeskFromQuery />
        </Suspense>
      )}
      <div className="hdesk-section-head">
        <div>
          <h1 className="hdesk-title">{queueLabel}</h1>
          <p className="hdesk-sub">
            {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
            {priority ? ` · ${PRIORITY_LABEL[priority as Priority]}` : ''}
            .
          </p>
        </div>
      </div>
      <div className="filters hdesk-priority-chips">
        <Link
          className={!priority ? 'tag tag--info' : 'tag tag--muted'}
          href={buildHelpdeskHref({ status, type, q, queue: queue === 'all' ? undefined : queue })}
        >
          All priorities
        </Link>
        {HELPDESK_PRIORITIES.map((item) => (
          <Link
            key={item}
            className={priority === item ? 'tag tag--warn' : 'tag tag--muted'}
            href={buildHelpdeskHref({ status, type, q, priority: item })}
          >
            {PRIORITY_LABEL[item as Priority]}
          </Link>
        ))}
      </div>
      <form className="filters" action={applyHelpdeskFilters}>
        <input type="hidden" name="queue" value={queue === 'all' ? '' : queue} />
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          {HELPDESK_STATUSES.map((item) => (
            <option key={item} value={item}>
              {HELPDESK_STATUS_LABEL[item]}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type}>
          <option value="">All types</option>
          {HELPDESK_TYPES.map((item) => (
            <option key={item} value={item}>
              {HELPDESK_TYPE_LABEL[item]}
            </option>
          ))}
        </select>
        <select name="priority" defaultValue={priority}>
          <option value="">All priorities</option>
          {HELPDESK_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {PRIORITY_LABEL[item as Priority]}
            </option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Summary, key…" />
        <button className="btn-secondary" type="submit">
          Filter
        </button>
      </form>
      <table className="data hdesk-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Summary</th>
            <th>Priority</th>
            <th>Status</th>
            <th>SLA</th>
            <th>Requester</th>
            <th>Assignee</th>
            <th>Updated</th>
            {canWrite ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const responseState = slaBadgeState('response', ticket);
            const resolveState = slaBadgeState('resolve', ticket);
            return (
              <tr key={ticket.key} className={ticket.slaBreached ? 'hdesk-row--breach' : undefined}>
                <td>
                  <Link className="key" href={`/helpdesk/${ticket.key}`}>
                    {ticket.key}
                  </Link>
                </td>
                <td>
                  <span className={tagForHelpdeskType(ticket.type)}>
                    {HELPDESK_TYPE_LABEL[ticket.type]}
                  </span>
                </td>
                <td>
                  <Link href={`/helpdesk/${ticket.key}`}>{ticket.summary}</Link>
                </td>
                <td>
                  <PriorityMark priority={ticket.priority as Priority} />
                </td>
                <td>
                  <span className={tagForHelpdeskStatus(ticket.status)}>
                    {HELPDESK_STATUS_LABEL[ticket.status]}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    {ticket.slaBreached ? (
                      <span className="tag tag--error">SLA breached</span>
                    ) : null}
                    {responseState !== 'none' ? (
                      <span className={tagForSlaBadge(responseState)}>
                        {labelForSlaBadge('response', responseState)}
                      </span>
                    ) : null}
                    {resolveState !== 'none' ? (
                      <span className={tagForSlaBadge(resolveState)}>
                        {labelForSlaBadge('resolve', resolveState)}
                      </span>
                    ) : null}
                    {responseState === 'none' && resolveState === 'none' && !ticket.slaBreached ? (
                      <span className="muted">—</span>
                    ) : null}
                  </div>
                </td>
                <td>{people.get(ticket.requesterId) ?? '—'}</td>
                <td>
                  {ticket.assigneeId ? (
                    people.get(ticket.assigneeId)
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </td>
                <td className="muted">{formatWhen(ticket.updatedAt)}</td>
                {canWrite ? (
                  <td>
                    {!ticket.assigneeId ? (
                      <form action={claimHelpdeskTicketAction}>
                        <input type="hidden" name="key" value={ticket.key} />
                        <button type="submit" className="btn-secondary">
                          Claim
                        </button>
                      </form>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
          {tickets.length === 0 && (
            <tr>
              <td colSpan={canWrite ? 10 : 9} className="muted">
                No tickets match this view.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </HelpdeskDesk>
  );
}

function buildHelpdeskHref(parts: {
  status?: string;
  type?: string;
  priority?: string;
  queue?: string;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (parts.status) params.set('status', parts.status);
  if (parts.type) params.set('type', parts.type);
  if (parts.priority) params.set('priority', parts.priority);
  if (parts.queue) params.set('queue', parts.queue);
  if (parts.q) params.set('q', parts.q);
  const qs = params.toString();
  return qs ? `/helpdesk?${qs}` : '/helpdesk';
}
