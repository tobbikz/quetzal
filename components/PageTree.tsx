import Link from 'next/link';
import type { WikiPage } from '@/lib/types';

export function PageTree({ space, pages, current }: { space: string; pages: WikiPage[]; current?: string }) {
  const roots = pages.filter((page) => page.parentId == null);
  function branch(page: WikiPage, depth: number) {
    const kids = pages.filter((item) => item.parentId === page.id);
    return (
      <li key={page.id} className="wdesk-tree-node">
        <Link
          href={`/wiki/${space}/${page.slug}`}
          className={`wdesk-tree-link${current === page.slug ? ' is-active' : ''}`}
          style={{ paddingLeft: `${0.5 + depth * 0.7}rem` }}
        >
          {page.title}
        </Link>
        {kids.length > 0 ? (
          <ul className="wdesk-tree-kids">{kids.map((kid) => branch(kid, depth + 1))}</ul>
        ) : null}
      </li>
    );
  }
  return (
    <nav className="wdesk-tree" aria-label="Pages in this space">
      <ul className="wdesk-tree-root">{roots.map((page) => branch(page, 0))}</ul>
    </nav>
  );
}
