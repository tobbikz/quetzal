'use client';

import { useState } from 'react';
import { CommentBox } from '@/components/CommentBox';

type Action = (formData: FormData) => void | Promise<void>;

export function CommentComposer({
  action,
  fields,
  placeholder,
  submitLabel,
  mentions,
  openLabel = 'Add a comment',
}: {
  action: Action;
  fields: { name: string; value: string }[];
  placeholder: string;
  submitLabel: string;
  mentions: string[];
  openLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="comment-open" onClick={() => setOpen(true)}>
        {openLabel}
      </button>
    );
  }
  return (
    <CommentBox
      action={action}
      fields={fields}
      placeholder={placeholder}
      submitLabel={submitLabel}
      mentions={mentions}
      onCancel={() => setOpen(false)}
    />
  );
}
