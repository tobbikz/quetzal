import Link from 'next/link';
import { completeSprintAction, startSprintAction } from '@/app/actions';
import { IssueTable } from '@/components/IssueTable';
import { ProjectSwitch } from '@/components/ProjectSwitch';
import { listIssues, listSprints, projectsForAssignee } from '@/lib/db';
import { currentProject, currentUser } from '@/lib/session';

export default async function BacklogPage() {
  const user = await currentUser();
  const current = await currentProject();
  const project = current.key;
  const sprints = await listSprints(current?.id);
  const hasActive = sprints.some((sprint) => sprint.state === 'active');
  const backlog = await listIssues({ projectKey: project, sprintId: 'backlog' });

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">Work</Link>
        <span className="faint">/</span>
        <span className="crumb current">{project} backlog</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Backlog</h1>
            <p className="page-sub">{current?.name}. Complete the active sprint before starting the next one. Unfinished issues return here.</p>
          </div>
          <div className="row-actions">
            <ProjectSwitch projects={await projectsForAssignee(user.id)} value={project} next="/backlog" />
          </div>
        </div>
        <div className="stack">
          {await Promise.all(sprints.map(async (sprint) => {
            const issues = await listIssues({ projectKey: project, sprintId: sprint.id });
            const points = issues.reduce((sum, issue) => sum + (issue.points ?? 0), 0);
            return (
              <section key={sprint.id} className="panel">
                <div className="panel-head">
                  <span>{sprint.name} · {sprint.state} · {issues.length} · {points} pts</span>
                  <span className="row-actions">
                    <span>{sprint.goal}</span>
                    {sprint.state === 'active' && (
                      <form action={completeSprintAction}>
                        <input type="hidden" name="sprint" value={sprint.id} />
                        <input type="hidden" name="project" value={project} />
                        <button className="btn" type="submit">Complete sprint</button>
                      </form>
                    )}
                    {sprint.state === 'planned' && !hasActive && (
                      <form action={startSprintAction}>
                        <input type="hidden" name="sprint" value={sprint.id} />
                        <input type="hidden" name="project" value={project} />
                        <button className="btn" type="submit">Start sprint</button>
                      </form>
                    )}
                  </span>
                </div>
                <IssueTable issues={issues} />
              </section>
            );
          }))}
          <section className="panel">
            <div className="panel-head">
              <span>Backlog</span>
              <span>{backlog.length} · {backlog.reduce((sum, issue) => sum + (issue.points ?? 0), 0)} pts</span>
            </div>
            <IssueTable
              issues={backlog}
              emptyTitle="Backlog is empty"
              emptyHint="Create an issue or complete a sprint to return unfinished work here."
            />
          </section>
        </div>
      </main>
    </>
  );
}
