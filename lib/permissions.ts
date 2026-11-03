import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


/** Issue / project permissions (Jira-style scheme keys). */
export const ISSUE_PERMS = {
  BROWSE_PROJECTS: 'BROWSE_PROJECTS',
  CREATE_ISSUES: 'CREATE_ISSUES',
  EDIT_ISSUES: 'EDIT_ISSUES',
} as const;

export type IssuePermission = (typeof ISSUE_PERMS)[keyof typeof ISSUE_PERMS];

/** Wiki space permissions. */
export const SPACE_PERMS = {
  VIEW_SPACE: 'VIEW_SPACE',
  EDIT_SPACE: 'EDIT_SPACE',
} as const;

export type SpacePermission = (typeof SPACE_PERMS)[keyof typeof SPACE_PERMS];

export type ProjectRoleKey = 'admin' | 'developer' | 'viewer';
export type GranteeType = 'project_role' | 'application_role' | 'user' | 'anyone' | 'space_member';

export interface PermissionScheme {
  id: number;
  name: string;
  description: string;
}

export interface SchemeGrant {
  schemeId: number;
  permission: string;
  granteeType: GranteeType;
  grantee: string;
}

export interface ProjectRole {
  id: number;
  projectId: number;
  key: ProjectRoleKey;
  name: string;
}

export interface SpaceGrant {
  spaceId: number;
  permission: string;
  granteeType: GranteeType;
  grantee: string;
}

const ROLE_NAMES: Record<ProjectRoleKey, string> = {
  admin: 'Administrators',
  developer: 'Developers',
  viewer: 'Viewers',
};

function mapScheme(row: Record<string, unknown>): PermissionScheme {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
  };
}

function mapRole(row: Record<string, unknown>): ProjectRole {
  const key = String(row.key);
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    key: key === 'admin' || key === 'viewer' ? key : 'developer',
    name: String(row.name),
  };
}

