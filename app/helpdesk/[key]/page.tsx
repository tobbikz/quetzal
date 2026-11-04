import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  addHelpdeskNoteAction,
  applyMacroNoteAction,
  updateHelpdeskStatusAction,
} from '@/app/helpdesk/actions';
import { HelpdeskDesk } from '@/components/HelpdeskDesk';
import { PriorityMark } from '@/components/PriorityMark';
import { WikiHtml } from '@/components/WikiHtml';
import { canWriteIssues } from '@/lib/acl';
import { canAccessHelpdeskDesk, canViewHelpdeskTicket } from '@/lib/capabilities';
import { listUsers } from '@/lib/db';
import { formatWhen } from '@/lib/format';
import {
  countHelpdeskQueues,
  getHelpdeskTicket,
  HELPDESK_STATUS_LABEL,
  HELPDESK_STATUSES,
  HELPDESK_TYPE_LABEL,
  labelForSlaBadge,
  listHelpdeskNotes,
  slaBadgeState,
  tagForHelpdeskStatus,
  tagForHelpdeskType,
  tagForSlaBadge,
  type HelpdeskQueueCounts,
} from '@/lib/helpdesk';
import { getCsatForTicket, listHelpdeskMacros } from '@/lib/helpdeskExtras';
import { currentSite, currentUser } from '@/lib/session';
import type { Priority } from '@/lib/types';
import type { ReactNode } from 'react';

