'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { updateRoadmapScheduleAction } from '@/app/roadmap/actions';
import type { IssueStatus } from '@/lib/types';

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayMs(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
}

export function RoadmapSchedule({
  issueKey,
  status,
  startOn,
  dueOn,
  windowFrom,
  windowTo,
  left,
  width,
}: {
  issueKey: string;
  status: IssueStatus;
  startOn: string;
  dueOn: string | null;
  windowFrom: string;
  windowTo: string;
  left: string;
  width: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    originX: number;
    start: string;
    due: string | null;
  } | null>(null);
  const [preview, setPreview] = useState<{ left: string; width: string } | null>(null);

  function barStyleFor(start: string, due: string | null): { left: string; width: string } {
    const span = Math.max(dayMs(windowTo) - dayMs(windowFrom), 86_400_000);
    const end = due ?? start;
    const leftMs = Math.max(0, dayMs(start) - dayMs(windowFrom));
    const rightMs = Math.max(leftMs + 86_400_000, dayMs(end) - dayMs(windowFrom) + 86_400_000);
    const l = (leftMs / span) * 100;
    const w = Math.max(1.2, ((rightMs - leftMs) / span) * 100);
    return { left: `${l.toFixed(2)}%`, width: `${Math.min(100 - l, w).toFixed(2)}%` };
  }

  async function submit(nextStart: string, nextDue: string | null) {
    if (nextStart === startOn && (nextDue ?? null) === (dueOn ?? null)) return;
    const data = new FormData();
    data.set('key', issueKey);
    data.set('start', nextStart);
    data.set('due', nextDue ?? '');
    start(async () => {
      await updateRoadmapScheduleAction(data);
      router.refresh();
    });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      start: startOn,
      due: dueOn,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId || !trackRef.current) return;
    const trackW = trackRef.current.getBoundingClientRect().width || 1;
    const spanDays = Math.max(1, (dayMs(windowTo) - dayMs(windowFrom)) / 86_400_000);
    const deltaDays = Math.round(((event.clientX - state.originX) / trackW) * spanDays);
    const nextStart = addDays(state.start, deltaDays);
    const nextDue = state.due ? addDays(state.due, deltaDays) : null;
    setPreview(barStyleFor(nextStart, nextDue));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId || !trackRef.current) return;
    const trackW = trackRef.current.getBoundingClientRect().width || 1;
    const spanDays = Math.max(1, (dayMs(windowTo) - dayMs(windowFrom)) / 86_400_000);
    const deltaDays = Math.round(((event.clientX - state.originX) / trackW) * spanDays);
    drag.current = null;
    setPreview(null);
    if (deltaDays === 0) return;
    submit(addDays(state.start, deltaDays), state.due ? addDays(state.due, deltaDays) : null);
  }

  const style = preview ?? { left, width };

  return (
    <div className={`roadmap-bar-cell${pending ? ' is-pending' : ''}`}>
      <div ref={trackRef} className="roadmap-bar-track">
        <div
          className={`roadmap-bar roadmap-bar--${status}${dueOn ? '' : ' is-open'} is-draggable`}
          style={style}
          role="slider"
          aria-label={`${issueKey} schedule`}
          aria-valuetext={`${startOn} → ${dueOn ?? 'no due'}`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setPreview(null);
          }}
        />
      </div>
      <form
        className="roadmap-dates"
        action={updateRoadmapScheduleAction}
        onSubmit={() => router.refresh()}
      >
        <input type="hidden" name="key" value={issueKey} />
        <label className="sr" htmlFor={`${issueKey}-start`}>
          Start
        </label>
        <input
          id={`${issueKey}-start`}
          type="date"
          name="start"
          defaultValue={startOn}
          aria-label={`${issueKey} start`}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
        <label className="sr" htmlFor={`${issueKey}-due`}>
          Due
        </label>
        <input
          id={`${issueKey}-due`}
          type="date"
          name="due"
          defaultValue={dueOn ?? ''}
          aria-label={`${issueKey} due`}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
      </form>
    </div>
  );
}
