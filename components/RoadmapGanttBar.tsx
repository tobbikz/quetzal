'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateRoadmapScheduleAction } from '@/app/roadmap/actions';
import { addDays, DAY_MS, dayMs, positionWithin, type GanttVariant } from '@/lib/roadmapGantt';

export type RoadmapGanttBarProps = {
  issueKey: string;
  startOn: string;
  dueOn: string;
  windowFrom: string;
  windowTo: string;
  variant: GanttVariant;
  label: string;
  meta?: string;
  canEdit?: boolean;
  /** 0..1 completion overlay drawn inside epic bars. */
  epicProgress?: number;
  /** Prefix the label with a small "!" chip for ticket/blocker bars. */
  flag?: string;
  derived?: boolean;
};

export function RoadmapGanttBar({
  issueKey,
  startOn,
  dueOn,
  windowFrom,
  windowTo,
  variant,
  label,
  meta,
  canEdit = true,
  epicProgress,
  flag,
  derived,
}: RoadmapGanttBarProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    pointerId: number;
    originX: number;
    start: string;
    due: string;
  } | null>(null);
  const [preview, setPreview] = useState<{ left: string; width: string } | null>(null);

  const base = positionWithin(startOn, dueOn, windowFrom, windowTo);
  const baseStyle = {
    left: `${base.leftPct.toFixed(2)}%`,
    width: `${base.widthPct.toFixed(2)}%`,
  };

  function styleFor(nextStart: string, nextDue: string) {
    const p = positionWithin(nextStart, nextDue, windowFrom, windowTo);
    return { left: `${p.leftPct.toFixed(2)}%`, width: `${p.widthPct.toFixed(2)}%` };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!canEdit || e.button !== 0) return;
    const parent = e.currentTarget.parentElement as HTMLDivElement | null;
    if (!parent) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    trackRef.current = parent;
    drag.current = { pointerId: e.pointerId, originX: e.clientX, start: startOn, due: dueOn };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = drag.current;
    if (!s || s.pointerId !== e.pointerId || !trackRef.current) return;
    const trackW = trackRef.current.getBoundingClientRect().width || 1;
    const spanDays = Math.max(1, (dayMs(windowTo) - dayMs(windowFrom)) / DAY_MS);
    const deltaDays = Math.round(((e.clientX - s.originX) / trackW) * spanDays);
    if (deltaDays === 0) {
      setPreview(null);
      return;
    }
    setPreview(styleFor(addDays(s.start, deltaDays), addDays(s.due, deltaDays)));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const s = drag.current;
    if (!s || s.pointerId !== e.pointerId || !trackRef.current) return;
    const trackW = trackRef.current.getBoundingClientRect().width || 1;
    const spanDays = Math.max(1, (dayMs(windowTo) - dayMs(windowFrom)) / DAY_MS);
    const deltaDays = Math.round(((e.clientX - s.originX) / trackW) * spanDays);
    drag.current = null;
    setPreview(null);
    if (deltaDays === 0) return;
    const nextStart = addDays(s.start, deltaDays);
    const nextDue = addDays(s.due, deltaDays);
    const data = new FormData();
    data.set('key', issueKey);
    data.set('start', nextStart);
    data.set('due', nextDue);
    start(async () => {
      await updateRoadmapScheduleAction(data);
      router.refresh();
    });
  }

  const style = preview ?? baseStyle;
  const dateRange = startOn === dueOn ? startOn : `${startOn} → ${dueOn}`;
  const classes = [
    'rmg-bar',
    `rmg-bar--${variant}`,
    canEdit ? 'is-draggable' : '',
    pending ? 'is-pending' : '',
    derived ? 'is-derived' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={style}
      role={canEdit ? 'slider' : 'img'}
      aria-label={`${issueKey} schedule`}
      aria-valuetext={dateRange}
      title={`${label}\n${dateRange}${derived ? '\n(dates inferred)' : ''}`}
      tabIndex={canEdit ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        setPreview(null);
      }}
    >
      {variant === 'epic' && epicProgress != null ? (
        <span
          className="rmg-bar-progress"
          style={{ width: `${Math.round(epicProgress * 100)}%` }}
          aria-hidden="true"
        />
      ) : null}
      {flag ? <span className="rmg-bar-flag">{flag}</span> : null}
      <span className="rmg-bar-label">{label}</span>
      {meta ? <span className="rmg-bar-meta">{meta}</span> : null}
    </div>
  );
}
