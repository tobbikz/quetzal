import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addSiteMemberAction, removeSiteMemberAction } from '@/app/settings/sites/actions';
import { listUsers } from '@/lib/db';
import { currentUser } from '@/lib/session';
import { getSiteById, listSiteMembers, listSites } from '@/lib/sites';

export default async function SitesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== 'admin') redirect('/');

  const params = await searchParams;
  const sites = await listSites();
  const selectedId = Number(params.site);
  const site =
    (Number.isInteger(selectedId) && selectedId > 0 ? await getSiteById(selectedId) : undefined) ??
    sites[0];
  if (!site) {
    return (
      <main className="page">
        <p className="muted">No sites configured.</p>
      </main>
    );
  }

  const members = await listSiteMembers(site.id);
  const memberIds = new Set(members.map((m) => m.userId));
  const candidates = (await listUsers()).filter((person) => !memberIds.has(person.id));

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <Link className="crumb" href="/settings">
          Settings
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">Sites</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Sites</h1>
            <p className="page-sub">
              Manage which people can switch into each site. Admins stay on every site.
            </p>
          </div>
        </div>

        <div className="row-actions" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {sites.map((item) => (
            <Link
              key={item.id}
              className={item.id === site.id ? 'btn' : 'btn-secondary'}
              href={`/settings/sites?site=${item.id}`}
            >
              {item.key} · {item.name}
            </Link>
          ))}
        </div>

        <section className="panel">
          <div className="panel-head">
            Members · {site.key} ({members.length})
          </div>
          <div className="panel-body">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId}>
                    <td>{member.name}</td>
                    <td className="muted">{member.email}</td>
                    <td>{member.role}</td>
                    <td>
                      {member.role === 'admin' ? (
                        <span className="muted">Protected</span>
                      ) : (
                        <form action={removeSiteMemberAction}>
                          <input type="hidden" name="site_id" value={site.id} />
                          <input type="hidden" name="user_id" value={member.userId} />
                          <button type="submit" className="btn-secondary">
                            Remove
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" style={{ marginTop: '0.75rem' }}>
          <div className="panel-head">Add member</div>
          <form className="panel-body stack" action={addSiteMemberAction}>
            <input type="hidden" name="site_id" value={site.id} />
            <label className="field">
              <span>User</span>
              <select name="user_id" required disabled={candidates.length === 0}>
                <option value="">
                  {candidates.length === 0 ? 'Everyone is already a member' : 'Select a person…'}
                </option>
                {candidates.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.role}
                  </option>
                ))}
              </select>
            </label>
            <div className="row-actions">
              <button type="submit" className="btn" disabled={candidates.length === 0}>
                Add to {site.key}
              </button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
