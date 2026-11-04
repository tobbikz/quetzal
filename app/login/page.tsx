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
      <div className="login-atmosphere" aria-hidden="true">
        <span className="login-aurora" />
        <span className="login-blob login-blob--a" />
        <span className="login-blob login-blob--b" />
        <span className="login-blob login-blob--c" />
        <span className="login-blob login-blob--d" />
        <span className="login-grid" />
        <span className="login-orbit login-orbit--1" />
        <span className="login-orbit login-orbit--2" />
        <span className="login-orbit login-orbit--3" />
        <span className="login-sheen" />
      </div>

      <div className="login-card">
        <aside className="login-visual">
          <Link href="/login" className="login-visual-brand" aria-label="Quetzal home">
            Quetzal
          </Link>
          <div className="login-visual-copy">
            <h2 className="login-visual-title">An ops atelier.</h2>
            <p className="login-visual-sub">Issues, wiki, and helpdesk — one quiet desk.</p>
          </div>
        </aside>

        <div className="login-stage">
          {devEscapes ? (
            <p className="login-dev-warn">
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
        </div>
      </div>
    </div>
  );
}
