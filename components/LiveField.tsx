'use client';

import { useEffect, useRef, useState } from 'react';
import { saveFieldAction } from '@/app/actions';
import { PriorityMark } from '@/components/PriorityMark';
import { tagForStatus, tagForType } from '@/lib/format';
import type { IssueStatus, IssueType, Priority } from '@/lib/types';

type Kind = 'text' | 'status' | 'type' | 'priority' | 'person';

function Face({ kind, value, label }: { kind: Kind; value: string; label: string }) {
  if (kind === 'status' && value) return <span className={tagForStatus(value as IssueStatus)}>{label}</span>;
  if (kind === 'type' && value) return <span className={tagForType(value as IssueType)}>{label}</span>;
  if (kind === 'priority' && value) return <PriorityMark priority={value as Priority} />;
  if (kind === 'person' && value) {
    return (
      <span className="person">
        <span className="avatar">{label.slice(0, 1)}</span>
        {label}
      </span>
    );
  }
  if (!value) return <span className="muted">{label}</span>;
  return <span>{label}</span>;
}

export function LiveSelect({
  issueKey,
  field,
  value,
  label,
  options,
  kind = 'text',
}: {
  issueKey: string;
  field: string;
  value: string;
  label: string;
  options: { value: string; label: string }[];
  kind?: Kind;
}) {
  const root = useRef<HTMLFormElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(next: string) {
    setOpen(false);
    if (!hidden.current || next === value) return;
    hidden.current.value = next;
    hidden.current.form?.requestSubmit();
  }

  return (
    <form ref={root} action={saveFieldAction} className={`quiet ${open ? 'open' : ''}`}>
      <input type="hidden" name="key" value={issueKey} />
      <input type="hidden" name="field" value={field} />
      <input ref={hidden} type="hidden" name="value" defaultValue={value} />
      <button
        type="button"
        className="quiet-value"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <Face kind={kind} value={value} label={current?.label ?? '—'} />
      </button>
      {open && (
        <div className="quiet-menu" role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value || 'empty'}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'on' : ''}
              onClick={() => pick(option.value)}
            >
              <Face kind={kind} value={option.value} label={option.label} />
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

export function LiveInput({
  issueKey,
  field,
  value,
  label,
  type,
}: {
  issueKey: string;
  field: string;
  value: string;
  label: string;
  type: 'text' | 'number' | 'date';
}) {
  return (
    <form action={saveFieldAction}>
      <input type="hidden" name="key" value={issueKey} />
      <input type="hidden" name="field" value={field} />
      <input
        type={type}
        name="value"
        aria-label={label}
        defaultValue={value}
        placeholder={type === 'text' ? 'None' : undefined}
        onChange={(event) => {
          if (type === 'date') event.currentTarget.form?.requestSubmit();
        }}
        onBlur={(event) => {
          if (type !== 'date' && event.currentTarget.value !== value) event.currentTarget.form?.requestSubmit();
        }}
      />
    </form>
  );
}
