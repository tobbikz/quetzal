import Link from 'next/link';

export default function AdminBackupPage() {
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
        <span className="crumb current">Backup</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Backup / export</h1>
            <p className="page-sub">
              Download a JSON dump of core tables, or a copy of <code>data/quetzal.db</code>.
            </p>
          </div>
          <div className="row-actions">
            <Link className="btn-secondary" href="/admin/audit">
              Audit
            </Link>
            <Link className="btn-secondary" href="/admin/users">
              Users
            </Link>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">Exports</div>
          <div className="panel-body stack">
            <div>
              <p className="muted" style={{ marginTop: 0 }}>
                JSON includes users, projects, issues, wiki pages, comments, sites, and audit_log when
                present.
              </p>
              <a className="btn" href="/admin/backup/download?format=json">
                Download JSON
              </a>
            </div>
            <div>
              <p className="muted">
                SQLite file copy after a WAL checkpoint. Use for full local restore.
              </p>
              <a className="btn-secondary" href="/admin/backup/download?format=db">
                Download quetzal.db copy
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
