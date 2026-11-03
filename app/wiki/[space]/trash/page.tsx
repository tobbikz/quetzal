import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { restorePageAction } from '@/app/wiki/[space]/wiki-actions';
import { WikiDesk } from '@/components/WikiDesk';
import { canManageSpaceAcl, canViewWiki, canWriteWiki } from '@/lib/acl';
import { getSpace, getUser } from '@/lib/db';
import { formatWhen } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import { listTrashedPages } from '@/lib/wikiExtras';

export default async function SpaceTrashPage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string }>;
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { space } = await params;
  const { deleted } = await searchParams;
  const me = await currentUser();
  const found = await getSpace(space.toUpperCase());
  if (!found) notFound();
  if (!(await canViewWiki(me, found.key))) redirect('/wiki/spaces');
  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);
  const pages = branches.find((b) => b.space.key === found.key)?.pages ?? [];
  const items = await listTrashedPages(found.key);
  const canEdit = await canWriteWiki(me, found.key);
  const canSettings = await canManageSpaceAcl(me, found.key);
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
        { label: 'Trash' },
      ]}
    >
      <header className="wdesk-section-head">
        <div>
          <h1 className="wdesk-title">Trash</h1>
          <p className="wdesk-sub">Soft-deleted pages. Restore to put them back in the tree.</p>
        </div>
      </header>

      {deleted === '1' ? <p className="wdesk-flash">Page moved to trash.</p> : null}

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Deleted · {items.length}</span>
        </div>
        <div className="wdesk-panel-body">
          {items.length === 0 ? (
            <p className="muted">Trash is empty.</p>
          ) : (
            <div>
              {items.map(async (item) => (
                <div key={item.id} className="wdesk-row">
                  <div>
                    <Link href={`/wiki/${item.spaceKey}/${item.slug}`}>{item.title}</Link>
                    <div className="faint">{item.slug}</div>
                  </div>
                  <div className="muted">
                    {formatWhen(item.deletedAt)}
                    <br />
                    {item.deletedBy ? (await getUser(item.deletedBy))?.name || '—' : '—'}
                  </div>
                  <div>
                    {canEdit ? (
                      <form action={restorePageAction}>
                        <input type="hidden" name="space" value={found.key} />
                        <input type="hidden" name="slug" value={item.slug} />
                        <button className="btn-secondary" type="submit">
                          Restore
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </WikiDesk>
  );
}
