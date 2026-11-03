'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type CommandItem = {
  id: string;
  label: string;
  href: string;
  group?: string;
  shortcut?: string;
  keywords?: string;
};

type CommandMenuApi = {
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const CommandMenuCtx = createContext<CommandMenuApi | null>(null);

export function useCommandMenu(): CommandMenuApi {
  return (
    useContext(CommandMenuCtx) ?? {
      open: () => undefined,
      close: () => undefined,
      toggle: () => undefined,
    }
  );
}

function matches(item: CommandItem, q: string): boolean {
  if (!q) return true;
  const hay = `${item.label} ${item.group ?? ''} ${item.keywords ?? ''} ${item.href}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => hay.includes(token));
}

export function CommandMenuHost({
  items,
  children,
}: {
  items: CommandItem[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(() => items.filter((item) => matches(item, query)), [items, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActive(0);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) {
        setQuery('');
        setActive(0);
        return false;
      }
      return true;
    });
  }, []);

  const api = useMemo<CommandMenuApi>(() => ({ open: openMenu, close, toggle }), [openMenu, close, toggle]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggle();
        return;
      }
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (typing && target !== inputRef.current) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
        return;
      }
      if (event.key === 'Enter') {
        const item = filtered[active];
        if (!item) return;
        event.preventDefault();
        close();
        router.push(item.href);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, toggle, close, filtered, active, router]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const portal =
    mounted && open
      ? createPortal(
          <div className="cmd-root" role="presentation">
            <button type="button" className="cmd-backdrop" aria-label="Close command menu" onClick={close} />
            <div
              className="cmd-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Command menu"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="cmd-search">
                <span className="cmd-search-icon" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  className="cmd-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter…"
                  aria-autocomplete="list"
                  aria-controls={listId}
                  aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
                />
                <kbd className="cmd-kbd">esc</kbd>
              </div>
              <ul id={listId} className="cmd-list" role="listbox">
                {filtered.length === 0 ? (
                  <li className="cmd-empty">No matches</li>
                ) : (
                  filtered.map((item, index) => (
                    <li key={item.id} role="option" aria-selected={index === active} id={`${listId}-${item.id}`}>
                      <button
                        type="button"
                        className={`cmd-item${index === active ? ' is-active' : ''}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => {
                          close();
                          router.push(item.href);
                        }}
                      >
                        <span className="cmd-item-label">
                          {item.group ? <span className="cmd-item-group">{item.group}</span> : null}
                          {item.label}
                        </span>
                        {item.shortcut ? <kbd className="cmd-item-shortcut">{item.shortcut}</kbd> : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="cmd-footer">
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> navigate
                </span>
                <span>
                  <kbd>↵</kbd> open
                </span>
                <span>
                  <kbd>⌘</kbd>
                  <kbd>K</kbd> toggle
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <CommandMenuCtx.Provider value={api}>
      {children}
      {portal}
    </CommandMenuCtx.Provider>
  );
}

export function CommandMenuTrigger() {
  const { toggle } = useCommandMenu();
  return (
    <button
      type="button"
      className="cmd-trigger"
      onClick={toggle}
      aria-label="Open command menu"
      title="Command menu (⌘K)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="cmd-trigger-label">Search</span>
      <kbd className="cmd-trigger-kbd">⌘K</kbd>
    </button>
  );
}

export function issueCommands(
  issues: Array<{ key: string; summary: string; type: string; status: string }>,
): CommandItem[] {
  return issues.map((issue) => ({
    id: `issue-${issue.key}`,
    label: `${issue.key} · ${issue.summary}`,
    href: `/issues/${issue.key}`,
    group: issue.type === 'bug' ? 'Tickets' : 'Issues',
    keywords: `${issue.key} ${issue.type} ticket ${issue.status} ${issue.summary}`,
  }));
}

