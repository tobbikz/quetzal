import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAutomationRuleAction, toggleAutomationRuleAction } from '@/app/automation/actions';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { canManageAutomation } from '@/lib/acl';
import {
  AUTOMATION_TRIGGERS,
  listAutomationRuns,
  listAutomationRules,
  type AutomationAction,
  type AutomationRule,
  type AutomationRun,
} from '@/lib/automation';
import { listUsers } from '@/lib/db';
import { STATUSES } from '@/lib/format';
import { requireUser } from '@/lib/session';

function summarizeConditions(rule: AutomationRule): string {
  const parts: string[] = [];
  const c = rule.conditions;
  if (rule.triggerEvent === 'status_changed') {
    if (c.from_status) parts.push(`from ${c.from_status}`);
    const to = c.to_status ?? c.status;
    if (to) parts.push(`to ${to}`);
  } else if (c.status) {
    parts.push(`status ${c.status}`);
  }
  if (c.priority) parts.push(`priority ${c.priority}`);
  if (c.type) parts.push(`type ${c.type}`);
  if (c.project_key) parts.push(`project ${c.project_key}`);
  if (rule.triggerEvent === 'due_approaching') {
    parts.push(`within ${c.within_days ?? 3}d`);
  }
  if (parts.length) return parts.join(' · ');
  if (rule.triggerEvent === 'status_changed') return 'any status change';
  if (rule.triggerEvent === 'due_approaching') return 'due soon';
  return 'any match';
}

function summarizeAction(action: AutomationAction): string {
  if (action.type === 'notify_user') {
    return `notify user #${action.user_id}${action.title ? ` · ${action.title}` : ''}`;
  }
  if (action.type === 'set_assignee') {
    return action.user_id == null ? 'unassign' : `assign user #${action.user_id}`;
  }
  return `comment: ${action.body.slice(0, 80)}${action.body.length > 80 ? '…' : ''}`;
}

function runTag(run: AutomationRun): string {
  if (run.status === 'ok') return 'tag tag--ok';
  if (run.status === 'error') return 'tag tag--error';
  return 'tag tag--muted';
}

