import Link from 'next/link';
import { redirect } from 'next/navigation';
import { saveLdapSettingsAction } from '@/app/settings/ldap/actions';
import { getLdapSettings } from '@/lib/ldap';
import { currentUser } from '@/lib/session';

export default async function LdapSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== 'admin') redirect('/');
  const params = await searchParams;
  const settings = await getLdapSettings();

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
        <span className="crumb current">LDAP</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">LDAP</h1>
            <p className="page-sub">
              Directory bind for corporate accounts. Local password users keep working when LDAP is
              off or when a user is marked local.
            </p>
          </div>
          <Link className="btn-secondary" href="/settings/integrations">
            Integrations
          </Link>
        </div>

        {params.saved === '1' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            LDAP settings saved.
          </p>
        ) : null}

        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-head">Status</div>
          <div className="panel-body">
            <span className={settings.enabled ? 'tag tag--ok' : 'tag tag--muted'}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">Directory</div>
          <form className="panel-body stack" action={saveLdapSettingsAction}>
            <label className="field field--check">
              <input type="checkbox" name="enabled" value="1" defaultChecked={settings.enabled} />
              <span>Enable LDAP authentication</span>
            </label>

            <label className="field">
              <span>Server URL</span>
              <input
                type="text"
                name="url"
                defaultValue={settings.url}
                placeholder="ldap://directory.example.com:389"
                autoComplete="off"
              />
            </label>

            <label className="field field--check">
              <input
                type="checkbox"
                name="start_tls"
                value="1"
                defaultChecked={settings.startTls}
              />
              <span>StartTLS before bind</span>
            </label>

            <label className="field">
              <span>Bind DN (service account)</span>
              <input
                type="text"
                name="bind_dn"
                defaultValue={settings.bindDn}
                placeholder="cn=readonly,dc=example,dc=com"
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>Bind password</span>
              <input
                type="password"
                name="bind_password"
                placeholder={settings.bindPassword ? '•••••••• (unchanged if blank)' : ''}
                autoComplete="new-password"
              />
            </label>

            <label className="field">
              <span>Base DN</span>
              <input
                type="text"
                name="base_dn"
                defaultValue={settings.baseDn}
                placeholder="ou=people,dc=example,dc=com"
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>User filter</span>
              <input
                type="text"
                name="user_filter"
                defaultValue={settings.userFilter}
                placeholder="(|(uid={{username}})(mail={{email}}))"
                autoComplete="off"
              />
            </label>
            <p className="muted" style={{ margin: 0, fontSize: '12px' }}>
              Placeholders: <code>{'{{username}}'}</code>, <code>{'{{email}}'}</code>
            </p>

            <label className="field">
              <span>Email attribute</span>
              <input type="text" name="email_attr" defaultValue={settings.emailAttr} />
            </label>

            <label className="field">
              <span>Display name attribute</span>
              <input type="text" name="name_attr" defaultValue={settings.nameAttr} />
            </label>

            <label className="field">
              <span>Default role for JIT users</span>
              <select name="default_role" defaultValue={settings.defaultRole}>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            </label>

            <div className="row-actions">
              <button type="submit" className="btn">
                Save LDAP
              </button>
              <Link className="btn-secondary" href="/admin/users">
                Local users
              </Link>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
