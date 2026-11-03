import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getIssueById, getUser, isWatching, toggleWatch } from '@/lib/db';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


/* DDL skipped — migrations */ void 0;

function stamp(): string {
  return new Date().toISOString();
}

export { isWatching, toggleWatch };

export async function listWatcherUserIds(issueId: number): Promise<number[]> {
  const rows = await qAll('SELECT user_id FROM issue_watchers WHERE issue_id = ? ORDER BY user_id', [issueId]) as { user_id: number }[];
  return rows.map((row) => Number(row.user_id));
}

export async function watcherCount(issueId: number): Promise<number> {
  const row = await qGet('SELECT COUNT(*) AS n FROM issue_watchers WHERE issue_id = ?', [issueId]) as {
    n: number;
  };
  return Number(row.n);
}

export async function hasVoted(issueId: number, userId: number): Promise<boolean> {
  return Boolean(
    await qGet('SELECT 1 FROM issue_votes WHERE issue_id = ? AND user_id = ?', [issueId, userId]),
  );
}

export async function voteCount(issueId: number): Promise<number> {
  const row = await qGet('SELECT COUNT(*) AS n FROM issue_votes WHERE issue_id = ?', [issueId]) as {
    n: number;
  };
  return Number(row.n);
}

/** Toggle a vote; returns whether the user is voting after the call. */
export async function toggleVote(issueId: number, userId: number): Promise<boolean> {
  if (!await getIssueById(issueId) || !await getUser(userId)) return false;
  if (await hasVoted(issueId, userId)) {
    await qRun('DELETE FROM issue_votes WHERE issue_id = ? AND user_id = ?', [issueId, userId]);
    return false;
  }
  await qRun('INSERT INTO issue_votes (issue_id, user_id, created_at) VALUES (?, ?, ?)', [issueId,
    userId,
    stamp(),]);
  return true;
}
