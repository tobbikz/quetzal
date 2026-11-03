'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions';
import { CommandMenuTrigger } from '@/components/CommandMenu';
import { NewIssueButton } from '@/components/CreateIssue';
import { NotificationBell } from '@/components/NotificationBell';
import { canAccessHelpdeskDesk, canManageAutomation } from '@/lib/capabilities';
import type { Notification, Space, User } from '@/lib/types';

/**
 * Primary rail: Portal (requester surface) → daily work → planning → insight → support → admin.
 * Work = home desk. Filters = QQL searcher (/issues).
 */
const PRIMARY = [
  { href: '/portal', label: 'Portal', match: 'prefix' as const },
  { href: '/', label: 'Work', match: 'exact' as const },
  { href: '/board', label: 'Board', match: 'prefix' as const },
  { href: '/issues', label: 'Filters', match: 'prefix' as const },
  { href: '/calendar', label: 'Calendar', match: 'prefix' as const },
  { href: '/roadmap', label: 'Roadmap', match: 'prefix' as const },
  { href: '/releases', label: 'Releases', match: 'prefix' as const },
  { href: '/dashboards', label: 'Dashboards', match: 'prefix' as const },
];

function linkActive(path: string, href: string, match: 'exact' | 'prefix'): boolean {
  if (match === 'exact') return path === href;
  return path === href || path.startsWith(`${href}/`);
}

export function Navbar({
  user,
  personalSpace: _personalSpace,
  teamSpaces: _teamSpaces,
  notifications,
  unreadCount,
}: {
  user: User;
  personalSpace: Space;
  teamSpaces: Space[];
  notifications: Notification[];
  unreadCount: number;
}) {
  const path = usePathname();
  const wiki = path.startsWith('/wiki') || path.startsWith('/search');
  const helpdesk = path.startsWith('/helpdesk');
  const automationActive = path.startsWith('/automation');
  const showHelpdesk = canAccessHelpdeskDesk(user);
  const showAutomation = canManageAutomation(user);
  /* Filters / Releases / Dashboards — create-issue CTA is noise on these desks. */
  const hideNewIssue =
    path.startsWith('/issues') ||
    path.startsWith('/releases') ||
    path.startsWith('/dashboards') ||
    path.startsWith('/wiki') ||
    path.startsWith('/search');

  return (
    <header className="navbar navbar--e">
      <div className="navbar-brand-zone">
        <Link href="/" className="brand">
          <span className="brand-mark">Q</span>
          <span className="brand-name">Quetzal</span>
        </Link>
      </div>
      <div className="navbar-split" aria-hidden />
      <nav className="nav-rail" aria-label="Primary">
        {PRIMARY.map((link) => {
          const active = linkActive(path, link.href, link.match);
          return (
            <Link key={link.href} href={link.href} className={`nav-link${active ? ' active' : ''}`}>
              {link.label}
            </Link>
          );
        })}
        <span className="nav-rail-gap" aria-hidden />
        <Link href="/wiki" className={`nav-link${wiki ? ' active' : ''}`}>
          Wiki
        </Link>
        {showHelpdesk ? (
          <Link href="/helpdesk" className={`nav-link${helpdesk ? ' active' : ''}`}>
            Helpdesk
          </Link>
        ) : null}
        {showAutomation ? (
          <Link href="/automation" className={`nav-link${automationActive ? ' active' : ''}`}>
            Automation
          </Link>
        ) : null}
      </nav>
      <div className="navbar-tray">
        <CommandMenuTrigger />
        {user.role !== 'viewer' && !hideNewIssue ? <NewIssueButton /> : null}
        <NotificationBell unreadCount={unreadCount} items={notifications} />
        <details className="account">
          <summary>
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span className="account-name">{user.name.split(' ')[0]}</span>
          </summary>
          <div className="account-menu">
            <div className="account-who">
              <span className="account-who-name">{user.name}</span>
              <span className="account-who-meta">{user.email}</span>
              <span className="account-who-role">{user.role}</span>
            </div>
            {user.role === 'admin' ? (
              <Link href="/settings" className="account-link">
                Settings
              </Link>
            ) : null}
            <form action={logoutAction}>
              <button type="submit">Log out</button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
