import Link from 'next/link';
import { redirect } from 'next/navigation';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { ProjectSwitch } from '@/components/ProjectSwitch';
import {
  markVersionReleasedAction,
  startVersionReleaseAction,
  unmarkVersionReleasedAction,
} from '@/app/actions';
import { canBrowseIssues, canWriteIssues } from '@/lib/acl';
import { getIssue, listProjects } from '@/lib/db';
import { STATUS_LABEL, TYPE_LABEL, tagForStatus, tagForType } from '@/lib/format';
import { toIssuePreview } from '@/lib/preview';
import { currentProject, currentSite, currentUser } from '@/lib/session';
import type { IssueStatus, IssueType } from '@/lib/types';
import {
  addDays,
  isoDate,
  listUnscheduledIssues,
  summarizeAllVersions,
  type Component,
  type ReleaseLane,
  type VersionIssue,
  type VersionSummary,
} from '@/lib/versions';

/* ─────────────────────────────────────────────────────────── helpers ── */

type View = 'kanban' | 'changelog';

const LANE_LABEL: Record<ReleaseLane, string> = {
  unreleased: 'Unreleased',
  releasing: 'Releasing',
  released: 'Released',
};

const LANE_ORDER: ReleaseLane[] = ['unreleased', 'releasing', 'released'];

function laneTag(lane: ReleaseLane): string {
  if (lane === 'released') return 'tag tag--ok';
  if (lane === 'releasing') return 'tag tag--info';
  return 'tag tag--warn';
}

function laneCopy(lane: ReleaseLane): string {
  if (lane === 'released') return 'Released';
  if (lane === 'releasing') return 'In release';
  return 'Planned';
}

function componentName(components: Component[], id: number | null): string | null {
  if (id == null) return null;
  return components.find((c) => c.id === id)?.name ?? null;
}

