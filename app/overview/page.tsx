import Link from 'next/link';
import { IssueTable } from '@/components/IssueTable';
import { ProjectSwitch } from '@/components/ProjectSwitch';
import { counts, listInvolved, listIssues, listSprints, listWatching, projectsForAssignee } from '@/lib/db';
import { STATUS_LABEL, STATUSES } from '@/lib/format';
import { currentProject, currentUser } from '@/lib/session';
import type { IssueStatus } from '@/lib/types';

type ListTab = 'open' | 'reported' | 'watching' | 'involved';

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ list?: string }> }) {
  const { list } = await searchParams;
  const tab: ListTab =
    list === 'reported' ? 'reported' : list === 'watching' ? 'watching' : list === 'involved' ? 'involved' : 'open';
  const user = await currentUser();
  const project = await currentProject();
  const stats = await counts(user.id, project.key);
  const sprint = (await listSprints(project.id)).find((item) => item.state === 'active');
  const catalog = await listIssues({ projectKey: project.key });
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<IssueStatus, number>;
  for (const issue of catalog) byStatus[issue.status] += 1;
  const statusTotal = catalog.length || 1;
  const openFor = async (assigneeId?: number, reporterId?: number) =>
    (await listIssues({ projectKey: project.key, assigneeId, reporterId })).filter((issue) => issue.status !== 'done');

  const issues =
    tab === 'reported'
      ? await openFor(undefined, user.id)
      : tab === 'watching'
        ? await listWatching(user.id, project.key)
        : tab === 'involved'
          ? await listInvolved(user.id, project.key)
          : await openFor(user.id);

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">Work</Link>
        <span className="crumb current">Overview</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-sub">{project.description}</p>
          </div>
          <ProjectSwitch projects={await projectsForAssignee(user.id)} value={project.key} next="/overview" />
        </div>
        <div className="stat-grid">
          <div className="stat"><div className="stat-label">Open</div><div className="stat-value">{stats.open}</div></div>
          <div className="stat"><div className="stat-label">In review</div><div className="stat-value">{stats.review}</div></div>
          <div className="stat"><div className="stat-label">Assigned to you</div><div className="stat-value">{stats.mine}</div></div>
        </div>
        <section className="panel" style={{ marginBottom: '0.75rem' }}>
          <div className="panel-head">
            <span>Counts by status</span>
            <Link href="/roadmap">{catalog.length} issues · Roadmap</Link>
          </div>
          <div className="panel-body">
            <div className="agg-bars" role="img" aria-label="Issue counts by status">
              {STATUSES.map((status) => {
                const n = byStatus[status];
                const pct = Math.round((n / statusTotal) * 100);
                return (
                  <div key={status} className="agg-row">
                    <span className="agg-label">{STATUS_LABEL[status]}</span>
                    <div className="agg-track">
                      <div className={`agg-fill agg-fill--${status}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="agg-n">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <nav className="tabs">
              <Link className={tab === 'open' ? 'on' : ''} href="/overview">Your open issues</Link>
              <Link className={tab === 'reported' ? 'on' : ''} href="/overview?list=reported">Reported by you</Link>
              <Link className={tab === 'watching' ? 'on' : ''} href="/overview?list=watching">Watching</Link>
              <Link className={tab === 'involved' ? 'on' : ''} href="/overview?list=involved">Involved</Link>
            </nav>
            <span>{sprint ? sprint.name : 'No active sprint'}</span>
          </div>
          <IssueTable issues={issues} />
        </section>
      </main>
    </>
  );
}
