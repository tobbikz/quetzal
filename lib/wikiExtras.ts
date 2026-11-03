import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Issue, WikiPage } from '@/lib/types';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';

export const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads');

/** Shared extras tables for deep wiki macros. */
try {
  mkdirSync(UPLOADS_DIR, { recursive: true });
} catch {
  /* ignore */
}

/* DDL skipped — migrations */ void 0;

function stamp(): string {
  return new Date().toISOString();
}

export type PageAttachment = {
  id: number;
  pageId: number;
  filename: string;
  storedName: string;
  mime: string;
  size: number;
  uploadedBy: number;
  createdAt: string;
  url: string;
};

export type PageVersion = {
  id: number;
  pageId: number;
  version: number;
  title: string;
  body: string;
  authorId: number;
  createdAt: string;
};

export type PageTemplate = {
  id: number;
  spaceId: number | null;
  name: string;
  title: string;
  body: string;
  createdAt: string;
};

export async function listPageLabels(pageId: number): Promise<string[]> {
  return (await qAll('SELECT label FROM page_labels WHERE page_id = ? ORDER BY label', [pageId]) as { label: string }[]).map(
    (row) => row.label,
  );
}

export async function setPageLabels(pageId: number, labels: string[]): Promise<void> {
  const clean = [...new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean))];
  await qRun('DELETE FROM page_labels WHERE page_id = ?', [pageId]);
  
  for (const label of clean) await qRun('INSERT INTO page_labels (page_id, label) VALUES (?, ?)', [pageId, label]);
}

export async function pagesByLabel(label: string, spaceKey?: string): Promise<WikiPage[]> {
  const like = label.trim().toLowerCase();
  if (!like) return [];
  const rows = spaceKey
    ? (await qAll(`SELECT pg.*, s.key AS space_key
           FROM pages pg
           JOIN spaces s ON s.id = pg.space_id
           JOIN page_labels pl ON pl.page_id = pg.id
           WHERE s.key = ? AND pl.label = ?
           ORDER BY pg.title`, [spaceKey, like]) as Record<string, unknown>[])
    : (await qAll(`SELECT pg.*, s.key AS space_key
           FROM pages pg
           JOIN spaces s ON s.id = pg.space_id
           JOIN page_labels pl ON pl.page_id = pg.id
           WHERE pl.label = ?
           ORDER BY pg.title`, [like]) as Record<string, unknown>[]);
  return rows.map((row) => ({
    id: Number(row.id),
    spaceId: Number(row.space_id),
    spaceKey: String(row.space_key),
    parentId: row.parent_id == null ? null : Number(row.parent_id),
    slug: String(row.slug),
    title: String(row.title),
    body: String(row.body),
    authorId: Number(row.author_id),
    updatedAt: String(row.updated_at),
  }));
}

export async function popularLabels(limit = 12): Promise<{ label: string; count: number }[]> {
  return (
    await qAll(`SELECT label, COUNT(*) AS count FROM page_labels GROUP BY label ORDER BY count DESC, label ASC LIMIT ?`, [limit]) as { label: string; count: number }[]
  ).map((row) => ({ label: row.label, count: Number(row.count) }));
}

export async function listPageAttachments(pageId: number): Promise<PageAttachment[]> {
  return (await qAll('SELECT * FROM page_attachments WHERE page_id = ? ORDER BY id DESC', [pageId]) as Record<string, unknown>[]).map(
    (row) => ({
      id: Number(row.id),
      pageId: Number(row.page_id),
      filename: String(row.filename),
      storedName: String(row.stored_name),
      mime: String(row.mime),
      size: Number(row.size),
      uploadedBy: Number(row.uploaded_by),
      createdAt: String(row.created_at),
      url: `/uploads/${String(row.stored_name)}`,
    }),
  );
}

