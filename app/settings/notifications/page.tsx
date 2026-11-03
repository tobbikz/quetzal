import Link from 'next/link';
import { redirect } from 'next/navigation';
import { saveNotifySettingsAction } from '@/app/settings/notifications/actions';
import { getEffectiveNotifyConfig, getNotifyChannelSettings } from '@/lib/notify';
import { currentUser } from '@/lib/session';

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== 'admin') redirect('/');

  const params = await searchParams;
  const settings = await getNotifyChannelSettings();
  const effective = await getEffectiveNotifyConfig();

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
        <span className="crumb current">Notifications</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-sub">
              Outbound mail (SMTP) and Slack webhook. In-app notifications always work.
            </p>
          </div>
        </div>

        {params.saved === '1' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Settings saved.
          </p>
        ) : null}

        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-head">Status</div>
          <div className="panel-body stack">
            <p className="muted" style={{ margin: 0 }}>
              Mail: {effective.mailReady ? 'ready' : 'not ready'}
              {effective.smtpFromEnv ? ' (env override)' : ''} · Slack:{' '}
              {effective.slackReady ? 'ready' : 'not ready'}
              {effective.slackFromEnv ? ' (env override)' : ''}
            </p>
          </div>
        </section>

        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-head">Environment overrides</div>
          <div className="panel-body stack">
            <p className="muted" style={{ margin: 0 }}>
              Non-empty env vars win over the form values below:
            </p>
            <ul className="muted" style={{ margin: 0, paddingLeft: '1.25rem' }}>
              <li>
                <code>QUETZAL_SMTP_HOST</code>, <code>QUETZAL_SMTP_PORT</code>,{' '}
                <code>QUETZAL_SMTP_USER</code>, <code>QUETZAL_SMTP_PASS</code>,{' '}
                <code>QUETZAL_SMTP_FROM</code>
              </li>
              <li>
                <code>QUETZAL_SLACK_WEBHOOK</code> — Incoming Webhook URL
              </li>
              <li>
                <code>QUETZAL_BASE_URL</code> — absolute links in messages (default{' '}
                <code>http://127.0.0.1:3210</code>)
              </li>
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">Channels</div>
          <form className="panel-body stack" action={saveNotifySettingsAction}>
            <label className="field field--check">
              <input
                type="checkbox"
                name="mail_enabled"
                value="1"
                defaultChecked={settings.mailEnabled}
              />
              <span>Enable SMTP email</span>
            </label>

            <label className="field">
              <span>SMTP host</span>
              <input
                type="text"
                name="smtp_host"
                defaultValue={settings.smtpHost}
                placeholder="smtp.example.com"
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>SMTP port</span>
              <input
                type="number"
                name="smtp_port"
                defaultValue={settings.smtpPort}
                min={1}
                max={65535}
              />
            </label>

            <label className="field">
              <span>SMTP user</span>
              <input
                type="text"
                name="smtp_user"
                defaultValue={settings.smtpUser}
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>SMTP password</span>
              <input
                type="password"
                name="smtp_pass"
                placeholder={settings.smtpPass ? '•••••••• (unchanged if blank)' : ''}
                autoComplete="new-password"
              />
            </label>

            <label className="field">
              <span>From address</span>
              <input
                type="text"
                name="smtp_from"
                defaultValue={settings.smtpFrom}
                placeholder="Quetzal <noreply@example.com>"
              />
            </label>

            <hr style={{ border: 0, borderTop: '1px solid var(--border, #ddd)', margin: '0.5rem 0' }} />

            <label className="field field--check">
              <input
                type="checkbox"
                name="slack_enabled"
                value="1"
                defaultChecked={settings.slackEnabled}
              />
              <span>Enable Slack webhook</span>
            </label>

            <label className="field">
              <span>Slack webhook URL</span>
              <input
                type="url"
                name="slack_webhook_url"
                defaultValue={settings.slackWebhookUrl}
                placeholder="https://hooks.slack.com/services/…"
                autoComplete="off"
              />
            </label>

            <div className="row-actions">
              <button type="submit" className="btn">
                Save
              </button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
