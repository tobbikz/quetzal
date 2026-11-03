'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createSprintAction, saveFieldAction } from '@/app/actions';

export function SprintField({
  issueKey,
  value,
  sprints,
}: {
  issueKey: string;
  value: string;
  sprints: { id: number; name: string }[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const options = [
    { value: '', label: 'Backlog' },
    ...sprints.map((sprint) => ({ value: String(sprint.id), label: sprint.name })),
  ];
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCreating(false);
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (creating) nameRef.current?.focus();
  }, [creating]);

  function pick(next: string) {
    setOpen(false);
    setCreating(false);
    if (!hidden.current || next === value) return;
    hidden.current.value = next;
    hidden.current.form?.requestSubmit();
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    const input = event.currentTarget.elements.namedItem('name');
    if (!(input instanceof HTMLInputElement)) return;
    const name = input.value.trim();
    if (!name) {
      event.preventDefault();
      input.setCustomValidity('Enter a sprint name');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    input.value = name;
  }

  return (
    <div ref={root} className={`quiet${open ? ' open' : ''}`}>
      <form action={saveFieldAction}>
        <input type="hidden" name="key" value={issueKey} />
        <input type="hidden" name="field" value="sprint" />
        <input ref={hidden} type="hidden" name="value" defaultValue={value} />
        <button
          type="button"
          className="quiet-value"
          aria-label="Sprint"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setCreating(false);
            setOpen((currentOpen) => !currentOpen);
          }}
        >
          {value ? current.label : <span className="muted">{current.label}</span>}
        </button>
        {open && !creating && (
          <div className="quiet-menu sprint-menu" role="listbox" aria-label="Sprint">
            <div className="sprint-options">
              {options.map((option) => (
                <button
                  key={option.value || 'backlog'}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={option.value === value ? 'on' : ''}
                  onClick={() => pick(option.value)}
                >
                  {option.value ? option.label : <span className="muted">{option.label}</span>}
                </button>
              ))}
            </div>
            <button type="button" className="sprint-new" onClick={() => setCreating(true)}>
              New sprint
            </button>
          </div>
        )}
      </form>
      {open && creating && (
        <form action={createSprintAction} className="quiet-menu sprint-create" onSubmit={onCreate}>
          <input type="hidden" name="key" value={issueKey} />
          <label className="field">
            <span>Name</span>
            <input
              ref={nameRef}
              type="text"
              name="name"
              required
              maxLength={80}
              aria-label="Sprint name"
              placeholder="Sprint name"
              autoComplete="off"
            />
          </label>
          <div className="sprint-create-actions">
            <button className="btn" type="submit">Create</button>
            <button className="btn-secondary" type="button" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
