/** Client-safe helpdesk enums/labels — no Node fs/sqlite (keep out of 'use client' import graphs). */

export type HelpdeskType =
  | 'request'
  | 'incident'
  | 'problem'
  | 'change'
  | 'question'
  | 'access'
  | 'hardware'
  | 'software'
  | 'service';
export type HelpdeskStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type HelpdeskPriority =
  | 'lowest'
  | 'low'
  | 'medium'
  | 'high'
  | 'highest'
  | 'blocker';

export const HELPDESK_TYPES: HelpdeskType[] = [
  'request',
  'incident',
  'problem',
  'change',
  'question',
  'access',
  'hardware',
  'software',
  'service',
];
export const HELPDESK_STATUSES: HelpdeskStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
export const HELPDESK_PRIORITIES: HelpdeskPriority[] = [
  'lowest',
  'low',
  'medium',
  'high',
  'highest',
  'blocker',
];

export const HELPDESK_TYPE_LABEL: Record<HelpdeskType, string> = {
  request: 'Request',
  incident: 'Incident',
  problem: 'Problem',
  change: 'Change',
  question: 'Question',
  access: 'Access',
  hardware: 'Hardware',
  software: 'Software',
  service: 'Service',
};

export const HELPDESK_STATUS_LABEL: Record<HelpdeskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function tagForHelpdeskStatus(status: HelpdeskStatus): string {
  if (status === 'resolved' || status === 'closed') return 'tag tag--ok';
  if (status === 'in_progress') return 'tag tag--info';
  return 'tag tag--warn';
}

export function tagForHelpdeskType(type: HelpdeskType): string {
  if (type === 'incident' || type === 'problem') return 'tag tag--error';
  if (type === 'change' || type === 'access') return 'tag tag--warn';
  if (type === 'question') return 'tag tag--ok';
  return 'tag tag--info';
}
