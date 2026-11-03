import Link from 'next/link';
import type { Space } from '@/lib/types';

export function WikiSpaceNav({
  personal,
  team,
  currentKey,
}: {
  personal: Space;
  team: Space[];
  currentKey?: string;
}) {
  return (
    <aside className="wdesk-spaces">
      <div className="wdesk-spaces-head">
        <span className="wdesk-spaces-label">Spaces</span>
        <Link
          href="/wiki"
          className={`wdesk-spaces-all${!currentKey || currentKey === '__all__' ? ' is-on' : ''}`}
        >
          Home
        </Link>
      </div>
      <nav className="wdesk-spaces-list" aria-label="Wiki spaces">
        <Link
          href={`/wiki/${personal.key}`}
          className={`wdesk-spaces-item${currentKey === personal.key ? ' is-on' : ''}`}
        >
          <span className="wdesk-spaces-kind">Personal</span>
          <strong>{personal.name}</strong>
        </Link>
        <div className="wdesk-spaces-section">Team</div>
        {team.map((space) => (
          <Link
            key={space.key}
            href={`/wiki/${space.key}`}
            className={`wdesk-spaces-item${currentKey === space.key ? ' is-on' : ''}`}
          >
            <span className="wdesk-spaces-kind">{space.key}</span>
            <strong>{space.name}</strong>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
