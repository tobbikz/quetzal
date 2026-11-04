import {
  addComment,
  createIssue,
  ensureUserByEmail,
  getIssue,
  listProjects,
  setIssueStatus,
} from '@/lib/db';
import { getConnectors } from '@/lib/connectors';
import { qGet, qInsertReturningId, qRun } from '@/lib/sql';

export type GithubSyncResult = {
  action: 'created' | 'commented' | 'status' | 'skipped' | 'linked';
  issueKey?: string;
  reason?: string;
};

type GhUser = { login?: string; html_url?: string };
type GhIssue = {
  id?: number;
  node_id?: string;
  number: number;
  title?: string;
  body?: string | null;
  html_url?: string;
  state?: string;
  user?: GhUser;
  pull_request?: unknown;
};
type GhRepo = { full_name?: string };
type GhComment = {
  id?: number;
  node_id?: string;
  body?: string;
  html_url?: string;
  user?: GhUser;
};

function stamp(): string {
  return new Date().toISOString();
}

async function ensureLinkTable(): Promise<void> {
  await qRun(`CREATE TABLE IF NOT EXISTS github_issue_links (
    id BIGSERIAL PRIMARY KEY,
    github_node_id TEXT NOT NULL UNIQUE,
    repo_full_name TEXT NOT NULL DEFAULT '',
    github_number INTEGER NOT NULL,
    issue_key TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'issue',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await qRun(
    `ALTER TABLE integration_connectors ADD COLUMN IF NOT EXISTS github_default_project TEXT NOT NULL DEFAULT 'OPS'`,
  );
}

async function botUserId(): Promise<number> {
  const user = await ensureUserByEmail('github-bot@quetzal.local', 'GitHub Bot', 'member', 'local');
  return user.id;
}

async function resolveProjectKey(): Promise<string> {
  const connectors = await getConnectors();
  const preferred = connectors.githubDefaultProject.trim().toUpperCase();
  const projects = await listProjects();
  if (preferred && projects.some((p) => p.key === preferred)) return preferred;
  return projects[0]?.key ?? 'OPS';
}

async function findLinkByNode(nodeId: string): Promise<{ issueKey: string } | undefined> {
  await ensureLinkTable();
  const row = (await qGet(
    'SELECT issue_key FROM github_issue_links WHERE github_node_id = ?',
    [nodeId],
  )) as { issue_key: string } | undefined;
  return row ? { issueKey: row.issue_key } : undefined;
}

async function findLinkByRepoNumber(
  repo: string,
  number: number,
): Promise<{ issueKey: string } | undefined> {
  await ensureLinkTable();
  const row = (await qGet(
    'SELECT issue_key FROM github_issue_links WHERE repo_full_name = ? AND github_number = ?',
    [repo, number],
  )) as { issue_key: string } | undefined;
  return row ? { issueKey: row.issue_key } : undefined;
}

async function saveLink(input: {
  nodeId: string;
  repo: string;
  number: number;
  issueKey: string;
  kind: string;
}): Promise<void> {
  await ensureLinkTable();
  const existing = await findLinkByNode(input.nodeId);
  if (existing) {
    await qRun(
      `UPDATE github_issue_links SET issue_key = ?, updated_at = ? WHERE github_node_id = ?`,
      [input.issueKey, stamp(), input.nodeId],
    );
    return;
  }
  await qInsertReturningId(
    `INSERT INTO github_issue_links (github_node_id, repo_full_name, github_number, issue_key, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.nodeId, input.repo, input.number, input.issueKey, input.kind, stamp(), stamp()],
  );
}

function excerpt(body: string | null | undefined, max = 4000): string {
  return String(body ?? '')
    .trim()
    .slice(0, max);
}

function htmlDescription(issue: GhIssue, repo: string, kind: string): string {
  const url = issue.html_url ?? '';
  const login = issue.user?.login ?? 'unknown';
  const body = excerpt(issue.body).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [
    `<p><strong>Synced from GitHub ${kind}</strong> · <a href="${url}">${repo}#${issue.number}</a></p>`,
    `<p>Opened by @${login}</p>`,
    body ? `<pre style="white-space:pre-wrap">${body}</pre>` : '<p><em>No body</em></p>',
  ].join('\n');
}

