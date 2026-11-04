import Link from 'next/link';
import type { ReactNode } from 'react';
import { NewHelpdeskButton } from '@/components/CreateHelpdesk';
import type { HelpdeskQueueCounts, HelpdeskQueueKey } from '@/lib/helpdesk';

export type HelpdeskCrumb = { href?: string; label: string };

const QUEUE_LINKS: Array<{ key: HelpdeskQueueKey; label: string; href: string }> = [
  { key: 'all', label: 'All tickets', href: '/helpdesk' },
  { key: 'urgent', label: 'Urgent', href: '/helpdesk?queue=urgent' },
  { key: 'mine', label: 'Assigned to me', href: '/helpdesk?queue=mine' },
  { key: 'open', label: 'Open', href: '/helpdesk?queue=open' },
  { key: 'breached', label: 'SLA breached', href: '/helpdesk?queue=breached' },
];

const SECTION_LINKS = [
  { href: '/helpdesk', label: 'Tickets', match: 'tickets' as const },
  { href: '/helpdesk/queues', label: 'Board', match: 'queues' as const },
  { href: '/helpdesk/sla', label: 'SLA', match: 'sla' as const },
  { href: '/helpdesk/macros', label: 'Macros', match: 'macros' as const },
];

export function HelpdeskDesk({
  crumbs,
  activeSection,
  activeQueue = 'all',
  counts,
  canCreate = false,
  children,
}: {
  crumbs: HelpdeskCrumb[];
  activeSection: 'tickets' | 'queues' | 'sla' | 'detail' | 'macros';
  activeQueue?: HelpdeskQueueKey | string;
  counts: HelpdeskQueueCounts;
  canCreate?: boolean;
  children: ReactNode;
}) {
  const queueOn = (key: HelpdeskQueueKey) =>
    activeSection === 'tickets' && (activeQueue || 'all') === key;

  return (
    <main className="page hdesk-page">
      <div className="hdesk-atmosphere" aria-hidden="true" />
      <header className="hdesk-bar">
        <nav className="hdesk-crumbs" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <span key={`${crumb.label}-${index}`} className="hdesk-crumb-piece">
                {index > 0 ? <span className="hdesk-crumb-sep" aria-hidden>/</span> : null}
                {crumb.href && !last ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span className={last ? 'is-current' : undefined}>{crumb.label}</span>
                )}
              </span>
            );
          })}
        </nav>
        <nav className="hdesk-sections" aria-label="Helpdesk sections">
          {SECTION_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`hdesk-section-link${
                activeSection === link.match ||
                (activeSection === 'detail' && link.match === 'tickets')
                  ? ' is-on'
                  : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="hdesk-shell">
        <aside className="hdesk-rail">
          <div className="hdesk-rail-panel">
            <div className="hdesk-rail-head">
              <span>Queues</span>
              {canCreate ? <NewHelpdeskButton label="New" /> : null}
            </div>
            <nav className="hdesk-queue-list" aria-label="Ticket queues">
              {QUEUE_LINKS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`hdesk-queue-item${queueOn(item.key) ? ' is-on' : ''}${
                    item.key === 'breached' && counts.breached > 0 ? ' is-alert' : ''
                  }`}
                >
                  <span className="hdesk-queue-label">{item.label}</span>
                  <span className="hdesk-queue-count">{counts[item.key]}</span>
                </Link>
              ))}
            </nav>
          </div>
          <p className="hdesk-rail-hint">Triage from the rail. Open a ticket to update status and SLA.</p>
        </aside>
        <div className="hdesk-main">{children}</div>
      </div>
    </main>
  );
}
