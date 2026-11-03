import Link from 'next/link';
import { listUsers } from '@/lib/db';
import { setUserRoleAction } from '@/app/admin/users/actions';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const people = await listUsers();

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <Link className="crumb" href="/admin">
          Admin
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">Users</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Users</h1>
            <p className="page-sub">
              Application roles: admin, member, viewer. The last admin cannot be demoted.
            </p>
          </div>
          <div className="row-actions">
            <Link className="btn-secondary" href="/admin/audit">
              Audit
            </Link>
            <Link className="btn-secondary" href="/admin/backup">
              Backup
            </Link>
          </div>
        </div>

        {params.error ? (
          <p className="login-error" style={{ marginBottom: '0.75rem' }}>
            {params.error === 'last_admin'
              ? 'Cannot demote the last admin.'
              : params.error === 'invalid'
                ? 'Invalid role.'
                : 'Could not update role.'}
          </p>
        ) : null}
        {params.saved === '1' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Role updated.
          </p>
        ) : null}

        <section className="panel">
          <div className="panel-head">People ({people.length})</div>
          <div className="panel-body" style={{ padding: 0, overflowX: 'auto' }}>
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
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>{person.name}</td>
                    <td className="muted">{person.email}</td>
                    <td>
                      <form action={setUserRoleAction} className="row-actions" style={{ gap: '0.35rem' }}>
                        <input type="hidden" name="user_id" value={person.id} />
                        <label className="sr" htmlFor={`role-${person.id}`}>
                          Role for {person.name}
                        </label>
                        <select
                          id={`role-${person.id}`}
                          name="role"
                          defaultValue={person.role}
                          aria-label={`Role for ${person.name}`}
                        >
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                          <option value="viewer">viewer</option>
                        </select>
                        <button type="submit" className="btn-secondary">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="muted">#{person.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
