import type { IssueStatus, IssueType, Priority } from './types';

export const STATUS_LABEL: Record<IssueStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
};

export const TYPE_LABEL: Record<IssueType, string> = {
  epic: 'Epic',
  story: 'Story',
  task: 'Task',
  bug: 'Ticket',
  subtask: 'Sub-task',
  feature: 'Feature',
  improvement: 'Improvement',
  spike: 'Spike',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  blocker: 'Blocker',
  highest: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  lowest: 'Lowest',
};

export const TRANSITIONS: Record<IssueStatus, { to: IssueStatus; label: string }[]> = {
  todo: [{ to: 'in_progress', label: 'Start progress' }],
  in_progress: [
    { to: 'in_review', label: 'Send to review' },
    { to: 'todo', label: 'Stop progress' },
  ],
  in_review: [
    { to: 'done', label: 'Resolve' },
    { to: 'in_progress', label: 'Back to progress' },
  ],
  done: [{ to: 'todo', label: 'Reopen' }],
};

export const STATUSES: IssueStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
export const TYPES: IssueType[] = ['epic', 'story', 'feature', 'task', 'bug', 'improvement', 'spike', 'subtask'];
export const PRIORITIES: Priority[] = ['blocker', 'highest', 'high', 'medium', 'low', 'lowest'];

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function tagForStatus(status: IssueStatus): string {
  if (status === 'done') return 'tag tag--ok';
  if (status === 'in_review') return 'tag tag--warn';
  if (status === 'in_progress') return 'tag tag--info';
  return 'tag tag--muted';
}

export function tagForPriority(priority: Priority): string {
  if (priority === 'blocker' || priority === 'highest' || priority === 'high') return 'tag tag--error';
  if (priority === 'medium') return 'tag tag--warn';
  return 'tag tag--muted';
}

export function tagForType(type: IssueType): string {
  if (type === 'bug') return 'tag tag--error';
  if (type === 'epic' || type === 'feature') return 'tag tag--info';
  if (type === 'spike' || type === 'improvement') return 'tag tag--warn';
  return 'tag tag--muted';
}
