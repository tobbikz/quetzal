import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createPageAction } from '@/app/actions';
import { WikiDesk } from '@/components/WikiDesk';
import { WikiEditor } from '@/components/WikiEditor';
import { canManageSpaceAcl, canWriteWiki } from '@/lib/acl';
import { getSpace } from '@/lib/db';
import { currentUser } from '@/lib/session';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import { getPageTemplate, listPageTemplates } from '@/lib/wikiExtras';

export default async function NewPage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { space } = await params;
  const { template } = await searchParams;
  const found = await getSpace(space.toUpperCase());
  if (!found) notFound();
  const me = await currentUser();
  if (!(await canWriteWiki(me, found.key))) redirect(`/wiki/${found.key}`);
  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);
  const pages = branches.find((b) => b.space.key === found.key)?.pages ?? [];
  const canSettings = await canManageSpaceAcl(me, found.key);
  const templates = await listPageTemplates(found.id);
  const templateId = template && /^\d+$/.test(template) ? Number(template) : null;
  const named =
    template && !templateId
      ? templates.find((item) => item.name.toLowerCase() === template.toLowerCase())
      : undefined;
  const chosen =
    (templateId ? await getPageTemplate(templateId) : undefined) ||
    named ||
    templates.find((item) => item.name === 'Blank') ||
    templates[0];
  const defaultLabels = chosen?.name.toLowerCase() === 'blog' ? 'blog' : '';
  const spaceLabel = found.kind === 'personal' ? 'Personal' : found.name;

  return (
    <WikiDesk
      personal={personal}
      team={team}
      currentSpaceKey={found.key}
      browseAll={branches}
      pages={pages}
      canEdit
      canSettings={canSettings}
      crumbs={[
        { href: '/wiki', label: 'Wiki' },
        { href: `/wiki/${found.key}`, label: spaceLabel },
        { label: 'New page' },
      ]}
    >
      <header className="wdesk-section-head">
        <div>
          <h1 className="wdesk-title">New page</h1>
          <p className="wdesk-sub">
            Publish into {found.name} ({found.key}).
          </p>
        </div>
      </header>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Templates</span>
        </div>
        <div className="wdesk-panel-body">
          <div className="wdesk-templates">
            {templates.map((item) => {
              const active = chosen?.id === item.id;
              return (
                <Link
                  key={item.id}
                  className={active ? 'btn' : 'btn-secondary'}
                  href={`/wiki/${found.key}/new?template=${item.id}`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <form className="wdesk-article" action={createPageAction}>
        <div className="wdesk-article-head">
          <h2 className="wdesk-article-title">Compose</h2>
        </div>
        <div className="wdesk-article-body stack">
          <input type="hidden" name="space" value={found.key} />
          <label className="field">
            <span>Parent</span>
            <select name="parent" defaultValue="">
              <option value="">Top of the space</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Title</span>
            <input type="text" name="title" required defaultValue={chosen?.title || ''} />
          </label>
          <label className="field">
            <span>Labels</span>
            <input
              type="text"
              name="labels"
              defaultValue={defaultLabels}
              placeholder="blog, docs, runbook"
            />
          </label>
          <label className="field">
            <span>Body · tip: type / for macros</span>
            <WikiEditor name="body" initial={chosen?.body || '<p></p>'} />
          </label>
          <div className="row-actions">
            <button className="btn" type="submit">
              Publish
            </button>
            <Link className="btn-secondary" href={`/wiki/${found.key}`}>
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </WikiDesk>
  );
}