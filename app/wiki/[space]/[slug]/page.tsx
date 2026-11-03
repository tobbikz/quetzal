import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { addPageCommentAction, updatePageAction } from '@/app/actions';
import { softDeletePageAction } from '@/app/wiki/[space]/wiki-actions';
import { CommentComposer } from '@/components/CommentComposer';
import { Markdown } from '@/components/Markdown';
import { WikiAttachForm } from '@/components/WikiAttachForm';
import { WikiDesk } from '@/components/WikiDesk';
import { WikiEditor } from '@/components/WikiEditor';
import { WikiHtml } from '@/components/WikiHtml';
import { WikiPageMenu } from '@/components/WikiPageMenu';
import { canManageSpaceAcl, canViewWiki, canWriteWiki } from '@/lib/acl';
import {
  getPage,
  getSpace,
  getUser,
  listPageComments,
  listUsers,
} from '@/lib/db';
import { formatWhen } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import {
  getPageViewCount,
  incrementPageView,
  isPageTrashed,
  listPageAttachments,
  listPageLabels,
  listPageProperties,
  listPageRevisions,
} from '@/lib/wikiExtras';

export default async function WikiPageView({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { space, slug } = await params;
  const { edit: editParam } = await searchParams;
  const me = await currentUser();
  const found = await getSpace(space.toUpperCase());
  const page = found ? await getPage(found.key, slug) : undefined;
  if (!found || !page) notFound();
  const trashed = await isPageTrashed(page.id);
  const canEdit = await canWriteWiki(me, found.key, page.id);
  if (trashed && !canEdit) notFound();
  if (!(await canViewWiki(me, found.key, page.id))) redirect('/wiki/spaces');
  const canSettings = await canManageSpaceAcl(me, found.key);
  const edit = Boolean(editParam) && canEdit && !trashed;
  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);
  const pages = branches.find((b) => b.space.key === found.key)?.pages ?? [];
  const comments = await listPageComments(page.id);
  const author = await getUser(page.authorId);
  const labels = await listPageLabels(page.id);
  const properties = await listPageProperties(page.id);
  const attachments = await listPageAttachments(page.id);
  const versions = await listPageRevisions(page.id);
  const views = !edit && !trashed ? incrementPageView(page.id) : getPageViewCount(page.id);
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
        { label: page.title },
      ]}
    >
      {trashed ? (
        <p className="wdesk-banner">
          This page is in the trash.{' '}
          <Link href={`/wiki/${found.key}/trash`}>Open trash</Link> to restore it.
        </p>
      ) : null}

      <article className="wdesk-article">
        <header className="wdesk-article-head">
          <div>
            <h1 className="wdesk-article-title">{edit ? 'Edit page' : page.title}</h1>
            {!edit ? (
              <p className="wdesk-article-meta">
                Updated {formatWhen(page.updatedAt)} · {author?.name} · {views} views
              </p>
            ) : null}
          </div>
          <div className="wdesk-article-actions">
            {!edit && canEdit && !trashed ? (
              <Link className="btn" href={`/wiki/${found.key}/${page.slug}?edit=1`}>
                Edit
              </Link>
            ) : null}
            <WikiPageMenu
              spaceKey={found.key}
              slug={page.slug}
              canEdit={canEdit}
              canSettings={canSettings}
              trashed={trashed}
              editing={edit}
              showEditInMenu={false}
              trashAction={softDeletePageAction}
            />
          </div>
        </header>
        <div className="wdesk-article-body">
          {edit ? (
            <form action={updatePageAction} className="stack">
              <input type="hidden" name="space" value={found.key} />
              <input type="hidden" name="slug" value={page.slug} />
              <label className="field">
                <span>Title</span>
                <input type="text" name="title" defaultValue={page.title} required />
              </label>
              <label className="field">
                <span>Labels</span>
                <input
                  type="text"
                  name="labels"
                  defaultValue={labels.join(', ')}
                  placeholder="ops, runbook, handbook"
                />
              </label>
              <label className="field">
                <span>Properties (key=value per line)</span>
                <textarea
                  name="properties"
                  rows={3}
                  defaultValue={properties.map((prop) => `${prop.key}=${prop.value}`).join('\n')}
                  placeholder="owner=Ana&#10;status=active"
                />
              </label>
              <label className="field">
                <span>Body · tip: type / for macros</span>
                <WikiEditor name="body" initial={page.body} />
              </label>
              <div className="row-actions">
                <button className="btn" type="submit">
                  Save
                </button>
                <Link className="btn-secondary" href={`/wiki/${found.key}/${page.slug}`}>
                  Cancel
                </Link>
              </div>
            </form>
          ) : (
            <>
              {labels.length > 0 ? (
                <p className="wiki-labels">
                  {labels.map((label) => (
                    <span key={label} className="tag">
                      {label}
                    </span>
                  ))}
                </p>
              ) : null}
              {/^\s*</.test(page.body) || /<\/(p|h[1-6]|ul|ol)\b/i.test(page.body) ? (
                <WikiHtml
                  html={page.body}
                  spaceKey={found.key}
                  slug={page.slug}
                  currentUserId={me.id}
                />
              ) : (
                <Markdown source={page.body} />
              )}
            </>
          )}
        </div>
      </article>

      {!trashed ? (
        <section className="wdesk-panel">
          <div className="wdesk-panel-head">
            <span>Attachments</span>
            <span className="wdesk-panel-actions">
              {canEdit ? <WikiAttachForm space={found.key} slug={page.slug} /> : null}
            </span>
          </div>
          <div className="wdesk-panel-body">
            {attachments.length === 0 ? (
              <p className="muted">No files yet.</p>
            ) : (
              <ul className="wiki-attach-list">
                {attachments.map((file) => {
                  const isImage = file.mime.startsWith('image/');
                  const sizeLabel =
                    file.size >= 1024 * 1024
                      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
                  return (
                    <li key={file.id} className="wiki-attach-item">
                      {isImage ? (
                        <a
                          className="wiki-attach-preview"
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={file.url} alt={file.filename} loading="lazy" />
                        </a>
                      ) : null}
                      <div className="wiki-attach-meta">
                        <a href={file.url} download={file.filename} target="_blank" rel="noreferrer">
                          {file.filename}
                        </a>
                        <span className="faint">
                          {' '}
                          · {sizeLabel}
                          {file.mime ? ` · ${file.mime}` : ''}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {!edit && versions.length > 0 ? (
        <section className="wdesk-panel">
          <div className="wdesk-panel-head">
            <span>Change history</span>
            <span className="wdesk-panel-actions">
              <Link href={`/wiki/${found.key}/${page.slug}/history`}>All + diff</Link>
            </span>
          </div>
          <div className="wdesk-panel-body">
            <ol className="wdesk-list">
              {versions.slice(0, 12).map(async (item) => (
                <li key={item.id}>
                  <strong>v{item.version}</strong>
                  <span>{item.title}</span>
                  <span className="faint">
                    {(await getUser(item.authorId))?.name || 'Someone'} · {formatWhen(item.createdAt)}
                  </span>
                  <Link href={`/wiki/${found.key}/${page.slug}/history/${item.version}`}>Diff</Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {!edit && !trashed ? (
        <section className="wdesk-panel">
          <div className="wdesk-panel-head">
            <span>Comments</span>
          </div>
          <div className="wdesk-panel-body">
            {comments.map(async (comment) => (
              <article key={comment.id} className="comment">
                <div className="comment-head">
                  <span className="avatar">
                    {((await getUser(comment.authorId))?.name ?? '?').slice(0, 1)}
                  </span>
                  <span className="comment-name">{(await getUser(comment.authorId))?.name}</span>
                  <span className="muted">{formatWhen(comment.createdAt)}</span>
                </div>
                <div className="comment-body">
                  {/^\s*</.test(comment.body) || /<\/(p|ul|ol|strong|em|a)\b/i.test(comment.body) ? (
                    <WikiHtml html={comment.body} />
                  ) : (
                    <Markdown source={comment.body} people={await listUsers()} />
                  )}
                </div>
              </article>
            ))}
            <CommentComposer
              action={addPageCommentAction}
              fields={[
                { name: 'space', value: found.key },
                { name: 'slug', value: page.slug },
              ]}
              placeholder="Comment"
              submitLabel="Add comment"
              mentions={(await listUsers()).map((person) => person.name)}
              openLabel="Add a comment"
            />
          </div>
        </section>
      ) : null}
    </WikiDesk>
  );
}
