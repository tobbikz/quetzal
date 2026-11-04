'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NewHelpdeskButton } from '@/components/CreateHelpdesk';
import { NewIssueButton } from '@/components/CreateIssue';
import { canAccessHelpdeskDesk, canManageAutomation } from '@/lib/capabilities';
import type { Space, User } from '@/lib/types';

const WORK = [
  { href: '/', label: 'Work' },
  { href: '/board', label: 'Board' },
  { href: '/issues', label: 'Filters' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/releases', label: 'Releases' },
  { href: '/dashboards', label: 'Dashboards' },
];

function isActive(path: string, href: string): boolean {
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar({
  user,
  personalSpace: _personalSpace,
  teamSpaces: _teamSpaces,
  projects,
}: {
  user: User;
  personalSpace: Space;
  teamSpaces: Space[];
  projects: { id: number; key: string; name: string }[];
}) {
  const path = usePathname();
  const wiki = path.startsWith('/wiki') || path.startsWith('/search');
  const helpdesk = path.startsWith('/helpdesk');
  const portal = path.startsWith('/portal');
  const admin = path.startsWith('/admin') || path.startsWith('/settings');
  const work = !wiki && !helpdesk && !portal && !admin;

  return (
    <aside className="sidebar" aria-label="Workspace">
      <Link href="/" className="sidebar-brand">
        <span className="brand-mark">Q</span>
        <span className="sidebar-brand-text">
          <span className="brand-name">Quetzal</span>
          <span className="brand-ver">0.1.0</span>
        </span>
      </Link>

      {user.role !== 'viewer' ? (
        <div className="sidebar-create">
          <NewIssueButton label="New issue" />
          {canAccessHelpdeskDesk(user) ? <NewHelpdeskButton label="New ticket" /> : null}
        </div>
      ) : null}

      <nav className="sidebar-nav">
        <div className={`sidebar-section${portal ? ' is-context' : ''}`}>
          <div className="sidebar-section-label">Portal</div>
          <Link href="/portal" className={`sidebar-link${portal ? ' on' : ''}`}>
            Customer portal
          </Link>
        </div>

        <div className={`sidebar-section${work ? ' is-context' : ''}`}>
          <div className="sidebar-section-label">Work</div>
          {WORK.map((link) => (
            <Link key={link.href} href={link.href} className={`sidebar-link${isActive(path, link.href) ? ' on' : ''}`}>
              {link.label}
            </Link>
          ))}
          {canManageAutomation(user) ? (
            <Link href="/automation" className={`sidebar-link${isActive(path, '/automation') ? ' on' : ''}`}>
              Automation
            </Link>
          ) : null}
        </div>

        {projects.length > 0 ? (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Projects</div>
            {projects.slice(0, 8).map((project) => (
              <Link
                key={project.key}
                href={`/issues?project=${encodeURIComponent(project.key)}`}
                className="sidebar-link sidebar-link--project"
              >
                <span className="sidebar-project-key">{project.key}</span>
                <span className="sidebar-project-name">{project.name}</span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className={`sidebar-section${wiki ? ' is-context' : ''}`}>
          <div className="sidebar-section-label">Wiki</div>
          <Link
            href="/wiki"
            className={`sidebar-link${path === '/wiki' || path.startsWith('/wiki/') ? ' on' : ''}`}
          >
            Home
          </Link>
          <Link href="/search" className={`sidebar-link${path.startsWith('/search') ? ' on' : ''}`}>
            Search
          </Link>
        </div>

        {canAccessHelpdeskDesk(user) ? (
          <div className={`sidebar-section${helpdesk ? ' is-context' : ''}`}>
            <div className="sidebar-section-label">Helpdesk</div>
            <Link
              href="/helpdesk"
              className={`sidebar-link${
                path === '/helpdesk' ||
                (path.startsWith('/helpdesk/') &&
                  !path.startsWith('/helpdesk/sla') &&
                  !path.startsWith('/helpdesk/queues'))
                  ? ' on'
                  : ''
              }`}
            >
              Tickets
            </Link>
            <Link href="/helpdesk/queues" className={`sidebar-link${path.startsWith('/helpdesk/queues') ? ' on' : ''}`}>
              Queues
            </Link>
            <Link href="/helpdesk/sla" className={`sidebar-link${path.startsWith('/helpdesk/sla') ? ' on' : ''}`}>
              SLA report
            </Link>
          </div>
        ) : null}

        {user.role === 'admin' ? (
          <div className={`sidebar-section${admin ? ' is-context' : ''}`}>
            <div className="sidebar-section-label">Admin</div>
            <Link href="/settings" className={`sidebar-link${path === '/settings' ? ' on' : ''}`}>
              Settings
            </Link>
            <Link
              href="/settings/integrations"
              className={`sidebar-link${path.startsWith('/settings/integrations') ? ' on' : ''}`}
            >
              Integrations
            </Link>
            <Link
              href="/settings/ldap"
              className={`sidebar-link${path.startsWith('/settings/ldap') ? ' on' : ''}`}
            >
              LDAP
            </Link>
            <Link href="/settings/sso" className={`sidebar-link${path.startsWith('/settings/sso') ? ' on' : ''}`}>
              SSO
            </Link>
            <Link href="/settings/fields" className={`sidebar-link${path.startsWith('/settings/fields') ? ' on' : ''}`}>
              Fields
            </Link>
            <Link
              href="/settings/workflows"
              className={`sidebar-link${path.startsWith('/settings/workflows') ? ' on' : ''}`}
            >
              Workflows
            </Link>
            <Link href="/admin/audit" className={`sidebar-link${path.startsWith('/admin/audit') ? ' on' : ''}`}>
              Audit
            </Link>
            <Link href="/admin/users" className={`sidebar-link${path.startsWith('/admin/users') ? ' on' : ''}`}>
              Users
            </Link>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
