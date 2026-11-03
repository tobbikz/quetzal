import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { WikiDesk } from '@/components/WikiDesk';
import { canManageSpaceAcl, canViewWiki, canWriteWiki } from '@/lib/acl';
import { getSpace, getUser } from '@/lib/db';
import { formatWhen } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import { listBlogPosts } from '@/lib/wikiExtras';

export default async function SpaceBlogPage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  const me = await currentUser();
  const found = await getSpace(space.toUpperCase());
  if (!found) notFound();
  if (!(await canViewWiki(me, found.key))) redirect('/wiki/spaces');
  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);
  const pages = branches.find((b) => b.space.key === found.key)?.pages ?? [];
  const posts = await listBlogPosts(found.key);
  const canEdit = await canWriteWiki(me, found.key);
  const canSettings = await canManageSpaceAcl(me, found.key);
  const blogTemplate = 'Blog';
  const spaceLabel = found.kind === 'personal' ? 'Personal' : found.name;

  return (
    <WikiDesk
      personal={personal}
      team={team}
      currentSpaceKey={found.key}
      browseAll={branches}
      pages={pages}
      canEdit={canEdit}
      canSettings={canSettings}
      crumbs={[
        { href: '/wiki', label: 'Wiki' },
        { href: `/wiki/${found.key}`, label: spaceLabel },
        { label: 'Blog' },
      ]}
    >
      <header className="wdesk-section-head">
        <div>
          <h1 className="wdesk-title">Blog</h1>
          <p className="wdesk-sub">
            Pages tagged <strong>blog</strong> in {found.name}.
          </p>
        </div>
        {canEdit ? (
          <Link
            className="btn"
            href={`/wiki/${found.key}/new?template=${encodeURIComponent(blogTemplate)}`}
          >
            New post
          </Link>
        ) : null}
      </header>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Posts · {posts.length}</span>
        </div>
        <div className="wdesk-panel-body">
          {posts.length === 0 ? (
            <p className="muted">
              No blog posts yet.
              {canEdit ? (
                <>
                  {' '}
                  <Link
                    href={`/wiki/${found.key}/new?template=${encodeURIComponent(blogTemplate)}`}
                  >
                    Create one from the Blog template
                  </Link>
                  .
                </>
              ) : null}
            </p>
          ) : (
            <ul className="wdesk-list">
              {posts.map(async (post) => (
                <li key={post.id}>
                  <Link href={`/wiki/${post.spaceKey}/${post.slug}`}>{post.title}</Link>
                  <span className="faint">
                    {formatWhen(post.updatedAt)} · {(await getUser(post.authorId))?.name || 'Someone'} ·{' '}
                    {post.viewCount} views
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </WikiDesk>
  );
}
