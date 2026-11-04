import { qGet, qRun } from '@/lib/sql';

export type GithubIssueLink = {
  repoFullName: string;
  githubNumber: number;
  issueKey: string;
  kind: string;
  htmlUrl: string;
};

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
}

export async function getGithubLinkForIssue(issueKey: string): Promise<GithubIssueLink | undefined> {
  await ensureLinkTable();
  const row = (await qGet(
    `SELECT repo_full_name, github_number, issue_key, kind
     FROM github_issue_links WHERE issue_key = ? ORDER BY id DESC LIMIT 1`,
    [issueKey],
  )) as
    | { repo_full_name: string; github_number: number; issue_key: string; kind: string }
    | undefined;
  if (!row) return undefined;
  const kindPath = row.kind === 'pull_request' ? 'pull' : 'issues';
  return {
    repoFullName: row.repo_full_name,
    githubNumber: Number(row.github_number),
    issueKey: row.issue_key,
    kind: row.kind,
    htmlUrl: `https://github.com/${row.repo_full_name}/${kindPath}/${row.github_number}`,
  };
}

function githubToken(): string {
  return String(process.env.QUETZAL_GITHUB_TOKEN ?? '').trim();
}

export function githubOutboundReady(): boolean {
  return Boolean(githubToken());
}

/** Post a comment on the linked GitHub issue/PR. Returns HTML URL or null. */
export async function postGithubComment(
  issueKey: string,
  body: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const token = githubToken();
  if (!token) return { ok: false, reason: 'QUETZAL_GITHUB_TOKEN not set' };
  const link = await getGithubLinkForIssue(issueKey);
  if (!link) return { ok: false, reason: 'issue not linked to GitHub' };
  const text = body.trim().slice(0, 65000);
  if (!text) return { ok: false, reason: 'empty body' };

  const apiUrl = `https://api.github.com/repos/${link.repoFullName}/issues/${link.githubNumber}/comments`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'Quetzal-Desk',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({
      body: `${text}\n\n_via Quetzal ${issueKey}_`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, reason: `GitHub HTTP ${res.status}: ${detail.slice(0, 200)}` };
  }
  const json = (await res.json()) as { html_url?: string };
  return { ok: true, url: json.html_url ?? link.htmlUrl };
}