async function ensureIssueForGithub(input: {
  issue: GhIssue;
  repo: string;
  kind: 'issue' | 'pull_request';
}): Promise<{ key: string; created: boolean }> {
  const nodeId = String(input.issue.node_id ?? `legacy:${input.repo}#${input.issue.number}`);
  const linked =
    (await findLinkByNode(nodeId)) ??
    (await findLinkByRepoNumber(input.repo, input.issue.number));
  if (linked) {
    const existing = await getIssue(linked.issueKey);
    if (existing) return { key: existing.key, created: false };
  }

  const projectKey = await resolveProjectKey();
  const reporterId = await botUserId();
  const summary = `[GH] ${input.issue.title?.trim() || `${input.kind} #${input.issue.number}`}`.slice(
    0,
    180,
  );
  const labels = ['github', `gh:${input.repo}#${input.issue.number}`, input.kind].join(',');
  const created = await createIssue({
    projectKey,
    type: input.kind === 'pull_request' ? 'task' : 'bug',
    summary,
    description: htmlDescription(input.issue, input.repo, input.kind),
    priority: 'medium',
    assigneeId: null,
    reporterId,
    sprintId: null,
    parentKey: null,
    points: null,
    labels,
    dueOn: null,
  });
  await saveLink({
    nodeId,
    repo: input.repo,
    number: input.issue.number,
    issueKey: created.key,
    kind: input.kind,
  });
  return { key: created.key, created: true };
}

/** Handle a verified GitHub webhook payload. */
export async function processGithubWebhook(
  event: string,
  payload: Record<string, unknown>,
): Promise<GithubSyncResult> {
  await ensureLinkTable();
  const action = String(payload.action ?? '');
  const repo = String((payload.repository as GhRepo | undefined)?.full_name ?? '').trim();
  if (!repo) return { action: 'skipped', reason: 'no repository' };

  if (event === 'issues') {
    const issue = payload.issue as GhIssue | undefined;
    if (!issue?.number) return { action: 'skipped', reason: 'no issue' };
    if (issue.pull_request) return { action: 'skipped', reason: 'pull_request via issues event' };

    if (action === 'opened' || action === 'reopened') {
      const { key, created } = await ensureIssueForGithub({ issue, repo, kind: 'issue' });
      if (action === 'reopened') {
        await setIssueStatus(key, 'todo', await botUserId());
        return { action: 'status', issueKey: key };
      }
      return { action: created ? 'created' : 'linked', issueKey: key };
    }

    if (action === 'closed') {
      const { key } = await ensureIssueForGithub({ issue, repo, kind: 'issue' });
      await setIssueStatus(key, 'done', await botUserId());
      return { action: 'status', issueKey: key };
    }

    if (action === 'edited') {
      const linked =
        (await findLinkByNode(String(issue.node_id ?? ''))) ??
        (await findLinkByRepoNumber(repo, issue.number));
      if (!linked) return { action: 'skipped', reason: 'not linked' };
      await addComment(
        linked.issueKey,
        await botUserId(),
        `GitHub issue edited.\n\n${excerpt(issue.body, 1500) || '(empty body)'}`,
        null,
        { skipAutomation: true },
      );
      return { action: 'commented', issueKey: linked.issueKey };
    }

    return { action: 'skipped', reason: `issues.${action}` };
  }

  if (event === 'pull_request') {
    const pr = payload.pull_request as GhIssue | undefined;
    if (!pr?.number) return { action: 'skipped', reason: 'no pull_request' };

    if (action === 'opened' || action === 'reopened') {
      const { key, created } = await ensureIssueForGithub({
        issue: pr,
        repo,
        kind: 'pull_request',
      });
      if (action === 'reopened') {
        await setIssueStatus(key, 'todo', await botUserId());
        return { action: 'status', issueKey: key };
      }
      return { action: created ? 'created' : 'linked', issueKey: key };
    }

    if (action === 'closed') {
      const { key } = await ensureIssueForGithub({ issue: pr, repo, kind: 'pull_request' });
      const merged = Boolean((payload.pull_request as { merged?: boolean } | undefined)?.merged);
      await setIssueStatus(key, 'done', await botUserId());
      await addComment(
        key,
        await botUserId(),
        merged ? 'GitHub PR merged — marked done.' : 'GitHub PR closed — marked done.',
        null,
        { skipAutomation: true },
      );
      return { action: 'status', issueKey: key };
    }

    return { action: 'skipped', reason: `pull_request.${action}` };
  }

  if (event === 'issue_comment') {
    const issue = payload.issue as GhIssue | undefined;
    const comment = payload.comment as GhComment | undefined;
    if (!issue?.number || !comment?.body) return { action: 'skipped', reason: 'no comment' };
    if (action !== 'created') return { action: 'skipped', reason: `issue_comment.${action}` };

    const kind = issue.pull_request ? 'pull_request' : 'issue';
    const { key } = await ensureIssueForGithub({ issue, repo, kind });
    const who = comment.user?.login ?? 'someone';
    const url = comment.html_url ? `\n\n${comment.html_url}` : '';
    await addComment(
      key,
      await botUserId(),
      `**@${who}** on GitHub:\n\n${excerpt(comment.body)}${url}`,
      null,
      { skipAutomation: true },
    );
    return { action: 'commented', issueKey: key };
  }

  if (event === 'ping') {
    return { action: 'skipped', reason: 'ping' };
  }

  return { action: 'skipped', reason: `unsupported event ${event}` };
}
