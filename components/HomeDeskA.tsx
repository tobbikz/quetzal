import Link from 'next/link';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import type { FeedEntry } from '@/lib/db';
import { feedLine } from '@/lib/feed';
import { STATUS_LABEL, STATUSES } from '@/lib/format';
import type { CalendarEvent, Issue, IssueStatus, Sprint, WikiPage } from '@/lib/types';

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function formatShortDue(dueOn: string): string {
  const [y, m, d] = dueOn.split('-').map(Number);
  if (!y || !m || !d) return dueOn;
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function daysUntil(dueOn: string): number | null {
  const [y, m, d] = dueOn.split('-').map(Number);
  if (!y || !m || !d) return null;
  const due = Date.UTC(y, m - 1, d);
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due - start) / 86_400_000);
}

function greetingFor(hour: number): string {
  if (hour < 5) return 'Still at it';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(now: Date): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(now);
}

function firstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  return first ?? null;
}

export function HomeDeskA({
  projectKey,
  sprint,
  issues,
  myQueue,
  dueSoon,
  feed,
  events,
  wikiPages,
  userName,
}: {
  projectKey: string;
  sprint: Sprint | undefined;
  issues: Issue[];
  myQueue: Issue[];
  dueSoon: Issue[];
  feed: FeedEntry[];
  events: CalendarEvent[];
  wikiPages: WikiPage[];
  userName?: string | null;
}) {
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, [] as Issue[]])) as Record<
    IssueStatus,
    Issue[]
  >;
  for (const issue of issues) byStatus[issue.status].push(issue);

  const open = issues.filter((issue) => issue.status !== 'done').length;
  const doing = byStatus.in_progress.length;
  const review = byStatus.in_review.length;
  const tickets = issues.filter((issue) => issue.type === 'bug' && issue.status !== 'done').length;
  const done = byStatus.done.length;
  const total = issues.length || 1;
  const sprintPct = Math.round((done / total) * 100);

  const upcomingEvents = events
    .slice()
    .sort(
      (a, b) =>
        a.startsOn.localeCompare(b.startsOn) ||
        String(a.startTime ?? '').localeCompare(String(b.startTime ?? '')),
    )
    .slice(0, 8);

  const now = new Date();
  const greet = greetingFor(now.getHours());
  const fname = firstName(userName);
  const dateStr = todayLabel(now);

  const strip: { label: string; value: number; tone?: 'accent' | 'warn' | 'ok' }[] = [
    { label: 'Open', value: open, tone: 'accent' },
    { label: 'In progress', value: doing },
    { label: 'In review', value: review, tone: 'warn' },
    { label: 'Tickets', value: tickets },
    { label: 'Done', value: done, tone: 'ok' },
  ];

  const sprintLine = sprint
    ? sprint.goal
      ? `${sprint.name} — ${sprint.goal}`
      : `${sprint.name} is active · set a goal from Backlog to focus the cycle.`
    : 'No active sprint — plan the next cycle from Backlog.';

  return (
    <div className="hw">
      {/* ——— Hero: brand as hero signal + context sentence ——— */}
      <section className="hw-hero hw-rise" style={{ ['--d' as string]: '0ms' }}>
        <div className="hw-hero-brand">
          <span className="hw-hero-eyebrow">
            <span className="hw-hero-pulse" aria-hidden />
            Work · For you · {projectKey}
          </span>
          <h1 className="hw-wordmark">
            Quetzal<span className="hw-wordmark-dot">.</span>
          </h1>
          <p className="hw-hero-tag">
            An ops atelier — issues, flow and knowledge in one quiet desk.
          </p>
        </div>
        <div className="hw-hero-meta" aria-live="polite">
          <div className="hw-hero-meta-top">
            <p className="hw-hero-greet">
              {greet}
              {fname ? <>, <strong>{fname}</strong></> : null}
              <span className="hw-hero-date"> · {dateStr}</span>
            </p>
            <Link href="/?view=list" className="hw-open-list">
              Open list
              <span className="hw-open-list-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
          <p className="hw-hero-goal" title={sprintLine}>
            <span className="hw-hero-chip">{sprint ? 'sprint' : 'planning'}</span>
            <span className="hw-hero-goal-text">{sprintLine}</span>
          </p>
        </div>
      </section>

      {/* ——— Status strip: one slim row, not five fat cards ——— */}
      <ul className="hw-strip hw-rise" style={{ ['--d' as string]: '60ms' }}>
        {strip.map((m) => (
          <li key={m.label} className={`hw-strip-cell${m.tone ? ` is-${m.tone}` : ''}`}>
            <span className="hw-strip-label">{m.label}</span>
            <strong className="hw-strip-value">{m.value}</strong>
          </li>
        ))}
        <li className="hw-strip-cell hw-strip-cell--trailing">
          <span className="hw-strip-label">Progress</span>
          <strong className="hw-strip-value hw-strip-value--pct">{sprintPct}%</strong>
        </li>
      </ul>

      {/* ——— Primary stage: Flow (kanban) + Activity + Agenda ——— */}
      <div className="hw-stage hw-rise" style={{ ['--d' as string]: '120ms' }}>
        <section className="hw-panel hw-panel--board">
          <header className="hw-section-head">
            <h2>
              <span className="hw-section-rule" aria-hidden />
              Flow
            </h2>
            <Link href="/board" className="hw-link">
              Open board →
            </Link>
          </header>
          <div className="hw-board-scroll">
            <div className="hw-board">
              {STATUSES.map((status) => (
                <div key={status} className={`hw-col hw-col--${status}`}>
                  <h3>
                    <span>{STATUS_LABEL[status]}</span>
                    <small>{byStatus[status].length}</small>
                  </h3>
                  <div className="hw-col-body">
                    {byStatus[status].slice(0, 4).map((issue) => (
                      <IssueHoverCard
                        key={issue.id}
                        issueKey={issue.key}
                        className="hw-card"
                      >
                        <span className="hw-card-key">{issue.key}</span>
                        <span className="hw-card-sum">{issue.summary}</span>
                      </IssueHoverCard>
                    ))}
                    {byStatus[status].length === 0 ? (
                      <p className="hw-empty">—</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="hw-panel hw-panel--feed">
          <header className="hw-section-head">
            <h2>
              <span className="hw-section-rule" aria-hidden />
              Activity
            </h2>
            <span className="hw-meta">{projectKey}</span>
          </header>
          <div className="hw-scroll">
            <ul className="hw-feed">
              {feed.length === 0 ? (
                <li className="hw-empty">No recent activity</li>
              ) : (
                feed.slice(0, 12).map((item) => (
                  <li key={item.id}>
                    <span className="hw-feed-av" aria-hidden>
                      {initials(item.authorName)}
                    </span>
                    <div className="hw-feed-copy">
                      <IssueHoverCard issueKey={item.issueKey} className="hw-key">
                        {item.issueKey}
                      </IssueHoverCard>{' '}
                      <span>{feedLine(item.kind, item.detail)}</span>
                    </div>
                    <time className="hw-feed-time" dateTime={item.createdAt}>
                      {relativeTime(item.createdAt)}
                    </time>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>

        <section className="hw-panel hw-panel--agenda">
          <header className="hw-section-head">
            <h2>
              <span className="hw-section-rule" aria-hidden />
              Agenda
            </h2>
            <Link href="/calendar" className="hw-link">
              Open
            </Link>
          </header>
          <div className="hw-scroll">
            {upcomingEvents.length === 0 ? (
              <p className="hw-empty">No upcoming events</p>
            ) : (
              <ul className="hw-events">
                {upcomingEvents.map((event) => (
                  <li key={event.id}>
                    <span
                      className="hw-events-bar"
                      style={{ background: event.typeColor }}
                      aria-hidden
                    />
                    <div className="hw-events-copy">
                      <span className="hw-events-title">{event.title}</span>
                      <span className="hw-events-when">
                        {formatShortDue(event.startsOn)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* ——— Sprint band: one elegant bar ——— */}
      <section className="hw-sprint hw-rise" style={{ ['--d' as string]: '180ms' }}>
        <div className="hw-sprint-head">
          <h2>
            <span className="hw-sprint-eyebrow">Sprint</span>
            <span className="hw-sprint-name">{sprint?.name ?? 'No active sprint'}</span>
          </h2>
          <span className="hw-sprint-stat">
            <strong>{done}</strong>
            <span>/ {issues.length || 0} resolved</span>
          </span>
        </div>
        <div className="hw-sprint-bar" aria-hidden>
          <span style={{ width: `${sprintPct}%` }} />
        </div>
        <p className="hw-sprint-goal">
          {sprint?.goal
            ? sprint.goal
            : 'Plan a goal to focus this cycle — specific, measurable, dated.'}
        </p>
      </section>

      {/* ——— Lists trio: calm, hairline dividers ——— */}
      <section className="hw-lists hw-rise" style={{ ['--d' as string]: '240ms' }}>
        <div className="hw-lists-col">
          <header className="hw-section-head">
            <h2>
              <span className="hw-section-rule" aria-hidden />
              My queue
            </h2>
            <Link href="/issues?who=assignee" className="hw-link">
              All
            </Link>
          </header>
          <ul className="hw-list">
            {myQueue.length === 0 ? (
              <li className="hw-empty">Nothing assigned</li>
            ) : (
              myQueue.map((issue) => (
                <li key={issue.id}>
                  <span className="hw-list-main">
                    <IssueHoverCard issueKey={issue.key} className="hw-key">
                      {issue.key}
                    </IssueHoverCard>{' '}
                    <Link href={`/issues/${issue.key}`} className="hw-list-sum">
                      {issue.summary}
                    </Link>
                  </span>
                  <span className="hw-pill">{STATUS_LABEL[issue.status]}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="hw-lists-col">
          <header className="hw-section-head">
            <h2>
              <span className="hw-section-rule" aria-hidden />
              Due soon
            </h2>
          </header>
          <ul className="hw-list">
            {dueSoon.length === 0 ? (
              <li className="hw-empty">No upcoming due dates</li>
            ) : (
              dueSoon.map((issue) => {
                const days = issue.dueOn ? daysUntil(issue.dueOn) : null;
                return (
                  <li key={issue.id}>
                    <span className="hw-list-main">
                      <IssueHoverCard issueKey={issue.key} className="hw-key">
                        {issue.key}
                      </IssueHoverCard>
                      {issue.dueOn ? (
                        <Link href={`/issues/${issue.key}`} className="hw-list-sum">
                          {' '}
                          · {formatShortDue(issue.dueOn)}
                        </Link>
                      ) : null}
                    </span>
                    {days != null ? (
                      <span
                        className={`hw-pill${
                          days < 0 ? ' is-late' : days <= 2 ? ' is-warn' : ''
                        }`}
                      >
                        {days < 0
                          ? `${Math.abs(days)}d late`
                          : days === 0
                            ? 'today'
                            : `${days}d`}
                      </span>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="hw-lists-col">
          <header className="hw-section-head">
            <h2>
              <span className="hw-section-rule" aria-hidden />
              Wiki pulse
            </h2>
            <Link href="/wiki" className="hw-link">
              Wiki home
            </Link>
          </header>
          <ul className="hw-list">
            {wikiPages.length === 0 ? (
              <li className="hw-empty">No recent pages</li>
            ) : (
              wikiPages.map((page) => (
                <li key={page.id}>
                  <Link
                    href={`/wiki/${page.spaceKey}/${page.slug}`}
                    className="hw-list-sum hw-list-sum--full"
                  >
                    {page.title}
                  </Link>
                  <span className="hw-pill hw-pill--ghost">{page.spaceKey}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