function dateHuman(iso: string | null): string {
  if (!iso) return 'no target date';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function daysLabel(days: number | null): string {
  if (days == null) return '';
  if (days === 0) return 'today';
  if (days > 0) return `${days}d to go`;
  return `${Math.abs(days)}d late`;
}

async function IssueRow({
  item,
  components,
  compact = false,
}: {
  item: VersionIssue;
  components: Component[];
  compact?: boolean;
}) {
  const type = item.type as IssueType;
  const status = item.status as IssueStatus;
  const cname = componentName(components, item.componentId);
  const inner = (
    <span className={`rel-issue${compact ? ' rel-issue--compact' : ''}`}>
      <span className={tagForType(type)}>{TYPE_LABEL[type] ?? item.type}</span>
      <span className="rel-issue-key">{item.key}</span>
      <span className="rel-issue-sum">{item.summary}</span>
      <span className={tagForStatus(status)}>{STATUS_LABEL[status] ?? item.status}</span>
      {cname && !compact ? <span className="rel-issue-cmp">{cname}</span> : null}
    </span>
  );
  const full = await getIssue(item.key);
  const preview = full ? await toIssuePreview(full) : undefined;
  if (preview) {
    return (
      <IssueHoverCard issueKey={item.key} preview={preview}>
        <span className="rel-issue-link">{inner}</span>
      </IssueHoverCard>
    );
  }
  return (
    <Link href={`/issues/${item.key}`} className="rel-issue-link">
      {inner}
    </Link>
  );
}

/* ───────────────────────────────────────────────────────────── Kanban ── */

function ProgressBar({ s }: { s: VersionSummary }) {
  const total = Math.max(1, s.total);
  const donePct = (s.done / total) * 100;
  const ipPct = ((s.inProgress + s.inReview) / total) * 100;
  const todoPct = Math.max(0, 100 - donePct - ipPct);
  return (
    <div className="rel-pbar" aria-label={`${s.done} done, ${s.inProgress + s.inReview} active, ${s.todo} to do`}>
      {donePct > 0 ? <div className="rel-pseg rel-pseg--done" style={{ width: `${donePct}%` }} /> : null}
      {ipPct > 0 ? <div className="rel-pseg rel-pseg--ip" style={{ width: `${ipPct}%` }} /> : null}
      {todoPct > 0 ? <div className="rel-pseg rel-pseg--todo" style={{ width: `${todoPct}%` }} /> : null}
    </div>
  );
}

function Breakdown({ s }: { s: VersionSummary }) {
  const items: Array<[string, number | string, string?]> = [
    [`${s.total === 1 ? 'issue' : 'issues'}`, s.total],
  ];
  if (s.done) items.push(['done', s.done, 'ok']);
  const active = s.inProgress + s.inReview;
  if (active) items.push(['active', active, 'info']);
  if (s.todo) items.push(['todo', s.todo]);
  if (s.points) items.push(['pts', s.points]);
  if (s.blockers) items.push([s.blockers === 1 ? 'bug' : 'bugs', s.blockers, 'err']);
  if (s.leadDays != null) items.push([`lead ${s.leadDays}d`, '']);
  return (
    <div className="rel-breakdown">
      {items.map(([label, value, tone], idx) => (
        <span key={idx} className={tone ? `rel-breakdown-item rel-tone-${tone}` : 'rel-breakdown-item'}>
          {value !== '' ? <strong>{value}</strong> : null}
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

function KanbanCard({
  s,
  canWrite,
}: {
  s: VersionSummary;
  canWrite: boolean;
}) {
  const date = s.version.releaseDate;
  const dateCopy = date ? dateShort(date) : 'no date';
  const daysCopy = s.daysToTarget != null && !s.version.released ? daysLabel(s.daysToTarget) : '';

  return (
    <article className={`rel-card rel-card--${s.lane}`}>
      <header className="rel-card-head">
        <span className="rel-card-ver">{s.version.name}</span>
        <span className={laneTag(s.lane)}>{laneCopy(s.lane)}</span>
        <span className="rel-card-date">
          {s.lane === 'released' ? 'shipped' : 'target'} · {dateCopy}
          {daysCopy ? ` · ${daysCopy}` : ''}
        </span>
      </header>
      <div className="rel-card-body">
        <ProgressBar s={s} />
        <Breakdown s={s} />
        {s.components.length > 0 ? (
          <div className="rel-components">
            {s.components.map((c) => (
              <span key={c.id} className="rel-chip">
                {c.name}
              </span>
            ))}
          </div>
        ) : null}
        {s.blockers > 0 ? (
          <div className="rel-checks">
            <span className="rel-check rel-check--fail">
              <span className="rel-check-mark">✕</span> {s.blockers} open bug{s.blockers === 1 ? '' : 's'}
            </span>
          </div>
        ) : null}
      </div>
      <footer className="rel-card-foot">
        {s.version.released ? (
          <>
            <span className="rel-card-note">
              <Link href={`/issues?view=list&version=${s.version.id}`}>v{s.version.name} notes ↗</Link>
            </span>
            {canWrite ? (
              <form action={unmarkVersionReleasedAction}>
                <input type="hidden" name="version" value={s.version.id} />
                <input type="hidden" name="next" value="/releases?view=kanban" />
                <button type="submit" className="rel-btn rel-btn--ghost">
                  Reopen
                </button>
              </form>
            ) : null}
          </>
        ) : s.lane === 'releasing' ? (
          <>
            <span className="rel-card-note">
              {s.total === 0
                ? 'No scope yet'
                : s.done === s.total
                  ? 'Scope complete — ready to ship'
                  : `${s.total - s.done} issue${s.total - s.done === 1 ? '' : 's'} open`}
            </span>
            {canWrite ? (
              <form action={markVersionReleasedAction}>
                <input type="hidden" name="version" value={s.version.id} />
                <input type="hidden" name="next" value="/releases?view=kanban" />
                <button type="submit" className="rel-btn rel-btn--primary">
                  Mark released ▸
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <>
            <span className="rel-card-note">
              {s.version.releaseDate ? `Planned for ${dateHuman(s.version.releaseDate)}` : 'Needs target date'}
            </span>
            {canWrite ? (
              <form action={startVersionReleaseAction}>
                <input type="hidden" name="version" value={s.version.id} />
                <input type="hidden" name="next" value="/releases?view=kanban" />
                <button
                  type="submit"
                  className="rel-btn"
                  disabled={s.total === 0}
                  title={s.total === 0 ? 'Add scope first' : 'Move to Releasing (sets target to today)'}
                >
                  Start release
                </button>
              </form>
            ) : null}
          </>
        )}
      </footer>
    </article>
  );
}

async function KanbanView({
  summaries,
  components,
  unscheduled,
  canWrite,
}: {
  summaries: VersionSummary[];
  components: Component[];
  unscheduled: VersionIssue[];
  canWrite: boolean;
}) {
  const laneMap: Record<ReleaseLane, VersionSummary[]> = {
    unreleased: [],
    releasing: [],
    released: [],
  };
  for (const summary of summaries) laneMap[summary.lane].push(summary);
  // Sort each lane for readability.
  laneMap.unreleased.sort((a, b) => (a.version.releaseDate ?? 'zzzz').localeCompare(b.version.releaseDate ?? 'zzzz') || a.version.name.localeCompare(b.version.name));
  laneMap.releasing.sort((a, b) => (a.version.releaseDate ?? '').localeCompare(b.version.releaseDate ?? ''));
  laneMap.released.sort((a, b) => (b.version.releaseDate ?? '').localeCompare(a.version.releaseDate ?? ''));

  const releasingCount = laneMap.releasing.length;

  return (
    <div className="rel-stack">
      <div className="rel-toolbar">
        <div className="rel-seg">
          <span className="rel-seg-btn is-on">Active</span>
          <span className="rel-seg-btn is-muted">All time</span>
        </div>
        <span className="rel-toolbar-spacer" />
        <span className="rel-toolbar-note">
          WIP in Releasing:{' '}
          <strong className={releasingCount > 2 ? 'rel-tone-err' : ''}>{releasingCount}</strong> / 2
        </span>
      </div>

      <div className="rel-board">
        {LANE_ORDER.map((lane) => (
          <section key={lane} className={`rel-col rel-col--${lane}`}>
            <header className="rel-col-head">
              <h3>{LANE_LABEL[lane]}</h3>
              <span className="rel-col-count">{laneMap[lane].length}</span>
            </header>
            <div className="rel-col-body">
              {laneMap[lane].length === 0 ? (
                <p className="rel-col-empty">
                  {lane === 'releasing'
                    ? 'Nothing shipping this week. Start a release from Unreleased.'
                    : lane === 'released'
                      ? 'No shipped versions yet.'
                      : 'All versions are in flight or shipped.'}
                </p>
              ) : null}
              {laneMap[lane].map((s) => (
                <KanbanCard key={s.version.id} s={s} canWrite={canWrite} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {unscheduled.length > 0 ? (
        <section className="rel-panel">
          <header className="rel-panel-head">
            <h3>Unscheduled issues</h3>
            <span className="rel-panel-count">{unscheduled.length}</span>
          </header>
          <div className="rel-panel-body rel-issue-list">
            {unscheduled.map((item) => (
              <IssueRow key={item.key} item={item} components={components} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────── Changelog Wall ── */

function stateClass(lane: ReleaseLane): string {
  if (lane === 'released') return 'rel-cl-state rel-cl-state--released';
  if (lane === 'releasing') return 'rel-cl-state rel-cl-state--releasing';
  return 'rel-cl-state rel-cl-state--planned';
}

function groupByComponent(
  issues: VersionIssue[],
  components: Component[],
): Array<{ key: string; label: string; items: VersionIssue[] }> {
  const groups = new Map<string, { label: string; items: VersionIssue[] }>();
  for (const item of issues) {
    const name = componentName(components, item.componentId) ?? 'Other';
    const key = String(item.componentId ?? 'other');
    const entry = groups.get(key) ?? { label: name, items: [] };
    entry.items.push(item);
    groups.set(key, entry);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([key, g]) => ({ key, label: g.label, items: g.items }));
}

async function ChangelogView({
  summaries,
  components,
  todayIso,
}: {
  summaries: VersionSummary[];
  components: Component[];
  todayIso: string;
}) {
  // Chronological: unscheduled/planned first, then today, then shipped (newest first).
  const sorted = [...summaries].sort((a, b) => {
    const aKey = a.version.released ? `R${a.version.releaseDate ?? ''}` : `U${a.version.releaseDate ?? '9999'}`;
    const bKey = b.version.released ? `R${b.version.releaseDate ?? ''}` : `U${b.version.releaseDate ?? '9999'}`;
    // Unreleased sorted ascending by target date, released sorted descending (newest first).
    if (a.version.released && b.version.released) return bKey.localeCompare(aKey);
    if (!a.version.released && !b.version.released) return (a.version.releaseDate ?? '9999').localeCompare(b.version.releaseDate ?? '9999');
    return a.version.released ? 1 : -1;
  });

  const todayLabel = new Date(`${todayIso}T00:00:00`).toLocaleDateString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Mark the first entry whose releaseDate === todayIso (or first unreleased) as "current".
  let currentIdx = sorted.findIndex((s) => s.version.releaseDate === todayIso);
  if (currentIdx === -1) currentIdx = sorted.findIndex((s) => s.lane === 'releasing');
  if (currentIdx === -1) currentIdx = sorted.findIndex((s) => s.lane === 'unreleased');

  return (
    <div className="rel-stack">
      <div className="rel-toolbar">
        <div className="rel-seg">
          <span className="rel-seg-btn is-on">Newest first</span>
          <span className="rel-seg-btn is-muted">Oldest first</span>
        </div>
        <span className="rel-chip is-on">All versions</span>
        <span className="rel-toolbar-spacer" />
        <span className="rel-toolbar-note">Today · {todayLabel}</span>
      </div>

      <div className="rel-cl-shell">
        <aside className="rel-cl-rail">
          <h4>Versions</h4>
          {sorted.length === 0 ? <p className="rel-cl-empty">No versions yet.</p> : null}
          {sorted.map((s, idx) => (
            <a
              key={s.version.id}
              href={`#v-${s.version.id}`}
              className={`rel-cl-rail-item rel-cl-rail-item--${s.lane}${idx === currentIdx ? ' is-current' : ''}`}
            >
              <span className="rel-cl-dot" aria-hidden />
              <span className="rel-cl-rail-name">{s.version.name}</span>
              <span className="rel-cl-rail-d">
                {s.version.releaseDate === todayIso
                  ? 'today'
                  : s.version.released
                    ? dateShort(s.version.releaseDate)
                    : s.version.releaseDate
                      ? dateShort(s.version.releaseDate)
                      : 'draft'}
              </span>
            </a>
          ))}
        </aside>

        <div className="rel-cl-feed">
          <div className="rel-cl-today">
            <span>▼ Today · {todayLabel}</span>
          </div>

          {sorted.length === 0 ? (
            <p className="muted">Create your first version to start a changelog.</p>
          ) : null}

          {sorted.map((s) => {
            const groups = groupByComponent(s.issues, components);
            const total = Math.max(1, s.total);
            const donePct = Math.round((s.done / total) * 100);
            return (
              <article key={s.version.id} id={`v-${s.version.id}`} className="rel-cl-entry">
                <div className="rel-cl-meta">
                  <div className="rel-cl-big-ver">{s.version.name}</div>
                  <div className="rel-cl-date">
                    {s.version.released
                      ? `Released ${dateHuman(s.version.releaseDate)}`
                      : s.version.releaseDate
                        ? `Target ${dateHuman(s.version.releaseDate)}`
                        : 'No target date'}
                  </div>
                  <span className={stateClass(s.lane)}>{LANE_LABEL[s.lane]}</span>
                  {s.components.length > 0 ? (
                    <div className="rel-cl-cmps">
                      {s.components.map((c) => (
                        <span key={c.id} className="rel-chip">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="rel-cl-body">
                  <h3 className="rel-cl-title">
                    {s.lane === 'released'
                      ? `Shipped — ${s.total} issue${s.total === 1 ? '' : 's'}`
                      : s.lane === 'releasing'
                        ? `In release — ${s.done}/${s.total} done`
                        : `Planned — ${s.total} issue${s.total === 1 ? '' : 's'}`}
                  </h3>
                  {!s.version.released && s.total > 0 ? (
                    <div className="rel-cl-progress">
                      <div className="rel-cl-progress-track">
                        <div className="rel-cl-progress-fill" style={{ width: `${donePct}%` }} />
                      </div>
                      <span className="rel-cl-progress-n">
                        {donePct}% · {s.done} / {s.total} done
                      </span>
                    </div>
                  ) : null}

                  {groups.length === 0 ? (
                    <p className="rel-cl-empty">No issues on this version yet.</p>
                  ) : (
                    groups.map((group) => (
                      <div key={group.key} className="rel-cl-group">
                        <h5>{group.label}</h5>
                        <div className="rel-cl-group-list">
                          {group.items.map((item) => (
                            <IssueRow key={item.key} item={item} components={components} compact />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── Page ── */

export default async function ReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const me = await currentUser();
  const site = await currentSite();
  const project = await currentProject();
  if (!(await canBrowseIssues(me, project.key))) redirect('/issues');
  const canWrite = await canWriteIssues(me, project.key);

  const params = await searchParams;
  const requested = params.view === 'changelog' ? 'changelog' : 'kanban';
  const view: View = requested;

  const projects = await listProjects(site.id);
  const today = new Date();
  const { components, summaries } = await summarizeAllVersions(project.id, today);
  const unscheduled = await listUnscheduledIssues(project.id);

  const todayIso = isoDate(today);
  const horizonIso = isoDate(addDays(today, 7));

  // Topline stats for the page head.
  const releasingNow = summaries.filter((s) => s.lane === 'releasing').length;
  const shippedCount = summaries.filter((s) => s.lane === 'released').length;
  const planned = summaries.filter((s) => s.lane === 'unreleased').length;

  return (
    <main className="page rel-page rel-page--atelier">
      <header className="rel-bar">
        <div className="rel-bar-left">
          <span className="rel-bar-kicker">Releases</span>
          <h1 className="rel-bar-title">{project.key}</h1>
          <span className="rel-bar-meta">
            <span className="rel-tone-info">{releasingNow} releasing</span>
            <span aria-hidden>·</span>
            <span className="rel-tone-ok">{shippedCount} shipped</span>
            <span aria-hidden>·</span>
            <span>{planned} planned</span>
            {components.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{components.map((c) => c.name).join(', ')}</span>
              </>
            ) : null}
          </span>
        </div>
        <div className="rel-bar-right">
          <ProjectSwitch
            projects={projects.map((item) => ({ key: item.key, name: item.name }))}
            value={project.key}
            next="/releases"
          />
          <nav className="rel-view-toggle" aria-label="View">
            <Link
              href="/releases?view=kanban"
              className={`rel-view-btn${view === 'kanban' ? ' is-on' : ''}`}
              aria-current={view === 'kanban' ? 'page' : undefined}
            >
              Kanban
            </Link>
            <Link
              href="/releases?view=changelog"
              className={`rel-view-btn${view === 'changelog' ? ' is-on' : ''}`}
              aria-current={view === 'changelog' ? 'page' : undefined}
            >
              Changelog
            </Link>
          </nav>
        </div>
      </header>

        {summaries.length === 0 ? (
          <section className="rel-panel">
            <div className="rel-panel-body">
              <p className="muted">
                No versions in <strong>{project.key}</strong> yet. Create one from Project
                settings to start a release.
              </p>
            </div>
          </section>
        ) : view === 'kanban' ? (
          <KanbanView
            summaries={summaries}
            components={components}
            unscheduled={unscheduled}
            canWrite={canWrite}
          />
        ) : (
          <ChangelogView summaries={summaries} components={components} todayIso={todayIso} />
        )}

        <section className="rel-mapping">
          <h4>Lane mapping</h4>
          <ul>
            <li>
              <span className="tag tag--ok">Released</span> <code>released = true</code>
            </li>
            <li>
              <span className="tag tag--info">Releasing</span> <code>!released</code> AND{' '}
              <code>release_date</code> within the last 60 days or next 7 days (through{' '}
              <code>{horizonIso}</code>) — or no date but issues are in progress.
            </li>
            <li>
              <span className="tag tag--warn">Unreleased</span> everything else (no target date, or far
              future).
            </li>
          </ul>
        </section>
    </main>
  );
}
