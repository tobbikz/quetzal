'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

type WikiPageMenuProps = {
  spaceKey: string;
  slug: string;
  canEdit: boolean;
  canSettings: boolean;
  trashed: boolean;
  editing: boolean;
  /** When false, Edit stays on the primary button only */
  showEditInMenu?: boolean;
  trashAction: (formData: FormData) => void | Promise<void>;
};

export function WikiPageMenu({
  spaceKey,
  slug,
  canEdit,
  canSettings,
  trashed,
  editing,
  showEditInMenu = true,
  trashAction,
}: WikiPageMenuProps) {
  const rootRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const el = rootRef.current;
      if (!el?.open) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        el.open = false;
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const base = `/wiki/${spaceKey}/${slug}`;

  return (
    <details ref={rootRef} className="wiki-page-menu">
      <summary className="wiki-page-menu-trigger" aria-label="Page actions">
        <span aria-hidden="true">⋯</span>
      </summary>
      <div className="wiki-page-menu-panel" role="menu">
        {showEditInMenu && canEdit && !trashed && !editing ? (
          <Link href={`${base}?edit=1`} role="menuitem" className="wiki-page-menu-item">
            Edit
          </Link>
        ) : null}
        <Link href={`${base}/history`} role="menuitem" className="wiki-page-menu-item">
          History
        </Link>
        {canSettings ? (
          <Link href={`${base}/settings`} role="menuitem" className="wiki-page-menu-item">
            Restrictions
          </Link>
        ) : null}
        {canEdit && !trashed ? (
          <form action={trashAction} className="wiki-page-menu-danger">
            <input type="hidden" name="space" value={spaceKey} />
            <input type="hidden" name="slug" value={slug} />
            <button type="submit" role="menuitem" className="wiki-page-menu-item is-danger">
              Move to trash
            </button>
          </form>
        ) : null}
      </div>
    </details>
  );
}
