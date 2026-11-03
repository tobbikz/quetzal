import type { Issue } from '@/lib/types';

export const DEFAULT_CAPACITY_PTS_PER_WEEK = 20;
export const CAPACITY_COOKIE = 'quetzal_capacity';

export function parseCapacity(raw: string | undefined | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CAPACITY_PTS_PER_WEEK;
  return Math.min(500, Math.round(n));
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function issueStartOn(issue: Issue): string {
  if (issue.startOn) return issue.startOn.slice(0, 10);
  return issue.createdAt.slice(0, 10);
}

function overlapsWeek(issue: Issue, weekStart: string, weekEnd: string): boolean {
  const start = issueStartOn(issue);
  const end = issue.dueOn ? issue.dueOn.slice(0, 10) : start;
  return start <= weekEnd && end >= weekStart;
}

export type CapacitySnapshot = {
  capacityPerWeek: number;
  weekStart: string;
  weekEnd: string;
  committed: number;
  openCount: number;
  loadPct: number;
  over: boolean;
};

/** Points committed in the current calendar week (Mon–Sun-ish via today+7) vs baseline. */
export function capacitySnapshot(issues: Issue[], capacityPerWeek: number): CapacitySnapshot {
  const weekStart = isoToday();
  const weekEnd = addDays(weekStart, 7);
  let committed = 0;
  let openCount = 0;
  for (const issue of issues) {
    if (issue.status === 'done') continue;
    if (!overlapsWeek(issue, weekStart, weekEnd)) continue;
    openCount += 1;
    committed += issue.points ?? 0;
  }
  const loadPct = capacityPerWeek > 0 ? Math.round((committed / capacityPerWeek) * 100) : 0;
  return {
    capacityPerWeek,
    weekStart,
    weekEnd,
    committed,
    openCount,
    loadPct,
    over: committed > capacityPerWeek,
  };
}
