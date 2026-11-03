import { IssueListBeyond } from '@/components/IssueListBeyond';
import { JqlBar } from '@/components/JqlBar';
import { ProjectSwitch } from '@/components/ProjectSwitch';
import { canBrowseIssues } from '@/lib/acl';
import { JQL_EXAMPLES, runJql } from '@/lib/jql';
import { projectsForAssignee } from '@/lib/db';
import { listSavedFilters } from '@/lib/savedFilters';
import { currentProject, currentUser } from '@/lib/session';
import type { Issue } from '@/lib/types';

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    jql?: string;
  }>;
}) {
  const query = await searchParams;
  const me = await currentUser();
  const project = await currentProject();
  const canBrowse = await canBrowseIssues(me, project.key);
  const savedFilters = await listSavedFilters(me.id);
  const projects = await projectsForAssignee(me.id);

  const jqlRaw = (query.jql ?? '').trim();
  const hasQuery = Boolean(jqlRaw);

  let issues: Issue[] = [];
  let jqlError: string | null = null;

  if (!canBrowse) {
    issues = [];
  } else if (hasQuery) {
    const result = await runJql(jqlRaw, {
      currentUserId: me.id,
      defaultProjectKey: project.key,
    });
    if (result.ok) {
      issues = result.issues;
    } else {
      jqlError = result.error;
      issues = [];
    }
  }

  return (
    <main className="page filters-page fp--atelier">
      <header className="fp-bar">
        <div className="fp-bar-left">
          <span className="fp-bar-kicker">Filters</span>
          <span className="fp-bar-key">{project.key}</span>
          <ProjectSwitch projects={projects} value={project.key} next="/issues" />
        </div>
      </header>

      {!canBrowse ? (
        <div className="gate-banner gate-banner--error" role="alert">
          Permission: no browse access for this project. Ask a project admin.
        </div>
      ) : null}

      <section className="fp-desk">
        <div className="fp-jql">
          <JqlBar
            defaultJql={jqlRaw}
            projectKey={project.key}
            examples={JQL_EXAMPLES}
            savedFilters={savedFilters}
            jqlError={jqlError}
          />
        </div>

        {canBrowse && hasQuery ? (
          <div className="fp-results">
            <p className="fp-meta">
              {jqlError
                ? 'Query error — fix the QQL above and try again'
                : `${issues.length} result${issues.length === 1 ? '' : 's'}`}
            </p>
            <div className="fp-table">
              <IssueListBeyond
                issues={issues}
                emptyTitle="No issues matched"
                emptyHint="Adjust the QQL query and run again."
              />
            </div>
          </div>
        ) : canBrowse && !hasQuery ? (
          <div className="fp-empty">
            <p className="fp-empty-eyebrow">QQL</p>
            <h2 className="fp-empty-title">Query the backlog</h2>
            <p className="fp-empty-hint">
              Type a Quetzal Query above and press <kbd>Run</kbd>. Autocomplete and saved filters sit
              under the bar.
            </p>
            <div className="fp-empty-examples">
              <span className="fp-empty-label">Try</span>
              {JQL_EXAMPLES.slice(0, 4).map((ex) => (
                <a
                  key={ex.jql}
                  href={`/issues?jql=${encodeURIComponent(ex.jql)}`}
                  className="fp-empty-chip"
                >
                  {ex.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
