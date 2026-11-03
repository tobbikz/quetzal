import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { PriorityMark } from '@/components/PriorityMark';
import { ProjectSwitch } from '@/components/ProjectSwitch';
import { RoadmapCapacity } from '@/components/RoadmapCapacity';
import { RoadmapGanttBar } from '@/components/RoadmapGanttBar';
import { listIssues, listSprints, projectsForAssignee, getUser } from '@/lib/db';
import { blockInfoByIssueId, ensureDemoBlocks } from '@/lib/issueLinks';
import { CAPACITY_COOKIE, capacitySnapshot, parseCapacity } from '@/lib/roadmapCapacity';
import {
  addDays,
  computeTimelineWindow,
  epicProgress,
  ganttVariant,
  inferSprintWindows,
  isoToday,
  positionWithin,
  scheduleIssues,
  startOfWeek,
  tickWeeks,
  todayPct,
  type DerivedSprint,
} from '@/lib/roadmapGantt';
import {
  STATUS_LABEL,
  STATUSES,
  tagForStatus,
  TYPE_LABEL,
  tagForType,
} from '@/lib/format';
import { toIssuePreview } from '@/lib/preview';
import { currentProject, currentUser } from '@/lib/session';
import type { Issue, IssueStatus, Sprint } from '@/lib/types';

type RoadmapView = 'timeline' | 'due' | 'sprint';
type RoadmapScope = 'project' | 'sprint';

type Lane = { id: string; title: string; hint?: string; issues: Issue[] };
type HierarchyRow = { issue: Issue; depth: number };

function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function lanesByDue(issues: Issue[]): Lane[] {
  const today = isoToday();
  const weekEnd = addDaysISO(today, 7);
  const overdue: Issue[] = [];
  const thisWeek: Issue[] = [];
  const later: Issue[] = [];
  const none: Issue[] = [];
  for (const issue of issues) {
    if (!issue.dueOn) {
      none.push(issue);
      continue;
    }
    if (issue.dueOn < today && issue.status !== 'done') overdue.push(issue);
    else if (issue.dueOn >= today && issue.dueOn <= weekEnd) thisWeek.push(issue);
    else later.push(issue);
  }
  const sortDue = (a: Issue, b: Issue) =>
    (a.dueOn ?? '').localeCompare(b.dueOn ?? '') || a.key.localeCompare(b.key);
  overdue.sort(sortDue);
  thisWeek.sort(sortDue);
  later.sort(sortDue);
  none.sort((a, b) => a.key.localeCompare(b.key));
  return [
    { id: 'overdue', title: 'Overdue', hint: 'Past due, not done', issues: overdue },
    { id: 'week', title: 'This week', hint: `Through ${weekEnd}`, issues: thisWeek },
    { id: 'later', title: 'Later', hint: 'Beyond 7 days', issues: later },
    { id: 'none', title: 'No due date', issues: none },
  ];
}

function lanesBySprint(issues: Issue[], sprints: Sprint[]): Lane[] {
  const bySprint = new Map<number | null, Issue[]>();
  for (const issue of issues) {
    const key = issue.sprintId;
    const list = bySprint.get(key) ?? [];
    list.push(issue);
    bySprint.set(key, list);
  }
  const lanes: Lane[] = sprints.map((sprint) => ({
    id: `sprint-${sprint.id}`,
    title: sprint.name,
    hint: `${sprint.state}${sprint.goal ? ` · ${sprint.goal}` : ''}`,
    issues: (bySprint.get(sprint.id) ?? []).sort((a, b) => a.key.localeCompare(b.key)),
  }));
  lanes.push({
    id: 'backlog',
    title: 'Backlog',
    hint: 'No sprint',
    issues: (bySprint.get(null) ?? []).sort((a, b) => a.key.localeCompare(b.key)),
  });
  return lanes;
}

function statusCounts(issues: Issue[]): Record<IssueStatus, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<IssueStatus, number>;
  for (const issue of issues) counts[issue.status] += 1;
  return counts;
}

