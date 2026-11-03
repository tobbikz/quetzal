'use client';

import { useRef } from 'react';
import { saveCustomFieldAction } from '@/app/actions';

export function LiveCustomField({
  issueKey,
  fieldId,
  label,
  type,
  value,
  options,
}: {
  issueKey: string;
  fieldId: number;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  value: string;
  options?: string[];
}) {
  const form = useRef<HTMLFormElement>(null);

  function submitSoon() {
    // Let the input commit its value before submit.
    Promise.resolve().then(() => form.current?.requestSubmit());
  }

  return (
    <form ref={form} action={saveCustomFieldAction} className="quiet">
      <input type="hidden" name="key" value={issueKey} />
      <input type="hidden" name="field_id" value={fieldId} />
      {type === 'select' ? (
        <select
          name="value"
          aria-label={label}
          defaultValue={value}
          className="quiet-value"
          onChange={submitSoon}
        >
          <option value="">None</option>
          {(options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="quiet-value"
          aria-label={label}
          name="value"
          type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
          defaultValue={value}
          onBlur={submitSoon}
        />
      )}
    </form>
  );
}
