'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  createEventTypeAction,
  deleteCalendarEventAction,
  deleteEventTypeAction,
  saveCalendarEventAction,
  updateEventTypeAction,
} from '@/app/actions';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import type { CalendarEvent, CalendarEventType, CalendarScope, Project, User } from '@/lib/types';

function openDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) return;
  try {
    dialog.showModal();
  } catch {
    // Another modal may already be open — retry once after paint
    requestAnimationFrame(() => {
      try {
        if (dialog.isConnected && !dialog.open) dialog.showModal();
      } catch {
        /* ignore */
      }
    });
  }
}

function closeDialog(dialog: HTMLDialogElement | null, syncFlag: { current: boolean }) {
  if (!dialog?.open) return;
  syncFlag.current = true;
  dialog.close();
}

export type CalMode = 'month' | 'week' | 'day' | 'events';

type DueMarker = { key: string; summary: string; dueOn: string };

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7–19
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymParam(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfWeek(iso: string): string {
  const d = parseIso(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toIso(d);
}

function addDaysIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function formatRange(from: string, toInclusive: string): string {
  const a = parseIso(from);
  const b = parseIso(toInclusive);
  const left = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(a);
  const right = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(b);
  return `${left} – ${right}`;
}

function formatDayBadge(iso: string): { mon: string; day: string } {
  const d = parseIso(iso);
  return {
    mon: new Intl.DateTimeFormat('en', { month: 'short' }).format(d).toUpperCase(),
    day: String(d.getDate()),
  };
}

function personInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatSchedule(event: CalendarEvent): string {
  const sameDay = event.startsOn === event.endsOn;
  const dayFmt = new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const startDay = dayFmt.format(parseIso(event.startsOn));
  const endDay = dayFmt.format(parseIso(event.endsOn));
  const startT = formatTime(event.startTime);
  const endT = formatTime(event.endTime);
  if (sameDay) {
    if (startT && endT) return `${startDay} · ${startT} – ${endT}`;
    if (startT) return `${startDay} · ${startT}`;
    return `${startDay} · All day`;
  }
  if (startT || endT) return `${startDay} ${startT || '…'} → ${endDay} ${endT || ''}`.trim();
  return `${startDay} → ${endDay}`;
}

function formatTime(t: string | null): string {
  if (!t) return '';
  const [hh, mm] = t.split(':').map(Number);
  if (!Number.isFinite(hh)) return t;
  const d = new Date();
  d.setHours(hh, mm || 0, 0, 0);
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: mm ? '2-digit' : undefined }).format(d);
}