export async function addPageAttachment(input: {
  pageId: number;
  filename: string;
  storedName: string;
  mime: string;
  size: number;
  uploadedBy: number;
}): Promise<PageAttachment> {
  const created = stamp();
  const id = await qInsertReturningId(`INSERT INTO page_attachments (page_id, filename, stored_name, mime, size, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [input.pageId, input.filename, input.storedName, input.mime, input.size, input.uploadedBy, created]);
  
  return (await listPageAttachments(input.pageId)).find((item) => item.id === id)!;
}

export async function savePageVersion(pageId: number, title: string, body: string, authorId: number): Promise<void> {
  const last = await qGet('SELECT MAX(version) AS v FROM page_versions WHERE page_id = ?', [pageId]) as { v: number | null };
  const version = Number(last?.v || 0) + 1;
  await qRun(`INSERT INTO page_versions (page_id, version, title, body, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [pageId, version, title, body, authorId, stamp()]);
}

export async function listPageVersions(pageId: number): Promise<PageVersion[]> {
  return (await qAll('SELECT * FROM page_versions WHERE page_id = ? ORDER BY version DESC', [pageId]) as Record<string, unknown>[]).map(
    (row) => ({
      id: Number(row.id),
      pageId: Number(row.page_id),
      version: Number(row.version),
      title: String(row.title),
      body: String(row.body),
      authorId: Number(row.author_id),
      createdAt: String(row.created_at),
    }),
  );
}

export async function listPageProperties(pageId: number): Promise<{ key: string; value: string }[]> {
  return (await qAll('SELECT key, value FROM page_properties WHERE page_id = ? ORDER BY key', [pageId]) as {
    key: string;
    value: string;
  }[]).map((row) => ({ key: row.key, value: row.value }));
}

export async function setPageProperties(pageId: number, props: { key: string; value: string }[]): Promise<void> {
  await qRun('DELETE FROM page_properties WHERE page_id = ?', [pageId]);
  
  for (const prop of props) {
    const key = prop.key.trim();
    if (!key) continue;
    await qRun('INSERT INTO page_properties (page_id, key, value) VALUES (?, ?, ?)', [pageId, key, prop.value]);
  }
}

export async function ensureDefaultTemplates(): Promise<void> {
  const count = await qGet('SELECT COUNT(*) AS n FROM page_templates') as { n: number };
  if (count.n > 0) return;
  const created = stamp();
  await qRun(`INSERT INTO page_templates (space_id, name, title, body, created_at) VALUES (NULL, ?, ?, ?, ?)`, ['Blank',
    'New page',
    '<p></p>',
    created,]);
  await qRun(`INSERT INTO page_templates (space_id, name, title, body, created_at) VALUES (NULL, ?, ?, ?, ?)`, ['Decision',
    'Decision record',
    `<h1>Decision</h1><div data-type="decision"><div class="wiki-decision-mark">✓</div><div class="wiki-decision-body"><p>We decided to…</p></div></div><h2>Context</h2><p></p><h2>Consequences</h2><p></p>`,
    created,]);
  await qRun(`INSERT INTO page_templates (space_id, name, title, body, created_at) VALUES (NULL, ?, ?, ?, ?)`, ['Runbook',
    'Runbook',
    `<h1>Runbook</h1><aside data-type="panel" data-panel="info" class="wiki-panel wiki-panel-info"><p>Purpose…</p></aside><h2>Steps</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Step one</p></div></li></ul>`,
    created,]);
}

// deferred: await ensureDefaultTemplates();
export async function listPageTemplates(spaceId?: number | null): Promise<PageTemplate[]> {
  const rows = (
    spaceId
      ? await qAll('SELECT * FROM page_templates WHERE space_id IS NULL OR space_id = ? ORDER BY name', [spaceId])
      : await qAll('SELECT * FROM page_templates WHERE space_id IS NULL ORDER BY name')
  ) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    spaceId: row.space_id == null ? null : Number(row.space_id),
    name: String(row.name),
    title: String(row.title),
    body: String(row.body),
    createdAt: String(row.created_at),
  }));
}

export async function getPageTemplate(id: number): Promise<PageTemplate | undefined> {
  return (await listPageTemplates()).find((item) => item.id === id) ??
    (await listPageTemplates(null)).find((item) => item.id === id);
}

/** Very small JQL-ish filter against local issues. */
export async function queryIssuesLoose(jql: string, limit = 40): Promise<Issue[]> {
  const text = jql.trim();
  const { listIssues, getProject } = require('@/lib/db') as typeof import('@/lib/db');
  const projectMatch = /project\s*=\s*([A-Z][A-Z0-9]+)/i.exec(text);
  const statusMatch = /status\s*(!=|=)\s*([a-z_ ]+)/i.exec(text);
  const query: { project?: string; status?: string; q?: string } = {};
  if (projectMatch) query.project = projectMatch[1].toUpperCase();
  if (statusMatch) {
    const op = statusMatch[1];
    const raw = statusMatch[2].trim().toLowerCase().replace(/\s+/g, '_');
    if (op === '=') query.status = raw === 'done' ? 'done' : raw;
  }
  let issues = await listIssues(query);
  if (statusMatch?.[1] === '!=') {
    const raw = statusMatch[2].trim().toLowerCase().replace(/\s+/g, '_');
    issues = issues.filter((issue) => issue.status !== raw);
  }
  if (!projectMatch && !statusMatch && text) {
    const q = text.toLowerCase();
    issues = (await listIssues({})).filter(
      (issue) =>
        issue.key.toLowerCase().includes(q) ||
        issue.summary.toLowerCase().includes(q) ||
        issue.labels.toLowerCase().includes(q),
    );
  }
  void getProject;
  return issues.slice(0, limit);
}

