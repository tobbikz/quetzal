'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { applyIssueJql, deleteSavedFilterAction, saveSavedFilterAction } from '@/app/actions';
import type { JqlSuggestion } from '@/lib/jql';
import type { SavedFilter } from '@/lib/savedFilters';

type Example = { label: string; jql: string };

export function JqlBar({
  defaultJql,
  projectKey,
  examples,
  savedFilters,
  jqlError,
}: {
  defaultJql: string;
  projectKey: string;
  examples: Example[];
  savedFilters: SavedFilter[];
  jqlError: string | null;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jql, setJql] = useState(defaultJql);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<JqlSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const [filterName, setFilterName] = useState('');
  const [flash, setFlash] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setJql(defaultJql);
  }, [defaultJql]);

  const fetchSuggest = useCallback((value: string, cursor: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/jql/suggest?q=${encodeURIComponent(value)}&cursor=${cursor}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: JqlSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setActive(0);
        setOpen(true);
      } catch {
        /* ignore network blips */
      }
    }, 120);
  }, []);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const cursor = event.target.selectionStart ?? value.length;
    setJql(value);
    fetchSuggest(value, cursor);
  }

  function applySuggestion(item: JqlSuggestion) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? jql.length;
    const before = jql.slice(0, cursor);
    const after = jql.slice(cursor);
    const trimmed = before.replace(/\s+$/, '');
    const tokenMatch = /([A-Za-z_][\w\-]*|"[^"]*"|'[^']*'|\d[\wT:\.\+\-]*)$/.exec(trimmed);
    const prefix = tokenMatch?.[1] ?? '';
    const start = trimmed.length - prefix.length;
    const head = before.slice(0, start).replace(/\s+$/, '');
    // Never glue tokens: space before unless head ends with = ( or is empty.
    const needsLead = head.length > 0 && !/[=(]$/.test(head);
    const lead = needsLead ? ' ' : head.endsWith('=') || head.endsWith('(') ? ' ' : '';
    const body = item.text === ',' ? ',' : item.text;
    const trail = ' ';
    const insert = `${lead}${body}${trail}`;
    const rest = after.replace(/^\s+/, '');
    const next = `${head}${insert}${rest}`;
    setJql(next);
    setOpen(false);
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 420);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = head.length + insert.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && suggestions[active]) {
      // Accept highlighted suggestion instead of submitting incomplete token (e.g. "ass" → assignee)
      event.preventDefault();
      applySuggestion(suggestions[active]);
    } else if (event.key === 'Tab' && suggestions[active]) {
      event.preventDefault();
      applySuggestion(suggestions[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="jql-panel">
      <form className="jql-bar" action={applyIssueJql}>
        <div className={`jql-field${open && suggestions.length > 0 ? ' is-open' : ''}${flash ? ' is-flash' : ''}`}>
          <label className="jql-label" htmlFor="jql">
            QQL
          </label>
          <div className="jql-input-wrap">
            <input
              ref={inputRef}
              id="jql"
              className="jql-input"
              type="search"
              name="jql"
              value={jql}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onFocus={(event) => {
                const cursor = event.target.selectionStart ?? jql.length;
                fetchSuggest(jql, cursor);
              }}
              onBlur={() => {
                // Delay so suggestion mousedown can fire
                setTimeout(() => setOpen(false), 150);
              }}
              placeholder={`project = ${projectKey} AND status = "In Progress"`}
              spellCheck={false}
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={listId}
            />
            {open && suggestions.length > 0 && (
              <ul id={listId} className="jql-suggest" role="listbox" aria-label="QQL suggestions">
                {suggestions.map((item, index) => (
                  <li key={`${item.kind}-${item.text}-${index}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      className={index === active ? 'on' : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySuggestion(item)}
                    >
                      <span className={`jql-suggest-kind is-${item.kind}`}>{item.kind}</span>
                      <span className="jql-suggest-text">{item.label}</span>
                      {index === active ? <span className="jql-suggest-hint">↵</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button className="btn jql-run" type="submit">
          Run
        </button>
        {defaultJql ? (
          <a className="jql-clear" href="/issues">
            Clear
          </a>
        ) : null}
      </form>

      <div className="jql-saved">
        <form
          className="jql-save-form"
          action={(formData) => {
            startTransition(async () => {
              await saveSavedFilterAction(formData);
              setFilterName('');
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="jql" value={jql} />
          <input
            type="text"
            name="name"
            className="jql-save-name"
            placeholder="Save as…"
            value={filterName}
            onChange={(event) => setFilterName(event.target.value)}
            maxLength={80}
            aria-label="Saved filter name"
          />
          <button className="btn-secondary" type="submit" disabled={pending || !jql.trim() || !filterName.trim()}>
            Save
          </button>
        </form>
        {savedFilters.length > 0 && (
          <div className="quick jql-saved-list" aria-label="Saved filters">
            {savedFilters.map(async (filter) => (
              <span key={filter.id} className={`jql-saved-item${jql === filter.jql ? ' on' : ''}`}>
                <a href={`/issues?jql=${encodeURIComponent(filter.jql)}`} title={filter.jql}>
                  {filter.name}
                </a>
                <form
                  action={(formData) => {
                    startTransition(async () => {
                      await deleteSavedFilterAction(formData);
                      router.refresh();
                    });
                  }}
                >
                  <input type="hidden" name="id" value={filter.id} />
                  <button type="submit" className="jql-saved-del" aria-label={`Delete ${filter.name}`} title="Delete">
                    ×
                  </button>
                </form>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="quick jql-examples">
        {examples.map((ex) => (
          <a
            key={ex.jql}
            href={`/issues?jql=${encodeURIComponent(ex.jql)}`}
            className={jql === ex.jql ? 'on' : undefined}
            title={ex.jql}
          >
            {ex.label}
          </a>
        ))}
      </div>
      {jqlError && (
        <p className="jql-error" role="alert">
          {jqlError}
        </p>
      )}
    </div>
  );
}
