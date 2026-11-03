import { STATUSES, TYPES } from '@/lib/format';
import type { IssueQuery } from '@/lib/db';
import type { IssueStatus, IssueType } from '@/lib/types';

export type IssueFilterParams = {
  status?: string;
  type?: string;
  assignee?: string;
  who?: string;
  q?: string;
  /** When set, the issues page prefers JQL over discrete filters. */
  jql?: string;
};

export type ParsedIssueFilters = {
  status: IssueStatus | '';
  type: IssueType | '';
  /** Raw assignee query param: user id, "unassigned", or "". */
  assignee: string;
  who: '' | 'assignee' | 'reporter';
  q: string;
  query: IssueQuery;
};

/** Parse multi-param issue list filters for /issues (and reusable elsewhere). */
export function parseIssueFilters(
  params: IssueFilterParams,
  opts: { projectKey: string; meId: number },
): ParsedIssueFilters {
  const status = STATUSES.includes(params.status as IssueStatus) ? (params.status as IssueStatus) : '';
  const type = TYPES.includes(params.type as IssueType) ? (params.type as IssueType) : '';
  const who = params.who === 'assignee' || params.who === 'reporter' ? params.who : '';
  const q = (params.q ?? '').trim();
  const assigneeRaw = (params.assignee ?? '').trim();

  let assigneeId: number | null | undefined;
  let assignee = '';
  if (assigneeRaw === 'unassigned') {
    assignee = 'unassigned';
    assigneeId = null;
  } else if (/^\d+$/.test(assigneeRaw)) {
    assignee = assigneeRaw;
    assigneeId = Number(assigneeRaw);
  }

  // Explicit assignee wins; who=assignee is "me" when no assignee param.
  if (assigneeId === undefined && who === 'assignee') {
    assigneeId = opts.meId;
  }
  const reporterId = who === 'reporter' ? opts.meId : undefined;

  const query: IssueQuery = {
    projectKey: opts.projectKey,
    status: status || undefined,
    type: type || undefined,
    q: q || undefined,
    assigneeId,
    reporterId,
  };

  return { status, type, assignee, who, q, query };
}

export const ISSUE_FILTER_KEYS = ['status', 'type', 'assignee', 'who', 'q', 'jql'] as const;
