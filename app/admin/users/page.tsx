import Link from 'next/link';
import {
  createLocalUserAction,
  resetLocalPasswordAction,
  setUserRoleAction,
  toggleUserDisabledAction,
} from '@/app/admin/users/actions';
import { listUserAuthRecords } from '@/lib/db';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const people = await listUserAuthRecords();

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
              Local password accounts and LDAP-mirrored users. Roles: admin, member, viewer.
            </p>
          </div>
          <div className="row-actions">
            <Link className="btn-secondary" href="/settings/ldap">
              LDAP
            </Link>
            <Link className="btn-secondary" href="/admin/audit">
              Audit
            </Link>
          </div>
        </div>

        {params.error ? (
          <p className="login-error" style={{ marginBottom: '0.75rem' }}>
            {params.error === 'last_admin'
              ? 'Cannot demote the last admin.'
              : params.error === 'invalid'
                ? 'Invalid role or user.'
                : params.error === 'create'
                  ? 'Name, email, and password (6+ chars) are required.'
                  : params.error === 'exists'
                    ? 'That email already exists.'
                    : params.error === 'password'
                      ? 'Password must be at least 6 characters.'
                      : params.error === 'self'
                        ? 'You cannot disable your own account.'
                        : 'Could not update user.'}
          </p>
        ) : null}
        {params.saved === '1' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            User updated.
          </p>
        ) : null}
        {params.saved === 'created' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Local user created.
          </p>
        ) : null}
        {params.saved === 'password' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Password updated.
          </p>
        ) : null}

        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-head">Create local user</div>
          <form className="panel-body stack" action={createLocalUserAction}>
            <label className="field">
              <span>Name</span>
              <input type="text" name="name" required maxLength={80} />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" name="email" required autoComplete="off" />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" name="password" required minLength={6} autoComplete="new-password" />
            </label>
            <label className="field">
              <span>Role</span>
              <select name="role" defaultValue="member">
                <option value="member">member</option>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <div className="row-actions">
              <button type="submit" className="btn">
                Create user
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">People ({people.length})</div>
          <div className="panel-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Source</th>
                  <th>Role</th>
                  <th>Password</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>{person.name}</td>
                    <td className="muted">{person.email}</td>
                    <td>
                      <span className={person.authSource === 'ldap' ? 'tag tag--info' : 'tag tag--muted'}>
                        {person.authSource}
                      </span>
                    </td>
                    <td>
                      <form action={setUserRoleAction} className="row-actions" style={{ gap: '0.35rem' }}>
                        <input type="hidden" name="user_id" value={person.id} />
                        <select
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
                    <td>
                      <form action={resetLocalPasswordAction} className="row-actions" style={{ gap: '0.35rem' }}>
                        <input type="hidden" name="user_id" value={person.id} />
                        <input
                          type="password"
                          name="password"
                          placeholder={person.passwordHash ? 'Reset…' : 'Set…'}
                          minLength={6}
                          autoComplete="new-password"
                          style={{ width: '8rem' }}
                        />
                        <button type="submit" className="btn-secondary">
                          Set
                        </button>
                      </form>
                    </td>
                    <td>
                      <form action={toggleUserDisabledAction} className="row-actions">
                        <input type="hidden" name="user_id" value={person.id} />
                        <input type="hidden" name="disabled" value={person.disabled ? '0' : '1'} />
                        <span className={person.disabled ? 'tag tag--error' : 'tag tag--ok'}>
                          {person.disabled ? 'Disabled' : 'Active'}
                        </span>
                        <button type="submit" className="btn-secondary">
                          {person.disabled ? 'Enable' : 'Disable'}
                        </button>
                      </form>
                    </td>
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