function hierarchyRows(issues: Issue[]): HierarchyRow[] {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const byParent = new Map<number | null, Issue[]>();
  for (const issue of issues) {
    const key = issue.parentId != null && byId.has(issue.parentId) ? issue.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(issue);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      const epicBias = Number(b.type === 'epic') - Number(a.type === 'epic');
      if (epicBias) return epicBias;
      return a.num - b.num;
    });
  }
  const rows: HierarchyRow[] = [];
  const seen = new Set<number>();
  function walk(issue: Issue, depth: number) {
    if (seen.has(issue.id)) return;
    seen.add(issue.id);
    rows.push({ issue, depth });
    for (const child of byParent.get(issue.id) ?? []) walk(child, depth + 1);
  }
  const epics = issues.filter((issue) => issue.type === 'epic').sort((a, b) => a.num - b.num);
  for (const epic of epics) walk(epic, 0);
  const roots = (byParent.get(null) ?? []).filter((issue) => !seen.has(issue.id));
  for (const root of roots) walk(root, 0);
  for (const issue of issues) {
    if (!seen.has(issue.id)) walk(issue, 0);
  }
  return rows;
}

/**
 * Narrow a project-wide issue set to the active roadmap scope. For sprint, we
 * also promote ancestor epics so the Gantt still groups work under its parent
 * instead of orphaning child rows.
 */
function applyScope(
  issues: Issue[],
  scope: RoadmapScope,
  activeSprint: Sprint | undefined,
): Issue[] {
  if (scope === 'project') return issues;
  const byId = new Map(issues.map((i) => [i.id, i]));
  const match = (issue: Issue): boolean =>
    activeSprint != null && issue.sprintId === activeSprint.id;
  const keep = new Set<number>();
  for (const issue of issues) {
    if (!match(issue)) continue;
    keep.add(issue.id);
    let cursor: Issue | undefined = issue;
    while (cursor?.parentId != null) {
      const parent = byId.get(cursor.parentId);
      if (!parent || keep.has(parent.id)) break;
      keep.add(parent.id);
      cursor = parent;
    }
  }
  return issues.filter((issue) => keep.has(issue.id));
}

