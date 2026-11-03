import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HelpdeskDesk } from '@/components/HelpdeskDesk';
import { PriorityMark } from '@/components/PriorityMark';
import { canAccessHelpdeskDesk } from '@/lib/capabilities';
import { canWriteIssues } from '@/lib/acl';
import { listUsers } from '@/lib/db';
import { formatWhen, PRIORITY_LABEL } from '@/lib/format';
import {
  countHelpdeskQueues,
  DEFAULT_BUSINESS_HOURS,
  HELPDESK_STATUS_LABEL,
  HELPDESK_TYPE_LABEL,
  labelForSlaBadge,
  listSlaBreachedTickets,
  listSlaPolicies,
  slaBadgeState,
  tagForHelpdeskStatus,
  tagForHelpdeskType,
  tagForSlaBadge,
} from '@/lib/helpdesk';
import { currentSite, currentUser } from '@/lib/session';
import type { Priority } from '@/lib/types';

export default async function HelpdeskSlaReportPage() {
  const me = await currentUser();
  if (!canAccessHelpdeskDesk(me)) redirect('/?notice=helpdesk-agents');
  const site = await currentSite();
  const canWrite = await canWriteIssues(me);
  const [breached, policies, counts] = await Promise.all([
    listSlaBreachedTickets(site.id),
    listSlaPolicies(),
    countHelpdeskQueues(site.id, me.id),
  ]);
  const people = new Map((await listUsers()).map((person) => [person.id, person.name]));
  const openBreaches = breached.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const cal = DEFAULT_BUSINESS_HOURS;
  const weekdayLabel = 'Mon–Fri';
  const hoursLabel = `${String(cal.startHour).padStart(2, '0')}:00–${String(cal.endHour).padStart(2, '0')}:00 UTC`;

  return (
    <HelpdeskDesk
      crumbs={[{ href: '/helpdesk', label: 'Helpdesk' }, { label: 'SLA' }]}
      activeSection="sla"
      activeQueue="breached"
      counts={counts}
      canCreate={canWrite}
    >
      <div className="hdesk-section-head">
        <div>
          <h1 className="hdesk-title">SLA breach report</h1>
          <p className="hdesk-sub">
            {breached.length} breached ticket{breached.length === 1 ? '' : 's'}
            {openBreaches.length !== breached.length
              ? ` · ${openBreaches.length} still open`
              : ''}
            . Business hours {weekdayLabel} {hoursLabel}.
          </p>
        </div>
        <Link className="btn-secondary" href="/helpdesk?queue=breached">
          Breached queue
        </Link>
      </div>

      <table className="data hdesk-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Summary</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Breach</th>
            <th>Response due</th>
            <th>Resolve due</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {breached.map((ticket) => {
            const responseState = slaBadgeState('response', ticket);
            const resolveState = slaBadgeState('resolve', ticket);
            return (
              <tr key={ticket.key} className="hdesk-row--breach">
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
                    <span className="tag tag--error">SLA breached</span>
                    {responseState === 'breached' ? (
                      <span className={tagForSlaBadge(responseState)}>
                        {labelForSlaBadge('response', responseState)}
                      </span>
                    ) : null}
                    {resolveState === 'breached' ? (
                      <span className={tagForSlaBadge(resolveState)}>
                        {labelForSlaBadge('resolve', resolveState)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="muted">
                  {ticket.responseDue ? formatWhen(ticket.responseDue) : '—'}
                </td>
                <td className="muted">
                  {ticket.resolveDue ? formatWhen(ticket.resolveDue) : '—'}
                </td>
                <td>
                  {ticket.assigneeId ? (
                    people.get(ticket.assigneeId)
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </td>
              </tr>
            );
          })}
          {breached.length === 0 && (
            <tr>
              <td colSpan={9} className="muted">
                No SLA breaches right now.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="panel" style={{ marginTop: '1.25rem' }}>
        <div className="panel-head">Policies (type + priority)</div>
        <div className="panel-body" style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Type</th>
                <th>Priority</th>
                <th>Response (biz min)</th>
                <th>Resolve (biz min)</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={`${policy.type}:${policy.priority || '*'}`}>
                  <td>
                    {HELPDESK_TYPE_LABEL[policy.type as keyof typeof HELPDESK_TYPE_LABEL] ??
                      policy.type}
                  </td>
                  <td>
                    {policy.priority ? (
                      (PRIORITY_LABEL[policy.priority as Priority] ?? policy.priority)
                    ) : (
                      <span className="muted">default</span>
                    )}
                  </td>
                  <td>{policy.responseMinutes}</td>
                  <td>{policy.resolveMinutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </HelpdeskDesk>
  );
}
