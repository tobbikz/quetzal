import Link from 'next/link';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';

/** Lightweight public shell — AppShell skips nav for /portal*. */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const authed = jar.get('quetzal_auth')?.value === '1';

  return (
    <div className="portal-shell">
      <header className="portal-top">
        <Link href="/portal" className="portal-brand">
          <span className="portal-brand-mark">Q</span>
          <span>Customer portal</span>
        </Link>
        <div className="portal-top-links">
          {authed ? (
            <Link href="/helpdesk">Agent desk</Link>
          ) : (
            <Link href="/login?next=/portal">Sign in</Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
