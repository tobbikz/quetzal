import Link from 'next/link';
import { redirect } from 'next/navigation';
import { saveSpaceAclAction } from '@/app/wiki/[space]/settings/actions';
import { WikiDesk } from '@/components/WikiDesk';
import { canManageSpaceAcl, canWriteWiki } from '@/lib/acl';
import {
  getSpace,
  listProjects,
  listUsers,
} from '@/lib/db';
import {
  SPACE_PERMS,
  listPermissionSchemes,
  listProjectRoles,
  listSchemeGrants,
  listSpacePermissions,
  userProjectRoleKeys,
} from '@/lib/permissions';
import { currentUser } from '@/lib/session';
import { loadWikiBrowseBranches } from '@/lib/wikiBrowse';

export default async function SpaceSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { space: raw } = await params;
  const { saved } = await searchParams;
  const me = await currentUser();
  const found = await getSpace(raw.toUpperCase());
  if (!found) redirect('/wiki/spaces');
  if (!(await canManageSpaceAcl(me, found.key))) redirect(`/wiki/${found.key}`);

  const { personal, team, branches } = await loadWikiBrowseBranches(me.id);
  const pages = branches.find((b) => b.space.key === found.key)?.pages ?? [];
  const canEdit = await canWriteWiki(me, found.key);
  const grants = await listSpacePermissions(found.id);
  const viewOpen = grants.some(
    (grant) => grant.permission === SPACE_PERMS.VIEW_SPACE && grant.granteeType === 'anyone',
  );
  const editAdminsOnly =
    grants
      .filter((grant) => grant.permission === SPACE_PERMS.EDIT_SPACE)
      .every((grant) => grant.granteeType === 'application_role' && grant.grantee === 'admin') &&
    grants.some((grant) => grant.permission === SPACE_PERMS.EDIT_SPACE);

  const schemes = await listPermissionSchemes();
  const projects = await listProjects();
  const people = await listUsers();
  const spaceLabel = found.kind === 'personal' ? 'Personal' : found.name;

  return (
    <WikiDesk
      personal={personal}
      team={team}
      currentSpaceKey={found.key}
      browseAll={branches}
      pages={pages}
      canEdit={canEdit}
      canSettings
      crumbs={[
        { href: '/wiki', label: 'Wiki' },
        { href: `/wiki/${found.key}`, label: spaceLabel },
        { label: 'Permissions' },
      ]}
    >
      <header className="wdesk-section-head">
        <div>
          <h1 className="wdesk-title">Space permissions</h1>
          <p className="wdesk-sub">
            Who can view and edit {found.name} ({found.key}). Page overrides live on each page&apos;s
            Restrictions menu.
          </p>
        </div>
      </header>

      {saved === '1' ? <p className="wdesk-flash">Space restrictions saved.</p> : null}

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Space restrictions</span>
        </div>
        <form className="wdesk-panel-body stack" action={saveSpaceAclAction}>
          <input type="hidden" name="space" value={found.key} />
          <div className="wiki-restrict-grid">
            <label className="field">
              <span>Who can view this space</span>
              <select name="view_mode" defaultValue={viewOpen ? 'everyone' : 'members'}>
                <option value="everyone">Everyone signed in</option>
                <option value="members">Space members + admins</option>
              </select>
            </label>
            <label className="field">
              <span>Who can edit pages</span>
              <select name="edit_mode" defaultValue={editAdminsOnly ? 'admins' : 'members'}>
                <option value="members">Space members + admins</option>
                <option value="admins">Admins only</option>
              </select>
            </label>
          </div>
          <p className="faint">
            Viewers never receive edit via application role. Use page Restrictions to tighten a single
            page.
          </p>
          <div className="row-actions">
            <button className="btn" type="submit">
              Save space ACL
            </button>
          </div>
        </form>
      </section>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Current space grants</span>
        </div>
        <div className="wdesk-panel-body">
          <table className="table">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Type</th>
                <th>Grantee</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr key={`${grant.permission}-${grant.granteeType}-${grant.grantee}`}>
                  <td>{grant.permission}</td>
                  <td>{grant.granteeType}</td>
                  <td>{grant.grantee || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wdesk-panel">
        <div className="wdesk-panel-head">
          <span>Issue permission schemes (read-only)</span>
        </div>
        <div className="wdesk-panel-body stack">
          {schemes.map(async (scheme) => {
            const schemeGrants = await listSchemeGrants(scheme.id);
            return (
              <div key={scheme.id}>
                <strong>{scheme.name}</strong>
                <p className="faint">{scheme.description}</p>
                <ul className="muted">
                  {schemeGrants.map((grant) => (
                    <li key={`${grant.permission}-${grant.granteeType}-${grant.grantee}`}>
                      {grant.permission} → {grant.granteeType}
                      {grant.grantee ? `:${grant.grantee}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div>
            <strong>Project roles</strong>
            {projects.map(async (project) => {
              const roles = await listProjectRoles(project.id);
              return (
                <div key={project.id} style={{ marginTop: '0.5rem' }}>
                  <div className="muted">
                    {project.key} · scheme #{project.permissionSchemeId}
                  </div>
                  {await Promise.all(
                    roles.map(async (role) => {
                      const matched: string[] = [];
                      for (const person of people) {
                        const keys = await userProjectRoleKeys(person.id, project.id);
                        if (keys.includes(role.key)) matched.push(person.name);
                      }
                      return (
                        <div key={role.id} className="faint">
                          {role.name}: {matched.join(', ') || '—'}
                        </div>
                      );
                    }),
                  )}
                </div>
              );
            })}
          </div>
          <Link className="btn-secondary" href={`/wiki/${found.key}`}>
            Back to space
          </Link>
        </div>
      </section>
    </WikiDesk>
  );
}
