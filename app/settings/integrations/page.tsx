import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  createWebhookAction,
  deleteWebhookAction,
  saveConnectorsAction,
  saveSlackConnectorAction,
  toggleWebhookAction,
} from '@/app/settings/integrations/actions';
import { getConnectors } from '@/lib/connectors';
import { getEffectiveNotifyConfig, getNotifyChannelSettings } from '@/lib/notify';
import { currentUser } from '@/lib/session';
import { listWebhooks, WEBHOOK_EVENTS } from '@/lib/webhooks';

const EVENT_LABEL: Record<(typeof WEBHOOK_EVENTS)[number], string> = {
  'issue.status_changed': 'Issue status changed',
  'issue.comment_added': 'Issue comment added',
  'helpdesk.created': 'Helpdesk ticket created',
  'helpdesk.status_changed': 'Helpdesk status changed',
  'helpdesk.note_added': 'Helpdesk note added',
  'helpdesk.csat_submitted': 'Helpdesk CSAT submitted',
};

export default async function IntegrationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== 'admin') redirect('/');

  const params = await searchParams;
  const [hooks, settings, effective, connectors] = await Promise.all([
    listWebhooks(),
    getNotifyChannelSettings(),
    getEffectiveNotifyConfig(),
    getConnectors(),
  ]);

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
        <span className="crumb current">Integrations</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Integrations</h1>
            <p className="page-sub">
              Outbound webhooks and connectors. SMTP details stay under{' '}
              <Link href="/settings/notifications">Notifications</Link>.
            </p>
          </div>
        </div>

        {params.saved === 'webhook' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Webhooks updated.
          </p>
        ) : null}
        {params.saved === 'slack' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Slack connector saved.
          </p>
        ) : null}
        {params.saved === 'connectors' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Connectors saved.
          </p>
        ) : null}
        {params.error === 'webhook' ? (
          <p className="muted" style={{ marginBottom: '0.75rem', color: 'var(--danger, #b91c1c)' }}>
            Could not create webhook — URL must be http(s).
          </p>
        ) : null}

        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-head">Status</div>
          <div className="panel-body stack">
            <div className="row-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className={effective.slackReady ? 'tag tag--ok' : 'tag tag--muted'}>
                Slack {effective.slackReady ? 'ready' : 'not ready'}
                {effective.slackFromEnv ? ' · env' : ''}
              </span>
              <span className={effective.mailReady ? 'tag tag--ok' : 'tag tag--muted'}>
                Email {effective.mailReady ? 'ready' : 'not ready'}
                {effective.smtpFromEnv ? ' · env' : ''}
              </span>
              <span className={connectors.teamsEnabled ? 'tag tag--ok' : 'tag tag--muted'}>
                Teams {connectors.teamsEnabled ? 'on' : 'off'}
              </span>
              <span className={connectors.githubEnabled ? 'tag tag--ok' : 'tag tag--muted'}>
                GitHub {connectors.githubEnabled ? 'on' : 'off'}
              </span>
              <span className={connectors.emailInboundEnabled ? 'tag tag--ok' : 'tag tag--muted'}>
                Inbound mail {connectors.emailInboundEnabled ? 'on' : 'off'}
              </span>
              <span className="tag tag--info">Webhooks {hooks.length}</span>
            </div>
          </div>
        </section>

        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-head">Slack</div>
          <form className="panel-body stack" action={saveSlackConnectorAction}>
            <p className="muted" style={{ margin: 0 }}>
              Incoming Webhook posts in-app notify events to a Slack channel. Env{' '}
              <code>QUETZAL_SLACK_WEBHOOK</code> overrides the form when set.
            </p>
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
              <span>Webhook URL</span>
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
                Save Slack
              </button>
              <Link className="btn-secondary" href="/settings/notifications">
                Email / SMTP
              </Link>
            </div>
          </form>
        </section>

        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-head">Teams · GitHub · Email inbound</div>
          <form className="panel-body stack" action={saveConnectorsAction}>
            <label className="field field--check">
              <input
                type="checkbox"
                name="teams_enabled"
                value="1"
                defaultChecked={connectors.teamsEnabled}
              />
              <span>Enable Microsoft Teams incoming webhook</span>
            </label>
            <label className="field">
              <span>Teams webhook URL</span>
              <input
                type="url"
                name="teams_webhook_url"
                defaultValue={connectors.teamsWebhookUrl}
                placeholder="https://…webhook.office.com/…"
                autoComplete="off"
              />
            </label>

            <hr style={{ border: 0, borderTop: '1px solid var(--border, #ddd)', margin: '0.5rem 0' }} />

            <label className="field field--check">
              <input
                type="checkbox"
                name="github_enabled"
                value="1"
                defaultChecked={connectors.githubEnabled}
              />
              <span>Enable GitHub → Work sync</span>
            </label>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              POST to <code>/api/integrations/github</code> with{' '}
              <code>X-Hub-Signature-256</code> when a secret is set. Opens/closes issues &amp; PRs
              and mirrors comments into the default project. Outbound Quetzal → GitHub comments need{' '}
              <code>QUETZAL_GITHUB_TOKEN</code> (see <code>docs/go-live.md</code>).
            </p>
            <label className="field">
              <span>Default project key</span>
              <input
                type="text"
                name="github_default_project"
                defaultValue={connectors.githubDefaultProject}
                placeholder="OPS"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>GitHub webhook secret (leave blank to keep)</span>
              <input
                type="password"
                name="github_webhook_secret"
                placeholder={connectors.githubWebhookSecret ? '••••••••' : 'optional'}
                autoComplete="off"
              />
            </label>

            <hr style={{ border: 0, borderTop: '1px solid var(--border, #ddd)', margin: '0.5rem 0' }} />

            <label className="field field--check">
              <input
                type="checkbox"
                name="email_inbound_enabled"
                value="1"
                defaultChecked={connectors.emailInboundEnabled}
              />
              <span>Enable email → helpdesk inbound API</span>
            </label>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              POST JSON to <code>/api/helpdesk/email-inbound</code> with Bearer token. Creates an HD
              ticket from <code>from</code> / <code>subject</code> / <code>text</code>.
            </p>
            <label className="field">
              <span>Inbound token</span>
              <input
                type="text"
                readOnly
                value={connectors.emailInboundToken || '(generate on save)'}
                autoComplete="off"
              />
            </label>
            <label className="field field--check">
              <input type="checkbox" name="rotate_email_token" value="1" />
              <span>Rotate inbound token on save</span>
            </label>

            <div className="row-actions">
              <button type="submit" className="btn">
                Save connectors
              </button>
            </div>
          </form>
        </section>

        <section className="panel" style={{ marginBottom: '1rem' }}>
          <div className="panel-head">Outbound webhooks</div>
          <div className="panel-body stack">
            <p className="muted" style={{ margin: 0 }}>
              Signed JSON POSTs when work or helpdesk changes. Header{' '}
              <code>x-quetzal-signature: sha256=…</code> when a secret is set.
            </p>

            {hooks.length === 0 ? (
              <p className="muted">No webhooks yet.</p>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Events</th>
                    <th>Secret</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {hooks.map((hook) => (
                    <tr key={hook.id}>
                      <td style={{ maxWidth: '16rem', wordBreak: 'break-all' }}>{hook.url}</td>
                      <td>
                        <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                          {hook.events.map((event) => (
                            <span key={event} className="tag tag--muted">
                              {EVENT_LABEL[event] ?? event}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="muted">{hook.secret ? 'set' : '—'}</td>
                      <td>
                        <span className={hook.enabled ? 'tag tag--ok' : 'tag tag--muted'}>
                          {hook.enabled ? 'On' : 'Off'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <form action={toggleWebhookAction}>
                            <input type="hidden" name="id" value={hook.id} />
                            <input type="hidden" name="enabled" value={hook.enabled ? '0' : '1'} />
                            <button type="submit" className="btn-secondary">
                              {hook.enabled ? 'Disable' : 'Enable'}
                            </button>
                          </form>
                          <form action={deleteWebhookAction}>
                            <input type="hidden" name="id" value={hook.id} />
                            <button type="submit" className="btn-secondary">
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">Add webhook</div>
          <form className="panel-body stack" action={createWebhookAction}>
            <label className="field">
              <span>Endpoint URL</span>
              <input
                type="url"
                name="url"
                required
                placeholder="https://example.com/hooks/quetzal"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Signing secret (optional)</span>
              <input type="text" name="secret" autoComplete="off" placeholder="shared secret" />
            </label>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="muted" style={{ fontSize: '12px', marginBottom: '0.35rem' }}>
                Events
              </legend>
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event} className="field field--check">
                  <input type="checkbox" name={`event_${event}`} value="1" defaultChecked />
                  <span>{EVENT_LABEL[event]}</span>
                </label>
              ))}
            </fieldset>
            <div className="row-actions">
              <button type="submit" className="btn">
                Create webhook
              </button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
