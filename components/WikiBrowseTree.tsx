'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Space, WikiPage } from '@/lib/types';

export type WikiBrowseBranch = {
  space: Space;
  kind: 'personal' | 'team';
  pages: WikiPage[];
};

function pageLabel(space: Space, page: WikiPage): string {
  /* Avoid twin rows like "Engineering" space + "Engineering" page. */
  if (page.title.trim().toLowerCase() === space.name.trim().toLowerCase()) return 'Overview';
  return page.title;
}

function matchesQuery(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

function pageOrDescendantMatches(
  pages: WikiPage[],
  page: WikiPage,
  space: Space,
  q: string,
): boolean {
  if (!q) return true;
  if (matchesQuery(pageLabel(space, page), q) || matchesQuery(page.slug, q)) return true;
  return pages
    .filter((item) => item.parentId === page.id)
    .some((kid) => pageOrDescendantMatches(pages, kid, space, q));
}

function PageNode({
  spaceKey,
  space,
  pages,
  page,
  depth,
  currentSlug,
  query,
}: {
  spaceKey: string;
  space: Space;
  pages: WikiPage[];
  page: WikiPage;
  depth: number;
  currentSlug?: string;
  query: string;
}) {
  const kids = pages.filter((item) => item.parentId === page.id);
  const visibleKids = kids.filter((kid) => pageOrDescendantMatches(pages, kid, space, query));
  if (query && !pageOrDescendantMatches(pages, page, space, query)) return null;

  const active = currentSlug === page.slug;
  const label = pageLabel(space, page);
  const isOverview = label === 'Overview';

  return (
    <li className="wiki-ex-node">
      <Link
        href={`/wiki/${spaceKey}/${page.slug}`}
        className={`wiki-ex-page${active ? ' is-active' : ''}${isOverview ? ' is-overview' : ''}`}
        style={{ paddingLeft: `${0.85 + depth * 0.75}rem` }}
        aria-current={active ? 'page' : undefined}
      >
        <span className="wiki-ex-page-mark" aria-hidden>
          {isOverview ? '⌂' : '·'}
        </span>
        <span className="wiki-ex-page-title">{label}</span>
      </Link>
      {visibleKids.length > 0 ? (
        <ul className="wiki-ex-pages">
          {visibleKids.map((kid) => (
            <PageNode
              key={kid.id}
              spaceKey={spaceKey}
              space={space}
              pages={pages}
              page={kid}
              depth={depth + 1}
              currentSlug={currentSlug}
              query={query}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WikiBrowseTree({
  branches,
  currentSpaceKey,
  currentSlug,
}: {
  branches: WikiBrowseBranch[];
  currentSpaceKey?: string | null;
  currentSlug?: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const initialOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const branch of branches) {
      map[branch.space.key] = true;
    }
    return map;
  }, [branches]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(initialOpen);

  useEffect(() => {
    if (!currentSpaceKey) return;
    setOpenMap((prev) => ({ ...prev, [currentSpaceKey]: true }));
  }, [currentSpaceKey]);

  const personal = branches.filter((b) => b.kind === 'personal');
  const team = branches.filter((b) => b.kind === 'team');

  function isOpen(key: string): boolean {
    if (q) return true;
    return openMap[key] ?? false;
  }

  function toggle(key: string) {
    setOpenMap((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  }

  function spaceMatches(branch: WikiBrowseBranch): boolean {
    if (!q) return true;
    if (matchesQuery(branch.space.name, q) || matchesQuery(branch.space.key, q)) return true;
    return branch.pages.some((page) => pageOrDescendantMatches(branch.pages, page, branch.space, q));
  }

  function renderSpace(branch: WikiBrowseBranch) {
    if (!spaceMatches(branch)) return null;
    const key = branch.space.key;
    const expanded = isOpen(key);
    const roots = branch.pages.filter((page) => page.parentId == null);
    const visibleRoots = roots.filter((page) =>
      pageOrDescendantMatches(branch.pages, page, branch.space, q),
    );
    const activeSpace = currentSpaceKey === key && !currentSlug;
    const activeInSpace = currentSpaceKey === key;

    return (
      <li
        key={key}
        className={`wiki-ex-space${activeInSpace ? ' is-current' : ''}${expanded ? ' is-open' : ''}`}
      >
        <div className="wiki-ex-space-row">
          <button
            type="button"
            className="wiki-ex-chevron"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${branch.space.name}` : `Expand ${branch.space.name}`}
            onClick={() => toggle(key)}
          >
            {expanded ? '▾' : '▸'}
          </button>
          <Link
            href={`/wiki/${key}`}
            className={`wiki-ex-space-link${activeSpace ? ' is-active' : ''}`}
            aria-current={activeSpace ? 'page' : undefined}
          >
            <span className="wiki-ex-space-name">{branch.space.name}</span>
            <span className="wiki-ex-space-meta">
              <span className="wiki-ex-space-key">
                {branch.kind === 'personal' ? 'Personal' : key}
              </span>
              <span className="wiki-ex-space-count">{branch.pages.length}</span>
            </span>
          </Link>
        </div>
        {expanded ? (
          visibleRoots.length > 0 ? (
            <ul className="wiki-ex-pages">
              {visibleRoots.map((page) => (
                <PageNode
                  key={page.id}
                  spaceKey={key}
                  space={branch.space}
                  pages={branch.pages}
                  page={page}
                  depth={0}
                  currentSlug={currentSpaceKey === key ? currentSlug : undefined}
                  query={q}
                />
              ))}
            </ul>
          ) : (
            <p className="wiki-ex-empty">No pages</p>
          )
        ) : null}
      </li>
    );
  }

  return (
    <div className="wiki-ex">
      <label className="wiki-ex-filter">
        <span className="sr-only">Filter spaces and pages</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter pages…"
          autoComplete="off"
        />
      </label>
      <nav className="wiki-ex-tree" aria-label="Spaces and pages">
        {personal.length > 0 ? (
          <div className="wiki-ex-section">
            <p className="wiki-ex-label">Personal</p>
            <ul className="wiki-ex-spaces">{personal.map(renderSpace)}</ul>
          </div>
        ) : null}
        {team.length > 0 ? (
          <div className="wiki-ex-section">
            <p className="wiki-ex-label">Team</p>
            <ul className="wiki-ex-spaces">{team.map(renderSpace)}</ul>
          </div>
        ) : null}
        {q && !branches.some(spaceMatches) ? (
          <p className="wiki-ex-empty wiki-ex-empty--filter">No matches</p>
        ) : null}
      </nav>
    </div>
  );
}
