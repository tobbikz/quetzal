import Link from 'next/link';
import { WikiDesk } from '@/components/WikiDesk';
import { canManageSpaceAcl } from '@/lib/acl';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import { currentSite, currentUser } from '@/lib/session';

export default async function WikiSpacesPage() {
  const user = await currentUser();
  const site = await currentSite();
  const { personal, team, branches } = await loadWikiBrowseBranches(user.id, site.id);
  const cards = [
    { space: personal, kind: 'personal' as const },
    ...team.map((space) => ({ space, kind: 'team' as const })),
  ];

  return (
    <WikiDesk
      personal={personal}
      team={team}
      currentSpaceKey={null}
      browseAll={branches}
      crumbs={[{ href: '/wiki', label: 'Wiki' }, { label: 'Spaces' }]}
    >
      <header className="wiki-hub-hero wiki-hub-hero--nested">
        <div className="wiki-hub-hero-copy">
          <p className="wiki-hub-kicker">Wiki</p>
          <h1 className="wiki-hub-hero-title">Spaces</h1>
          <p className="wiki-hub-hero-lede">
            Every space you can open. Prefer Home for recent activity.
          </p>
        </div>
        <Link className="btn wiki-hub-cta" href={`/wiki/${personal.key}`}>
          Open personal
        </Link>
      </header>

      {cards.length === 0 ? (
        <div className="wiki-hub-empty">
          <p className="wiki-hub-empty-eyebrow">Empty</p>
          <h2 className="wiki-hub-empty-title">No spaces yet</h2>
          <p className="wiki-hub-empty-hint">Personal space seeds on first visit.</p>
        </div>
      ) : (
        <section className="wiki-hub-grid wiki-hub-grid--nested" aria-label="Wiki spaces">
          {await Promise.all(cards.map(async ({ space, kind }) => {
            const pages = branches.find((b) => b.space.key === space.key)?.pages ?? [];
            const canSettings = await canManageSpaceAcl(user, space.key);
            const signal =
              kind === 'personal' ? 'Private drafts & notes' : 'Shared knowledge';
            return (
              <article key={space.key} className={`wiki-hub-card wiki-hub-card--${kind}`}>
                <header className="wiki-hub-card-head">
                  <span className={`wiki-hub-scope wiki-hub-scope--${kind}`}>
                    {kind === 'personal' ? 'Personal' : 'Team'}
                  </span>
                  <span className="wiki-hub-count">
                    {pages.length} page{pages.length === 1 ? '' : 's'}
                  </span>
                </header>
                <p className="wiki-hub-signal">{signal}</p>
                <Link className="wiki-hub-title" href={`/wiki/${space.key}`}>
                  {space.name}
                </Link>
                <p className="wiki-hub-key">{space.key}</p>
                {space.description ? (
                  <p className="wiki-hub-desc">{space.description}</p>
                ) : null}
                <footer className="wiki-hub-card-foot">
                  {canSettings ? (
                    <Link className="wiki-hub-perm" href={`/wiki/${space.key}/settings`}>
                      Permissions
                    </Link>
                  ) : (
                    <span className="muted">View only</span>
                  )}
                  <Link className="wiki-hub-open" href={`/wiki/${space.key}`}>
                    Open →
                  </Link>
                </footer>
              </article>
            );
          }))}
        </section>
      )}
    </WikiDesk>
  );
}
