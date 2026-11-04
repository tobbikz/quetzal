import Link from 'next/link';

const LINKS = [
  {
    href: '/settings/integrations',
    title: 'Integrations',
    blurb: 'Outbound webhooks, Slack Incoming Webhook, and connectors.',
  },
  {
    href: '/settings/ldap',
    title: 'LDAP',
    blurb: 'Directory bind for corporate users; local passwords stay available.',
  },
  {
    href: '/settings/sso',
    title: 'SSO',
    blurb: 'SAML ACS + OIDC authorization code for local sign-in.',
  },
  {
    href: '/settings/fields',
    title: 'Custom fields',
    blurb: 'Fields, screens, and project contexts.',
  },
  {
    href: '/settings/sites',
    title: 'Sites',
    blurb: 'Multi-site membership and switcher access.',
  },
  {
    href: '/settings/notifications',
    title: 'Notifications',
    blurb: 'In-app delivery plus SMTP / Slack channel config.',
  },
  {
    href: '/settings/workflows',
    title: 'Workflows',
    blurb: 'Statuses, transitions, conditions, and validators.',
  },
  {
    href: '/admin/audit',
    title: 'Admin',
    blurb: 'Audit log, backup, and user roles.',
  },
] as const;

export default function SettingsHubPage() {
  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">Settings</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-sub">Admin configuration for Quetzal desk.</p>
          </div>
        </div>

        <div className="settings-hub">
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="settings-hub-card">
              <span className="settings-hub-title">{item.title}</span>
              <span className="settings-hub-blurb">{item.blurb}</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
