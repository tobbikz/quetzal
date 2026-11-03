import { getSpace, getProject, isSpaceMember } from '@/lib/db';
import {
  ISSUE_PERMS,
  SPACE_PERMS,
  hasIssuePermission,
  hasPagePermission,
  hasSpacePermission,
  type IssuePermission,
} from '@/lib/permissions';
import type { User } from '@/lib/types';

export type Role = User['role'];

async function resolveProjectId(projectKeyOrId?: string | number | null): Promise<number | null> {
  if (typeof projectKeyOrId === 'number' && Number.isInteger(projectKeyOrId) && projectKeyOrId > 0) {
    return projectKeyOrId;
  }
  if (typeof projectKeyOrId === 'string' && projectKeyOrId.trim()) {
    const project = await getProject(projectKeyOrId.trim().toUpperCase());
    return project?.id ?? null;
  }
  return null;
}

async function issuePerm(user: User, permission: IssuePermission, projectKeyOrId?: string | number | null): Promise<boolean> {
  const projectId = await resolveProjectId(projectKeyOrId);
  if (projectId != null) {
    return await hasIssuePermission(user.id, user.role, projectId, permission);
  }
  // No project context (helpdesk / global): use application role from Default scheme semantics.
  if (permission === ISSUE_PERMS.BROWSE_PROJECTS) return true;
  return user.role === 'admin' || user.role === 'member';
}

/** Browse issues in a project (Rita / viewers allowed). */
export async function canBrowseIssues(user: User, projectKeyOrId?: string | number | null): Promise<boolean> {
  return await issuePerm(user, ISSUE_PERMS.BROWSE_PROJECTS, projectKeyOrId);
}

export async function canCreateIssues(user: User, projectKeyOrId?: string | number | null): Promise<boolean> {
  return await issuePerm(user, ISSUE_PERMS.CREATE_ISSUES, projectKeyOrId);
}

export async function canEditIssues(user: User, projectKeyOrId?: string | number | null): Promise<boolean> {
  return await issuePerm(user, ISSUE_PERMS.EDIT_ISSUES, projectKeyOrId);
}

/** Issues: admin + member write; viewer is read-only. Project-aware when key/id given. */
export async function canWriteIssues(user: User, projectKeyOrId?: string | number | null): Promise<boolean> {
  if (projectKeyOrId != null && projectKeyOrId !== '') {
    return await canCreateIssues(user, projectKeyOrId) || await canEditIssues(user, projectKeyOrId);
  }
  return user.role === 'admin' || user.role === 'member';
}

export async function canViewWiki(user: User, spaceKey: string, pageId?: number | null): Promise<boolean> {
  const space = await getSpace(spaceKey.toUpperCase());
  if (!space) return false;
  if (typeof pageId === 'number' && pageId > 0) {
    const pageGate = await hasPagePermission(user.id, user.role, pageId, 'VIEW_PAGE');
    if (pageGate != null) return pageGate;
  }
  return await hasSpacePermission(user.id, user.role, space.id, SPACE_PERMS.VIEW_SPACE);
}

/**
 * Wiki write: scheme/space_permissions first; personal owner + admin still win.
 * Viewers never edit via application role alone.
 */
export async function canWriteWiki(user: User, spaceKey: string, pageId?: number | null): Promise<boolean> {
  if (user.role === 'viewer') return false;
  const space = await getSpace(spaceKey.toUpperCase());
  if (!space) return false;
  if (user.role === 'admin') return true;
  if (space.kind === 'personal' && space.ownerUserId === user.id) return true;

  if (typeof pageId === 'number' && pageId > 0) {
    const pageGate = await hasPagePermission(user.id, user.role, pageId, 'EDIT_PAGE');
    if (pageGate != null) return pageGate;
  }

  if (await hasSpacePermission(user.id, user.role, space.id, SPACE_PERMS.EDIT_SPACE)) return true;
  // Fallback for spaces not yet seeded with EDIT grants.
  return await isSpaceMember(user.id, space.id);
}

export async function assertCanBrowseIssues(user: User, projectKeyOrId?: string | number | null): Promise<void> {
  if (!(await canBrowseIssues(user, projectKeyOrId))) throw new Error('Forbidden: no browse access for this project');
}

export async function assertCanCreateIssues(user: User, projectKeyOrId?: string | number | null): Promise<void> {
  if (!(await canCreateIssues(user, projectKeyOrId))) throw new Error('Forbidden: cannot create issues');
}

export async function assertCanEditIssues(user: User, projectKeyOrId?: string | number | null): Promise<void> {
  if (!(await canEditIssues(user, projectKeyOrId))) throw new Error('Forbidden: cannot edit issues');
}

export async function assertCanWriteIssues(user: User, projectKeyOrId?: string | number | null): Promise<void> {
  if (!(await canWriteIssues(user, projectKeyOrId))) throw new Error('Forbidden: viewers cannot create or edit issues');
}

export async function assertCanViewWiki(user: User, spaceKey: string, pageId?: number | null): Promise<void> {
  if (!(await canViewWiki(user, spaceKey, pageId))) throw new Error('Forbidden: no wiki view access for this space');
}

export async function assertCanWriteWiki(user: User, spaceKey: string, pageId?: number | null): Promise<void> {
  if (!(await canWriteWiki(user, spaceKey, pageId))) throw new Error('Forbidden: no wiki write access for this space');
}

export {
  canAccessHelpdeskDesk,
  canCreateHelpdeskTicket,
  canManageAutomation,
  canViewHelpdeskTicket,
} from '@/lib/capabilities';

import {
  canAccessHelpdeskDesk as deskAccess,
  canManageAutomation as automationAccess,
} from '@/lib/capabilities';

export function assertCanManageAutomation(user: User): void {
  if (!automationAccess(user)) throw new Error('Forbidden: only admins can manage automation');
}

export function assertCanAccessHelpdeskDesk(user: User): void {
  if (!deskAccess(user)) throw new Error('Forbidden: helpdesk agent desk only');
}

/** Space settings / ACL admin UI. */
export async function canManageSpaceAcl(user: User, spaceKey: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const space = await getSpace(spaceKey.toUpperCase());
  if (!space) return false;
  if (space.kind === 'personal' && space.ownerUserId === user.id) return true;
  return false;
}
