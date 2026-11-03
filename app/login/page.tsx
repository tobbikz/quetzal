import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';
import { listUsers } from '@/lib/db';
import { isSsoEnabled } from '@/lib/sso';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const people = await listUsers();
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : undefined;
  const ssoEnabled = await isSsoEnabled();

  return (
    <div className="login-page">
      <div className="login-shell">
        <header className="login-top">
          <Link href="/login" className="login-brand" aria-label="Quetzal">
            <span className="login-brand-mark">Q</span>
          </Link>
          <span className="login-top-link">Work tracker + wiki</span>
        </header>

        <div className="login-card">
          <LoginForm people={people} next={next} error={params.error === '1'} ssoEnabled={ssoEnabled} />

          <aside className="login-promo">
            <h2>Ship work together.</h2>
            <p>
              Issues, wiki spaces, and the activity that keeps the team aligned — one Quetzal desk for
              product and ops.
            </p>
            <div className="login-invite">
              <code>quetzal.local/invite/ops</code>
              <button type="button" className="login-copy" disabled title="Demo">
                Copy
              </button>
            </div>
            <div className="login-promo-art" aria-hidden="true">
              <div className="login-promo-tile">
                <span>Issues</span>
                <strong>For you</strong>
              </div>
              <div className="login-promo-tile alt">
                <span>Wiki</span>
                <strong>Spaces</strong>
              </div>
            </div>
            <p className="login-promo-foot">
              Demo accounts: ana@example.com · luis@example.com · marisol@example.com
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