export function buildDefaultCommands(opts: {
  isAdmin: boolean;
  isHelpdeskAgent?: boolean;
  personalSpaceKey: string;
  teamSpaces: { key: string; name: string }[];
  issues?: Array<{ key: string; summary: string; type: string; status: string }>;
}): CommandItem[] {
  const work: CommandItem[] = [
    { id: 'home', label: 'For you', href: '/', group: 'Work', shortcut: 'G H', keywords: 'home dashboard' },
    { id: 'overview', label: 'Overview', href: '/overview', group: 'Work' },
    { id: 'issues', label: 'Issues', href: '/issues', group: 'Work', keywords: 'tasks tickets' },
    { id: 'tickets', label: 'Tickets', href: '/?type=bug', group: 'Work', keywords: 'ticket bug defects' },
    { id: 'board', label: 'Board', href: '/board', group: 'Work' },
    { id: 'board-tickets', label: 'Board · Tickets', href: '/board?type=bug', group: 'Work', keywords: 'ticket bug board' },
    { id: 'backlog', label: 'Backlog', href: '/backlog', group: 'Work' },
    { id: 'dashboards', label: 'Dashboards', href: '/dashboards', group: 'Work' },
    { id: 'roadmap', label: 'Roadmap', href: '/roadmap', group: 'Work' },
    { id: 'releases', label: 'Releases', href: '/releases', group: 'Work' },
    { id: 'calendar', label: 'Calendar', href: '/calendar', group: 'Work' },
  ];
  if (opts.isAdmin) {
    work.push({ id: 'automation', label: 'Automation', href: '/automation', group: 'Work' });
  }

  const wiki: CommandItem[] = [
    { id: 'wiki-home', label: 'Wiki home', href: '/wiki', group: 'Wiki' },
    { id: 'wiki-spaces', label: 'Wiki spaces', href: '/wiki/spaces', group: 'Wiki' },
    {
      id: 'wiki-personal',
      label: 'Personal space',
      href: `/wiki/${opts.personalSpaceKey}`,
      group: 'Wiki',
    },
    ...opts.teamSpaces.map((space) => ({
      id: `wiki-${space.key}`,
      label: space.name,
      href: `/wiki/${space.key}`,
      group: 'Wiki',
      keywords: space.key,
    })),
    { id: 'search', label: 'Search wiki', href: '/search', group: 'Wiki' },
  ];

  const portal: CommandItem[] = [
    { id: 'portal', label: 'Customer portal', href: '/portal', group: 'Portal' },
  ];

  const helpdesk: CommandItem[] = opts.isHelpdeskAgent
    ? [
        { id: 'hd-tickets', label: 'Helpdesk tickets', href: '/helpdesk', group: 'Helpdesk' },
        { id: 'hd-queues', label: 'Queues', href: '/helpdesk/queues', group: 'Helpdesk' },
        { id: 'hd-sla', label: 'SLA report', href: '/helpdesk/sla', group: 'Helpdesk' },
      ]
    : [];

  const admin: CommandItem[] = opts.isAdmin
    ? [
        { id: 'settings', label: 'Settings hub', href: '/settings', group: 'Admin' },
        { id: 'integrations', label: 'Integrations', href: '/settings/integrations', group: 'Admin' },
        { id: 'sso', label: 'SSO', href: '/settings/sso', group: 'Admin' },
        { id: 'fields', label: 'Custom fields', href: '/settings/fields', group: 'Admin' },
        { id: 'sites', label: 'Sites', href: '/settings/sites', group: 'Admin' },
        { id: 'notifications', label: 'Notifications', href: '/settings/notifications', group: 'Admin' },
        { id: 'workflows', label: 'Workflows', href: '/settings/workflows', group: 'Admin' },
        { id: 'audit', label: 'Audit', href: '/admin/audit', group: 'Admin' },
        { id: 'backup', label: 'Backup', href: '/admin/backup', group: 'Admin' },
        { id: 'users', label: 'Users', href: '/admin/users', group: 'Admin' },
      ]
    : [];

  const issues = issueCommands(opts.issues ?? []);
  return [...portal, ...work, ...wiki, ...helpdesk, ...admin, ...issues];
}
