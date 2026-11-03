import type { Issue, Sprint } from './types';

export const DAY_MS = 86_400_000;
export const SPRINT_LENGTH_DAYS = 14;

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dayMs(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday-of-week (ISO) for a given day, inclusive. */
export function startOfWeek(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** ISO week number (1-53). */
export function isoWeekNumber(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = Date.UTC(target.getUTCFullYear(), 0, 4);
  const firstThursdayDayNr = (new Date(firstThursday).getUTCDay() + 6) % 7;
  return (
    1 +
    Math.round(
      ((target.getTime() - firstThursday) / DAY_MS - 3 + firstThursdayDayNr) / 7,
    )
  );
}

export type DerivedSprint = {
  id: number;
  name: string;
  state: Sprint['state'];
  start: string;
  end: string;
};

/**
 * Infer two-week calendar windows per sprint. The active sprint is anchored to
 * the current week (Monday); planned sprints extend forward in order; closed
 * sprints extend backward. Used only as a fallback when issues lack explicit
 * start/due dates.
 */
export function inferSprintWindows(sprints: Sprint[]): Map<number, DerivedSprint> {
  const map = new Map<number, DerivedSprint>();
  if (sprints.length === 0) return map;
  const anchorIdx = Math.max(0, sprints.findIndex((s) => s.state === 'active'));
  const anchorStart = startOfWeek(isoToday());
  sprints.forEach((sprint, idx) => {
    const offset = (idx - anchorIdx) * SPRINT_LENGTH_DAYS;
    const start = addDays(anchorStart, offset);
    const end = addDays(start, SPRINT_LENGTH_DAYS - 1);
    map.set(sprint.id, { id: sprint.id, name: sprint.name, state: sprint.state, start, end });
  });
  return map;
}

export type DerivedIssueDates = {
  startOn: string;
  dueOn: string;
  /** true when either/both dates were inferred (not stored on the issue). */
  derived: boolean;
};

/**
 * Derive display dates for an issue. Preference order:
 *  1. Explicit `start_on` / `due_on`
 *  2. Sprint window (if the issue is in a sprint we can date)
 *  3. Parent's window (recursively)
 *  4. `created_at` + points/default span
 */
export function deriveIssueDates(
  issue: Issue,
  byId: Map<number, Issue>,
  sprintWindows: Map<number, DerivedSprint>,
  seen: Set<number> = new Set(),
): DerivedIssueDates {
  const explicitStart = issue.startOn ? issue.startOn.slice(0, 10) : null;
  const explicitDue = issue.dueOn ? issue.dueOn.slice(0, 10) : null;
  if (explicitStart && explicitDue) {
    return {
      startOn: explicitStart,
      dueOn: explicitDue < explicitStart ? explicitStart : explicitDue,
      derived: false,
    };
  }
  const sprintWin =
    issue.sprintId != null ? sprintWindows.get(issue.sprintId) ?? null : null;
  let parentDates: DerivedIssueDates | null = null;
  if (issue.parentId != null && !seen.has(issue.parentId)) {
    const parent = byId.get(issue.parentId);
    if (parent) {
      const nextSeen = new Set(seen);
      nextSeen.add(issue.id);
      parentDates = deriveIssueDates(parent, byId, sprintWindows, nextSeen);
    }
  }
  const points = Math.max(1, issue.points ?? 3);
  const defaultSpan = Math.min(14, Math.max(2, points));
  const created = issue.createdAt.slice(0, 10);

  const startOn =
    explicitStart ??
    sprintWin?.start ??
    parentDates?.startOn ??
    created;
  let dueOn =
    explicitDue ??
    sprintWin?.end ??
    parentDates?.dueOn ??
    addDays(startOn, defaultSpan);
  if (dueOn < startOn) dueOn = addDays(startOn, defaultSpan);
  return { startOn, dueOn, derived: !(explicitStart && explicitDue) };
}

/**
 * Timeline window covering all issues with weekly bounds and a minimum width.
 * Returns inclusive-from Monday and exclusive-to Monday (one-week step aligned).
 */
export function computeTimelineWindow(
  dated: Array<DerivedIssueDates>,
  options: { minWeeks?: number; maxWeeks?: number } = {},
): { from: string; to: string; weeks: number } {
  const minWeeks = options.minWeeks ?? 9;
  const maxWeeks = options.maxWeeks ?? 20;
  const today = isoToday();
  let minStart = today;
  let maxEnd = today;
  for (const d of dated) {
    if (d.startOn < minStart) minStart = d.startOn;
    if (d.dueOn > maxEnd) maxEnd = d.dueOn;
  }
  let from = startOfWeek(addDays(minStart, -7));
  // Monday *after* the week that contains maxEnd + 1-week buffer:
  let to = startOfWeek(addDays(maxEnd, 14));
  if (today < from) from = startOfWeek(addDays(today, -7));
  if (today > to) to = startOfWeek(addDays(today, 21));
  let weeks = Math.round((dayMs(to) - dayMs(from)) / DAY_MS / 7);
  while (weeks < minWeeks) {
    to = addDays(to, 7);
    weeks += 1;
  }
  while (weeks > maxWeeks) {
    to = addDays(to, -7);
    weeks -= 1;
  }
  return { from, to, weeks };
}

export type WeekTick = {
  iso: string;
  week: number;
  label: string;
  sprint?: DerivedSprint;
  isCurrent: boolean;
};

export function tickWeeks(
  from: string,
  to: string,
  sprintWindows: Map<number, DerivedSprint>,
): WeekTick[] {
  const ticks: WeekTick[] = [];
  const sprintByStart = new Map<string, DerivedSprint>();
  for (const s of sprintWindows.values()) sprintByStart.set(s.start, s);
  const currentWeek = startOfWeek(isoToday());
  for (let iso = from; iso < to; iso = addDays(iso, 7)) {
    const date = new Date(`${iso}T12:00:00`);
    ticks.push({
      iso,
      week: isoWeekNumber(iso),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sprint: sprintByStart.get(iso),
      isCurrent: iso === currentWeek,
    });
  }
  return ticks;
}

export function positionWithin(
  startOn: string,
  dueOn: string,
  from: string,
  to: string,
): { leftPct: number; widthPct: number } {
  const span = Math.max(dayMs(to) - dayMs(from), DAY_MS);
  const leftMs = Math.max(0, dayMs(startOn) - dayMs(from));
  const rightMs = Math.max(leftMs + DAY_MS, dayMs(dueOn) - dayMs(from) + DAY_MS);
  const leftPct = (leftMs / span) * 100;
  const widthPct = Math.min(100 - leftPct, Math.max(1.2, ((rightMs - leftMs) / span) * 100));
  return { leftPct, widthPct };
}

export function todayPct(from: string, to: string): number {
  const span = Math.max(dayMs(to) - dayMs(from), DAY_MS);
  const t = dayMs(isoToday()) + DAY_MS / 2;
  return Math.min(100, Math.max(0, ((t - dayMs(from)) / span) * 100));
}

export type GanttVariant = 'epic' | 'done' | 'ip' | 'todo' | 'ticket';

export function ganttVariant(issue: Issue): GanttVariant {
  if (issue.type === 'epic') return 'epic';
  if (issue.status === 'done') return 'done';
  if (issue.type === 'bug') return 'ticket';
  if (issue.status === 'in_progress' || issue.status === 'in_review') return 'ip';
  return 'todo';
}

/** Fraction (0..1) of an epic's direct children that are done. */
export function epicProgress(children: Issue[]): number {
  if (children.length === 0) return 0;
  const done = children.filter((c) => c.status === 'done').length;
  return done / children.length;
}

/**
 * Produce a date for every issue, favouring real stored dates and spreading
 * sprint-bound issues across their sprint window so the Gantt looks like a
 * plan rather than a single column. Epics inherit the span of their
 * descendants when any descendant has been dated.
 */
export function scheduleIssues(
  issues: Issue[],
  sprintWindows: Map<number, DerivedSprint>,
): Map<number, DerivedIssueDates> {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const result = new Map<number, DerivedIssueDates>();

  // Pass 1 — honour explicit dates.
  for (const issue of issues) {
    const es = issue.startOn ? issue.startOn.slice(0, 10) : null;
    const ed = issue.dueOn ? issue.dueOn.slice(0, 10) : null;
    if (es && ed) {
      result.set(issue.id, {
        startOn: es,
        dueOn: ed < es ? es : ed,
        derived: false,
      });
    }
  }

  // Pass 2 — spread non-epic issues inside their sprint window.
  const bySprint = new Map<number, Issue[]>();
  for (const issue of issues) {
    if (result.has(issue.id)) continue;
    if (issue.type === 'epic') continue;
    if (issue.sprintId == null) continue;
    if (!sprintWindows.has(issue.sprintId)) continue;
    const list = bySprint.get(issue.sprintId) ?? [];
    list.push(issue);
    bySprint.set(issue.sprintId, list);
  }
  for (const [sprintId, list] of bySprint) {
    const win = sprintWindows.get(sprintId)!;
    list.sort((a, b) => (a.parentId ?? 0) - (b.parentId ?? 0) || a.num - b.num);
    const sprintDays = Math.max(
      1,
      Math.round((dayMs(win.end) - dayMs(win.start)) / DAY_MS) + 1,
    );
    const budget = Math.max(2, Math.floor(sprintDays / Math.max(1, list.length)));
    let cursor = 0;
    for (const issue of list) {
      const pts = Math.max(1, issue.points ?? 3);
      const dur = Math.max(2, Math.min(budget + 2, Math.round(pts * 1.1)));
      const start = addDays(win.start, Math.min(sprintDays - 2, cursor));
      const end = addDays(start, Math.max(1, Math.min(sprintDays - 1 - cursor, dur - 1)));
      result.set(issue.id, {
        startOn: start,
        dueOn: end < start ? start : end,
        derived: true,
      });
      cursor += Math.max(1, dur - 1);
    }
  }

  // Pass 3 — epic span = min/max of dated descendants.
  const childrenOf = new Map<number, Issue[]>();
  for (const issue of issues) {
    if (issue.parentId == null) continue;
    const list = childrenOf.get(issue.parentId) ?? [];
    list.push(issue);
    childrenOf.set(issue.parentId, list);
  }
  function datedDescendants(
    id: number,
    acc: DerivedIssueDates[],
    seen: Set<number>,
  ): void {
    if (seen.has(id)) return;
    seen.add(id);
    for (const child of childrenOf.get(id) ?? []) {
      const d = result.get(child.id);
      if (d) acc.push(d);
      datedDescendants(child.id, acc, seen);
    }
  }
  for (const issue of issues) {
    if (result.has(issue.id)) continue;
    if (issue.type !== 'epic') continue;
    const acc: DerivedIssueDates[] = [];
    datedDescendants(issue.id, acc, new Set<number>());
    if (acc.length > 0) {
      let minStart = acc[0].startOn;
      let maxEnd = acc[0].dueOn;
      for (const d of acc) {
        if (d.startOn < minStart) minStart = d.startOn;
        if (d.dueOn > maxEnd) maxEnd = d.dueOn;
      }
      result.set(issue.id, { startOn: minStart, dueOn: maxEnd, derived: true });
      continue;
    }
    if (issue.sprintId != null && sprintWindows.has(issue.sprintId)) {
      const win = sprintWindows.get(issue.sprintId)!;
      result.set(issue.id, { startOn: win.start, dueOn: win.end, derived: true });
    }
  }

  // Pass 3.5 — place sprintless children *inside* their parent's window as a
  // short slot after dated siblings, so children don't inherit the full span.
  const parentsSeen = new Set<number>();
  for (const issue of issues) {
    if (issue.parentId == null) continue;
    if (parentsSeen.has(issue.parentId)) continue;
    parentsSeen.add(issue.parentId);
    const parent = byId.get(issue.parentId);
    const parentDates = parent ? result.get(parent.id) : undefined;
    if (!parent || !parentDates) continue;
    const kids = childrenOf.get(parent.id) ?? [];
    const parentStart = parentDates.startOn;
    const parentEnd = parentDates.dueOn;
    const parentSpanDays = Math.max(
      1,
      Math.round((dayMs(parentEnd) - dayMs(parentStart)) / DAY_MS) + 1,
    );
    let cursor = parentStart;
    for (const kid of kids) {
      const existing = result.get(kid.id);
      if (existing) {
        if (existing.dueOn > cursor) cursor = existing.dueOn;
        continue;
      }
      const pts = Math.max(1, kid.points ?? 3);
      const dur = Math.max(2, Math.min(parentSpanDays, Math.round(pts * 1.1)));
      let start = cursor;
      let end = addDays(start, dur - 1);
      if (end > parentEnd) {
        end = parentEnd;
        start = addDays(end, -(dur - 1));
        if (start < parentStart) start = parentStart;
      }
      result.set(kid.id, { startOn: start, dueOn: end, derived: true });
      cursor = end;
    }
  }

  // Pass 4 — fallback for anything still undated.
  for (const issue of issues) {
    if (result.has(issue.id)) continue;
    const dates = deriveIssueDates(issue, byId, sprintWindows);
    result.set(issue.id, dates);
  }

  return result;
}