export default async function AutomationPage() {
  const user = await requireUser();
  if (!await canManageAutomation(user)) {
    redirect('/');
  }

  const rules = await listAutomationRules();
  const runs = await listAutomationRuns(40);
  const people = await listUsers();
  const cronSecretSet = Boolean(process.env.QUETZAL_AUTOMATION_CRON_SECRET?.trim());

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">Automation</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Automation</h1>
            <p className="page-sub">
              When/then rules for issue events. Admin only · {rules.length} rule
              {rules.length === 1 ? '' : 's'}.
            </p>
          </div>
        </div>

        <div className="work-layout">
          <section className="panel">
            <div className="panel-head">Rules</div>
            <div className="panel-body">
              {rules.length === 0 ? (
                <p className="empty-hint">No rules yet. Create one on the right.</p>
              ) : (
                <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: '0.75rem' }}>
                  {rules.map((rule) => (
                    <li
                      key={rule.id}
                      style={{
                        borderBottom: '1px solid var(--border, #e5e5e5)',
                        paddingBottom: '0.75rem',
                      }}
                    >
                      <div className="row-actions" style={{ justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div>
                          <strong>{rule.name}</strong>
                          <div className="muted" style={{ fontSize: '0.9rem', marginTop: '0.2rem' }}>
                            When <code>{rule.triggerEvent}</code> · {summarizeConditions(rule)}
                          </div>
                          <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            Then:{' '}
                            {rule.actions.map((action, i) => (
                              <span key={`${rule.id}-${i}`}>
                                {i > 0 ? '; ' : ''}
                                {summarizeAction(action)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <form action={toggleAutomationRuleAction}>
                          <input type="hidden" name="id" value={rule.id} />
                          <input type="hidden" name="enabled" value={rule.enabled ? '0' : '1'} />
                          <button type="submit" className="btn">
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </form>
                      </div>
                      <div style={{ marginTop: '0.35rem' }}>
                        <span className={rule.enabled ? 'tag tag--ok' : 'tag tag--muted'}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">Create rule</div>
            <form className="panel-body stack" action={createAutomationRuleAction}>
              <label className="field">
                <span>Name</span>
                <input name="name" required maxLength={120} placeholder="Notify when Done" />
              </label>
              <label className="field">
                <span>Trigger</span>
                <select name="trigger_event" defaultValue="status_changed">
                  {AUTOMATION_TRIGGERS.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {trigger}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>When · from status (status_changed)</span>
                <select name="from_status" defaultValue="">
                  <option value="">Any</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>When · to status (status_changed)</span>
                <select name="to_status" defaultValue="">
                  <option value="">Any</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Filter · status (other triggers)</span>
                <select name="status" defaultValue="">
                  <option value="">Any</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Within days (due_approaching)</span>
                <input name="within_days" type="number" min={1} max={90} defaultValue={3} />
              </label>
              <label className="field">
                <span>Then · action</span>
                <select name="action_type" defaultValue="notify_user">
                  <option value="notify_user">Notify user</option>
                  <option value="set_assignee">Set assignee</option>
                  <option value="add_comment">Add comment</option>
                </select>
              </label>
              <label className="field">
                <span>User (for notify / assign)</span>
                <select name="action_user_id" defaultValue={people[0]?.id ?? ''}>
                  <option value="">—</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} · {person.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Title (notify)</span>
                <input name="action_title" maxLength={200} placeholder="{{issue.key}} updated" />
              </label>
              <label className="field">
                <span>
                  Body (notify / comment) · {'{{issue.key}}'} {'{{issue.summary}}'} {'{{issue.status}}'}{' '}
                  {'{{comment.body}}'}
                </span>
                <textarea
                  name="action_body"
                  rows={3}
                  placeholder="{{issue.key}} · {{issue.summary}} ({{issue.status}})"
                />
              </label>
              <button type="submit" className="btn btn-primary">
                Create rule
              </button>
            </form>
          </section>
        </div>

        <section className="panel" style={{ marginTop: '1rem' }}>
          <div className="panel-head">Schedule · due_approaching</div>
          <div className="panel-body stack">
            <p className="muted" style={{ margin: 0 }}>
              Cron calls <code>POST /api/automation/tick</code> to evaluate due windows. Auth with{' '}
              <code>Authorization: Bearer $QUETZAL_AUTOMATION_CRON_SECRET</code>
              {cronSecretSet ? ' (env set)' : ' (env not set — use admin session)'} or sign in as admin.
            </p>
            <pre
              className="muted"
              style={{
                margin: 0,
                padding: '0.75rem',
                background: 'var(--surface-2, #f6f6f6)',
                overflow: 'auto',
                fontSize: '0.85rem',
              }}
            >{`*/15 * * * * curl -fsS -X POST \\
  -H "Authorization: Bearer $QUETZAL_AUTOMATION_CRON_SECRET" \\
  http://127.0.0.1:3210/api/automation/tick`}</pre>
          </div>
        </section>

        <section className="panel" style={{ marginTop: '1rem' }}>
          <div className="panel-head">Recent runs</div>
          <div className="panel-body">
            {runs.length === 0 ? (
              <p className="empty-hint">No automation runs recorded yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Rule</th>
                      <th>Issue</th>
                      <th>Trigger</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                          {run.createdAt.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td>{run.ruleName || `#${run.ruleId}`}</td>
                        <td>
                          <IssueHoverCard issueKey={run.issueKey} className="key">
                            {run.issueKey}
                          </IssueHoverCard>
                        </td>
                        <td>
                          <code>{run.triggerEvent}</code>
                        </td>
                        <td>
                          <span className={runTag(run)}>{run.status}</span>
                        </td>
                        <td className="muted" style={{ maxWidth: '18rem' }}>
                          {run.detail || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