export async function scanTasksInSpace(spaceKey: string): Promise<{ text: string; pageTitle: string; href: string; done: boolean }[]> {
  const { pagesInSpace } = require('@/lib/db') as typeof import('@/lib/db');
  const out: { text: string; pageTitle: string; href: string; done: boolean }[] = [];
  for (const page of await pagesInSpace(spaceKey)) {
    const checked = [...page.body.matchAll(/data-type="taskItem"[^>]*data-checked="(true|false)"[\s\S]*?<p>([\s\S]*?)<\/p>/gi)];
    for (const match of checked) {
      out.push({
        done: match[1] === 'true',
        text: match[2].replace(/<[^>]+>/g, '').trim() || 'Task',
        pageTitle: page.title,
        href: `/wiki/${page.spaceKey}/${page.slug}`,
      });
    }
  }
  return out.slice(0, 50);
}

export async function scanDecisionsInSpace(spaceKey: string): Promise<{ text: string; pageTitle: string; href: string }[]> {
  const { pagesInSpace } = require('@/lib/db') as typeof import('@/lib/db');
  const out: { text: string; pageTitle: string; href: string }[] = [];
  for (const page of await pagesInSpace(spaceKey)) {
    const matches = [...page.body.matchAll(/data-type="decision"[\s\S]*?<p>([\s\S]*?)<\/p>/gi)];
    for (const match of matches) {
      out.push({
        text: match[1].replace(/<[^>]+>/g, '').trim() || 'Decision',
        pageTitle: page.title,
        href: `/wiki/${page.spaceKey}/${page.slug}`,
      });
    }
  }
  return out.slice(0, 50);
}

export function parseLabelsInput(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function parsePropertiesInput(raw: string): { key: string; value: string }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return { key: line, value: '' };
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });
}


export async function getPageAttachmentByStoredName(storedName: string): Promise<PageAttachment | undefined> {
  const row = await qGet(`SELECT * FROM page_attachments WHERE stored_name = ? LIMIT 1`, [storedName]);
  if (!row) return undefined;
  return {
    id: Number(row.id),
    pageId: Number(row.page_id),
    filename: String(row.filename ?? ''),
    storedName: String(row.stored_name),
    mime: String(row.mime ?? 'application/octet-stream'),
    size: Number(row.size ?? 0),
    uploadedBy: Number(row.uploaded_by ?? 0),
    createdAt: String(row.created_at),
    url: `/uploads/${String(row.stored_name)}`,
  };
}

export type PagePermGrant = {
  granteeType: 'anyone' | 'application_role' | 'space_member' | 'project_role' | 'user';
  grantee?: string;
};

async function ensurePageMeta(pageId: number): Promise<void> {
  await qRun(
    `INSERT INTO wiki_page_meta (page_id, view_count) VALUES (?, 0) ON CONFLICT (page_id) DO NOTHING`,
    [pageId],
  );
}

export async function isPageTrashed(pageId: number): Promise<boolean> {
  const row = await qGet<{ deleted_at: string | null }>(
    `SELECT deleted_at FROM wiki_page_meta WHERE page_id = ?`,
    [pageId],
  );
  return row?.deleted_at != null;
}

export async function softDeletePage(pageId: number, userId: number): Promise<void> {
  await ensurePageMeta(pageId);
  await qRun(
    `UPDATE wiki_page_meta SET deleted_at = ?, deleted_by = ? WHERE page_id = ?`,
    [stamp(), userId, pageId],
  );
}

export async function restorePage(pageId: number): Promise<void> {
  await ensurePageMeta(pageId);
  await qRun(`UPDATE wiki_page_meta SET deleted_at = NULL, deleted_by = NULL WHERE page_id = ?`, [pageId]);
}

export async function filterActivePages(pages: WikiPage[]): Promise<WikiPage[]> {
  if (pages.length === 0) return [];
  const trashed = await qAll<{ page_id: number }>(
    `SELECT page_id FROM wiki_page_meta WHERE deleted_at IS NOT NULL`,
  );
  const gone = new Set(trashed.map((r) => Number(r.page_id)));
  return pages.filter((p) => !gone.has(p.id));
}

export type WikiHomeActivity = {
  kind: 'updated' | 'edited' | 'comment';
  at: string;
  pageId: number;
  spaceKey: string;
  slug: string;
  title: string;
  authorId: number;
  detail?: string;
};

