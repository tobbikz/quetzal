import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';
import { authDevEscapesEnabled, quickLoginAllowed } from '@/lib/auth';
import { ensureSeedLocalPasswords, listUsers } from '@/lib/db';
import { isSsoEnabled } from '@/lib/sso';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  await ensureSeedLocalPasswords();
  const people = await listUsers();
  const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : undefined;
  const ssoEnabled = await isSsoEnabled();
  const devEscapes = authDevEscapesEnabled();

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
          {devEscapes ? (
            <p className="muted" style={{ marginBottom: '0.75rem', color: 'var(--danger, #b91c1c)' }}>
              Dev auth escapes are on (demo/quick login). Never enable these in production.
            </p>
          ) : null}
          <LoginForm
            people={people}
            next={next}
            error={params.error === '1'}
            ssoEnabled={ssoEnabled}
            quickLogin={quickLoginAllowed()}
          />

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
              Demo: ana@example.com / quetzal · LDAP when enabled in Settings
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
