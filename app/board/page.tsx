import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewBoardButton, OpenBoardFromQuery } from '@/components/CreateBoard';
import { ensureDefaultBoards } from '@/lib/boards';
import { currentProject, currentUser } from '@/lib/session';

export default async function BoardsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();
  const project = await currentProject();
  const boards = await ensureDefaultBoards({
    userId: user.id,
    projectId: project.id,
    projectKey: project.key,
  });

  // Preserve legacy "go straight to a board" default UX when the user just
  // navigates to /board with no params and already has boards.
  if (sp.new !== '1' && boards.length > 0) {
    const preferred =
      boards.find((b) => b.scope === 'personal' && b.ownerUserId === user.id) ??
      boards.find((b) => b.scope === 'project' && b.projectId === project.id) ??
      boards[0];
    redirect(`/board/${preferred.id}`);
  }

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">Boards</span>
      </div>
      <main className="page board-hub">
        {/* Auto-open modal when landing on /board?new=1 (deep links, old redirects). */}
        <OpenBoardFromQuery />
        <div className="page-head">
          <div>
            <h1 className="page-title">Boards</h1>
            <p className="page-sub">
              Custom kanban views — personal or project — filtered by QQL. Not tied to a sprint.
            </p>
          </div>
          <NewBoardButton />
        </div>

        {boards.length === 0 ? (
          <section className="empty-state" role="status">
            <p className="empty-state-title">No boards yet</p>
            <div className="empty-state-body">
              <p>Create your first board to carve a kanban view out of any QQL query.</p>
              <p>
                <NewBoardButton className="linkish" label="Create a board" />
              </p>
            </div>
          </section>
        ) : (
          <section className="board-hub-list">
            <h2 className="board-hub-label">Your boards</h2>
            <ul>
              {boards.map((board) => (
                <li key={board.id}>
                  <Link href={`/board/${board.id}`} className="board-hub-card">
                    <strong>{board.name}</strong>
                    <span className={`board-hub-scope is-${board.scope}`}>
                      {board.scope === 'personal' ? 'Personal' : `Project · ${project.key}`}
                    </span>
                    <span className="board-hub-jql">{board.jql || 'No filter'}</span>
                    {board.description ? <p>{board.description}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