function qs(parts: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parts)) {
    if (value) params.set(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function IssueMeta({ issue }: { issue: Issue }) {
  return (
    <span className="muted roadmap-meta">
      {issue.dueOn ?? '—'}
      {' · '}
      {issue.assigneeId ? (await getUser(issue.assigneeId))?.name ?? '—' : 'Unassigned'}
    </span>
  );
}

async function LaneIssueRow({ issue }: { issue: Issue }) {
  const preview = await toIssuePreview(issue);
  return (
    <li>
      <IssueHoverCard issueKey={issue.key} preview={preview} className="key">
        {issue.key}
      </IssueHoverCard>
      <span className={tagForType(issue.type)}>{TYPE_LABEL[issue.type]}</span>
      <IssueHoverCard issueKey={issue.key} preview={preview} className="roadmap-sum">
        {issue.summary}
      </IssueHoverCard>
      <span className={tagForStatus(issue.status)}>{STATUS_LABEL[issue.status]}</span>
      <PriorityMark priority={issue.priority} />
      <IssueMeta issue={issue} />
    </li>
  );
}

/** Short, readable assignee for the side panel. "Ana Solis" → "Ana Solis"; keep full first name + last initial fallback. */
function assigneeLabel(name: string | undefined): string {
  if (!name) return 'Unassigned';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  // Keep full name when it fits (<= 14 chars), else first + last initial.
  const full = `${first} ${last}`;
  return full.length <= 14 ? full : `${first} ${last.charAt(0)}.`;
}

export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; by?: string; scope?: string }>;
}) {
  const sp = await searchParams;
  // Personal scope was removed per product decision — redirect to project so
  // old URLs (e.g. bookmarks) still land somewhere useful.
  if (sp.scope === 'personal') {
    const next = new URLSearchParams();
    if (sp.view && sp.view !== 'timeline') next.set('view', sp.view);
    const qs = next.toString();
    redirect(qs ? `/roadmap?${qs}` : '/roadmap');
  }
  // Legacy ?view=lanes&by=sprint URLs still work; new primary is Timeline.
  const legacyLanes = sp.view === 'lanes';
  const legacyBy = sp.by === 'sprint' ? 'sprint' : 'due';
  const requestedView =
    (sp.view === 'timeline' || sp.view === 'due' || sp.view === 'sprint')
      ? (sp.view as RoadmapView)
      : legacyLanes
        ? legacyBy
        : 'timeline';
  const view: RoadmapView = requestedView;
  const scope: RoadmapScope = sp.scope === 'sprint' ? 'sprint' : 'project';

  const user = await currentUser();
  const project = await currentProject();
  const allIssues = await listIssues({ projectKey: project.key });
  ensureDemoBlocks(allIssues);
  const sprints = await listSprints(project.id);
  const activeSprint = sprints.find((s) => s.state === 'active');
  const nextSprint = sprints.find((s) => s.state === 'planned');
  const issues = applyScope(allIssues, scope, activeSprint);
  const blocks = await blockInfoByIssueId(project.id);
  const jar = await cookies();
  const capacity = parseCapacity(jar.get(CAPACITY_COOKIE)?.value);
  const snap = capacitySnapshot(issues, capacity);
  const counts = statusCounts(issues);
  const total = issues.length || 1;

  // Timeline derivations
  const sprintWindows = inferSprintWindows(sprints);
  const dated = scheduleIssues(issues, sprintWindows);
  let timeline = computeTimelineWindow(Array.from(dated.values()));
  // Sprint scope narrows the axis to the active sprint ±1 week so the plan
  // feels like a sprint planner instead of a long project survey.
  if (scope === 'sprint' && activeSprint) {
    const win = sprintWindows.get(activeSprint.id);
    if (win) {
      const from = startOfWeek(addDays(win.start, -7));
      const to = startOfWeek(addDays(win.end, 14));
      const weeks = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 / 7));
      timeline = { from, to, weeks };
    }
  }
  const ticks = tickWeeks(timeline.from, timeline.to, sprintWindows);
  const today = todayPct(timeline.from, timeline.to);
  const rows = hierarchyRows(issues);
  const childrenOf = new Map<number, Issue[]>();
  for (const issue of allIssues) {
    if (issue.parentId == null) continue;
    const list = childrenOf.get(issue.parentId) ?? [];
    list.push(issue);
    childrenOf.set(issue.parentId, list);
  }

  const viewLabel =
    view === 'timeline'
      ? 'epic Gantt timeline'
      : view === 'due'
        ? 'by due date'
        : 'by sprint';
  const scopeLabel: Record<RoadmapScope, string> = {
    project: 'all project work',
    sprint: activeSprint ? `sprint ${activeSprint.name}` : 'active sprint',
  };

  const scopeParam = scope === 'project' ? undefined : scope;
  const viewParam = view === 'timeline' ? undefined : view;
  const switchNext = `/roadmap${qs({ view: viewParam, scope: scopeParam })}`;
  const scopeHref = (next: RoadmapScope) =>
    `/roadmap${qs({ view: viewParam, scope: next === 'project' ? undefined : next })}`;
  const viewHref = (next: RoadmapView) =>
    `/roadmap${qs({ view: next === 'timeline' ? undefined : next, scope: scopeParam })}`;

  return (
    <main className="page rmg-page">
      <header className="rmg-bar">
        <div className="rmg-bar-left">
          <span className="rmg-bar-kicker">Roadmap</span>
          <h1 className="rmg-bar-title">{project.key}</h1>
          <span className="rmg-bar-meta">
            {issues.length} issue{issues.length === 1 ? '' : 's'} · {scopeLabel[scope]} · {viewLabel}
          </span>
        </div>
        <div className="rmg-bar-right">
          <ProjectSwitch
            projects={await projectsForAssignee(user.id)}
            value={project.key}
            next={switchNext}
          />
        </div>
      </header>

        <section className="rmg-strip rmg-strip--slim" aria-label="Roadmap summary">
          <div className="rmg-strip-cell rmg-strip-cell--scope">
            <span className="rmg-strip-k">Scope</span>
            <div className="rmg-seg rmg-seg--scope" role="group" aria-label="Roadmap scope">
              <Link
                className={scope === 'project' ? 'is-active' : ''}
                href={scopeHref('project')}
              >
                Project
              </Link>
              <Link
                className={scope === 'sprint' ? 'is-active' : ''}
                href={scopeHref('sprint')}
                aria-disabled={!activeSprint}
                title={activeSprint ? `Filter to ${activeSprint.name}` : 'No active sprint'}
              >
                Sprint
              </Link>
            </div>
          </div>
          <div className="rmg-strip-cell rmg-strip-cell--cap">
            <span className="rmg-strip-k">Capacity</span>
            <span className={`rmg-strip-v${snap.over ? ' is-over' : ''}`}>
              {snap.committed}/{snap.capacityPerWeek} pts · {snap.loadPct}%
            </span>
            <div
              className="rmg-strip-meter"
              role="img"
              aria-label={`Load ${snap.loadPct}%`}
            >
              <span
                className={snap.over ? 'is-over' : ''}
                style={{ width: `${Math.min(100, snap.loadPct)}%` }}
              />
            </div>
          </div>
          <div className="rmg-strip-cell rmg-strip-cell--status">
            <span className="rmg-strip-k">Status</span>
            <div className="rmg-strip-status" role="img" aria-label="Issue counts by status">
              {STATUSES.map((status) => {
                const n = counts[status];
                const pct = Math.round((n / total) * 100);
                return (
                  <span key={status} className={`rmg-strip-chip rmg-strip-chip--${status}`}>
                    <span className="rmg-strip-chip-dot" aria-hidden="true" />
                    <span className="rmg-strip-chip-k">{STATUS_LABEL[status]}</span>
                    <span className="rmg-strip-chip-n">{n}</span>
                    <span className="rmg-strip-chip-bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="rmg-strip-cell rmg-strip-cell--sprints">
            <span className="rmg-strip-k">Sprints</span>
            <span className="rmg-strip-sprints">
              {activeSprint ? (
                <span className="rmg-strip-sprint is-active">
                  <span className="dot" />
                  {activeSprint.name}
                  <span className="muted"> · active</span>
                </span>
              ) : null}
              {nextSprint ? (
                <span className="rmg-strip-sprint">
                  <span className="dot" />
                  {nextSprint.name}
                  <span className="muted"> · next</span>
                </span>
              ) : null}
              {!activeSprint && !nextSprint ? (
                <span className="muted">No sprints</span>
              ) : null}
            </span>
          </div>
        </section>

        {view === 'timeline' ? (
          <section className="roadmap-gantt rmg-shell" aria-label="Roadmap timeline">
            <div className="rmg-toolbar">
              <div className="rmg-seg" role="group" aria-label="Roadmap view">
                <Link className="is-active" href={viewHref('timeline')}>
                  Timeline
                </Link>
                <Link href={viewHref('due')}>Due lanes</Link>
                <Link href={viewHref('sprint')}>Sprint lanes</Link>
              </div>
              <span className="rmg-toolbar-info">
                {timeline.weeks}-week window · {timeline.from} → {ticks.at(-1)?.iso ?? timeline.to}
              </span>
              <div className="rmg-legend" aria-hidden="true">
                <span>
                  <span className="rmg-swatch rmg-swatch--epic" />
                  Epic
                </span>
                <span>
                  <span className="rmg-swatch rmg-swatch--done" />
                  Done
                </span>
                <span>
                  <span className="rmg-swatch rmg-swatch--ip" />
                  In progress
                </span>
                <span>
                  <span className="rmg-swatch rmg-swatch--todo" />
                  To do
                </span>
                <span>
                  <span className="rmg-swatch rmg-swatch--ticket" />
                  Ticket
                </span>
              </div>
            </div>

            <div className="rmg-grid">
              <div className="rmg-side">
                <div className="rmg-side-head">
                  <span>Hierarchy</span>
                  <span>Assignee</span>
                </div>
                {rows.length === 0 ? (
                  <div className="rmg-side-empty muted">
                    {scope === 'sprint'
                      ? activeSprint
                        ? `Nothing in ${activeSprint.name} yet.`
                        : 'No active sprint for this project.'
                      : 'No issues in this project.'}
                  </div>
                ) : (
                  await Promise.all(
                    rows.map(async ({ issue, depth }) => {
                      const info = blocks.get(issue.id);
                      const preview = await toIssuePreview(issue);
                      const assignee = issue.assigneeId
                        ? (await getUser(issue.assigneeId))?.name
                        : undefined;
                      const blockCount =
                        (info?.blocks.length ?? 0) + (info?.blockedBy.length ?? 0);
                      return (
                        <div
                          key={issue.key}
                          className={`rmg-row rmg-row--left${issue.type === 'epic' ? ' is-epic' : ''}${issue.status === 'done' ? ' is-done' : ''}`}
                          data-depth={depth}
                          style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
                        >
                          <span className="rmg-row-caret" aria-hidden="true">
                            {issue.type === 'epic' ? '▾' : depth > 0 ? '·' : '▸'}
                          </span>
                          <span className={tagForType(issue.type)}>{TYPE_LABEL[issue.type]}</span>
                          <IssueHoverCard
                            issueKey={issue.key}
                            preview={preview}
                            className="rmg-row-id key"
                          >
                            {issue.key}
                          </IssueHoverCard>
                          <IssueHoverCard
                            issueKey={issue.key}
                            preview={preview}
                            className="rmg-row-title"
                          >
                            {issue.summary}
                          </IssueHoverCard>
                          {blockCount > 0 ? (
                            <span
                              className="rmg-row-blocks"
                              title={[
                                ...(info?.blockedBy ?? []).map((k) => `← blocked by ${k}`),
                                ...(info?.blocks ?? []).map((k) => `→ blocks ${k}`),
                              ].join('\n')}
                              aria-label={`${blockCount} dependency link${blockCount === 1 ? '' : 's'}`}
                            >
                              ⇄{blockCount}
                            </span>
                          ) : (
                            // Keep column alignment stable: 7 grid cells per row.
                            <span className="rmg-row-blocks rmg-row-blocks--empty" aria-hidden="true" />
                          )}
                          <PriorityMark priority={issue.priority} withLabel={false} />
                          <span className="rmg-row-assn muted" title={assignee ?? 'Unassigned'}>
                            {assigneeLabel(assignee)}
                          </span>
                        </div>
                      );
                    }),
                  )
                )}
              </div>

              <div className="rmg-tl">
                <div className="rmg-tl-head">
                  <div
                    className="rmg-tl-weeks"
                    style={{ gridTemplateColumns: `repeat(${ticks.length}, 1fr)` }}
                  >
                    {ticks.map((tick) => (
                      <div
                        key={tick.iso}
                        className={`rmg-tl-week${tick.sprint ? ' is-sprint-start' : ''}${tick.isCurrent ? ' is-current' : ''}`}
                      >
                        <span className="wk">
                          W{tick.week}
                          {tick.sprint ? ` · ${tick.sprint.name.replace(/^Sprint\s*/, 'S')}` : ''}
                        </span>
                        <span className="dt">{tick.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rmg-tl-body">
                  <div
                    className="rmg-tl-grid"
                    style={{ gridTemplateColumns: `repeat(${ticks.length}, 1fr)` }}
                    aria-hidden="true"
                  >
                    {ticks.map((tick) => (
                      <span
                        key={`g-${tick.iso}`}
                        className={`rmg-tl-col${tick.sprint ? ' is-sprint-start' : ''}${tick.isCurrent ? ' is-current' : ''}`}
                      />
                    ))}
                  </div>

                  {Array.from(sprintWindows.values()).map((s: DerivedSprint) => {
                    const pos = positionWithin(s.start, s.end, timeline.from, timeline.to);
                    if (pos.widthPct <= 0 || pos.leftPct >= 100) return null;
                    return (
                      <div
                        key={`band-${s.id}`}
                        className={`rmg-sprint-band is-${s.state}`}
                        style={{
                          left: `${pos.leftPct.toFixed(2)}%`,
                          width: `${pos.widthPct.toFixed(2)}%`,
                        }}
                        data-label={s.name}
                        aria-hidden="true"
                      />
                    );
                  })}

                  <div
                    className="rmg-today"
                    style={{ left: `${today.toFixed(2)}%` }}
                    aria-hidden="true"
                  >
                    <span className="rmg-today-pill">TODAY</span>
                  </div>

                  {rows.length === 0 ? (
                    <div className="rmg-tl-empty muted">No work scheduled yet.</div>
                  ) : (
                    rows.map(({ issue }) => {
                      const d = dated.get(issue.id)!;
                      const variant = ganttVariant(issue);
                      const children = childrenOf.get(issue.id) ?? [];
                      const progress =
                        issue.type === 'epic' ? epicProgress(children) : undefined;
                      const points = issue.points != null ? `${issue.points} pt${issue.points === 1 ? '' : 's'}` : null;
                      const flag = variant === 'ticket' ? '!' : undefined;
                      const label =
                        issue.type === 'epic'
                          ? `${issue.key} · ${issue.summary}${progress != null ? ` · ${Math.round(progress * 100)}%` : ''}`
                          : `${issue.key} · ${issue.summary}`;
                      return (
                        <div
                          key={`bar-${issue.key}`}
                          className={`rmg-bar-row${issue.type === 'epic' ? ' is-epic' : ''}${issue.status === 'done' ? ' is-done' : ''}`}
                        >
                          <RoadmapGanttBar
                            issueKey={issue.key}
                            startOn={d.startOn}
                            dueOn={d.dueOn}
                            windowFrom={timeline.from}
                            windowTo={timeline.to}
                            variant={variant}
                            label={label}
                            meta={points ?? undefined}
                            epicProgress={progress}
                            flag={flag}
                            derived={d.derived}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="rmg-toolbar rmg-toolbar--standalone">
              <div className="rmg-seg" role="group" aria-label="Roadmap view">
                <Link href={viewHref('timeline')}>Timeline</Link>
                <Link
                  className={view === 'due' ? 'is-active' : ''}
                  href={viewHref('due')}
                >
                  Due lanes
                </Link>
                <Link
                  className={view === 'sprint' ? 'is-active' : ''}
                  href={viewHref('sprint')}
                >
                  Sprint lanes
                </Link>
              </div>
              <span className="rmg-toolbar-info muted">
                List view — jump back to Timeline for the planner.
              </span>
            </div>
            <div className="roadmap-lanes">
              {(view === 'sprint' ? lanesBySprint(issues, sprints) : lanesByDue(issues)).map(
                (lane) => (
                  <section key={lane.id} className="panel roadmap-lane">
                    <div className="panel-head">
                      <span>{lane.title}</span>
                      <span>
                        {lane.issues.length}
                        {lane.hint ? <span className="faint"> · {lane.hint}</span> : null}
                      </span>
                    </div>
                    {lane.issues.length === 0 ? (
                      <div className="panel-body muted">Nothing here.</div>
                    ) : (
                      <ul className="roadmap-list">
                        {lane.issues.map((issue) => (
                          <LaneIssueRow key={issue.key} issue={issue} />
                        ))}
                      </ul>
                    )}
                  </section>
                ),
              )}
            </div>
          </>
        )}

        <details className="rmg-cap-details">
          <summary>Baseline capacity · {snap.capacityPerWeek} pts/week</summary>
          <RoadmapCapacity snap={snap} />
        </details>
    </main>
  );
}
