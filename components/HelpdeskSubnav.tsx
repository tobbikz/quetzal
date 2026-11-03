import Link from 'next/link';

const LINKS = [
  { href: '/helpdesk', label: 'Tickets', match: 'tickets' as const },
  { href: '/helpdesk/queues', label: 'Queues', match: 'queues' as const },
  { href: '/helpdesk/sla', label: 'SLA', match: 'sla' as const },
];

export function HelpdeskSubnav({ active }: { active: 'tickets' | 'queues' | 'sla' }) {
  return (
    <nav className="hdesk-subnav" aria-label="Helpdesk sections">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`hdesk-subnav-link${active === link.match ? ' is-on' : ''}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
