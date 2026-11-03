import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteBoardAction, updateBoardAction } from '@/app/actions';
import { Board } from '@/components/Board';
import { NewBoardButton } from '@/components/CreateBoard';
import { canAccessBoard, ensureDefaultBoards, getBoard } from '@/lib/boards';
import { listIssues, listUsers } from '@/lib/db';
import { runJql } from '@/lib/jql';
import { currentProject, currentUser } from '@/lib/session';
import type { Issue } from '@/lib/types';

export default async function BoardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id: idRaw } = await params;
  const sp = await searchParams;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await currentUser();
  const project = await currentProject();
  await ensureDefaultBoards({
    userId: user.id,
    projectId: project.id,
    projectKey: project.key,
  });

  const board = await getBoard(id);
  if (!board || !canAccessBoard(board, user.id, project.id)) notFound();

  const boards = await ensureDefaultBoards({
    userId: user.id,
    projectId: project.id,
    projectKey: project.key,
  });

  let issues: Issue[] = [];
  let jqlError: string | null = null;
  const jql = board.jql.trim();
  if (jql) {
    const result = await runJql(jql, {
      currentUserId: user.id,
      defaultProjectKey: project.key,
    });
    if (result.ok) {
      issues = result.issues;
    } else {
      jqlError = result.error;
      issues = [];
    }
  } else if (board.scope === 'project') {
    issues = await listIssues({ projectKey: project.key });
  } else {
    issues = await listIssues({ assigneeId: user.id });
  }

  const catalog = board.scope === 'project'
    ? await listIssues({ projectKey: project.key })
    : await listIssues({ assigneeId: user.id });
  const parents = Object.fromEntries(
    catalog.filter((issue) => issue.type === 'epic').map((issue) => [issue.id, { key: issue.key, type: issue.type }]),
  );

  const editing = sp.edit === '1' && board.ownerUserId === user.id;
  const boardHref = `/board/${board.id}`;

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <Link className="crumb" href="/board">
          Boards
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">{board.name}</span>
      </div>
      <main className="page board-desk">
        <div className="page-head">
          <div>
            <h1 className="page-title">{board.name}</h1>
            <p className="page-sub">
              <span className={`board-hub-scope is-${board.scope}`}>
                {board.scope === 'personal' ? 'Personal' : `Project · ${project.key}`}
              </span>
              {board.description ? ` · ${board.description}` : null}
            </p>
          </div>
          <div className="row-actions board-desk-actions">
            <NewBoardButton />
            {board.ownerUserId === user.id ? (
              <Link href={`${boardHref}?edit=1`} className="btn-ghost">
                Edit
              </Link>
            ) : null}
          </div>
        </div>

        <div className="board-switcher" role="tablist" aria-label="Boards">
          {boards.map((item) => (
            <Link
              key={item.id}
              href={`/board/${item.id}`}
              role="tab"
              aria-selected={item.id === board.id}
              className={item.id === board.id ? 'on' : ''}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {editing ? (
          <section className="panel board-create" style={{ marginBottom: '0.85rem' }}>
            <div className="panel-head">
              <span>Edit board</span>
              <Link href={boardHref}>Close</Link>
            </div>
            <div className="panel-body">
              <form action={updateBoardAction} className="stack board-create-form">
                <input type="hidden" name="id" value={board.id} />
                <input type="hidden" name="next" value={boardHref} />
                <label className="field">
                  <span>Name</span>
                  <input name="name" required defaultValue={board.name} maxLength={80} />
                </label>
                <label className="field">
                  <span>QQL filter</span>
                  <input name="jql" defaultValue={board.jql} placeholder="Leave empty for defaults" />
                </label>
                <label className="field">
                  <span>Description</span>
                  <input name="description" defaultValue={board.description} maxLength={240} />
                </label>
                <div className="row-actions">
                  <button className="btn" type="submit">
                    Save
                  </button>
                </div>
              </form>
              <form action={deleteBoardAction} style={{ marginTop: '0.65rem' }}>
                <input type="hidden" name="id" value={board.id} />
                <button className="btn-ghost" type="submit">
                  Delete board
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {jqlError ? (
          <div className="empty-state" role="alert">
            <p className="empty-state-title">Invalid QQL</p>
            <div className="empty-state-body">
              <p>{jqlError}</p>
              <p>
                <Link href={`${boardHref}?edit=1`}>Edit board filter</Link>
              </p>
            </div>
          </div>
        ) : issues.length === 0 ? (
          <div className="empty-state" role="status">
            <p className="empty-state-title">No issues on this board</p>
            <div className="empty-state-body">
              <p>Adjust the QQL filter or create an issue that matches it.</p>
              <p>
                <Link href={`${boardHref}?edit=1`}>Edit filter</Link>
                {' · '}
                <Link href={`/issues/new?project=${project.key}`}>Create issue</Link>
              </p>
            </div>
          </div>
        ) : (
          <Board
            issues={issues}
            project={project.key}
            people={await listUsers()}
            parents={parents}
            boardHref={boardHref}
            showPoints={board.scope !== 'personal'}
          />
        )}
      </main>
    </>
  );
}
