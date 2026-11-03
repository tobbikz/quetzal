import { getSprint, getUser } from '@/lib/db';
import type { Issue } from '@/lib/types';

export interface IssuePreview {
  key: string;
  type: Issue['type'];
  summary: string;
  status: Issue['status'];
  priority: Issue['priority'];
  assignee: string | null;
  reporter: string | null;
  sprint: string | null;
  points: number | null;
  dueOn: string | null;
  labels: string;
  description: string;
}

export async function toIssuePreview(issue: Issue): Promise<IssuePreview> {
  const description = issue.description.trim().replace(/\s+/g, ' ');
  return {
    key: issue.key,
    type: issue.type,
    summary: issue.summary,
    status: issue.status,
    priority: issue.priority,
    assignee: issue.assigneeId ? (await getUser(issue.assigneeId))?.name ?? null : null,
    reporter: (await getUser(issue.reporterId))?.name ?? null,
    sprint: issue.sprintId ? (await getSprint(issue.sprintId))?.name ?? null : null,
    points: issue.points,
    dueOn: issue.dueOn,
    labels: issue.labels,
    description: description.length > 160 ? `${description.slice(0, 157)}…` : description,
  };
}
