/** Client-safe SLA helpers — no Node fs/sqlite (safe for 'use client' import graphs). */

export type SlaPolicy = {
  type: string;
  /** Empty string = type-wide default (fallback when no priority-specific row). */
  priority: string;
  responseMinutes: number;
  resolveMinutes: number;
};

export type SlaClockFields = {
  status: string;
  responseDue: string | null;
  resolveDue: string | null;
  responseMetAt: string | null;
  resolveMetAt: string | null;
  slaBreached: boolean;
};

export type SlaBadgeKind = 'response' | 'resolve';
export type SlaBadgeState = 'none' | 'on_track' | 'met' | 'breached';

export type SlaDuePair = {
  responseDue: string;
  resolveDue: string;
};

/** Mon–Fri 09:00–17:00 UTC (8h business day). */
export type BusinessHoursCalendar = {
  /** JS getUTCDay(): 0=Sun … 6=Sat. Default Mon–Fri. */
  weekdays: ReadonlyArray<number>;
  /** Inclusive start hour (UTC), 0–23. */
  startHour: number;
  /** Exclusive end hour (UTC), 1–24. */
  endHour: number;
};

export const DEFAULT_BUSINESS_HOURS: BusinessHoursCalendar = {
  weekdays: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 17,
};

/**
 * Seed policies: type-wide (`priority: ''`) plus tighter type+priority overrides.
 * Lookup order: exact type+priority → type+'' → request+'' → hardcoded request.
 */
export const DEFAULT_SLA_POLICIES: ReadonlyArray<SlaPolicy> = [
  { type: 'incident', priority: '', responseMinutes: 30, resolveMinutes: 240 },
  { type: 'incident', priority: 'blocker', responseMinutes: 15, resolveMinutes: 120 },
  { type: 'incident', priority: 'highest', responseMinutes: 15, resolveMinutes: 180 },
  { type: 'incident', priority: 'high', responseMinutes: 30, resolveMinutes: 240 },
  { type: 'incident', priority: 'medium', responseMinutes: 45, resolveMinutes: 360 },
  { type: 'incident', priority: 'low', responseMinutes: 60, resolveMinutes: 480 },
  { type: 'incident', priority: 'lowest', responseMinutes: 120, resolveMinutes: 960 },
  { type: 'request', priority: '', responseMinutes: 120, resolveMinutes: 2880 },
  { type: 'request', priority: 'blocker', responseMinutes: 30, resolveMinutes: 480 },
  { type: 'request', priority: 'highest', responseMinutes: 45, resolveMinutes: 960 },
  { type: 'request', priority: 'high', responseMinutes: 60, resolveMinutes: 1440 },
  { type: 'request', priority: 'medium', responseMinutes: 120, resolveMinutes: 2880 },
  { type: 'request', priority: 'low', responseMinutes: 240, resolveMinutes: 4320 },
  { type: 'request', priority: 'lowest', responseMinutes: 480, resolveMinutes: 5760 },
  { type: 'problem', priority: '', responseMinutes: 60, resolveMinutes: 1440 },
  { type: 'problem', priority: 'blocker', responseMinutes: 30, resolveMinutes: 480 },
  { type: 'problem', priority: 'high', responseMinutes: 60, resolveMinutes: 960 },
  { type: 'change', priority: '', responseMinutes: 240, resolveMinutes: 5760 },
  { type: 'access', priority: '', responseMinutes: 60, resolveMinutes: 960 },
  { type: 'access', priority: 'high', responseMinutes: 30, resolveMinutes: 480 },
  { type: 'hardware', priority: '', responseMinutes: 60, resolveMinutes: 1440 },
  { type: 'software', priority: '', responseMinutes: 120, resolveMinutes: 2880 },
  { type: 'service', priority: '', responseMinutes: 90, resolveMinutes: 1920 },
  { type: 'question', priority: '', responseMinutes: 240, resolveMinutes: 4320 },
];

export function addMinutesIso(fromIso: string, minutes: number): string {
  return new Date(Date.parse(fromIso) + minutes * 60_000).toISOString();
}

function isBusinessWeekday(day: number, calendar: BusinessHoursCalendar): boolean {
  return calendar.weekdays.includes(day);
}

/** Snap cursor to the start of the next (or current) open business window in UTC. */
export function snapToBusinessStart(ms: number, calendar: BusinessHoursCalendar = DEFAULT_BUSINESS_HOURS): number {
  const startH = calendar.startHour;
  const endH = calendar.endHour;
  let cursor = ms;
  for (let guard = 0; guard < 14; guard += 1) {
    const d = new Date(cursor);
    const day = d.getUTCDay();
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    const second = d.getUTCSeconds();
    const msPart = d.getUTCMilliseconds();
    if (!isBusinessWeekday(day, calendar)) {
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, startH, 0, 0, 0));
      cursor = next.getTime();
      continue;
    }
    const minutesOfDay = hour * 60 + minute + second / 60 + msPart / 60_000;
    const startMin = startH * 60;
    const endMin = endH * 60;
    if (minutesOfDay < startMin) {
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), startH, 0, 0, 0);
    }
    if (minutesOfDay >= endMin) {
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, startH, 0, 0, 0));
      cursor = next.getTime();
      continue;
    }
    return cursor;
  }
  return cursor;
}

