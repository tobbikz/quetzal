import { EmptyState } from '@/components/EmptyState';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { PRIORITY_LABEL, STATUS_LABEL, STATUSES } from '@/lib/format';
import { getUser } from '@/lib/db';
import { toIssuePreview } from '@/lib/preview';
import type { Issue, IssueStatus, Priority } from '@/lib/types';

function formatDue(dueOn: string | null): string {
  if (!dueOn) return '—';
  const [y, m, d] = dueOn.split('-').map(Number);
  if (!y || !m || !d) return dueOn;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function priorityClass(priority: Priority): string {
  if (priority === 'blocker' || priority === 'highest') return 'ut-pri ut-pri--critical';
  if (priority === 'high') return 'ut-pri ut-pri--high';
  if (priority === 'medium') return 'ut-pri ut-pri--medium';
  return 'ut-pri ut-pri--low';
}

function statusClass(status: IssueStatus): string {
  return `ut-status is-${status}`;
}

type Row = {
  issue: Issue;
  preview: Awaited<ReturnType<typeof toIssuePreview>>;
  assignee: { name: string; initials: string } | null;
};

export async function IssueListBeyond({
  issues,
  emptyTitle = 'No issues match this view',
  emptyHint,
}: {
  issues: Issue[];
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (issues.length === 0) {
    return (
      <EmptyState title={emptyTitle}>
        {emptyHint ? <p>{emptyHint}</p> : null}
      </EmptyState>
    );
  }

  const assigneeCache = new Map<number, { name: string; initials: string } | null>();
  async function resolveAssignee(assigneeId: number | null) {
    if (assigneeId == null) return null;
    if (assigneeCache.has(assigneeId)) return assigneeCache.get(assigneeId) ?? null;
    const user = await getUser(assigneeId);
    const entry = user ? { name: user.name, initials: initials(user.name) } : null;
    assigneeCache.set(assigneeId, entry);
    return entry;
  }

  const rows: Row[] = await Promise.all(
    issues.map(async (issue) => ({
      issue,
      preview: await toIssuePreview(issue),
      assignee: await resolveAssignee(issue.assigneeId),
    })),
  );

  const statusRank = new Map(STATUSES.map((status, index) => [status, index]));
  rows.sort((a, b) => {
    const byStatus =
      (statusRank.get(a.issue.status) ?? 99) - (statusRank.get(b.issue.status) ?? 99);
    if (byStatus !== 0) return byStatus;
    return a.issue.key.localeCompare(b.issue.key);
  });

  return (
    <div className="ut-wrap">
      <table className="ut-table">
        <thead>
          <tr>
            <th scope="col" className="ut-th ut-th--key">
              Key
            </th>
            <th scope="col" className="ut-th ut-th--sum">
              Summary
            </th>
            <th scope="col" className="ut-th ut-th--status">
              Status
            </th>
            <th scope="col" className="ut-th ut-th--pri">
              Priority
            </th>
            <th scope="col" className="ut-th ut-th--due">
              Due
            </th>
            <th scope="col" className="ut-th ut-th--who">
              Assignee
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ issue, preview, assignee }) => (
            <tr key={issue.key} className="ut-row">
              <td className="ut-td ut-td--key">
                <IssueHoverCard issueKey={issue.key} preview={preview} className="ut-key">
                  {issue.key}
                </IssueHoverCard>
              </td>
              <td className="ut-td ut-td--sum">
                <IssueHoverCard issueKey={issue.key} preview={preview} className="ut-sum">
                  {issue.summary}
                </IssueHoverCard>
              </td>
              <td className="ut-td ut-td--status">
                <span className={statusClass(issue.status)}>{STATUS_LABEL[issue.status]}</span>
              </td>
              <td className="ut-td ut-td--pri">
                <span className={priorityClass(issue.priority)}>{PRIORITY_LABEL[issue.priority]}</span>
              </td>
              <td className={`ut-td ut-td--due${issue.dueOn ? '' : ' is-none'}`}>{formatDue(issue.dueOn)}</td>
              <td className="ut-td ut-td--who">
                {assignee ? (
                  <span className="ut-av" title={assignee.name}>
                    {assignee.initials}
                  </span>
                ) : (
                  <span className="ut-av is-empty" title="Unassigned">
                    –
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
