import { cookies } from 'next/headers';
import { getUser, listProjects, listUsers } from './db';
import {
  SITE_COOKIE,
  listSites,
  listSitesForUser,
  resolveSiteForUser,
  type Site,
} from './sites';
import type { Project, User } from './types';

export async function currentUser(): Promise<User> {
  const jar = await cookies();
  const id = Number(jar.get('quetzal_uid')?.value);
  const user = Number.isFinite(id) && id > 0 ? await getUser(id) : undefined;
  if (user) return user;
  const users = await listUsers();
  const fallback = users[0];
  if (!fallback) throw new Error('No users seeded');
  return fallback;
}

export async function currentSite(): Promise<Site> {
  const jar = await cookies();
  const user = await currentUser();
  return await resolveSiteForUser(user.id, jar.get(SITE_COOKIE)?.value ?? undefined);
}

export async function currentProject(): Promise<Project> {
  const jar = await cookies();
  const site = await currentSite();
  const projects = await listProjects(site.id);
  const key = jar.get('quetzal_project')?.value;
  const all = projects.length ? projects : await listProjects();
  const project = all.find((item) => item.key === key) ?? all[0];
  if (!project) throw new Error('No project');
  return project;
}

/** Actor from quetzal_uid cookie (falls back to first seeded user — same as currentUser). */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new Error('Not signed in');
  return user;
}

export { listSites, listSitesForUser, SITE_COOKIE };
