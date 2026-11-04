import { redirect } from 'next/navigation';
import { createMacroAction, deleteMacroAction } from '@/app/helpdesk/actions';
import { HelpdeskDesk } from '@/components/HelpdeskDesk';
import { canWriteIssues } from '@/lib/acl';
import { canAccessHelpdeskDesk } from '@/lib/capabilities';
import { countHelpdeskQueues } from '@/lib/helpdesk';
import { listHelpdeskMacros } from '@/lib/helpdeskExtras';
import { currentSite, currentUser } from '@/lib/session';

export default async function HelpdeskMacrosPage() {
  const me = await currentUser();
  if (!canAccessHelpdeskDesk(me)) redirect('/?notice=helpdesk-forbidden');
  const site = await currentSite();
  const canEdit = await canWriteIssues(me);
  const [counts, macros] = await Promise.all([
    countHelpdeskQueues(site.id, me.id),
    listHelpdeskMacros(),
  ]);

  return (
    <HelpdeskDesk
      crumbs={[
        { href: '/helpdesk', label: 'Helpdesk' },
        { label: 'Macros' },
      ]}
      activeSection="macros"
      counts={counts}
      canCreate={canEdit}
    >
      <div className="hdesk-section-head">
        <div>
          <h1 className="page-title">Reply macros</h1>
          <p className="page-sub">Reusable note snippets for agent replies.</p>
        </div>
      </div>

      <div className="layout-2">
        <section className="panel">
          <div className="panel-head">Library</div>
          <div className="panel-body stack">
            {macros.length === 0 ? (
              <p className="muted">No macros yet.</p>
            ) : (
              macros.map((macro) => (
                <article key={macro.id} className="history-item">
                  <span className="history-dot" aria-hidden="true" />
                  <div style={{ flex: 1 }}>
                    <div className="row-actions" style={{ justifyContent: 'space-between' }}>
                      <strong>{macro.name}</strong>
                      {canEdit ? (
                        <form action={deleteMacroAction}>
                          <input type="hidden" name="id" value={macro.id} />
                          <button type="submit" className="btn-secondary">
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', margin: '0.35rem 0 0' }}>{macro.body}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {canEdit ? (
          <section className="panel">
            <div className="panel-head">Add macro</div>
            <form className="panel-body stack" action={createMacroAction}>
              <label className="field">
                <span>Name</span>
                <input name="name" required maxLength={80} placeholder="Acknowledge" />
              </label>
              <label className="field">
                <span>Body</span>
                <textarea name="body" required rows={5} placeholder="Thanks for reaching out…" />
              </label>
              <button className="btn" type="submit">
                Create
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </HelpdeskDesk>
  );
}