/** Recent wiki pulse for /wiki home — skips soft-deleted pages. */
export async function listWikiHomeActivity(limit = 16): Promise<WikiHomeActivity[]> {
  const n = Math.max(1, Math.min(40, limit));
  const updated = await qAll<Record<string, unknown>>(
    `SELECT pg.id, pg.slug, pg.title, pg.author_id, pg.updated_at, s.key AS space_key
       FROM pages pg
       JOIN spaces s ON s.id = pg.space_id
       LEFT JOIN wiki_page_meta m ON m.page_id = pg.id
      WHERE m.deleted_at IS NULL
      ORDER BY pg.updated_at DESC
      LIMIT ?`,
    [n],
  );
  const edits = await qAll<Record<string, unknown>>(
    `SELECT v.page_id, v.version, v.title, v.author_id, v.created_at,
            pg.slug, s.key AS space_key
       FROM page_versions v
       JOIN pages pg ON pg.id = v.page_id
       JOIN spaces s ON s.id = pg.space_id
       LEFT JOIN wiki_page_meta m ON m.page_id = pg.id
      WHERE m.deleted_at IS NULL
      ORDER BY v.created_at DESC
      LIMIT ?`,
    [n],
  );
  const comments = await qAll<Record<string, unknown>>(
    `SELECT c.page_id, c.author_id, c.created_at, c.body,
            pg.slug, pg.title, s.key AS space_key
       FROM page_comments c
       JOIN pages pg ON pg.id = c.page_id
       JOIN spaces s ON s.id = pg.space_id
       LEFT JOIN wiki_page_meta m ON m.page_id = pg.id
      WHERE m.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT ?`,
    [n],
  );

  const feed: WikiHomeActivity[] = [
    ...updated.map((row) => ({
      kind: 'updated' as const,
      at: String(row.updated_at),
      pageId: Number(row.id),
      spaceKey: String(row.space_key),
      slug: String(row.slug),
      title: String(row.title),
      authorId: Number(row.author_id),
    })),
    ...edits.map((row) => ({
      kind: 'edited' as const,
      at: String(row.created_at),
      pageId: Number(row.page_id),
      spaceKey: String(row.space_key),
      slug: String(row.slug),
      title: String(row.title),
      authorId: Number(row.author_id),
      detail: `v${Number(row.version)}`,
    })),
    ...comments.map((row) => ({
      kind: 'comment' as const,
      at: String(row.created_at),
      pageId: Number(row.page_id),
      spaceKey: String(row.space_key),
      slug: String(row.slug),
      title: String(row.title),
      authorId: Number(row.author_id),
      detail: String(row.body || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 80),
    })),
  ];

  feed.sort((a, b) => b.at.localeCompare(a.at));
  const seen = new Set<string>();
  const out: WikiHomeActivity[] = [];
  for (const item of feed) {
    const key = `${item.kind}:${item.pageId}:${item.at}:${item.detail || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= n) break;
  }
  return out;
}

export type TrashedPage = WikiPage & { deletedAt: string; deletedBy: number | null };

export async function listTrashedPages(spaceKey: string): Promise<TrashedPage[]> {
  const rows = await qAll<Record<string, unknown>>(
    `SELECT pg.*, s.key AS space_key, m.deleted_at, m.deleted_by
       FROM pages pg
       JOIN spaces s ON s.id = pg.space_id
       JOIN wiki_page_meta m ON m.page_id = pg.id
      WHERE s.key = ? AND m.deleted_at IS NOT NULL
      ORDER BY m.deleted_at DESC`,
    [spaceKey.toUpperCase()],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    spaceId: Number(row.space_id),
    spaceKey: String(row.space_key),
    parentId: row.parent_id == null ? null : Number(row.parent_id),
    slug: String(row.slug),
    title: String(row.title),
    body: String(row.body),
    authorId: Number(row.author_id),
    updatedAt: String(row.updated_at),
    deletedAt: String(row.deleted_at),
    deletedBy: row.deleted_by == null ? null : Number(row.deleted_by),
  }));
}

/** Blog posts: pages with property type=blog, or slug prefix blog-. */
export type BlogPage = WikiPage & { viewCount: number };

export async function listBlogPosts(spaceKey: string): Promise<BlogPage[]> {
  const rows = await qAll<Record<string, unknown>>(
    `SELECT pg.*, s.key AS space_key, COALESCE(m.view_count, 0) AS view_count
       FROM pages pg
       JOIN spaces s ON s.id = pg.space_id
       LEFT JOIN wiki_page_meta m ON m.page_id = pg.id
       LEFT JOIN page_properties pp ON pp.page_id = pg.id AND pp.key = 'type'
      WHERE s.key = ?
        AND (m.deleted_at IS NULL)
        AND (pp.value = 'blog' OR pg.slug LIKE 'blog-%')
      ORDER BY pg.updated_at DESC`,
    [spaceKey.toUpperCase()],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    spaceId: Number(row.space_id),
    spaceKey: String(row.space_key),
    parentId: row.parent_id == null ? null : Number(row.parent_id),
    slug: String(row.slug),
    title: String(row.title),
    body: String(row.body),
    authorId: Number(row.author_id),
    updatedAt: String(row.updated_at),
    viewCount: Number(row.view_count ?? 0),
  }));
}

export async function getPageViewCount(pageId: number): Promise<number> {
  const row = await qGet<{ view_count: number }>(`SELECT view_count FROM wiki_page_meta WHERE page_id = ?`, [pageId]);
  return Number(row?.view_count ?? 0);
}

export async function incrementPageView(pageId: number): Promise<number> {
  await ensurePageMeta(pageId);
  await qRun(`UPDATE wiki_page_meta SET view_count = view_count + 1 WHERE page_id = ?`, [pageId]);
  return getPageViewCount(pageId);
}

export async function listPageRevisions(pageId: number): Promise<PageVersion[]> {
  const fromRevisions = await qAll<Record<string, unknown>>(
    `SELECT * FROM page_revisions WHERE page_id = ? ORDER BY version DESC`,
    [pageId],
  );
  if (fromRevisions.length > 0) {
    return fromRevisions.map((row) => ({
      id: Number(row.id),
      pageId: Number(row.page_id),
      version: Number(row.version),
      title: String(row.title),
      body: String(row.body),
      authorId: Number(row.author_id),
      createdAt: String(row.created_at),
    }));
  }
  return listPageVersions(pageId);
}

export async function getPageRevision(pageId: number, version: number): Promise<PageVersion | undefined> {
  const row =
    (await qGet<Record<string, unknown>>(
      `SELECT * FROM page_revisions WHERE page_id = ? AND version = ?`,
      [pageId, version],
    )) ??
    (await qGet<Record<string, unknown>>(
      `SELECT * FROM page_versions WHERE page_id = ? AND version = ?`,
      [pageId, version],
    ));
  if (!row) return undefined;
  return {
    id: Number(row.id),
    pageId: Number(row.page_id),
    version: Number(row.version),
    title: String(row.title),
    body: String(row.body),
    authorId: Number(row.author_id),
    createdAt: String(row.created_at),
  };
}

/** Simple line diff for history UI. */
export function diffText(a: string, b: string): Array<{ type: 'add' | 'del' | 'same'; text: string }> {
  const left = a.split('\n');
  const right = b.split('\n');
  const max = Math.max(left.length, right.length);
  const out: Array<{ type: 'add' | 'del' | 'same'; text: string }> = [];
  for (let i = 0; i < max; i++) {
    const L = left[i];
    const R = right[i];
    if (L === R) out.push({ type: 'same', text: L ?? '' });
    else {
      if (L != null) out.push({ type: 'del', text: L });
      if (R != null) out.push({ type: 'add', text: R });
    }
  }
  return out;
}

export async function clearPagePermissions(pageId: number): Promise<void> {
  await qRun(`DELETE FROM page_permissions WHERE page_id = ?`, [pageId]);
}

export async function replacePagePermissionSet(
  pageId: number,
  permission: string,
  grants: Array<{ granteeType: PagePermGrant['granteeType']; grantee?: string }>,
): Promise<void> {
  await qRun(`DELETE FROM page_permissions WHERE page_id = ? AND permission = ?`, [pageId, permission]);
  for (const grant of grants) {
    await qRun(
      `INSERT INTO page_permissions (page_id, permission, grantee_type, grantee) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [pageId, permission, grant.granteeType, grant.grantee ?? ''],
    );
  }
}

export async function storePageAttachment(input: {
  pageId: number;
  filename: string;
  bytes: Buffer | Uint8Array;
  mime?: string;
  uploadedBy: number;
}): Promise<PageAttachment> {
  mkdirSync(UPLOADS_DIR, { recursive: true });
  const safe = input.filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
  const storedName = `${Date.now()}-${randomBytes(6).toString('hex')}-${safe}`;
  const buf = Buffer.from(input.bytes);
  writeFileSync(join(UPLOADS_DIR, storedName), buf);
  return addPageAttachment({
    pageId: input.pageId,
    filename: input.filename,
    storedName,
    mime: input.mime ?? 'application/octet-stream',
    size: buf.length,
    uploadedBy: input.uploadedBy,
  });
}