/** Minutes remaining in the current business day from `ms` (must already be inside window). */
function remainingBusinessMinutesToday(ms: number, calendar: BusinessHoursCalendar): number {
  const d = new Date(ms);
  const endMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), calendar.endHour, 0, 0, 0);
  return Math.max(0, (endMs - ms) / 60_000);
}

/**
 * Add `minutes` of business time (Mon–Fri window) to an ISO timestamp.
 * Non-positive minutes return the start snapped into business hours.
 */
export function addBusinessMinutesIso(
  fromIso: string,
  minutes: number,
  calendar: BusinessHoursCalendar = DEFAULT_BUSINESS_HOURS,
): string {
  const startMs = Date.parse(fromIso);
  if (!Number.isFinite(startMs)) return fromIso;
  let remaining = Math.max(0, minutes);
  let cursor = snapToBusinessStart(startMs, calendar);
  if (remaining === 0) return new Date(cursor).toISOString();

  for (let guard = 0; guard < 10_000 && remaining > 0; guard += 1) {
    const slot = remainingBusinessMinutesToday(cursor, calendar);
    if (slot <= 0) {
      cursor = snapToBusinessStart(cursor + 60_000, calendar);
      continue;
    }
    if (remaining <= slot) {
      cursor += remaining * 60_000;
      remaining = 0;
      break;
    }
    remaining -= slot;
    cursor = snapToBusinessStart(cursor + slot * 60_000 + 60_000, calendar);
  }
  return new Date(cursor).toISOString();
}

export function duesFromPolicy(
  nowIso: string,
  policy: SlaPolicy,
  calendar: BusinessHoursCalendar = DEFAULT_BUSINESS_HOURS,
): SlaDuePair {
  return {
    responseDue: addBusinessMinutesIso(nowIso, policy.responseMinutes, calendar),
    resolveDue: addBusinessMinutesIso(nowIso, policy.resolveMinutes, calendar),
  };
}

/** Pick best matching seed policy for type+priority (no DB). */
export function resolveDefaultSlaPolicy(type: string, priority = ''): SlaPolicy {
  const pri = priority.trim();
  const exact = DEFAULT_SLA_POLICIES.find((p) => p.type === type && p.priority === pri);
  if (exact) return exact;
  const typeDefault = DEFAULT_SLA_POLICIES.find((p) => p.type === type && p.priority === '');
  if (typeDefault) return typeDefault;
  const requestExact = DEFAULT_SLA_POLICIES.find((p) => p.type === 'request' && p.priority === pri);
  if (requestExact) return requestExact;
  return (
    DEFAULT_SLA_POLICIES.find((p) => p.type === 'request' && p.priority === '') ?? {
      type: 'request',
      priority: '',
      responseMinutes: 120,
      resolveMinutes: 2880,
    }
  );
}

function isOpenStatus(status: string): boolean {
  return status === 'open' || status === 'in_progress';
}

/** True when response or resolve clock missed its due (met late, or still open past due). */
export function computeSlaBreached(fields: SlaClockFields, nowMs = Date.now()): boolean {
  if (fields.responseDue) {
    const due = Date.parse(fields.responseDue);
    if (Number.isFinite(due)) {
      if (fields.responseMetAt) {
        if (Date.parse(fields.responseMetAt) > due) return true;
      } else if (isOpenStatus(fields.status) && nowMs > due) {
        return true;
      }
    }
  }
  if (fields.resolveDue) {
    const due = Date.parse(fields.resolveDue);
    if (Number.isFinite(due)) {
      if (fields.resolveMetAt) {
        if (Date.parse(fields.resolveMetAt) > due) return true;
      } else if (isOpenStatus(fields.status) && nowMs > due) {
        return true;
      }
    }
  }
  return false;
}

export function slaBadgeState(
  kind: SlaBadgeKind,
  fields: SlaClockFields,
  nowMs = Date.now(),
): SlaBadgeState {
  const due = kind === 'response' ? fields.responseDue : fields.resolveDue;
  const met = kind === 'response' ? fields.responseMetAt : fields.resolveMetAt;
  if (!due) return 'none';
  const dueMs = Date.parse(due);
  if (!Number.isFinite(dueMs)) return 'none';
  if (met) {
    return Date.parse(met) > dueMs ? 'breached' : 'met';
  }
  if (isOpenStatus(fields.status) && nowMs > dueMs) return 'breached';
  if (!isOpenStatus(fields.status)) return 'none';
  return 'on_track';
}

export function tagForSlaBadge(state: SlaBadgeState): string {
  if (state === 'breached') return 'tag tag--error';
  if (state === 'met') return 'tag tag--ok';
  if (state === 'on_track') return 'tag tag--info';
  return 'tag tag--muted';
}

export function labelForSlaBadge(kind: SlaBadgeKind, state: SlaBadgeState): string {
  const clock = kind === 'response' ? 'Response' : 'Resolve';
  if (state === 'breached') return `${clock} SLA breached`;
  if (state === 'met') return `${clock} SLA met`;
  if (state === 'on_track') return `${clock} SLA on track`;
  return `${clock} SLA`;
}

/** Urgent priority queue: blocker / highest / high. */
export const URGENT_PRIORITIES = ['blocker', 'highest', 'high'] as const;

export function priorityRank(priority: string): number {
  switch (priority) {
    case 'blocker':
      return 0;
    case 'highest':
      return 1;
    case 'high':
      return 2;
    case 'medium':
      return 3;
    case 'low':
      return 4;
    case 'lowest':
      return 5;
    default:
      return 6;
  }
}
