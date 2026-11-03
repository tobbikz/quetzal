import type { Issue, IssueStatus, IssueType, Priority, WikiPage } from '@/lib/types';
import { PRIORITIES, STATUSES, TYPES } from '@/lib/format';

export type ApiIssue = {
  id: number;
  key: string;
  projectKey: string;
  type: IssueType;
  summary: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  assigneeId: number | null;
  reporterId: number;
  sprintId: number | null;
  parentId: number | null;
  points: number | null;
  labels: string[];
  dueOn: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiPage = {
  id: number;
  spaceId: number;
  spaceKey: string;
  parentId: number | null;
  slug: string;
  title: string;
  body: string;
  authorId: number;
  updatedAt: string;
};

export function toApiIssue(issue: Issue): ApiIssue {
  return {
    id: issue.id,
    key: issue.key,
    projectKey: issue.projectKey,
    type: issue.type,
    summary: issue.summary,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    assigneeId: issue.assigneeId,
    reporterId: issue.reporterId,
    sprintId: issue.sprintId,
    parentId: issue.parentId,
    points: issue.points,
    labels: issue.labels
      ? issue.labels
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
    dueOn: issue.dueOn,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

export function toApiPage(page: WikiPage): ApiPage {
  return {
    id: page.id,
    spaceId: page.spaceId,
    spaceKey: page.spaceKey,
    parentId: page.parentId,
    slug: page.slug,
    title: page.title,
    body: page.body,
    authorId: page.authorId,
    updatedAt: page.updatedAt,
  };
}

export function parseIssueType(raw: unknown, fallback: IssueType = 'task'): IssueType | null {
  const value = String(raw ?? fallback);
  return TYPES.includes(value as IssueType) ? (value as IssueType) : null;
}

export function parsePriority(raw: unknown, fallback: Priority = 'medium'): Priority | null {
  const value = String(raw ?? fallback);
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : null;
}

export function parseStatus(raw: unknown): IssueStatus | null {
  const value = String(raw ?? '');
  return STATUSES.includes(value as IssueStatus) ? (value as IssueStatus) : null;
}

export function labelsToCsv(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(',');
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(',');
  }
  return '';
}
