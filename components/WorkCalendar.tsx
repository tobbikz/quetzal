import Link from 'next/link';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import type { Issue } from '@/lib/types';

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function WorkCalendar({
  year,
  month,
  issues,
  selected,
}: {
  year: number;
  month: number;
  issues: Issue[];
  selected?: string | null;
}) {
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const byDay = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!issue.dueOn) continue;
    const list = byDay.get(issue.dueOn) ?? [];
    list.push(issue);
    byDay.set(issue.dueOn, list);
  }
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < startPad; i += 1) cells.push({ day: null, iso: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, iso });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });

  const dayIssues = selected ? byDay.get(selected) ?? [] : [];
  const dueCount = issues.filter((issue) => issue.dueOn).length;

  return (
    <section className="panel work-cal">
      <div className="panel-head">
        <span>Calendar</span>
        <div className="work-cal-head-actions">
          <nav className="work-cal-nav" aria-label="Month">
            <Link href={`/?ym=${prev.year}-${String(prev.month).padStart(2, '0')}`} aria-label="Previous month">
              ‹
            </Link>
            <span className="work-cal-month">{monthLabel(year, month)}</span>
            <Link href={`/?ym=${next.year}-${String(next.month).padStart(2, '0')}`} aria-label="Next month">
              ›
            </Link>
          </nav>
          <Link href="/calendar" className="work-cal-open">
            Open
          </Link>
        </div>
      </div>
      <div className="panel-body">
        <p className="work-cal-summary muted">
          {dueCount === 0 ? 'No due dates this month.' : `${dueCount} due item${dueCount === 1 ? '' : 's'} this month.`}
        </p>
        <div className="work-cal-grid" role="grid" aria-label={monthLabel(year, month)}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((label) => (
            <div key={label} className="work-cal-dow">
              {label}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (!cell.iso || cell.day == null) {
              return <div key={`pad-${index}`} className="work-cal-day is-pad" />;
            }
            const count = byDay.get(cell.iso)?.length ?? 0;
            const classes = [
              'work-cal-day',
              cell.iso === today ? 'is-today' : '',
              count ? 'has-due' : '',
              selected === cell.iso ? 'is-on' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <Link
                key={cell.iso}
                href={selected === cell.iso ? `/?ym=${ym}` : `/?ym=${ym}&day=${cell.iso}`}
                className={classes}
                title={count ? `${count} due` : undefined}
              >
                <span className="work-cal-num">{cell.day}</span>
                {count ? <span className="work-cal-count">{count > 9 ? '9+' : count}</span> : null}
              </Link>
            );
          })}
        </div>
        {selected ? (
          <div className="work-cal-daylist">
            <div className="work-cal-daylist-head">Due {selected}</div>
            {dayIssues.length === 0 ? (
              <p className="muted">No due issues this day.</p>
            ) : (
              <ul>
                {dayIssues.map((issue) => (
                  <li key={issue.key}>
                    <IssueHoverCard issueKey={issue.key} className="key">
                      {issue.key}
                    </IssueHoverCard>
                    <span>{issue.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="work-cal-hint muted">Select a day with due work to preview it here.</p>
        )}
      </div>
    </section>
  );
}
