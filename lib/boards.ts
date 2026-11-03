import { qAll, qGet, qInsertReturningId, qRun } from '@/lib/sql';

export type BoardScope = 'personal' | 'project';

export type WorkBoard = {
  id: number;
  name: string;
  description: string;
  jql: string;
  scope: BoardScope;
  ownerUserId: number;
  projectId: number | null;
  createdAt: string;
  updatedAt: string;
};

function stamp(): string {
  return new Date().toISOString();
}

function mapBoard(row: Record<string, unknown>): WorkBoard {
  const scope = String(row.scope) === 'project' ? 'project' : 'personal';
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    jql: String(row.jql ?? ''),
    scope,
    ownerUserId: Number(row.owner_user_id),
    projectId: row.project_id == null ? null : Number(row.project_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listBoardsForUser(opts: {
  userId: number;
  projectId?: number | null;
}): Promise<WorkBoard[]> {
  const rows = (await qAll(
    `
    SELECT * FROM boards
    WHERE owner_user_id = ?
       OR (scope = 'project' AND project_id = ?)
    ORDER BY
      CASE WHEN scope = 'personal' THEN 0 ELSE 1 END,
      lower(name),
      id
  `,
    [opts.userId, opts.projectId ?? -1],
  )) as Record<string, unknown>[];
  return rows.map(mapBoard);
}

export async function getBoard(id: number): Promise<WorkBoard | undefined> {
  const row = (await qGet(`SELECT * FROM boards WHERE id = ?`, [id])) as Record<string, unknown> | undefined;
  return row ? mapBoard(row) : undefined;
}

export async function createBoard(input: {
  name: string;
  description?: string;
  jql?: string;
  scope: BoardScope;
  ownerUserId: number;
  projectId?: number | null;
}): Promise<WorkBoard> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error('Board name is required');
  const description = (input.description ?? '').trim().slice(0, 240);
  const jql = (input.jql ?? '').trim().slice(0, 500);
  const scope = input.scope;
  const projectId = scope === 'project' ? (input.projectId ?? null) : null;
  if (scope === 'project' && !projectId) throw new Error('Project board needs a project');
  const now = stamp();
  const id = await qInsertReturningId(
    `INSERT INTO boards (name, description, jql, scope, owner_user_id, project_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, jql, scope, input.ownerUserId, projectId, now, now],
  );
  const board = await getBoard(id);
  if (!board) throw new Error('Failed to create board');
  return board;
}

export async function updateBoard(
  id: number,
  ownerUserId: number,
  patch: { name?: string; description?: string; jql?: string },
): Promise<WorkBoard | undefined> {
  const current = await getBoard(id);
  if (!current || current.ownerUserId !== ownerUserId) return undefined;
  const name = patch.name != null ? patch.name.trim().slice(0, 80) : current.name;
  const description = patch.description != null ? patch.description.trim().slice(0, 240) : current.description;
  const jql = patch.jql != null ? patch.jql.trim().slice(0, 500) : current.jql;
  if (!name) throw new Error('Board name is required');
  await qRun(`UPDATE boards SET name = ?, description = ?, jql = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`, [
    name,
    description,
    jql,
    stamp(),
    id,
    ownerUserId,
  ]);
  return getBoard(id);
}

export async function deleteBoard(id: number, ownerUserId: number): Promise<boolean> {
  const result = await qRun(`DELETE FROM boards WHERE id = ? AND owner_user_id = ?`, [id, ownerUserId]);
  return result > 0;
}

/** Ensure the user has a personal board and the project has at least one project board. */
export async function ensureDefaultBoards(opts: {
  userId: number;
  projectId: number;
  projectKey: string;
}): Promise<WorkBoard[]> {
  const existing = await listBoardsForUser({ userId: opts.userId, projectId: opts.projectId });
  const hasPersonal = existing.some((b) => b.scope === 'personal' && b.ownerUserId === opts.userId);
  const hasProject = existing.some((b) => b.scope === 'project' && b.projectId === opts.projectId);

  if (!hasPersonal) {
    await createBoard({
      name: 'My board',
      description: 'Personal board — issues assigned to you',
      jql: 'assignee = currentUser()',
      scope: 'personal',
      ownerUserId: opts.userId,
    });
  }
  if (!hasProject) {
    await createBoard({
      name: `${opts.projectKey} board`,
      description: 'Project board — all issues in this project',
      jql: `project = ${opts.projectKey}`,
      scope: 'project',
      ownerUserId: opts.userId,
      projectId: opts.projectId,
    });
  }
  return listBoardsForUser({ userId: opts.userId, projectId: opts.projectId });
}

export function canAccessBoard(board: WorkBoard, userId: number, projectId: number | null): boolean {
  if (board.ownerUserId === userId) return true;
  if (board.scope === 'project' && board.projectId != null && board.projectId === projectId) return true;
  return false;
}
