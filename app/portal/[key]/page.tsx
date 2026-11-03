import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createPortalTicketAction } from '@/app/portal/actions';
import { HELPDESK_TYPE_LABEL, tagForHelpdeskType } from '@/lib/helpdeskMeta';
import { getRequestType } from '@/lib/portal';
import { currentUser } from '@/lib/session';

export default async function PortalRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { key } = await params;
  const query = await searchParams;
  const requestType = await getRequestType(key);
  if (!requestType) notFound();

  const jar = await cookies();
  const authed = jar.get('quetzal_auth')?.value === '1';
  const user = authed ? await currentUser() : null;

  return (
    <main className="portal-page portal-page--narrow">
      <p className="portal-crumb">
        <Link href="/portal">Portal</Link>
        <span className="faint"> / </span>
        <span>{requestType.name}</span>
      </p>
      <div className="portal-hero">
        <h1>{requestType.name}</h1>
        <p>{requestType.description}</p>
        <span className={tagForHelpdeskType(requestType.helpdeskType)}>
          {HELPDESK_TYPE_LABEL[requestType.helpdeskType]}
        </span>
      </div>
      {query.error === 'summary' && (
        <p className="portal-banner portal-banner--warn">Please enter a short summary.</p>
      )}
      <form className="portal-form" action={createPortalTicketAction}>
        <input type="hidden" name="request_type" value={requestType.key} />
        {authed && user ? (
          <p className="portal-signed-in">
            Submitting as <strong>{user.name}</strong> ({user.email}).{' '}
            <Link href="/login?next=/portal">Switch account</Link>
          </p>
        ) : (
          <>
            <label className="field">
              <span>Your email</span>
              <input type="email" name="email" required placeholder="you@company.com" autoComplete="email" />
            </label>
            <label className="field">
              <span>Your name</span>
              <input type="text" name="name" placeholder="Optional" autoComplete="name" />
            </label>
            <p className="muted" style={{ marginTop: 0 }}>
              Or <Link href={`/login?next=/portal/${requestType.key}`}>sign in</Link> to skip these fields.
            </p>
          </>
        )}
        <label className="field">
          <span>Summary</span>
          <input type="text" name="summary" required maxLength={180} placeholder="What do you need?" />
        </label>
        <label className="field">
          <span>Details</span>
          <textarea name="body" rows={6} placeholder="Steps, error messages, when it started…" />
        </label>
        <div className="row-actions">
          <button className="btn" type="submit">
            Submit request
          </button>
          <Link className="btn-secondary" href="/portal">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