/** Create ACL tables, default scheme, project roles, space grants — never lock out writers. */
export async function ensurePermissions(): Promise<void> {
  /* DDL skipped — migrations */ void 0;

  const projectCols = (await qAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_schema = 'quetzal' AND table_name = 'projects'`)) as { name: string }[];
  if (projectCols.length > 0 && !projectCols.some((column) => column.name === 'permission_scheme_id')) {
    await qRun('ALTER TABLE projects ADD COLUMN permission_scheme_id INTEGER REFERENCES permission_schemes(id)');
  }

  await seedDefaultScheme();
  await seedProjectRolesAndMembers();
  await seedSpacePermissions();
}

async function seedDefaultScheme(): Promise<void> {
  const existing = await qGet(`SELECT id FROM permission_schemes WHERE name = 'Default'`) as
    | { id: number }
    | undefined;
  let schemeId = existing?.id;
  if (!schemeId) {
    const inserted = await qRun(`INSERT INTO permission_schemes (name, description) VALUES (?, ?)`, ['Default', 'Admins and members can create/edit; viewers browse only.']);
    schemeId = Number(inserted /*LASTID*/);
  }

  const grantSql = `
    INSERT INTO permission_scheme_grants (scheme_id, permission, grantee_type, grantee)
    VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING
  `;

  // Browse: everyone (app roles + project roles).
  for (const role of ['admin', 'member', 'viewer'] as const) {
    await qRun(grantSql, [schemeId, ISSUE_PERMS.BROWSE_PROJECTS, 'application_role', role]);
  }
  for (const role of ['admin', 'developer', 'viewer'] as const) {
    await qRun(grantSql, [schemeId, ISSUE_PERMS.BROWSE_PROJECTS, 'project_role', role]);
  }

  // Create / edit: writers only (not Rita / viewer).
  for (const perm of [ISSUE_PERMS.CREATE_ISSUES, ISSUE_PERMS.EDIT_ISSUES] as const) {
    for (const role of ['admin', 'member'] as const) {
      await qRun(grantSql, [schemeId, perm, 'application_role', role]);
    }
    for (const role of ['admin', 'developer'] as const) {
      await qRun(grantSql, [schemeId, perm, 'project_role', role]);
    }
  }

  await qRun(`UPDATE projects SET permission_scheme_id = ? WHERE permission_scheme_id IS NULL`, [schemeId]);
}

async function seedProjectRolesAndMembers(): Promise<void> {
  const projects = await qAll('SELECT id FROM projects') as { id: number }[];
  const insertRoleSql = `INSERT INTO project_roles (project_id, key, name) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`;
  for (const project of projects) {
    for (const key of ['admin', 'developer', 'viewer'] as ProjectRoleKey[]) {
      await qRun(insertRoleSql, [project.id, key, ROLE_NAMES[key]]);
    }
  }

  const users = await qAll('SELECT id, role FROM users') as { id: number; role: string }[];
  const roleIdSql = `SELECT id FROM project_roles WHERE project_id = ? AND key = ?`;
  const addMemberSql = `INSERT INTO project_role_members (role_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING`;

  for (const project of projects) {
    for (const user of users) {
      const key: ProjectRoleKey =
        user.role === 'admin' ? 'admin' : user.role === 'viewer' ? 'viewer' : 'developer';
      const row = await qGet(roleIdSql, [project.id, key]) as { id: number } | undefined;
      if (row) await qRun(addMemberSql, [row.id, user.id]);
    }
  }
}

async function seedSpacePermissions(): Promise<void> {
  const spaces = await qAll('SELECT id, kind FROM spaces') as { id: number; kind: string }[];
  const grantSql = `
    INSERT INTO space_permissions (space_id, permission, grantee_type, grantee)
    VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING
  `;

  for (const space of spaces) {
    // Open view so existing demos (incl. Rita) are not locked out.
    await qRun(grantSql, [space.id, SPACE_PERMS.VIEW_SPACE, 'anyone', '']);
    for (const role of ['admin', 'member', 'viewer'] as const) {
      await qRun(grantSql, [space.id, SPACE_PERMS.VIEW_SPACE, 'application_role', role]);
    }
    // Edit: space members + global admins. Viewers never get EDIT via app role.
    await qRun(grantSql, [space.id, SPACE_PERMS.EDIT_SPACE, 'space_member', '']);
    await qRun(grantSql, [space.id, SPACE_PERMS.EDIT_SPACE, 'application_role', 'admin']);
    if (space.kind === 'personal') {
      // Personal owner path still covered by space_member seed in ensureAclSeed.
      await qRun(grantSql, [space.id, SPACE_PERMS.EDIT_SPACE, 'space_member', '']);
    }
  }
}

// deferred: await ensurePermissions();
export async function listPermissionSchemes(): Promise<PermissionScheme[]> {
  return (await qAll('SELECT * FROM permission_schemes ORDER BY id') as Record<string, unknown>[]).map(
    mapScheme,
  );
}

export async function getPermissionScheme(id: number): Promise<PermissionScheme | undefined> {
  const row = await qGet('SELECT * FROM permission_schemes WHERE id = ?', [id]) as
    | Record<string, unknown>
    | undefined;
  return row ? mapScheme(row) : undefined;
}

export async function getDefaultSchemeId(): Promise<number> {
  const row = await qGet(`SELECT id FROM permission_schemes WHERE name = 'Default'`) as
    | { id: number }
    | undefined;
  if (row) return row.id;
  await ensurePermissions();
  const again = await qGet(`SELECT id FROM permission_schemes WHERE name = 'Default'`) as {
    id: number;
  };
  return again.id;
}

export async function listSchemeGrants(schemeId: number): Promise<SchemeGrant[]> {
  return (
    await qAll(`SELECT scheme_id, permission, grantee_type, grantee FROM permission_scheme_grants WHERE scheme_id = ? ORDER BY permission, grantee_type`, [schemeId]) as Record<string, unknown>[]
  ).map((row) => ({
    schemeId: Number(row.scheme_id),
    permission: String(row.permission),
    granteeType: String(row.grantee_type) as GranteeType,
    grantee: String(row.grantee ?? ''),
  }));
}

export async function schemeIdForProject(projectId: number): Promise<number> {
  const row = await qGet('SELECT permission_scheme_id FROM projects WHERE id = ?', [projectId]) as
    | { permission_scheme_id: number | null }
    | undefined;
  return row?.permission_scheme_id ?? await getDefaultSchemeId();
}

export async function listProjectRoles(projectId: number): Promise<ProjectRole[]> {
  return (
    await qAll('SELECT * FROM project_roles WHERE project_id = ? ORDER BY id', [projectId]) as Record<
      string,
      unknown
    >[]
  ).map(mapRole);
}

export async function listProjectRoleMembers(roleId: number): Promise<number[]> {
  return (
    await qAll('SELECT user_id FROM project_role_members WHERE role_id = ?', [roleId]) as {
      user_id: number;
    }[]
  ).map((row) => row.user_id);
}

export async function userProjectRoleKeys(userId: number, projectId: number): Promise<ProjectRoleKey[]> {
  const rows = await qAll(`SELECT r.key
       FROM project_roles r
       JOIN project_role_members m ON m.role_id = r.id
       WHERE r.project_id = ? AND m.user_id = ?`, [projectId, userId]) as { key: string }[];
  return rows.map((row) =>
    row.key === 'admin' || row.key === 'viewer' ? row.key : 'developer',
  ) as ProjectRoleKey[];
}

export async function addProjectRoleMember(projectId: number, roleKey: ProjectRoleKey, userId: number): Promise<void> {
  const role = await qGet(`SELECT id FROM project_roles WHERE project_id = ? AND key = ?`, [projectId, roleKey]) as { id: number } | undefined;
  if (!role) return;
  await qRun(`INSERT INTO project_role_members (role_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, [role.id,
    userId,]);
}

export async function listSpacePermissions(spaceId: number): Promise<SpaceGrant[]> {
  return (
    await qAll(`SELECT space_id, permission, grantee_type, grantee FROM space_permissions WHERE space_id = ? ORDER BY permission, grantee_type`, [spaceId]) as Record<string, unknown>[]
  ).map((row) => ({
    spaceId: Number(row.space_id),
    permission: String(row.permission),
    granteeType: String(row.grantee_type) as GranteeType,
    grantee: String(row.grantee ?? ''),
  }));
}

export async function setSpacePermission(
  spaceId: number,
  permission: SpacePermission,
  granteeType: GranteeType,
  grantee = '',
): Promise<void> {
  await qRun(`INSERT INTO space_permissions (space_id, permission, grantee_type, grantee) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`, [spaceId, permission, granteeType, grantee]);
}

export async function clearSpacePermission(
  spaceId: number,
  permission: SpacePermission,
  granteeType: GranteeType,
  grantee = '',
): Promise<void> {
  await qRun(`DELETE FROM space_permissions WHERE space_id = ? AND permission = ? AND grantee_type = ? AND grantee = ?`, [spaceId, permission, granteeType, grantee]);
}

export async function replaceSpacePermissionSet(
  spaceId: number,
  permission: SpacePermission,
  grants: Array<{ granteeType: GranteeType; grantee?: string }>,
): Promise<void> {

  await qRun(`DELETE FROM space_permissions WHERE space_id = ? AND permission = ?`, [spaceId, permission]);
  const insertSql = `INSERT INTO space_permissions (space_id, permission, grantee_type, grantee) VALUES (?, ?, ?, ?)`;
  for (const grant of grants) {
    await qRun(insertSql, [spaceId, permission, grant.granteeType, grant.grantee ?? '']);
  }
}

export async function listPagePermissions(pageId: number): Promise<
  Array<{
    pageId: number;
    permission: string;
    granteeType: GranteeType;
    grantee: string;
  }>
> {
  return (
    (await qAll(
      `SELECT page_id, permission, grantee_type, grantee FROM page_permissions WHERE page_id = ?`,
      [pageId],
    )) as Record<string, unknown>[]
  ).map((row) => ({
    pageId: Number(row.page_id),
    permission: String(row.permission),
    granteeType: String(row.grantee_type) as GranteeType,
    grantee: String(row.grantee ?? ''),
  }));
}

export async function isSpaceMember(userId: number, spaceId: number): Promise<boolean> {
  return Boolean(
    await qGet('SELECT 1 FROM space_members WHERE space_id = ? AND user_id = ?', [spaceId, userId]),
  );
}

/** True if any scheme grant matches the user for this project permission. */
export async function hasIssuePermission(
  userId: number,
  applicationRole: string,
  projectId: number,
  permission: IssuePermission,
): Promise<boolean> {
  const schemeId = await schemeIdForProject(projectId);
  const grants = (await listSchemeGrants(schemeId)).filter((grant) => grant.permission === permission);
  if (grants.length === 0) {
    // Fail-open for writers so a half-seeded scheme never locks demos out.
    return applicationRole === 'admin' || applicationRole === 'member';
  }

  const roles = await userProjectRoleKeys(userId, projectId);
  for (const grant of grants) {
    if (grant.granteeType === 'anyone') return true;
    if (grant.granteeType === 'application_role' && grant.grantee === applicationRole) return true;
    if (grant.granteeType === 'project_role' && roles.includes(grant.grantee as ProjectRoleKey)) return true;
    if (grant.granteeType === 'user' && Number(grant.grantee) === userId) return true;
  }
  return false;
}

/** Space grant match; empty VIEW grants fail-open (browse); empty EDIT fails closed for viewers. */
export async function hasSpacePermission(
  userId: number,
  applicationRole: string,
  spaceId: number,
  permission: SpacePermission,
): Promise<boolean> {
  const grants = (await listSpacePermissions(spaceId)).filter((grant) => grant.permission === permission);
  if (grants.length === 0) {
    if (permission === SPACE_PERMS.VIEW_SPACE) return true;
    if (applicationRole === 'admin') return true;
    if (applicationRole === 'viewer') return false;
    return await isSpaceMember(userId, spaceId);
  }

  for (const grant of grants) {
    if (grant.granteeType === 'anyone') return true;
    if (grant.granteeType === 'application_role' && grant.grantee === applicationRole) return true;
    if (grant.granteeType === 'space_member' && await isSpaceMember(userId, spaceId)) return true;
    if (grant.granteeType === 'user' && Number(grant.grantee) === userId) return true;
  }
  return false;
}

/** Page-level override: if any page grants exist for the permission, they must match. */
export async function hasPagePermission(
  userId: number,
  applicationRole: string,
  pageId: number,
  permission: 'VIEW_PAGE' | 'EDIT_PAGE',
): Promise<boolean | null> {
  const grants = (await listPagePermissions(pageId)).filter((grant) => grant.permission === permission);
  if (grants.length === 0) return null;
  for (const grant of grants) {
    if (grant.granteeType === 'anyone') return true;
    if (grant.granteeType === 'application_role' && grant.grantee === applicationRole) return true;
    if (grant.granteeType === 'user' && Number(grant.grantee) === userId) return true;
  }
  return false;
}
