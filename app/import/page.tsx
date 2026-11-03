import Link from 'next/link';
import {
  importAttachmentsAction,
  importIssuesAction,
  importPagesAction,
  importUsersAction,
} from '@/app/actions';
import {
  SAMPLE_ATTACHMENTS_JSON,
  SAMPLE_ISSUES_CSV,
  SAMPLE_ISSUES_JSON,
  SAMPLE_PAGES_JSON,
  SAMPLE_USERS_JSON,
} from '@/lib/import';
import { listProjects, listSpaces, pagesInSpace } from '@/lib/db';
import { currentProject } from '@/lib/session';

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    created?: string;
    skipped?: string;
    errors?: string;
    detail?: string;
  }>;
}) {
  const summary = await searchParams;
  const projects = await listProjects();
  const spaces = await listSpaces();
  const project = await currentProject();
  const hasSummary =
    summary.created != null || summary.skipped != null || summary.errors != null;
  const defaultSpace = spaces[0]?.key ?? '';
  const samplePages = defaultSpace ? (await pagesInSpace(defaultSpace)).slice(0, 8) : [];

  const kindLabel =
    summary.kind === 'pages'
      ? 'wiki'
      : summary.kind === 'users'
        ? 'users'
        : summary.kind === 'attachments'
          ? 'attachments'
          : 'issues';

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">Work</Link>
        <span className="faint">/</span>
        <span className="crumb current">Import</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Import</h1>
            <p className="page-sub">
              Bring issues, users, wiki pages, and page attachments into Quetzal. Optional issue keys are
              kept when free; unknown assignee emails create users; attachments accept JSON, multi-file, or ZIP.
            </p>
          </div>
        </div>

        <section className="panel" style={{ marginBottom: '0.75rem' }}>
          <div className="panel-head">Notes</div>
          <div className="panel-body stack">
            <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
              <li>
                Issue <code>key</code> (e.g. <code>OPS-42</code>) is preserved when that number is unused in the
                project; existing keys are skipped. Omit <code>key</code> to allocate the next number.
              </li>
              <li>
                Assignees resolve by email and are created as <code>member</code> when missing. Use the Users
                panel to bulk-create accounts with an explicit role.
              </li>
              <li>
                Wiki attachments: JSON with <code>content</code> / <code>contentBase64</code>, or upload many
                files / one ZIP onto a target space + page slug.
              </li>
            </ul>
          </div>
        </section>

        {hasSummary ? (
          <section className="panel" style={{ marginBottom: '0.75rem' }}>
            <div className="panel-head">
              <span>Last {kindLabel} import</span>
            </div>
            <div className="panel-body stack">
              <div className="row-actions" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="tag tag--ok">Created {summary.created ?? '0'}</span>
                <span className="tag tag--muted">Skipped {summary.skipped ?? '0'}</span>
                <span className={Number(summary.errors) > 0 ? 'tag tag--error' : 'tag tag--muted'}>
                  Errors {summary.errors ?? '0'}
                </span>
              </div>
              {summary.detail ? <p className="muted" style={{ margin: 0 }}>{summary.detail}</p> : null}
            </div>
          </section>
        ) : null}

        <div className="work-layout">
          <section className="panel">
            <div className="panel-head">Issues · JSON or CSV</div>
            <form className="panel-body stack" action={importIssuesAction}>
              <label className="field">
                <span>Default project (used when a row omits project)</span>
                <select name="project" defaultValue={project.key}>
                  {projects.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.key} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Format</span>
                <select name="format" defaultValue="json">
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </label>
              <label className="field">
                <span>Paste payload</span>
                <textarea
                  name="payload"
                  placeholder="Paste issues JSON or CSV here"
                  style={{ minHeight: 180, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                />
              </label>
              <label className="field">
                <span>Or upload a file</span>
                <input type="file" name="file" accept=".json,.csv,text/csv,application/json" />
              </label>
              <div className="row-actions">
                <button className="btn" type="submit">Import issues</button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head">Users · JSON or CSV</div>
            <form className="panel-body stack" action={importUsersAction}>
              <label className="field">
                <span>Format</span>
                <select name="format" defaultValue="json">
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </label>
              <label className="field">
                <span>Paste payload</span>
                <textarea
                  name="payload"
                  placeholder='{ "users": [ { "email": "…", "name": "…", "role": "member" } ] }'
                  style={{ minHeight: 180, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                />
              </label>
              <label className="field">
                <span>Or upload a file</span>
                <input type="file" name="file" accept=".json,.csv,text/csv,application/json" />
              </label>
              <div className="row-actions">
                <button className="btn" type="submit">Import users</button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head">Wiki pages · JSON</div>
            <form className="panel-body stack" action={importPagesAction}>
              <label className="field">
                <span>Default space (used when a row omits space)</span>
                <select name="space" defaultValue={defaultSpace}>
                  {spaces.map((space) => (
                    <option key={space.key} value={space.key}>
                      {space.key} · {space.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Paste JSON</span>
                <textarea
                  name="payload"
                  placeholder='{ "pages": [ ... ] }'
                  style={{ minHeight: 180, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                />
              </label>
              <label className="field">
                <span>Or upload a file</span>
                <input type="file" name="file" accept=".json,application/json" />
              </label>
              <div className="row-actions">
                <button className="btn" type="submit">Import pages</button>
              </div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head">Wiki attachments · JSON, multi-file, or ZIP</div>
            <form className="panel-body stack" action={importAttachmentsAction} encType="multipart/form-data">
              <label className="field">
                <span>Mode</span>
                <select name="mode" defaultValue="files">
                  <option value="files">Multi-file or ZIP</option>
                  <option value="json">JSON (base64 / text)</option>
                </select>
              </label>
              <label className="field">
                <span>Target space (required for file/ZIP; default for JSON rows)</span>
                <select name="space" defaultValue={defaultSpace}>
                  {spaces.map((space) => (
                    <option key={space.key} value={space.key}>
                      {space.key} · {space.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Page slug (required for file/ZIP)</span>
                <input
                  name="slug"
                  list="import-page-slugs"
                  placeholder={samplePages[0]?.slug ?? 'deploy-runbook'}
                  defaultValue={samplePages[0]?.slug ?? ''}
                />
                <datalist id="import-page-slugs">
                  {samplePages.map((page) => (
                    <option key={page.id} value={page.slug}>
                      {page.title}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>JSON payload (when mode = JSON)</span>
                <textarea
                  name="payload"
                  placeholder='{ "attachments": [ ... ] }'
                  style={{ minHeight: 120, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                />
              </label>
              <label className="field">
                <span>Files or one ZIP</span>
                <input type="file" name="files" multiple accept="*/*,.zip,application/zip,application/json" />
              </label>
              <div className="row-actions">
                <button className="btn" type="submit">Import attachments</button>
              </div>
            </form>
          </section>
        </div>

        <section className="panel" style={{ marginTop: '0.75rem' }}>
          <div className="panel-head">Sample shapes (Atlassian-ish, simplified)</div>
          <div className="panel-body stack">
            <div>
              <p className="muted" style={{ marginTop: 0 }}>
                Issues JSON — array or <code>{'{ "issues": [...] }'}</code>. Optional <code>key</code> is kept
                when unused; keys that already exist are skipped. Unknown <code>assigneeEmail</code> values
                create users.
              </p>
              <pre
                style={{
                  margin: 0,
                  padding: '0.65rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {SAMPLE_ISSUES_JSON}
              </pre>
            </div>
            <div>
              <p className="muted">
                Issues CSV — header row required. Columns:{' '}
                <code>project, key, type, summary, description, priority, labels, assigneeEmail, parent, points, dueOn</code>
              </p>
              <pre
                style={{
                  margin: 0,
                  padding: '0.65rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {SAMPLE_ISSUES_CSV}
              </pre>
            </div>
            <div>
              <p className="muted">
                Users JSON — array or <code>{'{ "users": [...] }'}</code>. Roles: <code>admin</code>,{' '}
                <code>member</code>, <code>viewer</code>.
              </p>
              <pre
                style={{
                  margin: 0,
                  padding: '0.65rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {SAMPLE_USERS_JSON}
              </pre>
            </div>
            <div>
              <p className="muted">
                Wiki pages JSON — array or <code>{'{ "pages": [...] }'}</code>. If <code>slug</code> already exists in the space, the row is skipped.
              </p>
              <pre
                style={{
                  margin: 0,
                  padding: '0.65rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {SAMPLE_PAGES_JSON}
              </pre>
            </div>
            <div>
              <p className="muted">
                Attachments JSON — <code>content</code> (UTF-8) or <code>contentBase64</code>. Prefer multi-file / ZIP upload for binaries.
              </p>
              <pre
                style={{
                  margin: 0,
                  padding: '0.65rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {SAMPLE_ATTACHMENTS_JSON}
              </pre>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