export default async function HelpdeskTicketPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const ticket = await getHelpdeskTicket(key.toUpperCase());
  if (!ticket) notFound();
  const me = await currentUser();
  const site = await currentSite();
  if (ticket.siteId !== site.id) notFound();
  if (!canViewHelpdeskTicket(me, ticket)) redirect('/?notice=helpdesk-forbidden');
  const isAgent = canAccessHelpdeskDesk(me);
  const canEdit = isAgent && (await canWriteIssues(me));
  const people = await listUsers();
  const nameOf = (id: number | null) =>
    (id ? people.find((person) => person.id === id)?.name : undefined) ?? 'Someone';
  const notes = await listHelpdeskNotes(ticket.id);
  const macros = canEdit ? await listHelpdeskMacros() : [];
  const csat = isAgent ? await getCsatForTicket(ticket.id) : undefined;
  const responseState = slaBadgeState('response', ticket);
  const resolveState = slaBadgeState('resolve', ticket);
  const counts: HelpdeskQueueCounts | null = isAgent
    ? await countHelpdeskQueues(site.id, me.id)
    : null;

  const body: ReactNode = (
    <>
      <div className="hdesk-section-head">
        <div>
          <div className="row-actions">
            <span className={tagForHelpdeskType(ticket.type)}>
              {HELPDESK_TYPE_LABEL[ticket.type]}
            </span>
            <span className="key">{ticket.key}</span>
            <PriorityMark priority={ticket.priority as Priority} />
            <span className={tagForHelpdeskStatus(ticket.status)}>
              {HELPDESK_STATUS_LABEL[ticket.status]}
            </span>
            {ticket.slaBreached ? <span className="tag tag--error">SLA breached</span> : null}
            {responseState !== 'none' ? (
              <span className={tagForSlaBadge(responseState)}>
                {labelForSlaBadge('response', responseState)}
              </span>
            ) : null}
            {resolveState !== 'none' ? (
              <span className={tagForSlaBadge(resolveState)}>
                {labelForSlaBadge('resolve', resolveState)}
              </span>
            ) : null}
          </div>
          <h1 className="issue-title hdesk-title">{ticket.summary}</h1>
          {ticket.labels ? (
            <div className="row-actions" style={{ marginTop: '0.35rem' }}>
              {ticket.labels
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
                .map((label) => (
                  <span key={label} className="tag">
                    {label}
                  </span>
                ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="layout-2">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">Details</div>
            <div className="panel-body description-block">
              {ticket.body ? (
                <WikiHtml html={ticket.body} />
              ) : (
                <p className="muted">No details yet.</p>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">Notes</div>
            <div className="panel-body stack">
              {notes.length === 0 && <p className="muted">No notes yet.</p>}
              {notes.map((note) => (
                <article key={note.id} className="history-item">
                  <span className="history-dot" aria-hidden="true" />
                  <div>
                    <div>
                      <strong>{nameOf(note.authorId)}</strong>{' '}
                      <span className="muted">{formatWhen(note.createdAt)}</span>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0' }}>{note.body}</p>
                  </div>
                </article>
              ))}
              {canEdit && (
                <form action={addHelpdeskNoteAction} className="stack" style={{ marginTop: '0.5rem' }}>
                  <input type="hidden" name="key" value={ticket.key} />
                  <textarea name="body" required placeholder="Add a note…" rows={3} />
                  <div className="row-actions">
                    <button className="btn" type="submit">
                      Add note
                    </button>
                  </div>
                </form>
              )}
              {canEdit && macros.length > 0 ? (
                <div className="stack" style={{ marginTop: '0.75rem' }}>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    Apply macro
                  </div>
                  <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                    {macros.map((macro) => (
                      <form key={macro.id} action={applyMacroNoteAction}>
                        <input type="hidden" name="key" value={ticket.key} />
                        <input type="hidden" name="macro_id" value={macro.id} />
                        <button type="submit" className="btn-secondary">
                          {macro.name}
                        </button>
                      </form>
                    ))}
                    <Link className="btn-secondary" href="/helpdesk/macros">
                      Manage…
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
        <aside className="stack">
          <section className="panel">
            <div className="panel-head">People</div>
            <div className="panel-body stack">
              <div>
                <div className="muted">Requester</div>
                <div>{nameOf(ticket.requesterId)}</div>
              </div>
              <div>
                <div className="muted">Assignee</div>
                <div>
                  {ticket.assigneeId ? nameOf(ticket.assigneeId) : <span className="muted">Unassigned</span>}
                </div>
              </div>
              <div>
                <div className="muted">Created</div>
                <div>{formatWhen(ticket.createdAt)}</div>
              </div>
              <div>
                <div className="muted">Updated</div>
                <div>{formatWhen(ticket.updatedAt)}</div>
              </div>
              {ticket.due && (
                <div>
                  <div className="muted">Due</div>
                  <div>{ticket.due}</div>
                </div>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">SLA</div>
            <div className="panel-body stack">
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                Business hours Mon–Fri 09:00–17:00 UTC · policy by type + priority
              </div>
              <div>
                <div className="muted">Response due</div>
                <div>{ticket.responseDue ? formatWhen(ticket.responseDue) : '—'}</div>
                {ticket.responseMetAt ? (
                  <div className="muted">Met {formatWhen(ticket.responseMetAt)}</div>
                ) : null}
              </div>
              <div>
                <div className="muted">Resolve due</div>
                <div>{ticket.resolveDue ? formatWhen(ticket.resolveDue) : '—'}</div>
                {ticket.resolveMetAt ? (
                  <div className="muted">Met {formatWhen(ticket.resolveMetAt)}</div>
                ) : null}
              </div>
              <div className="row-actions">
                {ticket.slaBreached ? <span className="tag tag--error">SLA breached</span> : null}
                {responseState !== 'none' ? (
                  <span className={tagForSlaBadge(responseState)}>
                    {labelForSlaBadge('response', responseState)}
                  </span>
                ) : null}
                {resolveState !== 'none' ? (
                  <span className={tagForSlaBadge(resolveState)}>
                    {labelForSlaBadge('resolve', resolveState)}
                  </span>
                ) : null}
              </div>
              {isAgent ? (
                <Link className="btn-secondary" href="/helpdesk/sla" style={{ alignSelf: 'start' }}>
                  Breach report
                </Link>
              ) : null}
            </div>
          </section>
          {canEdit && (
            <section className="panel">
              <div className="panel-head">Update</div>
              <form className="panel-body stack" action={updateHelpdeskStatusAction}>
                <input type="hidden" name="key" value={ticket.key} />
                <label className="field">
                  <span>Status</span>
                  <select name="status" defaultValue={ticket.status}>
                    {HELPDESK_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {HELPDESK_STATUS_LABEL[item]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Assignee</span>
                  <select name="assignee" defaultValue={ticket.assigneeId ?? ''}>
                    <option value="">Unassigned</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn" type="submit">
                  Save
                </button>
              </form>
            </section>
          )}
          {isAgent ? (
            <section className="panel">
              <div className="panel-head">CSAT</div>
              <div className="panel-body stack">
                {!csat ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Invite appears when the ticket is resolved or closed.
                  </p>
                ) : csat.submittedAt && csat.score != null ? (
                  <>
                    <div>
                      <div className="muted">Score</div>
                      <div>
                        {csat.score}/5 · {formatWhen(csat.submittedAt)}
                      </div>
                    </div>
                    {csat.comment ? (
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{csat.comment}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ margin: 0 }}>
                      Awaiting customer feedback.
                    </p>
                    <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                      /csat/{csat.token}
                    </code>
                  </>
                )}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );

  if (isAgent && counts) {
    return (
      <HelpdeskDesk
        crumbs={[
          { href: '/helpdesk', label: 'Helpdesk' },
          { label: ticket.key },
        ]}
        activeSection="detail"
        counts={counts}
        canCreate={canEdit}
      >
        {body}
      </HelpdeskDesk>
    );
  }

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">{ticket.key}</span>
      </div>
      <main className="page">{body}</main>
    </>
  );
}
