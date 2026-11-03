export type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask' | 'feature' | 'improvement' | 'spike';
export type IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'blocker' | 'highest' | 'high' | 'medium' | 'low' | 'lowest';

export type UserRole = 'admin' | 'member' | 'viewer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  /** Agent desk (/helpdesk). Admins are always treated as agents in ACL. */
  helpdeskAgent?: boolean;
}

export interface Site {
  id: number;
  key: string;
  name: string;
}

export interface Project {
  id: number;
  key: string;
  name: string;
  description: string;
  leadId: number;
  workflowId: number;
  siteId: number;
  permissionSchemeId: number;
}

export interface Sprint {
  id: number;
  projectId: number;
  name: string;
  state: 'planned' | 'active' | 'closed';
  goal: string;
}

export interface Component {
  id: number;
  projectId: number;
  name: string;
}

export interface Version {
  id: number;
  projectId: number;
  name: string;
  released: boolean;
  releaseDate: string | null;
}

export interface Issue {
  id: number;
  projectId: number;
  projectKey: string;
  num: number;
  key: string;
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
  labels: string;
  componentId: number | null;
  fixVersionId: number | null;
  startOn: string | null;
  dueOn: string | null;
  originalEstimateMinutes: number | null;
  remainingMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export type IssueLinkType = 'blocks' | 'clones' | 'relates' | 'duplicates';

export interface IssueLink {
  id: number;
  fromIssueId: number;
  toIssueId: number;
  type: IssueLinkType;
  createdAt: string;
}

export interface Comment {
  id: number;
  authorId: number;
  body: string;
  createdAt: string;
  parentId: number | null;
}

export interface Space {
  id: number;
  key: string;
  name: string;
  description: string;
  kind: 'personal' | 'team';
  ownerUserId: number | null;
  siteId: number;
}

export interface WikiPage {
  id: number;
  spaceId: number;
  spaceKey: string;
  parentId: number | null;
  slug: string;
  title: string;
  body: string;
  authorId: number;
  updatedAt: string;
}

export type CalendarScope = 'personal' | 'project';
export type CalendarTypeScope = 'personal' | 'project' | 'both';

export interface CalendarEventType {
  id: number;
  name: string;
  color: string;
  scope: CalendarTypeScope;
  projectId: number | null;
  ownerUserId: number | null;
  system: boolean;
  createdAt: string;
}

export interface CalendarAttendee {
  id: number;
  name: string;
  email: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  notes: string;
  typeId: number;
  typeName: string;
  typeColor: string;
  scope: CalendarScope;
  ownerUserId: number | null;
  projectId: number | null;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  createdBy: number;
  createdByName: string;
  attendees: CalendarAttendee[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}
