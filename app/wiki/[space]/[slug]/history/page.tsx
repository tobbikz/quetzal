import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { WikiDesk } from '@/components/WikiDesk';
import { canManageSpaceAcl, canViewWiki, canWriteWiki } from '@/lib/acl';
import {
  getPage,
  getSpace,
  getUser,
} from '@/lib/db';
import { formatWhen } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import { getPageViewCount, isPageTrashed, listPageRevisions } from '@/lib/wikiExtras';

export default async function PageHistoryList({
  params,
}: {
  params: Promise<{ space: string; slug: string }>;
}) {
  const { space, slug } = await params;
  const me = await currentUser();
  const found = await getSpace(space.toUpperCase());
  const page = found ? await getPage(found.key, slug) : undefined;
  if (!found || !page) notFound();
  if (!(await canViewWiki(me, found.key, page.id))) redirect('/wiki/spaces');
  if ((await isPageTrashed(page.id)) && !(await canWriteWiki(me, found.key, page.id))) notFound();

  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);
  const pages = branches.find((b) => b.space.key === found.key)?.pages ?? [];
  const canEdit = await canWriteWiki(me, found.key, page.id);
  const canSettings = await canManageSpaceAcl(me, found.key);
  const revisions = await listPageRevisions(page.id);
  const views = await getPageViewCount(page.id);
  const spaceLabel = found.kind === 'personal' ? 'Personal' : found.name;

  return (
    <WikiDesk
      personal={personal}
      team={team}
      currentSpaceKey={found.key}
      browseAll={branches}
      pages={pages}
      currentSlug={page.slug}
      canEdit={canEdit}
      canSettings={canSettings}
      crumbs={[
        { href: '/wiki', label: 'Wiki' },
        { href: `/wiki/${found.key}`, label: spaceLabel },
        { href: `/wiki/${found.key}/${page.slug}`, label: page.title },
        { label: 'History' },
      ]}
    >
      <header className="wdesk-section-head">
        <div>
          <h1 className="wdesk-title">Page history</h1>
          <p className="wdesk-sub">
            Revisions on each save · {views} views · current: {page.title}
          </p>
        </div>
        <Link className="btn-secondary" href={`/wiki/${found.key}/${page.slug}`}>
          View page
        </Link>
      </header>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Revisions · {revisions.length}</span>
        </div>
        <div className="wdesk-panel-body">
          {revisions.length === 0 ? (
            <p className="muted">No revisions yet — edit and save to start history.</p>
          ) : (
            <div>
              {revisions.map(async (rev, index) => {
                const newer = index === 0 ? null : revisions[index - 1];
                const diffHref = newer
                  ? `/wiki/${found.key}/${page.slug}/history/${rev.version}?compare=${newer.version}`
                  : `/wiki/${found.key}/${page.slug}/history/${rev.version}`;
                return (
                  <div key={rev.id} className="wdesk-row">
                    <div>
                      <strong>v{rev.version}</strong> {rev.title}
                    </div>
                    <div className="muted">
                      {(await getUser(rev.authorId))?.name || 'Someone'}
                      <br />
                      {formatWhen(rev.createdAt)}
                    </div>
                    <div>
                      <Link className="btn-secondary" href={diffHref}>
                        Diff
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </WikiDesk>
  );
}
