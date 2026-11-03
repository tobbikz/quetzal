import { EmptyState } from '@/components/EmptyState';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { PriorityMark } from '@/components/PriorityMark';
import { STATUS_LABEL, TYPE_LABEL, tagForStatus, tagForType } from '@/lib/format';
import { getUser, listSprints } from '@/lib/db';
import { toIssuePreview } from '@/lib/preview';
import type { Issue } from '@/lib/types';

export async function IssueTable({
  issues,
  emptyTitle = 'No issues match this view',
  emptyHint,
}: {
  issues: Issue[];
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const sprints = new Map((await listSprints()).map((sprint) => [sprint.id, sprint.name]));
  if (issues.length === 0) {
    return (
      <EmptyState title={emptyTitle}>
        {emptyHint ? <p>{emptyHint}</p> : null}
      </EmptyState>
    );
  }
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Key</th>
          <th>Type</th>
          <th>Summary</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Assignee</th>
          <th>Sprint</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {issues.map(async (issue) => (
          <tr key={issue.key}>
            <td>
              <IssueHoverCard issueKey={issue.key} preview={await toIssuePreview(issue)} className="key">
                {issue.key}
              </IssueHoverCard>
            </td>
            <td><span className={tagForType(issue.type)}>{TYPE_LABEL[issue.type]}</span></td>
            <td>
              <IssueHoverCard issueKey={issue.key} preview={await toIssuePreview(issue)}>
                {issue.summary}
              </IssueHoverCard>
            </td>
            <td><span className={tagForStatus(issue.status)}>{STATUS_LABEL[issue.status]}</span></td>
            <td><PriorityMark priority={issue.priority} /></td>
            <td>{issue.assigneeId ? (await getUser(issue.assigneeId))?.name : <span className="muted">Unassigned</span>}</td>
            <td className="muted">{issue.sprintId ? sprints.get(issue.sprintId) : 'Backlog'}</td>
            <td className="faint">{issue.points ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
