import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { savePageAclAction } from '@/app/wiki/[space]/wiki-actions';
import { WikiDesk } from '@/components/WikiDesk';
import { canManageSpaceAcl, canViewWiki, canWriteWiki } from '@/lib/acl';
import {
  getPage,
  getSpace,
  getUser,
  listUsers,
} from '@/lib/db';
import { listPagePermissions } from '@/lib/permissions';
import { currentUser } from '@/lib/session';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';
import {
  getPageViewCount,
  isPageTrashed,
  listPageRevisions,
} from '@/lib/wikiExtras';

export default async function PageSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { space, slug } = await params;
  const { saved } = await searchParams;
  const me = await currentUser();
  const found = await getSpace(space.toUpperCase());
  const page = found ? await getPage(found.key, slug) : undefined;
  if (!found || !page) notFound();
  if (!(await canViewWiki(me, found.key, page.id))) redirect('/wiki/spaces');
  if (!(await canManageSpaceAcl(me, found.key))) redirect(`/wiki/${found.key}/${page.slug}`);

  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);
  const pages = branches.find((b) => b.space.key === found.key)?.pages ?? [];
  const canEdit = await canWriteWiki(me, found.key, page.id);

  const grants = await listPagePermissions(page.id);
  const hasOverrides = grants.length > 0;
  const viewAdmins =
    grants.some(
      (g) =>
        g.permission === 'VIEW_PAGE' &&
        g.granteeType === 'application_role' &&
        g.grantee === 'admin',
    ) &&
    !grants.some((g) => g.permission === 'VIEW_PAGE' && g.granteeType === 'anyone') &&
    !grants.some((g) => g.permission === 'VIEW_PAGE' && g.granteeType === 'space_member');
  const viewMembers = grants.some(
    (g) =>
      g.permission === 'VIEW_PAGE' &&
      (g.granteeType === 'space_member' ||
        (g.granteeType === 'application_role' && g.grantee === 'member')),
  );
  const editAdminsOnly =
    grants.filter((g) => g.permission === 'EDIT_PAGE').length > 0 &&
    grants
      .filter((g) => g.permission === 'EDIT_PAGE')
      .every((g) => g.granteeType === 'application_role' && g.grantee === 'admin');

  const viewDefault = !hasOverrides
    ? 'inherit'
    : viewAdmins
      ? 'admins'
      : viewMembers
        ? 'members'
        : 'everyone';
  const editDefault = !hasOverrides ? 'inherit' : editAdminsOnly ? 'admins' : 'members';
  const views = await getPageViewCount(page.id);
  const revisions = (await listPageRevisions(page.id)).length;
  const people = await listUsers();
  const trashed = await isPageTrashed(page.id);
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
      canSettings
      crumbs={[
        { href: '/wiki', label: 'Wiki' },
        { href: `/wiki/${found.key}`, label: spaceLabel },
        { href: `/wiki/${found.key}/${page.slug}`, label: page.title },
        { label: 'Restrictions' },
      ]}
    >
      <header className="wdesk-section-head">
        <div>
          <h1 className="wdesk-title">Page restrictions</h1>
          <p className="wdesk-sub">
            Override who can view or edit this page. Empty overrides inherit space permissions.
            {trashed ? ' · In trash' : ''}
          </p>
        </div>
      </header>

      {saved === '1' ? <p className="wdesk-flash">Page restrictions saved.</p> : null}

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Analytics</span>
        </div>
        <div className="wdesk-panel-body">
          <p>
            <strong>{views}</strong> views · <strong>{revisions}</strong> revisions · author{' '}
            {(await getUser(page.authorId))?.name || '—'}
          </p>
        </div>
      </section>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Restrictions</span>
        </div>
        <form className="wdesk-panel-body stack" action={savePageAclAction}>
          <input type="hidden" name="space" value={found.key} />
          <input type="hidden" name="slug" value={page.slug} />
          <label className="field">
            <span>Restriction mode</span>
            <select name="restrict_mode" defaultValue={hasOverrides ? 'custom' : 'inherit'}>
              <option value="inherit">Inherit from space</option>
              <option value="custom">Custom page rules</option>
            </select>
          </label>
          <div className="wiki-restrict-grid">
            <label className="field">
              <span>Who can view</span>
              <select
                name="view_mode"
                defaultValue={viewDefault === 'inherit' ? 'everyone' : viewDefault}
              >
                <option value="everyone">Everyone who can view the space</option>
                <option value="members">Space members + admins</option>
                <option value="admins">Admins only</option>
              </select>
            </label>
            <label className="field">
              <span>Who can edit</span>
              <select
                name="edit_mode"
                defaultValue={editDefault === 'inherit' ? 'members' : editDefault}
              >
                <option value="members">Space members + admins</option>
                <option value="admins">Admins only</option>
              </select>
            </label>
          </div>
          <p className="faint">
            Choosing “Inherit” clears page overrides. Viewers never gain edit via application role
            alone.
          </p>
          <div className="row-actions">
            <button className="btn" type="submit">
              Save restrictions
            </button>
            <Link className="btn-secondary" href={`/wiki/${found.key}/${page.slug}`}>
              Back to page
            </Link>
          </div>
        </form>
      </section>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Current page grants</span>
        </div>
        <div className="wdesk-panel-body">
          {grants.length === 0 ? (
            <p className="muted">No page overrides — space ACL applies.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Type</th>
                  <th>Grantee</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => {
                  const label =
                    grant.granteeType === 'user'
                      ? people.find((person) => String(person.id) === grant.grantee)?.name ||
                        grant.grantee
                      : grant.grantee || '—';
                  return (
                    <tr key={`${grant.permission}-${grant.granteeType}-${grant.grantee}`}>
                      <td>{grant.permission}</td>
                      <td>{grant.granteeType}</td>
                      <td>{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </WikiDesk>
  );
}
