import Link from 'next/link';
import { notFound } from 'next/navigation';
import { removeGadgetAction } from '@/app/dashboards/actions';
import { DashboardDrawer, type DrawerGadget } from '@/components/DashboardDrawer';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import {
  canEditDashboard,
  dashboardDisplayDescription,
  dashboardTemplate,
  GADGET_TYPE_CATEGORY,
  GADGET_TYPE_HELP,
  GADGET_TYPE_LABEL,
  GADGET_TYPES,
  getDashboard,
  isProtectedDashboard,
  listGadgets,
  resolveGadget,
  type DashboardGadget,
  type GadgetPayload,
  type MyOpenIssuesPayload,
  type MyDueSoonPayload,
  type MyMentionsPayload,
  type SprintBlockersPayload,
  type SprintBurndownPayload,
  type SprintCommitmentPayload,
} from '@/lib/dashboards';
import { feedLine } from '@/lib/feed';
import { formatWhen, STATUS_LABEL, STATUSES, tagForStatus } from '@/lib/format';
import { HELPDESK_STATUS_LABEL, tagForHelpdeskStatus } from '@/lib/helpdesk';
import { currentProject, currentSite, currentUser } from '@/lib/session';
import type { IssueStatus } from '@/lib/types';

type Resolved = { gadget: DashboardGadget; data: GadgetPayload };

