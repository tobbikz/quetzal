'use client';

import { useMemo, useRef, useState } from 'react';
import { saveFieldAction } from '@/app/actions';

function splitLabels(value: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of value.split(',')) {
    const label = part.trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function LabelTags({
  issueKey,
  value,
  suggestions,
}: {
  issueKey: string;
  value: string;
  suggestions: string[];
}) {
  const labels = splitLabels(value);
  const hidden = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const unused = useMemo(() => {
    const taken = new Set(labels.map((label) => label.toLowerCase()));
    const query = draft.trim().toLowerCase();
    return suggestions.filter((label) => {
      const key = label.toLowerCase();
      if (taken.has(key)) return false;
      return !query || key.includes(query);
    });
  }, [draft, labels, suggestions]);

  function save(next: string[]) {
    if (!hidden.current) return;
    hidden.current.value = next.join(', ');
    hidden.current.form?.requestSubmit();
  }

  function add(raw: string) {
    const label = raw.trim().replace(/,/g, '');
    if (!label) return;
    const taken = new Set(labels.map((item) => item.toLowerCase()));
    if (taken.has(label.toLowerCase())) {
      setDraft('');
      return;
    }
    setDraft('');
    setOpen(false);
    save([...labels, label]);
  }

  return (
    <form action={saveFieldAction} className={`chips ${open ? 'open' : ''}`}>
      <input type="hidden" name="key" value={issueKey} />
      <input type="hidden" name="field" value="labels" />
      <input ref={hidden} type="hidden" name="value" defaultValue={labels.join(', ')} />
      {labels.map((label) => (
        <span key={label.toLowerCase()} className="chip">
          {label}
          <button type="button" aria-label={`Remove ${label}`} onClick={() => save(labels.filter((item) => item !== label))}>
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        aria-label="Add label"
        value={draft}
        placeholder={labels.length ? '' : 'Add label'}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add(draft);
          }
          if (event.key === 'Backspace' && !draft && labels.length) {
            save(labels.slice(0, -1));
          }
        }}
      />
      {open && unused.length > 0 && (
        <div className="chip-menu" role="listbox" aria-label="Labels in this project">
          {unused.map((label) => (
            <button
              key={label.toLowerCase()}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                add(label);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
