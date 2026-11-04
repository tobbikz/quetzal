import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HelpdeskDesk } from '@/components/HelpdeskDesk';
import { canAccessHelpdeskDesk } from '@/lib/capabilities';
import { canWriteIssues } from '@/lib/acl';
import { formatWhen } from '@/lib/format';
import { countHelpdeskQueues } from '@/lib/helpdesk';
import { getCsatReport } from '@/lib/helpdeskExtras';
import { currentSite, currentUser } from '@/lib/session';

export default async function HelpdeskCsatReportPage() {
  const me = await currentUser();
  if (!canAccessHelpdeskDesk(me)) redirect('/?notice=helpdesk-forbidden');
  const site = await currentSite();
  const canEdit = await canWriteIssues(me);
  const [counts, report] = await Promise.all([
    countHelpdeskQueues(site.id, me.id),
    getCsatReport(site.id),
  ]);

  return (
    <HelpdeskDesk
      crumbs={[
        { href: '/helpdesk', label: 'Helpdesk' },
        { label: 'CSAT' },
      ]}
      activeSection="csat"
      counts={counts}
      canCreate={canEdit}
    >
      <div className="hdesk-section-head">
        <div>
          <h1 className="page-title">CSAT</h1>
          <p className="page-sub">Customer satisfaction on resolved helpdesk tickets.</p>
        </div>
      </div>

      <div className="row-actions" style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <span className="tag tag--info">Submitted {report.submitted}</span>
        <span className="tag tag--muted">Pending {report.pending}</span>
        <span className={report.average != null ? 'tag tag--ok' : 'tag tag--muted'}>
          Avg {report.average != null ? report.average.toFixed(1) : '—'}
        </span>
      </div>

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-head">Score distribution</div>
        <div className="panel-body">
          <div className="row-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            {([5, 4, 3, 2, 1] as const).map((score) => (
              <div key={score} style={{ minWidth: '4.5rem' }}>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {score}★
                </div>
                <strong>{report.distribution[score]}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">Recent responses</div>
        <div className="panel-body">
          {report.recent.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No CSAT submissions yet. Resolve a ticket to send an invite.
            </p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Score</th>
                  <th>When</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {report.recent.map((row) => (
                  <tr key={`${row.ticketKey}-${row.submittedAt}`}>
                    <td>
                      <Link href={`/helpdesk/${row.ticketKey}`}>{row.ticketKey}</Link>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {row.summary}
                      </div>
                    </td>
                    <td>{row.score}/5</td>
                    <td className="muted">{formatWhen(row.submittedAt)}</td>
                    <td style={{ maxWidth: '18rem', whiteSpace: 'pre-wrap' }}>
                      {row.comment || <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </HelpdeskDesk>
  );
}
