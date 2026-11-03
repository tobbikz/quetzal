import Link from 'next/link';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { WikiDesk } from '@/components/WikiDesk';
import { searchAll } from '@/lib/db';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import { toIssuePreview } from '@/lib/preview';
import { currentUser } from '@/lib/session';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const result = query ? await searchAll(query) : { issues: [], pages: [] };
  const me = await currentUser();
  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);

  return (
    <WikiDesk
      personal={personal}
      team={team}
      currentSpaceKey={null}
      browseAll={branches}
      crumbs={[
        { href: '/wiki', label: 'Wiki' },
        { label: 'Search' },
      ]}
      tools={false}
    >
      <header className="wdesk-section-head">
        <div>
          <h1 className="wdesk-title">Search</h1>
          <p className="wdesk-sub">Find issues and wiki pages across the site.</p>
        </div>
      </header>

      <form className="wdesk-panel" action="/search" style={{ marginBottom: '0.85rem' }}>
        <div className="wdesk-panel-body" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Issues and pages"
            style={{ flex: '1 1 16rem', minWidth: 0 }}
            aria-label="Search query"
          />
          <button className="btn" type="submit">
            Search
          </button>
        </div>
      </form>

      {query ? (
        <div className="wdesk-search-grid">
          <section className="wdesk-panel">
            <div className="wdesk-panel-head">
              <span>Issues · {result.issues.length}</span>
            </div>
            <div className="wdesk-panel-body">
              <ul className="wdesk-list">
                {result.issues.map(async (issue) => (
                  <li key={issue.key}>
                    <IssueHoverCard issueKey={issue.key} preview={await toIssuePreview(issue)}>
                      <span className="key">{issue.key}</span> {issue.summary}
                    </IssueHoverCard>
                  </li>
                ))}
              </ul>
              {result.issues.length === 0 ? <p className="muted">No issues.</p> : null}
            </div>
          </section>
          <section className="wdesk-panel">
            <div className="wdesk-panel-head">
              <span>Pages · {result.pages.length}</span>
            </div>
            <div className="wdesk-panel-body">
              <ul className="wdesk-list">
                {result.pages.map((page) => (
                  <li key={page.id}>
                    <Link href={`/wiki/${page.spaceKey}/${page.slug}`}>
                      <span className="key">{page.spaceKey}</span> {page.title}
                    </Link>
                  </li>
                ))}
              </ul>
              {result.pages.length === 0 ? <p className="muted">No pages.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </WikiDesk>
  );
}
