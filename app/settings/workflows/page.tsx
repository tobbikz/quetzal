import Link from 'next/link';
import { redirect } from 'next/navigation';
import { STATUS_LABEL } from '@/lib/format';
import { currentUser } from '@/lib/session';
import {
  listWorkflowStatuses,
  listWorkflowTransitions,
  listWorkflows,
} from '@/lib/workflows';

export default async function WorkflowsSettingsPage() {
  const user = await currentUser();
  if (user.role !== 'admin') redirect('/');

  const workflows = await listWorkflows();

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
        <span className="crumb current">Workflows</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Workflows</h1>
            <p className="page-sub">
              Project workflows with statuses, transitions, conditions, and validators. Read-only list.
            </p>
          </div>
        </div>

        <div className="stack">
          {workflows.map(async (workflow) => {
            const statuses = await listWorkflowStatuses(workflow.id);
            const transitions = await listWorkflowTransitions(workflow.id);
            return (
              <section key={workflow.id} className="panel">
                <div className="panel-head">
                  {workflow.name} <span className="muted">#{workflow.id}</span>
                </div>
                <div className="panel-body stack">
                  <div>
                    <div className="muted" style={{ marginBottom: '0.35rem' }}>
                      Statuses
                    </div>
                    <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                      {statuses.map((status) => (
                        <span key={status.id} className="tag tag--muted">
                          {status.name} ({status.status})
                        </span>
                      ))}
                      {statuses.length === 0 ? <span className="muted">None</span> : null}
                    </div>
                  </div>
                  <div>
                    <div className="muted" style={{ marginBottom: '0.35rem' }}>
                      Transitions
                    </div>
                    {transitions.length === 0 ? (
                      <p className="muted">No transitions.</p>
                    ) : (
                      <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: '0.4rem' }}>
                        {transitions.map((transition) => (
                          <li key={transition.id}>
                            <strong>{transition.name}</strong>{' '}
                            <span className="muted">
                              {STATUS_LABEL[transition.fromStatus] ?? transition.fromStatus}
                              {' → '}
                              {STATUS_LABEL[transition.toStatus] ?? transition.toStatus}
                            </span>
                            {transition.conditions.length > 0 ? (
                              <span className="muted">
                                {' '}
                                · conditions: {transition.conditions.map((rule) => rule.type).join(', ')}
                              </span>
                            ) : null}
                            {transition.validators.length > 0 ? (
                              <span className="muted">
                                {' '}
                                · validators: {transition.validators.map((rule) => rule.type).join(', ')}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
          {workflows.length === 0 ? <p className="muted">No workflows seeded.</p> : null}
        </div>
      </main>
    </>
  );
}
