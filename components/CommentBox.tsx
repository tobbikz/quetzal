'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { RichToolbar } from '@/components/RichToolbar';
import { SelectionBubble } from '@/components/SelectionBubble';
import { SlashMenu } from '@/components/SlashMenu';
import { richExtensions } from '@/components/tiptapExtensions';
import { isEmptyHtml } from '@/lib/richtext';
import type { IssuePreview } from '@/lib/preview';
import { STATUS_LABEL, TYPE_LABEL, tagForStatus, tagForType } from '@/lib/format';

const EMOJIS = [
  '😀', '🙂', '😅', '🤔', '😎', '🎉', '🙌', '👏', '🙏', '❤️',
  '👍', '👎', '👀', '🔥', '💡', '⭐', '💯', '✅', '❌', '⚠️',
  '🐛', '🚀', '📌', '📝', '⏰', '💬', '📎', '🔗',
];

const ISSUE_TOKEN = /(?:^|[\s([{])([A-Z][A-Z0-9]{0,9}(?:-\d{0,6})?)$/;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

type Action = (formData: FormData) => void | Promise<void>;

type EditorLike = {
  state: {
    selection: { $from: { parent: { isTextblock: boolean; textBetween: (from: number, to: number, blockSep?: string, leaf?: string) => string }; start: () => number; parentOffset: number; pos: number } };
  };
  chain: () => {
    focus: () => {
      deleteRange: (range: { from: number; to: number }) => {
        insertContent: (content: unknown) => { run: () => boolean };
      };
    };
  };
  getHTML: () => string;
  commands: { focus: () => boolean };
};

function textBeforeCursor(editor: EditorLike): { text: string; from: number; to: number } | null {
  const { $from } = editor.state.selection;
  if (!$from.parent.isTextblock) return null;
  const parentStart = $from.start();
  const offset = $from.parentOffset;
  const text = $from.parent.textBetween(0, offset, undefined, '\ufffc');
  return { text, from: parentStart, to: $from.pos };
}

export function CommentBox({
  action,
  fields,
  placeholder,
  submitLabel,
  mentions,
  onCancel,
  githubMirror = false,
}: {
  action: Action;
  fields: { name: string; value: string }[];
  placeholder: string;
  submitLabel: string;
  mentions: string[];
  onCancel?: () => void;
  /** When true, offer “Also post to GitHub” for linked issues. */
  githubMirror?: boolean;
}) {
  const [html, setHtml] = useState('<p></p>');
  const [open, setOpen] = useState<'emoji' | 'mention' | null>(null);
  const [query, setQuery] = useState('');
  const [issueQuery, setIssueQuery] = useState('');
  const [issueHits, setIssueHits] = useState<IssuePreview[]>([]);
  const [issueIndex, setIssueIndex] = useState(0);
  const [issueRange, setIssueRange] = useState<{ from: number; to: number } | null>(null);
  const issueFetch = useRef(0);
  const issueHitsRef = useRef<IssuePreview[]>([]);
  const issueIndexRef = useRef(0);
  const issueRangeRef = useRef<{ from: number; to: number } | null>(null);
  const insertIssueRef = useRef<(issue: IssuePreview) => void>(() => {});

  useEffect(() => {
    issueHitsRef.current = issueHits;
  }, [issueHits]);
  useEffect(() => {
    issueIndexRef.current = issueIndex;
  }, [issueIndex]);
  useEffect(() => {
    issueRangeRef.current = issueRange;
  }, [issueRange]);

  const names = useMemo(
    () => mentions.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase())),
    [mentions, query],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: richExtensions(placeholder, 'full'),
    content: '<p></p>',
    onUpdate: ({ editor: current }) => {
      setHtml(current.getHTML());
      const before = textBeforeCursor(current as unknown as EditorLike);
      if (!before) {
        setIssueHits([]);
        setIssueQuery('');
        setIssueRange(null);
        return;
      }
      const match = ISSUE_TOKEN.exec(before.text);
      if (!match) {
        setIssueHits([]);
        setIssueQuery('');
        setIssueRange(null);
        return;
      }
      const token = match[1] ?? '';
      // Trigger once the user types PROJECT- (Jira-style).
      if (!token.includes('-')) {
        setIssueHits([]);
        setIssueQuery('');
        setIssueRange(null);
        return;
      }
      const tokenFrom = before.to - token.length;
      setIssueQuery(token);
      setIssueRange({ from: tokenFrom, to: before.to });
      setIssueIndex(0);
    },
    editorProps: {
      attributes: {
        class: 'composer-editor prose',
      },
      handleKeyDown: (_view, event) => {
        const hits = issueHitsRef.current;
        const range = issueRangeRef.current;
        if (!hits.length || !range) return false;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setIssueIndex((i) => {
            const next = (i + 1) % hits.length;
            issueIndexRef.current = next;
            return next;
          });
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setIssueIndex((i) => {
            const next = (i - 1 + hits.length) % hits.length;
            issueIndexRef.current = next;
            return next;
          });
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const hit = hits[issueIndexRef.current];
          if (!hit) return false;
          event.preventDefault();
          insertIssueRef.current(hit);
          return true;
        }
        if (event.key === 'Escape') {
          setIssueHits([]);
          setIssueQuery('');
          setIssueRange(null);
          return true;
        }
        return false;
      },
    },
  });

  function insertIssueLink(issue: IssuePreview) {
    const range = issueRangeRef.current;
    if (!editor || !range) return;
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent([
        {
          type: 'text',
          text: issue.key,
          marks: [{ type: 'link', attrs: { href: `/issues/${issue.key}`, class: 'issue-key-link' } }],
        },
        { type: 'text', text: ' ' },
      ])
      .run();
    setIssueHits([]);
    setIssueQuery('');
    setIssueRange(null);
    setHtml(editor.getHTML());
  }
  insertIssueRef.current = insertIssueLink;

  useEffect(() => {
    if (!issueQuery.includes('-')) {
      setIssueHits([]);
      return;
    }
    const id = ++issueFetch.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/issues/search?q=${encodeURIComponent(issueQuery)}`);
        if (!response.ok || id !== issueFetch.current) return;
        const data = (await response.json()) as IssuePreview[];
        if (id !== issueFetch.current) return;
        setIssueHits(data);
        setIssueIndex(0);
      } catch {
        if (id === issueFetch.current) setIssueHits([]);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [issueQuery]);

  function insertMention(name: string) {
    editor?.chain().focus().insertContent(`@${name} `).run();
    setOpen(null);
    setQuery('');
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (isEmptyHtml(html)) {
      event.preventDefault();
      editor?.commands.focus();
    }
  }

  return (
    <form action={action} className="composer" onSubmit={onSubmit}>
      {fields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      <RichToolbar editor={editor} variant="full" />
      <SelectionBubble editor={editor} />
      <SlashMenu editor={editor} />
      <div className="composer-extra-bar">
        <button type="button" title="Emoji" aria-label="Emoji" aria-pressed={open === 'emoji'} onClick={() => setOpen(open === 'emoji' ? null : 'emoji')}>
          <Icon><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" /></Icon>
        </button>
        <button type="button" title="Mention" aria-label="Mention" aria-pressed={open === 'mention'} onClick={() => setOpen(open === 'mention' ? null : 'mention')}>
          <Icon><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" /></Icon>
        </button>
      </div>
      {open === 'emoji' && (
        <div className="composer-pop" role="listbox" aria-label="Emoji">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                editor?.chain().focus().insertContent(emoji).run();
                setOpen(null);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {open === 'mention' && (
        <div className="composer-pop" role="listbox" aria-label="Mention a person">
          <input
            className="composer-mention-filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter people"
            aria-label="Filter people"
          />
          <div className="composer-mentions">
            {names.map((name) => (
              <button key={name} type="button" role="option" onClick={() => insertMention(name)}>
                <span className="avatar">{name.slice(0, 1)}</span>
                {name}
              </button>
            ))}
            {names.length === 0 && <span className="muted">No matches</span>}
          </div>
        </div>
      )}
      <div className="composer-editor-wrap">
        <EditorContent editor={editor} />
        {issueHits.length > 0 ? (
          <div className="composer-issue-suggest" role="listbox" aria-label="Link an issue">
            {issueHits.map((issue, index) => (
              <button
                key={issue.key}
                type="button"
                role="option"
                aria-selected={index === issueIndex}
                className={index === issueIndex ? 'on' : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertIssueLink(issue)}
              >
                <span className={tagForType(issue.type)}>{TYPE_LABEL[issue.type]}</span>
                <span className="key">{issue.key}</span>
                <span className={tagForStatus(issue.status)}>{STATUS_LABEL[issue.status]}</span>
                <span className="composer-issue-summary">{issue.summary}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <input type="hidden" name="body" value={isEmptyHtml(html) ? '' : html} readOnly />
      {githubMirror ? (
        <label className="field field--check" style={{ marginTop: '0.35rem' }}>
          <input type="checkbox" name="post_to_github" value="1" />
          <span>Also post to GitHub</span>
        </label>
      ) : null}
      <div className="composer-foot">
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button className="btn" type="submit" disabled={isEmptyHtml(html)}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
