import Link from 'next/link';
import { notFound } from 'next/navigation';
import { submitCsatAction } from '@/app/csat/actions';
import { getCsatByToken } from '@/lib/helpdeskExtras';
import { getHelpdeskTicketById } from '@/lib/helpdesk';

export default async function CsatPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const csat = await getCsatByToken(token);
  if (!csat) notFound();
  const ticket = await getHelpdeskTicketById(csat.ticketId);
  if (!ticket) notFound();

  const done = Boolean(csat.submittedAt) || query.saved === '1';

  return (
    <main className="page" style={{ maxWidth: '32rem', margin: '2rem auto' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">How did we do?</h1>
          <p className="page-sub">
            Feedback for <strong>{ticket.key}</strong> — {ticket.summary}
          </p>
        </div>
      </div>

      {done ? (
        <section className="panel">
          <div className="panel-body stack">
            <p style={{ margin: 0 }}>Thanks — your rating was recorded.</p>
            {csat.score != null ? (
              <p className="muted" style={{ margin: 0 }}>
                Score: {csat.score}/5
                {csat.comment ? ` · “${csat.comment}”` : ''}
              </p>
            ) : null}
            <Link className="btn-secondary" href="/portal" style={{ alignSelf: 'start' }}>
              Back to portal
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel">
          <form className="panel-body stack" action={submitCsatAction}>
            <input type="hidden" name="token" value={token} />
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="muted" style={{ fontSize: '12px', marginBottom: '0.35rem' }}>
                Rating (1 = poor, 5 = excellent)
              </legend>
              <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <label key={score} className="field field--check">
                    <input type="radio" name="score" value={score} required={score === 1} />
                    <span>{score}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field">
              <span>Comment (optional)</span>
              <textarea name="comment" rows={3} placeholder="Anything we should know?" />
            </label>
            <button className="btn" type="submit">
              Submit feedback
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
