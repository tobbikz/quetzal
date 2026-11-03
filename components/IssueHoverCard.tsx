'use client';

import Link from 'next/link';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PriorityMark } from '@/components/PriorityMark';
import { STATUS_LABEL, TYPE_LABEL, tagForStatus, tagForType } from '@/lib/format';
import type { IssuePreview } from '@/lib/preview';

const cache = new Map<string, IssuePreview>();

function Card({ preview }: { preview: IssuePreview }) {
  const labels = preview.labels.split(',').map((item) => item.trim()).filter(Boolean);
  return (
    <span className="issue-card issue-card--portal" role="tooltip">
      <span className="issue-card-top">
        <span className={tagForType(preview.type)}>{TYPE_LABEL[preview.type]}</span>
        <span className="key">{preview.key}</span>
        <span className={tagForStatus(preview.status)}>{STATUS_LABEL[preview.status]}</span>
      </span>
      <strong className="issue-card-title">{preview.summary}</strong>
      {preview.description ? <span className="issue-card-desc">{preview.description}</span> : null}
      <span className="issue-card-grid">
        <span>Priority</span>
        <span><PriorityMark priority={preview.priority} /></span>
        <span>Assignee</span>
        <span>{preview.assignee ?? 'Unassigned'}</span>
        <span>Reporter</span>
        <span>{preview.reporter ?? 'Unknown'}</span>
        <span>Sprint</span>
        <span>{preview.sprint ?? 'Backlog'}</span>
        <span>Points</span>
        <span>{preview.points ?? '—'}</span>
        <span>Due</span>
        <span>{preview.dueOn ?? 'None'}</span>
      </span>
      {labels.length > 0 ? (
        <span className="issue-card-labels">
          {labels.map((label) => (
            <span key={label} className="tag">{label}</span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export function IssueHoverCard({
  issueKey,
  preview: initial,
  children,
  className,
}: {
  issueKey: string;
  preview?: IssuePreview;
  children: ReactNode;
  className?: string;
}) {
  const tip = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<IssuePreview | null>(initial ?? cache.get(issueKey) ?? null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initial) {
      cache.set(issueKey, initial);
      setPreview(initial);
    }
  }, [issueKey, initial]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    function place() {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth * 0.7);
      const gap = 6;
      const estimatedHeight = 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const preferAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
      const top = preferAbove ? Math.max(8, rect.top - estimatedHeight - gap) : rect.bottom + gap;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      setCoords({ top, left });
    }

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, preview]);

  async function ensurePreview() {
    if (preview || cache.has(issueKey)) {
      setPreview((current) => current ?? cache.get(issueKey) ?? null);
      return;
    }
    try {
      const response = await fetch(`/api/issues/${encodeURIComponent(issueKey)}`);
      if (!response.ok) return;
      const data = (await response.json()) as IssuePreview;
      cache.set(issueKey, data);
      setPreview(data);
    } catch {
      /* ignore */
    }
  }

  function show() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setOpen(true);
    void ensurePreview();
  }

  function hide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), 120);
  }

  const portal =
    mounted && open && preview && coords
      ? createPortal(
          <span
            id={tip}
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 4000 }}
          >
            <Card preview={preview} />
          </span>,
          document.body,
        )
      : null;

  return (
    <span
      ref={rootRef}
      className={`issue-hover${open ? ' issue-hover--open' : ''}`}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <Link
        href={`/issues/${issueKey}`}
        className={className}
        draggable={false}
        aria-describedby={open && preview ? tip : undefined}
      >
        {children}
      </Link>
      {portal}
    </span>
  );
}