function eachDate(startsOn: string, endsOn: string): string[] {
  const out: string[] = [];
  const cursor = parseIso(startsOn);
  const end = parseIso(endsOn);
  while (cursor <= end) {
    out.push(toIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function softColor(hex: string): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return 'rgba(37, 99, 235, 0.12)';
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
}

function hourOffset(time: string | null): number {
  if (!time) return 9;
  const [hh, mm] = time.split(':').map(Number);
  return (hh || 0) + (mm || 0) / 60;
}

export function calendarHref(opts: {
  view: CalendarScope;
  mode: CalMode;
  ym: string;
  day?: string | null;
  edit?: string | null;
  types?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set('view', opts.view);
  params.set('mode', opts.mode);
  params.set('ym', opts.ym);
  if (opts.day) params.set('day', opts.day);
  if (opts.edit) params.set('edit', opts.edit);
  if (opts.types) params.set('types', '1');
  return `/calendar?${params.toString()}`;
}

function EventPill({
  event,
  href,
  showTime = true,
  compact = false,
  onOpen,
}: {
  event: CalendarEvent;
  href: string;
  showTime?: boolean;
  compact?: boolean;
  onOpen?: (href: string) => void;
}) {
  const time = showTime ? formatTime(event.startTime) : '';
  return (
    <Link
      href={href}
      className={`uical-pill${compact ? ' is-compact' : ''}`}
      style={{ borderLeftColor: event.typeColor, background: softColor(event.typeColor), color: event.typeColor }}
      title={`${event.title}${time ? ` · ${time}` : ''}`}
      onClick={(e) => {
        if (!onOpen) return;
        e.preventDefault();
        onOpen(href);
      }}
    >
      {time ? <span className="uical-pill-time">{time}</span> : null}
      <span className="uical-pill-title">{event.title}</span>
    </Link>
  );
}

function DuePill({ due }: { due: DueMarker }) {
  return (
    <span className="uical-pill uical-pill-due" title={`${due.key} ${due.summary}`}>
      <IssueHoverCard issueKey={due.key} className="uical-pill-title">
        {due.key}
      </IssueHoverCard>
    </span>
  );
}

export function CalendarDesk({
  project,
  view,
  mode,
  year,
  month,
  focusDay,
  today,
  events,
  types,
  dues,
  people,
  showTypes,
  editingNew,
  editing,
}: {
  project: Project;
  view: CalendarScope;
  mode: CalMode;
  year: number;
  month: number;
  focusDay: string;
  today: string;
  events: CalendarEvent[];
  types: CalendarEventType[];
  dues: DueMarker[];
  people: User[];
  showTypes: boolean;
  editingNew: boolean;
  editing: CalendarEvent | null;
}) {
  const router = useRouter();
  const eventDialog = useRef<HTMLDialogElement>(null);
  const typesDialog = useRef<HTMLDialogElement>(null);
  const eventSyncClose = useRef(false);
  const typesSyncClose = useRef(false);
  const eventDismissing = useRef(false);
  const typesDismissing = useRef(false);
  const [eventUiOpen, setEventUiOpen] = useState(false);
  const [typesUiOpen, setTypesUiOpen] = useState(false);
  const [eventFormMode, setEventFormMode] = useState<'details' | 'edit'>('details');

  const ym = ymParam(year, month);
  const weekStart = startOfWeek(focusDay);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
  const weekEnd = weekDays[6];

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    for (const day of eachDate(event.startsOn, event.endsOn)) {
      const list = byDay.get(day) ?? [];
      list.push(event);
      byDay.set(day, list);
    }
  }
  const duesByDay = new Map<string, DueMarker[]>();
  for (const due of dues) {
    const list = duesByDay.get(due.dueOn) ?? [];
    list.push(due);
    duesByDay.set(due.dueOn, list);
  }

  const prevMonth = shiftMonth(year, month, -1);
  const nextMonth = shiftMonth(year, month, 1);
  const prevWeek = addDaysIso(weekStart, -7);
  const nextWeek = addDaysIso(weekStart, 7);
  const prevDay = addDaysIso(focusDay, -1);
  const nextDay = addDaysIso(focusDay, 1);

  const badge = formatDayBadge(mode === 'month' ? `${ym}-01` : focusDay);
  const title =
    mode === 'month'
      ? monthLabel(year, month)
      : mode === 'week'
        ? formatRange(weekStart, weekEnd)
        : mode === 'day'
          ? new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(
              parseIso(focusDay),
            )
          : monthLabel(year, month);
  const subtitle =
    mode === 'month'
      ? formatRange(`${ym}-01`, toIso(new Date(year, month, 0)))
      : mode === 'week'
        ? `Week of ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(parseIso(weekStart))}`
        : mode === 'day'
          ? project.key
          : `Upcoming in ${monthLabel(year, month)}`;

  const navPrev =
    mode === 'month'
      ? calendarHref({ view, mode, ym: ymParam(prevMonth.year, prevMonth.month), day: focusDay })
      : mode === 'week'
        ? calendarHref({ view, mode, ym: prevWeek.slice(0, 7), day: prevWeek })
        : mode === 'day'
          ? calendarHref({ view, mode, ym: prevDay.slice(0, 7), day: prevDay })
          : calendarHref({ view, mode, ym: ymParam(prevMonth.year, prevMonth.month), day: focusDay });

  const navNext =
    mode === 'month'
      ? calendarHref({ view, mode, ym: ymParam(nextMonth.year, nextMonth.month), day: focusDay })
      : mode === 'week'
        ? calendarHref({ view, mode, ym: nextWeek.slice(0, 7), day: nextWeek })
        : mode === 'day'
          ? calendarHref({ view, mode, ym: nextDay.slice(0, 7), day: nextDay })
          : calendarHref({ view, mode, ym: ymParam(nextMonth.year, nextMonth.month), day: focusDay });

  const todayHref = calendarHref({
    view,
    mode,
    ym: today.slice(0, 7),
    day: today,
  });

  const returnTo = calendarHref({ view, mode, ym, day: focusDay });
  const addHref = calendarHref({ view, mode, ym, day: focusDay, edit: 'new' });
  const typesHref = calendarHref({ view, mode, ym, day: focusDay, types: true });

  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number | null; iso: string | null; outside: boolean }> = [];
  const leadStart = addDaysIso(`${ym}-01`, -startPad);
  for (let i = 0; i < startPad; i += 1) {
    const iso = addDaysIso(leadStart, i);
    cells.push({ day: parseIso(iso).getDate(), iso, outside: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, iso: `${ym}-${pad2(day)}`, outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].iso!;
    const iso = addDaysIso(last, 1);
    cells.push({ day: parseIso(iso).getDate(), iso, outside: true });
  }

  const dayEvents = byDay.get(focusDay) ?? [];
  const dayDues = duesByDay.get(focusDay) ?? [];

  const agendaDays = Array.from(
    new Set([...byDay.keys(), ...duesByDay.keys()].filter((d) => d.startsWith(ym)).sort()),
  );

  const modes: Array<{ id: CalMode; label: string }> = [
    { id: 'month', label: 'Month' },
    { id: 'week', label: 'Week' },
    { id: 'day', label: 'Day' },
    { id: 'events', label: 'Events' },
  ];

  const urlWantsEvent = editingNew || Boolean(editing);
  const urlWantsTypes = showTypes;
  const showEventForm = editingNew || eventFormMode === 'edit';

  // Sync from URL, but ignore while a local dismiss is in flight
  useEffect(() => {
    if (eventDismissing.current) {
      if (!urlWantsEvent) eventDismissing.current = false;
      return;
    }
    setEventUiOpen(urlWantsEvent);
  }, [urlWantsEvent, editing?.id]);

  useEffect(() => {
    if (editingNew) setEventFormMode('edit');
    else if (editing) setEventFormMode('details');
  }, [editingNew, editing?.id]);

  useEffect(() => {
    if (typesDismissing.current) {
      if (!urlWantsTypes) typesDismissing.current = false;
      return;
    }
    setTypesUiOpen(urlWantsTypes);
  }, [urlWantsTypes]);

  useEffect(() => {
    const dialog = eventDialog.current;
    if (!dialog) return;
    if (eventUiOpen) openDialog(dialog);
    else closeDialog(dialog, eventSyncClose);
  }, [eventUiOpen, editing?.id, editingNew]);

  useEffect(() => {
    const dialog = typesDialog.current;
    if (!dialog) return;
    if (typesUiOpen) openDialog(dialog);
    else closeDialog(dialog, typesSyncClose);
  }, [typesUiOpen]);

  function dismissEventModal() {
    eventDismissing.current = true;
    setEventUiOpen(false);
    closeDialog(eventDialog.current, eventSyncClose);
    router.replace(returnTo);
  }

  function dismissTypesModal() {
    typesDismissing.current = true;
    setTypesUiOpen(false);
    closeDialog(typesDialog.current, typesSyncClose);
    router.replace(returnTo);
  }

  function openNewEvent(href: string = addHref) {
    eventDismissing.current = false;
    typesDismissing.current = true;
    setTypesUiOpen(false);
    closeDialog(typesDialog.current, typesSyncClose);
    setEventFormMode('edit');
    setEventUiOpen(true);
    openDialog(eventDialog.current);
    router.push(href);
  }

  function openEditEvent(href: string) {
    eventDismissing.current = false;
    setEventFormMode('details');
    setEventUiOpen(true);
    openDialog(eventDialog.current);
    router.push(href);
  }

  function openTypesModal() {
    typesDismissing.current = false;
    eventDismissing.current = true;
    setEventUiOpen(false);
    closeDialog(eventDialog.current, eventSyncClose);
    setTypesUiOpen(true);
    openDialog(typesDialog.current);
    router.push(typesHref);
  }

  function addEventHref(dayIso?: string) {
    return calendarHref({
      view,
      mode,
      ym: (dayIso ?? focusDay).slice(0, 7) === ym ? ym : (dayIso ?? focusDay).slice(0, 7),
      day: dayIso ?? focusDay,
      edit: 'new',
    });
  }

  function editEventHref(eventId: number, dayIso?: string) {
    return calendarHref({
      view,
      mode,
      ym,
      day: dayIso ?? focusDay,
      edit: String(eventId),
    });
  }

  return (
    <main className="page uical-page uical--atelier">
      <header className="uical-head">
        <div className="uical-title-row">
          <div className="uical-brand">
            <span className="uical-kicker">Calendar</span>
            <h1 className="uical-title">{project.key}</h1>
          </div>
          <div className="uical-title-actions">
            <button type="button" className="btn-ghost uical-types-btn" onClick={openTypesModal}>
              Event types
            </button>
            <button type="button" className="btn uical-add" onClick={() => openNewEvent()}>
              Add event
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
        <div className="uical-head-meta">
          <nav className="uical-scopes" aria-label="Calendar scope">
            <Link
              href={calendarHref({ view: 'project', mode, ym, day: focusDay })}
              className={view === 'project' ? 'is-on' : ''}
            >
              Team
            </Link>
            <Link
              href={calendarHref({ view: 'personal', mode, ym, day: focusDay })}
              className={view === 'personal' ? 'is-on' : ''}
            >
              Personal
            </Link>
          </nav>
          {types.length > 0 ? (
            <ul className="uical-legend" aria-label="Event types">
              {types.map((type) => (
                <li key={type.id}>
                  <span className="uical-legend-dot" style={{ background: type.color }} aria-hidden />
                  <span>{type.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <section className="uical-board">
        <div className="uical-toolbar">
          <div className="uical-period">
            <div className="uical-badge" aria-hidden>
              <span>{badge.mon}</span>
              <strong>{badge.day}</strong>
            </div>
            <div>
              <p className="uical-period-title">{title}</p>
              <p className="uical-period-sub">{subtitle}</p>
            </div>
          </div>
          <div className="uical-toolbar-actions">
            <div className="uical-nav">
              <Link href={navPrev} aria-label="Previous" className="uical-icon-btn">
                ‹
              </Link>
              <Link href={todayHref} className="uical-today">
                Today
              </Link>
              <Link href={navNext} aria-label="Next" className="uical-icon-btn">
                ›
              </Link>
            </div>
            <div className="uical-modes" role="tablist" aria-label="Calendar views">
              {modes.map((item) => (
                <Link
                  key={item.id}
                  role="tab"
                  aria-selected={mode === item.id}
                  href={calendarHref({ view, mode: item.id, ym, day: focusDay })}
                  className={mode === item.id ? 'is-on' : ''}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <button type="button" className="btn uical-add-sm" onClick={() => openNewEvent()}>
              + Add event
            </button>
          </div>
        </div>

        {mode === 'month' ? (
          <div className="uical-month" role="grid" aria-label={monthLabel(year, month)}>
            {DOW.map((label) => (
              <div key={label} className="uical-dow">
                {label}
              </div>
            ))}
            {cells.map((cell) => {
              if (!cell.iso || cell.day == null) return null;
              const items = byDay.get(cell.iso) ?? [];
              const dueItems = duesByDay.get(cell.iso) ?? [];
              const overflow = Math.max(0, items.length + dueItems.length - 3);
              const classes = [
                'uical-cell',
                cell.outside ? 'is-out' : '',
                cell.iso === today ? 'is-today' : '',
                focusDay === cell.iso ? 'is-on' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={cell.iso} className={classes}>
                  <div className="uical-cell-top">
                    <Link
                      href={calendarHref({ view, mode: 'day', ym: cell.iso.slice(0, 7), day: cell.iso })}
                      className={`uical-daynum${cell.iso === today ? ' is-today' : ''}`}
                    >
                      {cell.day}
                    </Link>
                    {!cell.outside ? (
                      <button
                        type="button"
                        className="uical-cell-add"
                        aria-label={`Add event on ${cell.iso}`}
                        onClick={() => openNewEvent(addEventHref(cell.iso!))}
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                  <div className="uical-cell-items">
                      {items.slice(0, 3).map((event) => (
                        <EventPill
                          key={event.id}
                          event={event}
                          compact
                          href={editEventHref(event.id, cell.iso!)}
                          onOpen={openEditEvent}
                        />
                      ))}
                    {dueItems.slice(0, Math.max(0, 3 - items.length)).map((due) => (
                      <DuePill key={due.key} due={due} />
                    ))}
                    {overflow > 0 ? (
                      <Link
                        href={calendarHref({ view, mode: 'day', ym: cell.iso.slice(0, 7), day: cell.iso })}
                        className="uical-more"
                      >
                        + {overflow} more…
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {mode === 'week' ? (
          <div className="uical-week">
            <div className="uical-week-head">
              <div className="uical-week-gutter" />
              {weekDays.map((iso) => {
                const d = parseIso(iso);
                return (
                  <Link
                    key={iso}
                    href={calendarHref({ view, mode: 'day', ym: iso.slice(0, 7), day: iso })}
                    className={`uical-week-dayhead${iso === today ? ' is-today' : ''}`}
                  >
                    <span>{DOW[(d.getDay() + 6) % 7]}</span>
                    <strong className={iso === today ? 'is-today' : ''}>{d.getDate()}</strong>
                  </Link>
                );
              })}
            </div>
            <div className="uical-week-grid">
              <div className="uical-week-hours">
                {HOURS.map((h) => (
                  <div key={h} className="uical-week-hour">
                    {formatTime(`${pad2(h)}:00`)}
                  </div>
                ))}
              </div>
              {weekDays.map((iso) => {
                const items = byDay.get(iso) ?? [];
                return (
                  <div key={iso} className="uical-week-col">
                    {items.map((event) => {
                      const start = Math.max(7, hourOffset(event.startTime));
                      const end = Math.min(20, event.endTime ? hourOffset(event.endTime) : start + 1);
                      const top = ((start - 7) / 13) * 100;
                      const height = Math.max(6, ((end - start) / 13) * 100);
                      return (
                        <Link
                          key={event.id}
                          href={calendarHref({
                            view,
                            mode,
                            ym,
                            day: iso,
                            edit: String(event.id),
                          })}
                          className="uical-week-event"
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                            borderLeftColor: event.typeColor,
                            background: softColor(event.typeColor),
                            color: event.typeColor,
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            openEditEvent(
                              calendarHref({
                                view,
                                mode,
                                ym,
                                day: iso,
                                edit: String(event.id),
                              }),
                            );
                          }}
                        >
                          <span className="uical-pill-time">{formatTime(event.startTime)}</span>
                          <span className="uical-pill-title">{event.title}</span>
                        </Link>
                      );
                    })}
                    {(duesByDay.get(iso) ?? []).map((due) => (
                      <div key={due.key} className="uical-week-due">
                        <DuePill due={due} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {mode === 'day' ? (
          <div className="uical-day">
            <div className="uical-day-grid">
              {HOURS.map((h) => {
                const slot =
                  byDay.get(focusDay)?.filter((event) => {
                    const startH = Math.floor(hourOffset(event.startTime));
                    return !event.startTime ? h === 9 : startH === h;
                  }) ?? [];
                return (
                  <div key={h} className="uical-day-row">
                    <div className="uical-day-hour">{formatTime(`${pad2(h)}:00`)}</div>
                    <div className="uical-day-slot">
                      {slot.map((event) => (
                        <EventPill
                          key={event.id}
                          event={event}
                          href={calendarHref({
                            view,
                            mode,
                            ym,
                            day: focusDay,
                            edit: String(event.id),
                          })}
                          onOpen={openEditEvent}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {dayDues.length > 0 ? (
              <div className="uical-day-dues">
                <p className="uical-section-label">Due issues</p>
                {dayDues.map((due) => (
                  <DuePill key={due.key} due={due} />
                ))}
              </div>
            ) : null}
            {dayEvents.length === 0 && dayDues.length === 0 ? (
              <p className="uical-empty">
                No events this day.{' '}
                <button type="button" className="linkish" onClick={() => openNewEvent()}>
                  Add event
                </button>
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === 'events' ? (
          <div className="uical-agenda">
            {agendaDays.length === 0 ? (
              <p className="uical-empty">
                No events this month.{' '}
                <button type="button" className="linkish" onClick={() => openNewEvent()}>
                  Add event
                </button>
              </p>
            ) : (
              agendaDays.map((iso) => {
                const items = byDay.get(iso) ?? [];
                const dueItems = duesByDay.get(iso) ?? [];
                const d = parseIso(iso);
                return (
                  <section key={iso} className="uical-agenda-day">
                    <header className="uical-agenda-head">
                      <strong>{new Intl.DateTimeFormat('en', { weekday: 'long' }).format(d)}</strong>
                      <span>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(d)}</span>
                    </header>
                    <ul>
                      {items.map((event) => (
                        <li key={event.id}>
                          <span className="uical-dot" style={{ background: event.typeColor }} />
                          <div>
                            <Link
                              href={calendarHref({
                                view,
                                mode,
                                ym,
                                day: iso,
                                edit: String(event.id),
                              })}
                            >
                              {event.title}
                            </Link>
                            <p className="muted">
                              {event.typeName}
                              {event.startTime
                                ? ` · ${formatTime(event.startTime)}${event.endTime ? `–${formatTime(event.endTime)}` : ''}`
                                : ' · All day'}
                            </p>
                          </div>
                        </li>
                      ))}
                      {dueItems.map((due) => (
                        <li key={due.key}>
                          <span className="uical-dot uical-dot-due" />
                          <div>
                            <IssueHoverCard issueKey={due.key} className="key">
                              {due.key}
                            </IssueHoverCard>
                            <p className="muted">Issue due · {due.summary}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        ) : null}
      </section>

      <dialog
        ref={eventDialog}
        className="modal modal--wide uical-modal"
        onClose={() => {
          if (eventSyncClose.current) {
            eventSyncClose.current = false;
            return;
          }
          eventDismissing.current = true;
          setEventUiOpen(false);
          router.replace(returnTo);
        }}
      >
        {editing && !showEventForm ? (
          <div className="modal-form" key={`details-${editing.id}`}>
            <div className="modal-head">
              <div>
                <p className="uical-detail-kicker">
                  <span className="cal-dot" style={{ background: editing.typeColor }} aria-hidden />
                  {editing.typeName}
                  <span className="muted">· {editing.scope === 'project' ? `Team · ${project.key}` : 'Personal'}</span>
                </p>
                <h2 className="modal-title">{editing.title}</h2>
                <p className="modal-sub">{formatSchedule(editing)}</p>
              </div>
              <button className="modal-close" type="button" aria-label="Close" onClick={dismissEventModal}>
                ×
              </button>
            </div>
            <div className="modal-body stack">
              <dl className="uical-detail-grid">
                <div>
                  <dt>Organizer</dt>
                  <dd>
                    <span className="uical-person">
                      <span className="avatar" aria-hidden>
                        {personInitials(editing.createdByName)}
                      </span>
                      <span>
                        <strong>{editing.createdByName}</strong>
                      </span>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Invitees</dt>
                  <dd>
                    {editing.attendees.length === 0 ? (
                      <span className="muted">No one invited yet</span>
                    ) : (
                      <ul className="uical-invite-list">
                        {editing.attendees.map((person) => (
                          <li key={person.id}>
                            <span className="avatar" aria-hidden>
                              {personInitials(person.name)}
                            </span>
                            <span>
                              <strong>{person.name}</strong>
                              <span className="muted">{person.email}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{editing.notes.trim() ? editing.notes : <span className="muted">No notes</span>}</dd>
                </div>
              </dl>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" type="submit" form={`delete-event-${editing.id}`}>
                Delete
              </button>
              <div className="row-actions">
                <button className="btn-ghost" type="button" onClick={dismissEventModal}>
                  Close
                </button>
                <button className="btn" type="button" onClick={() => setEventFormMode('edit')}>
                  Edit
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            key={editing ? `edit-${editing.id}` : 'new'}
            action={saveCalendarEventAction}
            className="modal-form"
          >
            <div className="modal-head">
              <div>
                <h2 className="modal-title">{editing ? 'Edit event' : 'New event'}</h2>
                <p className="modal-sub">
                  {editing ? 'Update details, invitees, or schedule.' : 'Pick a type, when it happens, and who to invite.'}
                </p>
              </div>
              <button className="modal-close" type="button" aria-label="Close" onClick={dismissEventModal}>
                ×
              </button>
            </div>
            <div className="modal-body stack">
              <input type="hidden" name="next" value={returnTo} />
              <input type="hidden" name="scope" value={view} />
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <label className="field">
                <span>Title</span>
                <input type="text" name="title" required defaultValue={editing?.title ?? ''} autoFocus />
              </label>
              <label className="field">
                <span>Type</span>
                <select name="type" defaultValue={String(editing?.typeId ?? types[0]?.id ?? '')} required>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid-form">
                <label className="field">
                  <span>Starts</span>
                  <input type="date" name="starts_on" required defaultValue={editing?.startsOn ?? focusDay} />
                </label>
                <label className="field">
                  <span>Ends</span>
                  <input type="date" name="ends_on" defaultValue={editing?.endsOn ?? focusDay} />
                </label>
                <label className="field">
                  <span>Start time</span>
                  <input type="time" name="start_time" defaultValue={editing?.startTime ?? ''} />
                </label>
                <label className="field">
                  <span>End time</span>
                  <input type="time" name="end_time" defaultValue={editing?.endTime ?? ''} />
                </label>
              </div>
              <fieldset className="uical-invite-field">
                <legend>Invitees</legend>
                <div className="uical-invite-checks">
                  {people.map((person) => {
                    const checked = editing?.attendees.some((a) => a.id === person.id) ?? false;
                    return (
                      <label key={person.id} className="uical-invite-check">
                        <input type="checkbox" name="invitee" value={person.id} defaultChecked={checked} />
                        <span className="avatar" aria-hidden>
                          {personInitials(person.name)}
                        </span>
                        <span>
                          <strong>{person.name}</strong>
                          <span className="muted">{person.email}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="field">
                <span>Notes</span>
                <textarea name="notes" rows={3} defaultValue={editing?.notes ?? ''} />
              </label>
            </div>
            <div className="modal-foot">
              {editing ? (
                <button className="btn-ghost" type="submit" form={`delete-event-${editing.id}`}>
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="row-actions">
                {editing ? (
                  <button className="btn-ghost" type="button" onClick={() => setEventFormMode('details')}>
                    Back
                  </button>
                ) : (
                  <button className="btn-ghost" type="button" onClick={dismissEventModal}>
                    Cancel
                  </button>
                )}
                <button className="btn" type="submit">
                  {editing ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        )}
        {editing ? (
          <form id={`delete-event-${editing.id}`} action={deleteCalendarEventAction} hidden>
            <input type="hidden" name="next" value={returnTo} />
            <input type="hidden" name="id" value={editing.id} />
          </form>
        ) : null}
      </dialog>

      <dialog
        ref={typesDialog}
        className="modal modal--wide uical-modal"
        onClose={() => {
          if (typesSyncClose.current) {
            typesSyncClose.current = false;
            return;
          }
          typesDismissing.current = true;
          setTypesUiOpen(false);
          router.replace(returnTo);
        }}
      >
        <div className="modal-form">
          <div className="modal-head">
            <div>
              <h2 className="modal-title">Event types</h2>
              <p className="modal-sub">System types plus your custom labels for both calendars.</p>
            </div>
            <button className="modal-close" type="button" aria-label="Close" onClick={dismissTypesModal}>
              ×
            </button>
          </div>
          <div className="modal-body stack">
            <ul className="cal-type-list">
              {types.map((type) => (
                <li key={type.id}>
                  <span className="cal-dot" style={{ background: type.color }} />
                  {type.system ? (
                    <div>
                      <strong>{type.name}</strong>
                      <div className="muted">System · {type.scope}</div>
                    </div>
                  ) : (
                    <form action={updateEventTypeAction} className="cal-type-edit">
                      <input type="hidden" name="next" value={typesHref} />
                      <input type="hidden" name="id" value={type.id} />
                      <input name="name" defaultValue={type.name} required />
                      <input name="color" type="color" defaultValue={type.color} />
                      <button className="btn-ghost" type="submit">
                        Save
                      </button>
                      <button formAction={deleteEventTypeAction} className="btn-ghost" type="submit">
                        Delete
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form action={createEventTypeAction} className="stack cal-type-create">
              <input type="hidden" name="next" value={typesHref} />
              <strong>New type</strong>
              <label className="field">
                <span>Name</span>
                <input name="name" required placeholder="e.g. On-call" />
              </label>
              <div className="grid-form">
                <label className="field">
                  <span>Color</span>
                  <input name="color" type="color" defaultValue="#2563eb" />
                </label>
                <label className="field">
                  <span>Scope</span>
                      <select name="scope" defaultValue={view}>
                        <option value="both">Team + Personal</option>
                        <option value="project">Team only</option>
                        <option value="personal">Personal only</option>
                      </select>
                </label>
              </div>
              <button className="btn" type="submit">
                Add type
              </button>
            </form>
          </div>
          <div className="modal-foot">
            <span />
            <button className="btn-ghost" type="button" onClick={dismissTypesModal}>
              Done
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
