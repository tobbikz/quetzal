import Link from 'next/link';
import { WikiDesk } from '@/components/WikiDesk';
import { canManageSpaceAcl } from '@/lib/acl';
import { getUser } from '@/lib/db';
import { formatWhen } from '@/lib/format';
import { currentSite, currentUser } from '@/lib/session';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import { listWikiHomeActivity } from '@/lib/wikiExtras';

const KIND_LABEL = {
  updated: 'Updated',
  edited: 'Edited',
  comment: 'Commented',
} as const;

export default async function WikiHome() {
  const user = await currentUser();
  const site = await currentSite();
  const { personal, team, branches } = await loadWikiBrowseBranches(user.id, site.id);
  const cards = [
    { space: personal, kind: 'personal' as const },
    ...team.map((space) => ({ space, kind: 'team' as const })),
  ];
  const activityRaw = await listWikiHomeActivity(18);
  const activity = await Promise.all(
    activityRaw.map(async (item) => ({
      ...item,
      who: (await getUser(item.authorId))?.name || 'Someone',
    })),
  );
  const spaceRows = await Promise.all(
    cards.map(async ({ space, kind }) => ({
      space,
      kind,
      pages: branches.find((b) => b.space.key === space.key)?.pages ?? [],
      canSettings: await canManageSpaceAcl(user, space.key),
    })),
  );

  return (
    <WikiDesk
      personal={personal}
      team={team}
      currentSpaceKey={null}
      browseAll={branches}
      crumbs={[{ label: 'Wiki' }, { label: 'Home' }]}
    >
      <header className="wiki-hub-hero wiki-hub-hero--nested">
        <div className="wiki-hub-hero-copy">
          <p className="wiki-hub-kicker">Wiki</p>
          <h1 className="wiki-hub-hero-title">Home</h1>
          <p className="wiki-hub-hero-lede">
            Recent page activity across {site.name}. Browse the tree or jump into a space.
          </p>
        </div>
        <div className="wiki-home-cta-row">
          <Link className="btn" href={`/wiki/${personal.key}`}>
            Open personal
          </Link>
          <Link className="btn-secondary" href="/search">
            Search
          </Link>
        </div>
      </header>

      <div className="wiki-home-layout">
        <section className="wdesk-panel wiki-home-activity">
          <div className="wdesk-panel-head">
            <span>Recent activity</span>
          </div>
          <div className="wdesk-panel-body">
            {activity.length === 0 ? (
              <p className="muted">No wiki activity yet. Open a space and publish a page.</p>
            ) : (
              <ul className="wiki-home-feed">
                {activity.map((item) => (
                  <li key={`${item.kind}-${item.pageId}-${item.at}-${item.detail || ''}`}>
                    <span className={`wiki-home-kind wiki-home-kind--${item.kind}`}>
                      {KIND_LABEL[item.kind]}
                    </span>
                    <div className="wiki-home-feed-main">
                      <Link href={`/wiki/${item.spaceKey}/${item.slug}`}>{item.title}</Link>
                      <span className="faint">
                        {item.spaceKey} · {item.who}
                        {item.detail ? ` · ${item.detail}` : ''} · {formatWhen(item.at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="wiki-home-spaces" aria-label="Your spaces">
          <div className="wdesk-panel-head wiki-home-spaces-head">
            <span>Spaces</span>
            <Link href="/wiki/spaces" className="wiki-home-spaces-all">
              All spaces →
            </Link>
          </div>
          <ul className="wiki-home-space-list">
            {spaceRows.map(({ space, kind, pages, canSettings }) => (
              <li key={space.key} className="wiki-home-space-row">
                <Link href={`/wiki/${space.key}`} className="wiki-home-space-link">
                  <span className={`wiki-hub-scope wiki-hub-scope--${kind}`}>
                    {kind === 'personal' ? 'Personal' : 'Team'}
                  </span>
                  <strong>{space.name}</strong>
                  <span className="faint">
                    {space.key} · {pages.length} page{pages.length === 1 ? '' : 's'}
                  </span>
                </Link>
                {canSettings ? (
                  <Link className="wiki-hub-perm" href={`/wiki/${space.key}/settings`}>
                    Permissions
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </WikiDesk>
  );
}