export default async function DashboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const dash = await getDashboard(id);
  if (!dash) notFound();

  const user = await currentUser();
  const project = await currentProject();
  const site = await currentSite();
  const editable = canEditDashboard(dash, user.id, user.role);
  const protectedBoard = isProtectedDashboard(dash);
  const canMutateGadgets = editable && !protectedBoard;
  const gadgets = await listGadgets(id);
  const resolved = await Promise.all(
    gadgets.map(async (gadget) => ({
      gadget,
      data: await resolveGadget(gadget, {
        userId: user.id,
        projectKey: project.key,
        siteId: site.id,
      }),
    })),
  );

  const template = dashboardTemplate(dash);
  const scopeLabel =
    template === 'sprint'
      ? 'Sprint desk'
      : template === 'ops'
        ? 'Ops desk'
        : template === 'personal'
          ? 'Personal'
          : 'Custom';
  const description = dashboardDisplayDescription(dash);
  const tone = template === 'ops' ? 'ops' : template === 'sprint' ? 'sprint' : 'custom';

  const drawerGadgets: DrawerGadget[] = GADGET_TYPES.map((type) => ({
    type,
    label: GADGET_TYPE_LABEL[type],
    help: GADGET_TYPE_HELP[type],
    category: GADGET_TYPE_CATEGORY[type],
  }));

  return (
    <main className={`page ddesk-page ddesk-page--${tone}`}>
      <div className="ddesk-atmosphere" aria-hidden="true" />
      <header className="ddesk-bar">
        <div className="ddesk-bar-left">
          <Link className="ddesk-back" href="/dashboards">
            ← Boards
          </Link>
          <span className={`ddesk-kicker ddesk-kicker--${tone}`}>{scopeLabel}</span>
          <h1 className="ddesk-title">{dash.name}</h1>
          <span className="ddesk-meta">
            {description || 'Dashboard gadgets'}
            <span className="ddesk-dot" aria-hidden="true">
              ·
            </span>
            {gadgets.length} gadget{gadgets.length === 1 ? '' : 's'}
            {protectedBoard ? (
              <>
                <span className="ddesk-dot" aria-hidden="true">
                  ·
                </span>
                <span className="ddesk-lock">locked</span>
              </>
            ) : null}
          </span>
        </div>
        {editable && !protectedBoard ? (
          <div className="ddesk-bar-right">
            <DashboardDrawer
              dashboardId={dash.id}
              projectKey={project.key}
              gadgets={drawerGadgets}
            />
          </div>
        ) : null}
      </header>

      {resolved.length === 0 ? (
        editable ? (
          <section className="ddesk-empty">
            <p className="ddesk-empty-eyebrow">Empty</p>
            <h2 className="ddesk-empty-title">No gadgets yet</h2>
            <p className="ddesk-empty-hint">Pick a gadget type from the drawer.</p>
            <DashboardDrawer
              dashboardId={dash.id}
              projectKey={project.key}
              gadgets={drawerGadgets}
            />
          </section>
        ) : (
          <p className="empty-hint">This dashboard has no gadgets.</p>
        )
      ) : template === 'sprint' ? (
        <SprintDesk
          resolved={resolved}
          editable={canMutateGadgets}
          dashId={dash.id}
        />
      ) : template === 'ops' ? (
        <OpsDesk resolved={resolved} editable={canMutateGadgets} dashId={dash.id} />
      ) : (
        <div className="ddesk-grid">
          {resolved.map(({ gadget, data }, i) => (
            <GadgetCard
              key={gadget.id}
              gadget={gadget}
              data={data}
              editable={canMutateGadgets}
              dashId={dash.id}
              index={i}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function takeKind(resolved: Resolved[], kind: GadgetPayload['kind']): Resolved | undefined {
  return resolved.find((r) => r.data.kind === kind);
}

function leftovers(resolved: Resolved[], used: Set<number>): Resolved[] {
  return resolved.filter((r) => !used.has(r.gadget.id));
}

function SprintDesk({
  resolved,
  editable,
  dashId,
}: {
  resolved: Resolved[];
  editable: boolean;
  dashId: number;
}) {
  const burndown = takeKind(resolved, 'sprint_burndown');
  const commitment = takeKind(resolved, 'sprint_commitment');
  const blockers = takeKind(resolved, 'sprint_blockers');
  const status = takeKind(resolved, 'status_breakdown');
  const used = new Set(
    [burndown, commitment, blockers, status]
      .filter(Boolean)
      .map((r) => r!.gadget.id),
  );
  const extra = leftovers(resolved, used);

  const burn = burndown?.data.kind === 'sprint_burndown' ? burndown.data : null;
  const commit = commitment?.data.kind === 'sprint_commitment' ? commitment.data : null;
  const block = blockers?.data.kind === 'sprint_blockers' ? blockers.data : null;
  const ptsPct =
    commit && commit.committedPoints > 0
      ? Math.round((commit.donePoints / commit.committedPoints) * 100)
      : 0;

  return (
    <div className="ddesk-sprint">
      <section className="ddesk-kpi" aria-label="Sprint pulse">
        <article className="ddesk-kpi-card ddesk-kpi-card--pts ddesk-reveal" style={{ ['--d' as string]: '0' }}>
          <span className="ddesk-kpi-label">Points left</span>
          <strong className="ddesk-kpi-value">
            {burn ? burn.remainingPoints : '—'}
            <span className="ddesk-kpi-den">/{burn ? burn.totalPoints : '—'}</span>
          </strong>
          <span className="ddesk-kpi-sub">{burn?.sprint?.name ?? 'No active sprint'}</span>
        </article>
        <article className="ddesk-kpi-card ddesk-kpi-card--commit ddesk-reveal" style={{ ['--d' as string]: '1' }}>
          <span className="ddesk-kpi-label">Delivered</span>
          <strong className="ddesk-kpi-value">
            {ptsPct}
            <span className="ddesk-kpi-unit">%</span>
          </strong>
          <span className="ddesk-kpi-sub">
            {commit ? `${commit.donePoints} of ${commit.committedPoints} pts` : '—'}
          </span>
          <div className="ddesk-kpi-meter" aria-hidden="true">
            <div className="ddesk-kpi-meter-fill" style={{ width: `${Math.min(100, ptsPct)}%` }} />
          </div>
        </article>
        <article
          className={`ddesk-kpi-card ddesk-kpi-card--block ddesk-reveal${block && block.items.length ? ' is-hot' : ''}`}
          style={{ ['--d' as string]: '2' }}
        >
          <span className="ddesk-kpi-label">Blockers</span>
          <strong className="ddesk-kpi-value">{block ? block.items.length : '—'}</strong>
          <span className="ddesk-kpi-sub">
            {block && block.items.length === 0 ? 'Clear runway' : 'Need eyes'}
          </span>
        </article>
        <article className="ddesk-kpi-card ddesk-kpi-card--mix ddesk-reveal" style={{ ['--d' as string]: '3' }}>
          <span className="ddesk-kpi-label">In flight</span>
          <strong className="ddesk-kpi-value">
            {status && status.data.kind === 'status_breakdown' ? status.data.total : '—'}
          </strong>
          <span className="ddesk-kpi-sub">issues in project</span>
        </article>
      </section>

      <div className="ddesk-sprint-main">
        {burndown ? (
          <GadgetCard
            gadget={burndown.gadget}
            data={burndown.data}
            editable={editable}
            dashId={dashId}
            index={0}
            variant="hero"
            className="ddesk-span-burn"
          />
        ) : null}
        {commitment ? (
          <GadgetCard
            gadget={commitment.gadget}
            data={commitment.data}
            editable={editable}
            dashId={dashId}
            index={1}
            variant="accent"
          />
        ) : null}
        {blockers ? (
          <GadgetCard
            gadget={blockers.gadget}
            data={blockers.data}
            editable={editable}
            dashId={dashId}
            index={2}
            variant={block && block.items.length ? 'warn' : 'calm'}
          />
        ) : null}
        {status ? (
          <GadgetCard
            gadget={status.gadget}
            data={status.data}
            editable={editable}
            dashId={dashId}
            index={3}
            variant="wide"
            className="ddesk-span-full"
          />
        ) : null}
      </div>

      {extra.length ? (
        <div className="ddesk-grid ddesk-grid--extra">
          {extra.map((r, i) => (
            <GadgetCard
              key={r.gadget.id}
              gadget={r.gadget}
              data={r.data}
              editable={editable}
              dashId={dashId}
              index={i + 4}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OpsDesk({
  resolved,
  editable,
  dashId,
}: {
  resolved: Resolved[];
  editable: boolean;
  dashId: number;
}) {
  const count = takeKind(resolved, 'jql_count');
  const status = takeKind(resolved, 'status_breakdown');
  const activity = takeKind(resolved, 'recent_activity');
  const sla = takeKind(resolved, 'sla_breached');
  const used = new Set(
    [count, status, activity, sla].filter(Boolean).map((r) => r!.gadget.id),
  );
  const extra = leftovers(resolved, used);

  const openN = count?.data.kind === 'jql_count' ? count.data.count : null;
  const slaN = sla?.data.kind === 'sla_breached' ? sla.data.count : null;
  const total = status?.data.kind === 'status_breakdown' ? status.data.total : null;

  return (
    <div className="ddesk-ops">
      <section className="ddesk-kpi ddesk-kpi--ops" aria-label="Ops pulse">
        <article className="ddesk-kpi-card ddesk-kpi-card--open ddesk-reveal" style={{ ['--d' as string]: '0' }}>
          <span className="ddesk-kpi-label">Open issues</span>
          <strong className="ddesk-kpi-value">{openN ?? '—'}</strong>
          <span className="ddesk-kpi-sub">live QQL count</span>
        </article>
        <article
          className={`ddesk-kpi-card ddesk-kpi-card--sla ddesk-reveal${slaN && slaN > 0 ? ' is-hot' : ''}`}
          style={{ ['--d' as string]: '1' }}
        >
          <span className="ddesk-kpi-label">SLA breached</span>
          <strong className="ddesk-kpi-value">{slaN ?? '—'}</strong>
          <span className="ddesk-kpi-sub">{slaN === 0 ? 'All clear' : 'Escalate'}</span>
        </article>
        <article className="ddesk-kpi-card ddesk-kpi-card--proj ddesk-reveal" style={{ ['--d' as string]: '2' }}>
          <span className="ddesk-kpi-label">Project load</span>
          <strong className="ddesk-kpi-value">{total ?? '—'}</strong>
          <span className="ddesk-kpi-sub">issues total</span>
        </article>
      </section>

      <div className="ddesk-ops-main">
        {status ? (
          <GadgetCard
            gadget={status.gadget}
            data={status.data}
            editable={editable}
            dashId={dashId}
            index={0}
            variant="wide"
            className="ddesk-span-status"
          />
        ) : count ? (
          <GadgetCard
            gadget={count.gadget}
            data={count.data}
            editable={editable}
            dashId={dashId}
            index={0}
            variant="stat"
            className="ddesk-span-status"
          />
        ) : null}
        {activity ? (
          <GadgetCard
            gadget={activity.gadget}
            data={activity.data}
            editable={editable}
            dashId={dashId}
            index={1}
            variant="feed"
          />
        ) : null}
        {sla ? (
          <GadgetCard
            gadget={sla.gadget}
            data={sla.data}
            editable={editable}
            dashId={dashId}
            index={2}
            variant={slaN && slaN > 0 ? 'warn' : 'calm'}
          />
        ) : null}
      </div>

      {extra.length ? (
        <div className="ddesk-grid ddesk-grid--extra">
          {extra.map((r, i) => (
            <GadgetCard
              key={r.gadget.id}
              gadget={r.gadget}
              data={r.data}
              editable={editable}
              dashId={dashId}
              index={i + 4}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GadgetCard({
  gadget,
  data,
  editable,
  dashId,
  index = 0,
  variant = 'default',
  className = '',
}: {
  gadget: DashboardGadget;
  data: GadgetPayload;
  editable: boolean;
  dashId: number;
  index?: number;
  variant?: 'default' | 'hero' | 'accent' | 'warn' | 'calm' | 'wide' | 'stat' | 'feed';
  className?: string;
}) {
  return (
    <section
      className={`ddesk-gadget ddesk-gadget--${variant} ddesk-reveal ${className}`.trim()}
      style={{ ['--d' as string]: String(index) }}
    >
      <header className="ddesk-gadget-head">
        <div className="ddesk-gadget-titles">
          <h2 className="ddesk-gadget-title">{data.title}</h2>
          <span className="ddesk-gadget-type">{GADGET_TYPE_LABEL[gadget.type]}</span>
        </div>
        {editable ? (
          <form action={removeGadgetAction}>
            <input type="hidden" name="dashboard_id" value={dashId} />
            <input type="hidden" name="gadget_id" value={gadget.id} />
            <button type="submit" className="btn-secondary ddesk-gadget-remove">
              Remove
            </button>
          </form>
        ) : null}
      </header>
      <div className="ddesk-gadget-body">
        <GadgetBody data={data} />
      </div>
    </section>
  );
}

function GadgetBody({ data }: { data: GadgetPayload }) {
  if (data.kind === 'jql_count') {
    return (
      <div className="ddesk-stat-block">
        <div className={`ddesk-stat-num${data.error ? ' is-err' : ''}`}>{data.count}</div>
        {data.error ? (
          <p className="muted">QQL error: {data.error}</p>
        ) : (
          <p className="ddesk-stat-qql">
            <code>{data.jql}</code>
          </p>
        )}
        <Link className="ddesk-stat-link" href={`/issues?jql=${encodeURIComponent(data.jql)}`}>
          Open in Filters →
        </Link>
      </div>
    );
  }

  if (data.kind === 'status_breakdown') {
    return <StatusMix data={data} />;
  }

  if (data.kind === 'recent_activity') {
    if (data.items.length === 0) {
      return <p className="muted">No recent activity in {data.projectKey}.</p>;
    }
    return (
      <ul className="ddesk-feed">
        {data.items.map((item) => (
          <li key={item.id} className="ddesk-feed-row">
            <div className="ddesk-feed-meta">
              <IssueHoverCard issueKey={item.issueKey} className="key">
                {item.issueKey}
              </IssueHoverCard>
              <span className="muted">{item.authorName ?? 'System'}</span>
              <span className="muted">{formatWhen(item.createdAt)}</span>
            </div>
            <div className="ddesk-feed-body">{feedLine(item.kind, item.detail)}</div>
          </li>
        ))}
      </ul>
    );
  }

  if (data.kind === 'sla_breached') {
    return (
      <div className="ddesk-sla">
        <div className={`ddesk-stat-num${data.count > 0 ? ' is-warn' : ' is-ok'}`}>{data.count}</div>
        {data.tickets.length === 0 ? (
          <p className="muted">No breached tickets.</p>
        ) : (
          <ul className="ddesk-sla-list">
            {data.tickets.map((ticket) => (
              <li key={ticket.key}>
                <Link className="key" href={`/helpdesk/${ticket.key}`}>
                  {ticket.key}
                </Link>
                <span className={tagForHelpdeskStatus(ticket.status)}>
                  {HELPDESK_STATUS_LABEL[ticket.status]}
                </span>
                <span className="ddesk-sla-sum">{ticket.summary}</span>
              </li>
            ))}
          </ul>
        )}
        <Link className="ddesk-stat-link" href="/helpdesk/sla">
          Full SLA report →
        </Link>
      </div>
    );
  }

  if (data.kind === 'my_open_issues') {
    return <MyWorkList data={data} emptyMessage="No open work assigned to you." />;
  }

  if (data.kind === 'my_due_soon') {
    return (
      <MyWorkList
        data={data}
        emptyMessage={`No work due in the next ${data.windowDays} days.`}
        showDue
      />
    );
  }

  if (data.kind === 'my_mentions') {
    return <MentionsList data={data} />;
  }

  if (data.kind === 'sprint_burndown') {
    return <Burndown data={data} />;
  }

  if (data.kind === 'sprint_commitment') {
    return <Commitment data={data} />;
  }

  return <Blockers data={data} />;
}

function StatusMix({
  data,
}: {
  data: Extract<GadgetPayload, { kind: 'status_breakdown' }>;
}) {
  const total = data.total || 1;
  return (
    <div className="ddesk-mix">
      <p className="ddesk-mix-lede">
        {data.projectKey} · {data.total} issue{data.total === 1 ? '' : 's'}
      </p>
      <div className="ddesk-mix-stack" role="img" aria-label="Issue mix by status">
        {STATUSES.map((status) => {
          const n = data.counts[status as IssueStatus];
          if (!n) return null;
          const pct = (n / total) * 100;
          return (
            <div
              key={status}
              className={`ddesk-mix-seg ddesk-mix-seg--${status}`}
              style={{ width: `${pct}%` }}
              title={`${STATUS_LABEL[status]}: ${n}`}
            />
          );
        })}
      </div>
      <div className="ddesk-mix-rows">
        {STATUSES.map((status) => {
          const n = data.counts[status as IssueStatus];
          const pct = Math.round((n / total) * 100);
          return (
            <div key={status} className="ddesk-mix-row">
              <span className={`ddesk-mix-dot ddesk-mix-dot--${status}`} />
              <span className="ddesk-mix-label">{STATUS_LABEL[status]}</span>
              <span className="ddesk-mix-bar">
                <span
                  className={`ddesk-mix-fill ddesk-mix-fill--${status}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="ddesk-mix-n">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyWorkList({
  data,
  emptyMessage,
  showDue = false,
}: {
  data: MyOpenIssuesPayload | MyDueSoonPayload;
  emptyMessage: string;
  showDue?: boolean;
}) {
  if (data.items.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }
  return (
    <ul className="dash-work-list">
      {data.items.map((issue) => (
        <li key={issue.id} className="dash-work-row">
          <IssueHoverCard issueKey={issue.key} className="key">
            {issue.key}
          </IssueHoverCard>
          <span className={tagForStatus(issue.status)}>{STATUS_LABEL[issue.status]}</span>
          <span className="dash-work-sum">{issue.summary}</span>
          {showDue ? (
            <span className="dash-work-due">{issue.dueOn ?? ''}</span>
          ) : (
            <span className="dash-work-pts">
              {issue.points != null ? `${issue.points} pts` : ''}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function MentionsList({ data }: { data: MyMentionsPayload }) {
  if (data.items.length === 0) {
    return <p className="muted">No mentions yet.</p>;
  }
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        {data.unread} unread · {data.items.length} total
      </p>
      <ul className="dash-mention-list">
        {data.items.map((notification) => (
          <li
            key={notification.id}
            className={`dash-mention${notification.readAt == null ? ' is-unread' : ''}`}
          >
            <div className="dash-mention-body">
              <strong>{notification.title}</strong>
              {notification.body ? <p className="muted">{notification.body}</p> : null}
            </div>
            <span className="muted dash-mention-when">{formatWhen(notification.createdAt)}</span>
            {notification.href ? (
              <Link className="dash-mention-link" href={notification.href}>
                Open
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function Burndown({ data }: { data: SprintBurndownPayload }) {
  if (!data.sprint) {
    return <p className="muted">No active sprint in {data.projectKey}.</p>;
  }
  const w = 560;
  const h = 160;
  const pad = 8;
  const peak = Math.max(data.totalPoints, 1);
  const toX = (i: number) =>
    data.days.length <= 1 ? pad : pad + (i * (w - pad * 2)) / (data.days.length - 1);
  const toY = (val: number) => pad + (h - pad * 2) - (val / peak) * (h - pad * 2);
  const idealPts = data.days.map((d, i) => `${toX(i)},${toY(d.ideal)}`).join(' ');
  const realPts = data.days.map((d, i) => `${toX(i)},${toY(d.remaining)}`).join(' ');
  const areaPts =
    data.days.length > 0
      ? `${toX(0)},${toY(0)} ${realPts} ${toX(data.days.length - 1)},${toY(0)}`
      : '';
  const last = data.days[data.days.length - 1];

  return (
    <div className="ddesk-burn">
      <div className="ddesk-burn-head">
        <div>
          <strong className="ddesk-burn-sprint">{data.sprint.name}</strong>
          <span className="ddesk-burn-state">{data.sprint.state}</span>
        </div>
        <div className="ddesk-burn-remain">
          <span className="ddesk-burn-remain-n">{data.remainingPoints}</span>
          <span className="ddesk-burn-remain-label">pts remaining</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h + 28}`}
        className="ddesk-burn-svg"
        role="img"
        aria-label="Sprint burndown"
      >
        <defs>
          <linearGradient id="ddeskBurnFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad}
            y1={toY(peak * f)}
            x2={w - pad}
            y2={toY(peak * f)}
            className="ddesk-burn-grid"
          />
        ))}
        <polyline
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          points={idealPts}
        />
        {areaPts ? <polygon fill="url(#ddeskBurnFill)" points={areaPts} /> : null}
        <polyline
          className="ddesk-burn-line"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          points={realPts}
        />
        {data.days.map((d, i) => (
          <circle
            key={d.day}
            cx={toX(i)}
            cy={toY(d.remaining)}
            r={i === data.days.length - 1 ? 4 : 2.5}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth={i === data.days.length - 1 ? 2 : 0}
          />
        ))}
        {data.days.length ? (
          <text x={pad} y={h + 20} className="ddesk-burn-axis">
            {data.days[0].day}
          </text>
        ) : null}
        {last ? (
          <text x={w - pad} y={h + 20} textAnchor="end" className="ddesk-burn-axis">
            {last.day}
          </text>
        ) : null}
      </svg>
      <div className="ddesk-burn-legend">
        <span>
          <span className="dash-sw dash-sw--real" /> Actual
        </span>
        <span>
          <span className="dash-sw dash-sw--ideal" /> Ideal
        </span>
      </div>
    </div>
  );
}

function Commitment({ data }: { data: SprintCommitmentPayload }) {
  if (!data.sprint) {
    return <p className="muted">No active sprint in {data.projectKey}.</p>;
  }
  const ptsPct =
    data.committedPoints > 0
      ? Math.round((data.donePoints / data.committedPoints) * 100)
      : 0;
  const issuesPct =
    data.totalIssues > 0 ? Math.round((data.doneIssues / data.totalIssues) * 100) : 0;
  return (
    <div className="ddesk-commit">
      <div className="ddesk-commit-ring-wrap">
        <svg viewBox="0 0 96 96" className="ddesk-commit-ring" aria-hidden="true">
          <circle cx="48" cy="48" r="40" className="ddesk-commit-ring-track" />
          <circle
            cx="48"
            cy="48"
            r="40"
            className="ddesk-commit-ring-fill"
            style={{
              strokeDasharray: `${(Math.min(100, ptsPct) / 100) * 251.2} 251.2`,
            }}
          />
        </svg>
        <div className="ddesk-commit-ring-label">
          <strong>{ptsPct}%</strong>
          <span>pts</span>
        </div>
      </div>
      <div className="ddesk-commit-stats">
        <div>
          <span className="ddesk-commit-label">Points</span>
          <strong>
            {data.donePoints} / {data.committedPoints}
          </strong>
        </div>
        <div>
          <span className="ddesk-commit-label">Issues</span>
          <strong>
            {data.doneIssues} / {data.totalIssues}
          </strong>
          <div className="ddesk-kpi-meter" aria-hidden="true">
            <div className="ddesk-kpi-meter-fill" style={{ width: `${Math.min(100, issuesPct)}%` }} />
          </div>
        </div>
        <p className="muted">
          {data.sprint.name} · {data.sprint.state}
        </p>
      </div>
    </div>
  );
}

function Blockers({ data }: { data: SprintBlockersPayload }) {
  if (!data.sprint) {
    return <p className="muted">No active sprint in {data.projectKey}.</p>;
  }
  if (data.items.length === 0) {
    return (
      <div className="ddesk-clear">
        <span className="ddesk-clear-mark" aria-hidden="true">
          ✓
        </span>
        <p>
          No blockers in <strong>{data.sprint.name}</strong>. Nice.
        </p>
      </div>
    );
  }
  return (
    <ul className="ddesk-blocker-list">
      {data.items.map((issue) => (
        <li key={issue.id} className="ddesk-blocker">
          <IssueHoverCard issueKey={issue.key} className="key">
            {issue.key}
          </IssueHoverCard>
          <span className="ddesk-blocker-sum">{issue.summary}</span>
          <span className="tag tag--error">{issue.priority}</span>
        </li>
      ))}
    </ul>
  );
}
