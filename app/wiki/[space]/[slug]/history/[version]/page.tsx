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
import {
  diffText,
  getPageRevision,
  isPageTrashed,
  listPageRevisions,
} from '@/lib/wikiExtras';

export default async function PageHistoryDiff({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; slug: string; version: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  const { space, slug, version: versionRaw } = await params;
  const { compare: compareRaw } = await searchParams;
  const version = Number(versionRaw);
  if (!Number.isFinite(version) || version < 1) notFound();

  const me = await currentUser();
  const found = await getSpace(space.toUpperCase());
  const page = found ? await getPage(found.key, slug) : undefined;
  if (!found || !page) notFound();
  if (!(await canViewWiki(me, found.key, page.id))) redirect('/wiki/spaces');
  if ((await isPageTrashed(page.id)) && !(await canWriteWiki(me, found.key, page.id))) notFound();

  const left = await getPageRevision(page.id, version);
  if (!left) notFound();

  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);
  const pages = branches.find((b) => b.space.key === found.key)?.pages ?? [];
  const canEdit = await canWriteWiki(me, found.key, page.id);
  const canSettings = await canManageSpaceAcl(me, found.key);

  const revisions = await listPageRevisions(page.id);
  const compareVersion = compareRaw && /^\d+$/.test(compareRaw) ? Number(compareRaw) : null;
  const compared =
    compareVersion != null ? await getPageRevision(page.id, compareVersion) : undefined;
  const newer = revisions.find((item) => item.version > left.version);
  const right =
    compared ??
    newer ?? {
      version: 0,
      title: page.title,
      body: page.body,
      authorId: page.authorId,
      createdAt: page.updatedAt,
      id: 0,
      pageId: page.id,
    };

  const titleDiff = diffText(left.title, right.title);
  const bodyDiff = diffText(left.body, right.body);
  const rightLabel = right.version > 0 ? `v${right.version}` : 'current';
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
        { href: `/wiki/${found.key}/${page.slug}/history`, label: 'History' },
        { label: `v${left.version} → ${rightLabel}` },
      ]}
    >
      <header className="wdesk-section-head">
        <div>
          <h1 className="wdesk-title">
            Diff v{left.version} → {rightLabel}
          </h1>
          <p className="wdesk-sub">
            {(await getUser(left.authorId))?.name || 'Someone'} · {formatWhen(left.createdAt)}
            {right.version > 0 ? (
              <>
                {' '}
                → {(await getUser(right.authorId))?.name || 'Someone'} · {formatWhen(right.createdAt)}
              </>
            ) : (
              <> → live page</>
            )}
          </p>
        </div>
        <Link className="btn-secondary" href={`/wiki/${found.key}/${page.slug}/history`}>
          All revisions
        </Link>
      </header>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Title</span>
        </div>
        <div className="wdesk-panel-body">
          <pre className="wiki-diff">
            {titleDiff.map((line, idx) => (
              <div key={`t-${idx}`} className={`wiki-diff-line wiki-diff-${line.type}`}>
                <span className="wiki-diff-mark">
                  {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
                </span>
                {line.text || ' '}
              </div>
            ))}
          </pre>
        </div>
      </section>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Body</span>
        </div>
        <div className="wdesk-panel-body">
          <pre className="wiki-diff">
            {bodyDiff.map((line, idx) => (
              <div key={`b-${idx}`} className={`wiki-diff-line wiki-diff-${line.type}`}>
                <span className="wiki-diff-mark">
                  {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
                </span>
                {line.text || ' '}
              </div>
            ))}
          </pre>
        </div>
      </section>
    </WikiDesk>
  );
}
