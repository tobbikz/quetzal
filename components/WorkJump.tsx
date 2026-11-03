import Link from 'next/link';

const LINKS = [
  { href: '/overview', label: 'Overview' },
  { href: '/board', label: 'Board' },
  { href: '/issues', label: 'Issues' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/dashboards', label: 'Dashboards' },
] as const;

export function WorkJump({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="work-more" aria-label="More destinations">
      <span className="work-more-label">More</span>
      <div className="work-more-links">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="work-more-link">
            {link.label}
          </Link>
        ))}
        {isAdmin ? (
          <Link href="/settings" className="work-more-link">
            Settings
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
