import Link from 'next/link';
import { DashHubDeleteButton, NewDashboardButton } from '@/components/CreateDashboard';
import {
  dashboardDisplayDescription,
  dashboardTemplate,
  GADGET_TYPE_LABEL,
  isProtectedDashboard,
  listDashboards,
  listGadgets,
  ownerName,
} from '@/lib/dashboards';
import { formatWhen } from '@/lib/format';
import { currentUser } from '@/lib/session';

const TEMPLATE_LABEL: Record<string, string> = {
  sprint: 'Sprint',
  ops: 'Project',
  blank: 'Blank',
};

const TEMPLATE_SIGNAL: Record<string, string> = {
  sprint: 'Active sprint pulse',
  ops: 'Project command desk',
  blank: 'Blank canvas',
};

export default async function DashboardsPage() {
  const user = await currentUser();
  // Personal Home seeding was removed; also filter out any legacy personal
  // boards that linger in the DB until ensureDashboards() wipes them.
  // Shared defaults (Sprint Health + Ops overview) are visible to everyone.
  const boards = (await listDashboards(user.id))
    .filter((board) => dashboardTemplate(board) !== 'personal')
    .filter(
      (board) =>
        user.role === 'admin' ||
        board.ownerUserId === user.id ||
        isProtectedDashboard(board),
    );

  return (
    <main className="page dash-hub-page">
      <div className="dash-hub-atmosphere" aria-hidden="true" />
      <header className="dash-hub-bar">
        <div className="dash-hub-bar-left">
          <span className="dash-hub-kicker">Dashboards</span>
          <h1 className="dash-hub-bar-title">Boards</h1>
        </div>
        <div className="dash-hub-bar-right">
          <NewDashboardButton />
        </div>
      </header>

      {boards.length === 0 ? (
        <div className="dash-hub-empty">
          <p className="dash-hub-empty-eyebrow">Empty</p>
          <h2 className="dash-hub-empty-title">No dashboards yet</h2>
          <p className="dash-hub-empty-hint">
            Defaults seed as Sprint Health + Ops overview — then add your own.
          </p>
        </div>
      ) : (
        <section className="dash-hub-grid" aria-label="Your dashboards">
          {boards.map(async (board) => {
            const gadgets = await listGadgets(board.id);
            const protectedBoard = isProtectedDashboard(board);
            const canDelete =
              !protectedBoard && (board.ownerUserId === user.id || user.role === 'admin');
            const template = dashboardTemplate(board);
            const scope = template ? TEMPLATE_LABEL[template] : 'Custom';
            const description = dashboardDisplayDescription(board);
            const signal =
              (template && TEMPLATE_SIGNAL[template]) ||
              `${gadgets.length} gadget${gadgets.length === 1 ? '' : 's'}`;
            return (
              <article
                key={board.id}
                className={`dash-hub-card dash-hub-card--${template ?? 'custom'}${protectedBoard ? ' is-default' : ''}`}
              >
                <header className="dash-hub-card-head">
                  <span className={`dash-hub-scope dash-hub-scope--${template ?? 'custom'}`}>
                    {protectedBoard ? 'Default' : scope}
                  </span>
                  <span className="dash-hub-count">
                    {gadgets.length} gadget{gadgets.length === 1 ? '' : 's'}
                  </span>
                </header>
                <p className="dash-hub-signal">{signal}</p>
                <Link className="dash-hub-title" href={`/dashboards/${board.id}`}>
                  {board.name}
                </Link>
                {description ? <p className="dash-hub-desc">{description}</p> : null}
                {gadgets.length > 0 ? (
                  <ul className="dash-hub-chips" aria-label="Gadgets">
                    {gadgets.slice(0, 4).map((g) => (
                      <li key={g.id}>{GADGET_TYPE_LABEL[g.type]}</li>
                    ))}
                  </ul>
                ) : null}
                <footer className="dash-hub-card-foot">
                  <span className="muted">
                    {await ownerName(board.ownerUserId)} · updated {formatWhen(board.updatedAt)}
                    {protectedBoard ? ' · locked' : ''}
                  </span>
                  {canDelete ? (
                    <DashHubDeleteButton dashboardId={board.id} name={board.name} />
                  ) : (
                    <Link className="dash-hub-open" href={`/dashboards/${board.id}`}>
                      Open →
                    </Link>
                  )}
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
