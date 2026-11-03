import Link from 'next/link';
import { getHelpdeskTicket } from '@/lib/helpdesk';

export default async function PortalThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const query = await searchParams;
  const key = query.key?.trim().toUpperCase() ?? '';
  const ticket = key ? await getHelpdeskTicket(key) : undefined;

  return (
    <main className="portal-page portal-page--narrow">
      <div className="portal-hero">
        <h1>Request received</h1>
        {ticket ? (
          <p>
            Your ticket <strong className="key">{ticket.key}</strong> is open. An agent will follow up.
          </p>
        ) : (
          <p>Your request was submitted. An agent will follow up by email.</p>
        )}
      </div>
      <div className="row-actions">
        <Link className="btn" href="/portal">
          Submit another
        </Link>
        {ticket && (
          <Link className="btn-secondary" href={`/helpdesk/${ticket.key}`}>
            View ticket
          </Link>
        )}
      </div>
    </main>
  );
}
