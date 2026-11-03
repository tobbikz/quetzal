'use client';

import { useState } from 'react';
import { CommentBox } from '@/components/CommentBox';

type Action = (formData: FormData) => void | Promise<void>;

export function ReplyComposer({
  action,
  issueKey,
  parentId,
  tab,
  placeholder,
  mentions,
}: {
  action: Action;
  issueKey: string;
  parentId: number;
  tab: string;
  placeholder: string;
  mentions: string[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="comment-reply" onClick={() => setOpen(true)}>
        Reply
      </button>
    );
  }
  return (
    <CommentBox
      action={action}
      fields={[
        { name: 'key', value: issueKey },
        { name: 'parent', value: String(parentId) },
        ...(tab === 'all' ? [] : [{ name: 'tab', value: tab }]),
      ]}
      placeholder={placeholder}
      submitLabel="Reply"
      mentions={mentions}
      onCancel={() => setOpen(false)}
    />
  );
}
