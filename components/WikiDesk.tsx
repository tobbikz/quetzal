import Link from 'next/link';
import type { ReactNode } from 'react';
import { WikiBrowseTree, type WikiBrowseBranch } from '@/components/WikiBrowseTree';
import type { Space, WikiPage } from '@/lib/types';

export type WikiCrumb = { href?: string; label: string };

export function WikiDesk({
  personal,
  team,
  currentSpaceKey,
  pages: _pages,
  currentSlug,
  browseAll,
  canEdit = false,
  canSettings = false,
  crumbs,
  tools = true,
  children,
}: {
  personal: Space;
  team: Space[];
  /** Active space key, or null on hub routes */
  currentSpaceKey: string | null;
  pages?: WikiPage[];
  currentSlug?: string;
  /** Full cross-space tree — preferred explorer model */
  browseAll?: WikiBrowseBranch[];
  canEdit?: boolean;
  canSettings?: boolean;
  crumbs: WikiCrumb[];
  /** Show Blog/Trash/Settings/New in the rail */
  tools?: boolean;
  children: ReactNode;
}) {
  const inSpace = Boolean(currentSpaceKey);
  const key = currentSpaceKey ?? '';

  const fallbackBranches: WikiBrowseBranch[] =
    browseAll ??
    [
      {
        space: personal,
        kind: 'personal' as const,
        pages: currentSpaceKey === personal.key && _pages ? _pages : [],
      },
      ...team.map((space) => ({
        space,
        kind: 'team' as const,
        pages: currentSpaceKey === space.key && _pages ? _pages : [],
      })),
    ];

  return (
    <main className="page wdesk-page">
      <div className="wdesk-atmosphere" aria-hidden="true" />
      <header className="wdesk-bar wdesk-bar--slim">
        <nav className="wdesk-crumbs" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <span key={`${crumb.label}-${index}`} className="wdesk-crumb-piece">
                {index > 0 ? <span className="wdesk-crumb-sep" aria-hidden="true">/</span> : null}
                {crumb.href && !last ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span className={last ? 'is-current' : undefined}>{crumb.label}</span>
                )}
              </span>
            );
          })}
        </nav>
      </header>

      <div className="wdesk-shell">
        <aside className="wdesk-rail">
          <div className="wdesk-tree-panel wdesk-tree-panel--browse">
            <div className="wdesk-tree-head">
              <span>Explorer</span>
              <Link href="/wiki" className={`wdesk-spaces-all${!currentSpaceKey ? ' is-on' : ''}`}>
                Home
              </Link>
            </div>
            <WikiBrowseTree
              branches={fallbackBranches}
              currentSpaceKey={currentSpaceKey}
              currentSlug={currentSlug}
            />
          </div>

          {inSpace && tools ? (
            <nav className="wdesk-tools wdesk-tools--compact" aria-label="Space tools">
              {canEdit ? (
                <Link href={`/wiki/${key}/new`} className="wdesk-tools-link">
                  New
                </Link>
              ) : null}
              <Link href={`/wiki/${key}/blog`} className="wdesk-tools-link">
                Blog
              </Link>
              <Link href={`/wiki/${key}/trash`} className="wdesk-tools-link">
                Trash
              </Link>
              {canSettings ? (
                <Link href={`/wiki/${key}/settings`} className="wdesk-tools-link">
                  Perms
                </Link>
              ) : null}
              <Link href="/search" className="wdesk-tools-link">
                Search
              </Link>
            </nav>
          ) : tools && !inSpace ? (
            <nav className="wdesk-tools wdesk-tools--compact" aria-label="Wiki tools">
              <Link href="/search" className="wdesk-tools-link">
                Search
              </Link>
              <Link href="/wiki/spaces" className="wdesk-tools-link">
                Spaces
              </Link>
            </nav>
          ) : null}
        </aside>

        <div className="wdesk-main">{children}</div>
      </div>
    </main>
  );
}
