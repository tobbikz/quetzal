import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HelpdeskDesk } from '@/components/HelpdeskDesk';
import { canAccessHelpdeskDesk } from '@/lib/capabilities';
import { canWriteIssues } from '@/lib/acl';
import { listUsers } from '@/lib/db';
import { formatWhen } from '@/lib/format';
import {
  countHelpdeskQueues,
  HELPDESK_STATUS_LABEL,
  HELPDESK_STATUSES,
  HELPDESK_TYPE_LABEL,
  HELPDESK_TYPES,
  listHelpdeskTickets,
  tagForHelpdeskStatus,
  tagForHelpdeskType,
  type HelpdeskStatus,
  type HelpdeskType,
} from '@/lib/helpdesk';
import { listRequestTypes } from '@/lib/portal';
import { currentSite, currentUser } from '@/lib/session';

export default async function HelpdeskQueuesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; request?: string }>;
}) {
  const query = await searchParams;
  const me = await currentUser();
  if (!canAccessHelpdeskDesk(me)) redirect('/?notice=helpdesk-agents');
  const site = await currentSite();
  const canWrite = await canWriteIssues(me);
  const requestTypes = await listRequestTypes();
  const type = (HELPDESK_TYPES.includes(query.type as HelpdeskType)
    ? query.type
    : '') as HelpdeskType | '';
  const status = (HELPDESK_STATUSES.includes(query.status as HelpdeskStatus)
    ? query.status
    : '') as HelpdeskStatus | '';
  const requestKey = query.request?.trim().toLowerCase() ?? '';
  const requestType = requestTypes.find((item) => item.key === requestKey);

  const tickets = (
    await listHelpdeskTickets({
      type: requestType ? requestType.helpdeskType : type,
      status,
      siteId: site.id,
      sortByPriority: true,
    })
  ).filter((ticket) => {
    if (!requestType) return true;
    const labels = ticket.labels
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    return labels.includes(requestType.key);
  });

  const scoped =
    requestType && tickets.length === 0
      ? await listHelpdeskTickets({
          type: requestType.helpdeskType,
          status,
          siteId: site.id,
          sortByPriority: true,
        })
      : tickets;

  const [people, counts] = await Promise.all([
    listUsers().then((rows) => new Map(rows.map((person) => [person.id, person.name]))),
    countHelpdeskQueues(site.id, me.id),
  ]);

  const byStatus = HELPDESK_STATUSES.map((item) => ({
    status: item,
    tickets: scoped.filter((ticket) => ticket.status === item),
  }));

  const byType = HELPDESK_TYPES.map((item) => ({
    type: item,
    count: scoped.filter((ticket) => ticket.type === item).length,
  })).filter((row) => row.count > 0);

  function href(parts: { type?: string; status?: string; request?: string }): string {
    const params = new URLSearchParams();
    if (parts.type) params.set('type', parts.type);
    if (parts.status) params.set('status', parts.status);
    if (parts.request) params.set('request', parts.request);
    const qs = params.toString();
    return qs ? `/helpdesk/queues?${qs}` : '/helpdesk/queues';
  }

  return (
    <HelpdeskDesk
      crumbs={[{ href: '/helpdesk', label: 'Helpdesk' }, { label: 'Board' }]}
      activeSection="queues"
      counts={counts}
      canCreate={canWrite}
    >
      <div className="hdesk-section-head">
        <div>
          <h1 className="hdesk-title">Status board</h1>
          <p className="hdesk-sub">
            {scoped.length} ticket{scoped.length === 1 ? '' : 's'} by type and status.
          </p>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: '0.5rem' }}>
        <Link className={!requestKey && !type ? 'tag tag--info' : 'tag tag--muted'} href={href({ status })}>
          All types
        </Link>
        {requestTypes.map((item) => (
          <Link
            key={item.key}
            className={requestKey === item.key ? 'tag tag--warn' : 'tag tag--muted'}
            href={href({ request: item.key, status })}
          >
            {item.name}
          </Link>
        ))}
        {HELPDESK_TYPES.map((item) => (
          <Link
            key={item}
            className={!requestKey && type === item ? 'tag tag--info' : 'tag tag--muted'}
            href={href({ type: item, status })}
          >
            {HELPDESK_TYPE_LABEL[item]}
          </Link>
        ))}
      </div>

      <div className="filters" style={{ marginBottom: '0.75rem' }}>
        <Link
          className={!status ? 'tag tag--info' : 'tag tag--muted'}
          href={href({ type: type || undefined, request: requestKey || undefined })}
        >
          All statuses
        </Link>
        {HELPDESK_STATUSES.map((item) => (
          <Link
            key={item}
            className={status === item ? 'tag tag--warn' : 'tag tag--muted'}
            href={href({
              type: type || undefined,
              request: requestKey || undefined,
              status: item,
            })}
          >
            {HELPDESK_STATUS_LABEL[item]}
          </Link>
        ))}
      </div>

      {byType.length > 0 && (
        <div className="filters" style={{ marginBottom: '1rem' }}>
          {byType.map((row) => (
            <span key={row.type} className={tagForHelpdeskType(row.type)}>
              {HELPDESK_TYPE_LABEL[row.type]} · {row.count}
            </span>
          ))}
        </div>
      )}

      <div className="queue-board">
        {byStatus.map((column) => {
          if (status && column.status !== status) return null;
          return (
            <section key={column.status} className="queue-col">
              <header className="queue-col-head">
                <span className={tagForHelpdeskStatus(column.status)}>
                  {HELPDESK_STATUS_LABEL[column.status]}
                </span>
                <span className="muted">{column.tickets.length}</span>
              </header>
              <ul className="queue-col-list">
                {column.tickets.map((ticket) => (
                  <li key={ticket.key} className="queue-card">
                    <div className="queue-card-top">
                      <Link className="key" href={`/helpdesk/${ticket.key}`}>
                        {ticket.key}
                      </Link>
                      <span className={tagForHelpdeskType(ticket.type)}>
                        {HELPDESK_TYPE_LABEL[ticket.type]}
                      </span>
                    </div>
                    <Link href={`/helpdesk/${ticket.key}`}>{ticket.summary}</Link>
                    <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                      {people.get(ticket.requesterId) ?? 'Requester'}
                      {ticket.assigneeId
                        ? ` → ${people.get(ticket.assigneeId) ?? 'Assignee'}`
                        : ' · Unassigned'}
                      {' · '}
                      {formatWhen(ticket.updatedAt)}
                    </p>
                  </li>
                ))}
                {column.tickets.length === 0 && (
                  <li className="muted" style={{ padding: '0.5rem 0' }}>
                    Empty
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </HelpdeskDesk>
  );
}
