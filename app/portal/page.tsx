import Link from 'next/link';
import { cookies } from 'next/headers';
import { HELPDESK_TYPE_LABEL, tagForHelpdeskType } from '@/lib/helpdeskMeta';
import { listRequestTypes } from '@/lib/portal';

export default async function PortalHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const types = await listRequestTypes();
  const jar = await cookies();
  const authed = jar.get('quetzal_auth')?.value === '1';

  return (
    <main className="portal-page">
      <div className="portal-hero">
        <h1>How can we help?</h1>
        <p>
          Pick a request type to open a helpdesk ticket.
          {authed
            ? ' You are signed in — tickets will use your account.'
            : ' Prefer signing in, or leave your email on the form.'}
        </p>
        {query.error === 'email' && (
          <p className="portal-banner portal-banner--warn">Enter a valid email to submit without signing in.</p>
        )}
        {query.error === 'type' && (
          <p className="portal-banner portal-banner--warn">That request type was not found.</p>
        )}
      </div>
      <ul className="portal-type-list">
        {types.map((item) => (
          <li key={item.key}>
            <Link className="portal-type-card" href={`/portal/${item.key}`}>
              <div className="portal-type-card-head">
                <strong>{item.name}</strong>
                <span className={tagForHelpdeskType(item.helpdeskType)}>
                  {HELPDESK_TYPE_LABEL[item.helpdeskType]}
                </span>
              </div>
              <p>{item.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      {types.length === 0 && <p className="muted">No request types are configured yet.</p>}
    </main>
  );
}
