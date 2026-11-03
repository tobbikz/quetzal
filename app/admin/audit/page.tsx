import Link from 'next/link';
import { listAudit } from '@/lib/audit';

export default async function AdminAuditPage() {
  const entries = await listAudit(250);

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <Link className="crumb" href="/admin">
          Admin
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">Audit</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Audit log</h1>
            <p className="page-sub">Key events: login, issue create/status, wiki save, role changes.</p>
          </div>
          <div className="row-actions">
            <Link className="btn-secondary" href="/admin/backup">
              Backup
            </Link>
            <Link className="btn-secondary" href="/admin/users">
              Users
            </Link>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">Recent ({entries.length})</div>
          <div className="panel-body" style={{ padding: 0, overflowX: 'auto' }}>
            {entries.length === 0 ? (
              <p className="muted" style={{ padding: '0.75rem' }}>
                No audit events yet. Log in, create an issue, or save a wiki page.
              </p>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                        {entry.createdAt.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td>{entry.actorName ?? (entry.actorId != null ? `#${entry.actorId}` : '—')}</td>
                      <td>{entry.action}</td>
                      <td>
                        {entry.entityType
                          ? `${entry.entityType}${entry.entityId ? `:${entry.entityId}` : ''}`
                          : '—'}
                      </td>
                      <td className="muted">{entry.detail || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
