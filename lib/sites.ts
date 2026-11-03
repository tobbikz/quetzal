import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export const SITE_COOKIE = 'quetzal_site';
export const DEFAULT_SITE_KEY = 'HQ';

export interface Site {
  id: number;
  key: string;
  name: string;
}

export interface SiteMember {
  siteId: number;
  userId: number;
  name: string;
  email: string;
  role: string;
}

function mapSite(row: Record<string, unknown>): Site {
  return {
    id: Number(row.id),
    key: String(row.key),
    name: String(row.name),
  };
}

async function usersTableReady(): Promise<boolean> {
  const row = await qGet(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'quetzal' AND table_name = 'users'`) as { name: string } | undefined;
  return Boolean(row);
}

/** Create sites table, seed HQ + Branch, and attach site_id to projects/spaces. */
export async function ensureSites(): Promise<void> {
  /* DDL skipped — migrations */ void 0;

  const count = await qGet('SELECT COUNT(*) AS n FROM sites') as { n: number };
  if (count.n === 0) {
    await qRun(`
      INSERT INTO sites (id, key, name) VALUES
        (1, 'HQ', 'Headquarters'),
        (2, 'BR', 'Branch');
    `);
  } else {
    await qRun(`INSERT INTO sites (id, key, name) VALUES (1, 'HQ', 'Headquarters') ON CONFLICT DO NOTHING`);
    await qRun(`INSERT INTO sites (id, key, name) VALUES (2, 'BR', 'Branch') ON CONFLICT DO NOTHING`);
  }

  const hq = (await getSiteByKey(DEFAULT_SITE_KEY))?? await getSiteById(1);
  if (!hq) throw new Error('HQ site missing');

  const projectCols = (await qAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_schema = 'quetzal' AND table_name = 'projects'`)) as { name: string }[];
  if (projectCols.length > 0 && !projectCols.some((column) => column.name === 'site_id')) {
    await qRun('ALTER TABLE projects ADD COLUMN site_id INTEGER REFERENCES sites(id)');
  }
  if (projectCols.length > 0) {
    await qRun('UPDATE projects SET site_id = ? WHERE site_id IS NULL', [hq.id]);
  }

  const spaceCols = (await qAll(`SELECT column_name AS name FROM information_schema.columns WHERE table_schema = 'quetzal' AND table_name = 'spaces'`)) as { name: string }[];
  if (spaceCols.length > 0 && !spaceCols.some((column) => column.name === 'site_id')) {
    await qRun('ALTER TABLE spaces ADD COLUMN site_id INTEGER REFERENCES sites(id)');
  }
  if (spaceCols.length > 0) {
    // Team spaces inherit HQ; personal spaces stay site-tagged for list filters.
    await qRun('UPDATE spaces SET site_id = ? WHERE site_id IS NULL', [hq.id]);
  }

  await ensureSiteMembers(hq);
}

/** Membership table + seed: everyone on HQ; admins on every site (no lockout). */
async function ensureSiteMembers(hq: Site): Promise<void> {
  if (!usersTableReady()) return;

  /* DDL skipped — migrations */ void 0;

  const sites = await listSites();
  const users = await qAll('SELECT id, role FROM users') as { id: number; role: string }[];
  
  for (const user of users) {
    await qRun('INSERT INTO site_members (site_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [hq.id, user.id]);
    if (user.role === 'admin') {
      for (const site of sites) await qRun('INSERT INTO site_members (site_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [site.id, user.id]);
    }
  }
}

// deferred: await ensureSites();
export async function listSites(): Promise<Site[]> {
  return (await qAll('SELECT * FROM sites ORDER BY id') as Record<string, unknown>[]).map(mapSite);
}

export async function getSiteById(id: number): Promise<Site | undefined> {
  const row = await qGet('SELECT * FROM sites WHERE id = ?', [id]) as Record<string, unknown> | undefined;
  return row ? mapSite(row) : undefined;
}

export async function getSiteByKey(key: string): Promise<Site | undefined> {
  const row = await qGet('SELECT * FROM sites WHERE key = ?', [key]) as Record<string, unknown> | undefined;
  return row ? mapSite(row) : undefined;
}

export async function resolveSiteKey(raw: string | undefined | null): Promise<Site> {
  const sites = await listSites();
  const match = raw ? sites.find((site) => site.key === raw) : undefined;
  return match ?? sites.find((site) => site.key === DEFAULT_SITE_KEY) ?? sites[0];
}

export async function isSiteMember(siteId: number, userId: number): Promise<boolean> {
  if (!Number.isInteger(siteId) || !Number.isInteger(userId) || siteId <= 0 || userId <= 0) return false;
  if (!usersTableReady()) return true;
  const row = await qGet('SELECT 1 AS ok FROM site_members WHERE site_id = ? AND user_id = ?', [siteId, userId]) as { ok: number } | undefined;
  return Boolean(row);
}

export async function listSitesForUser(userId: number): Promise<Site[]> {
  if (!usersTableReady()) return await listSites();
  return (
    await qAll(`
        SELECT s.*
        FROM sites s
        INNER JOIN site_members m ON m.site_id = s.id
        WHERE m.user_id = ?
        ORDER BY s.id
      `, [userId]) as Record<string, unknown>[]
  ).map(mapSite);
}

/** Resolve cookie site only if the user is a member; otherwise first membership / HQ. */
export async function resolveSiteForUser(userId: number, raw: string | undefined | null): Promise<Site> {
  const allowed = await listSitesForUser(userId);
  if (allowed.length === 0) {
    return await resolveSiteKey(raw);
  }
  const match = raw ? allowed.find((site) => site.key === raw) : undefined;
  return match ?? allowed.find((site) => site.key === DEFAULT_SITE_KEY) ?? allowed[0];
}

export async function listSiteMembers(siteId: number): Promise<SiteMember[]> {
  if (!usersTableReady()) return [];
  return (
    await qAll(`
        SELECT m.site_id, m.user_id, u.name, u.email, u.role
        FROM site_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.site_id = ?
        ORDER BY u.name
      `, [siteId]) as Record<string, unknown>[]
  ).map((row) => ({
    siteId: Number(row.site_id),
    userId: Number(row.user_id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
  }));
}

export async function addSiteMember(siteId: number, userId: number): Promise<boolean> {
  if (!await getSiteById(siteId) || !usersTableReady()) return false;
  const user = await qGet('SELECT id FROM users WHERE id = ?', [userId]) as { id: number } | undefined;
  if (!user) return false;
  await qRun('INSERT INTO site_members (site_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [siteId, userId]);
  return true;
}

export async function removeSiteMember(siteId: number, userId: number): Promise<boolean> {
  if (!usersTableReady()) return false;
  const site = await getSiteById(siteId);
  if (!site) return false;

  // Never strip the last membership for a user (lockout).
  const memberships = (
    await qAll('SELECT site_id FROM site_members WHERE user_id = ?', [userId]) as { site_id: number }[]
  ).map((row) => row.site_id);
  if (memberships.length <= 1 && memberships[0] === siteId) return false;

  // Keep admins on every site (seed contract).
  const user = await qGet('SELECT role FROM users WHERE id = ?', [userId]) as { role: string } | undefined;
  if (user?.role === 'admin') return false;

  const result = await qRun('DELETE FROM site_members WHERE site_id = ? AND user_id = ?', [siteId, userId]);
  return result > 0;
}
