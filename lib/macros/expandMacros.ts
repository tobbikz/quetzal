import { getPage, getUser, listSpaces, listUsers, pagesInSpace } from '@/lib/db';
import { runJql } from '@/lib/jql';
import {
  listPageAttachments,
  listPageLabels,
  listPageProperties,
  listPageVersions,
  pagesByLabel,
  popularLabels,
  queryIssuesLoose,
  scanDecisionsInSpace,
  scanTasksInSpace,
} from '@/lib/wikiExtras';
import { STATUS_LABEL } from '@/lib/format';
import type { Issue, IssueStatus } from '@/lib/types';

type Ctx = { spaceKey: string; slug: string; currentUserId?: number };

const ISSUE_MACRO_LIMIT = 40;

type Heading = { level: number; text: string; id: string };

type ExpandOpts = { headings?: Heading[]; depth?: number };

const INCLUDE_MAX_DEPTH = 2;

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function parseParams(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw.replaceAll('&quot;', '"')) as Record<string, string>;
  } catch {
    return {};
  }
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

function headingId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `toc-${index}-${slug || 'section'}`;
}

/** Assign stable heading ids and return the outline used by TOC. */
function collectAndIdHeadings(html: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  let index = 0;
  const out = html.replace(/<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_all, level, attrs, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, '').trim();
    if (!text) return `<h${level}${attrs}>${inner}</h${level}>`;
    const existing = /\sid=["']([^"']+)["']/i.exec(String(attrs));
    const id = existing?.[1] || headingId(text, index++);
    headings.push({ level: Number(level), text, id });
    if (existing) return `<h${level}${attrs}>${inner}</h${level}>`;
    return `<h${level}${attrs} id="${esc(id)}">${inner}</h${level}>`;
  });
  return { html: out, headings };
}

function renderToc(headings: Heading[]): string {
  if (!headings.length) return `<p class="muted">No headings yet.</p>`;
  const items = headings
    .map((heading) => `<li class="toc-l${heading.level}"><a href="#${esc(heading.id)}">${esc(heading.text)}</a></li>`)
    .join('');
  return `<nav class="wiki-toc" aria-label="Table of contents"><ol>${items}</ol></nav>`;
}

/** Resolve Include Page target: space+slug, SPACE/slug, SPACE:slug, or slug in current space. */
function resolvePageRef(params: Record<string, string>, ctx: Ctx): { spaceKey: string; slug: string } {
  const spaceParam = (params.space || params.spaceKey || '').trim();
  let slug = (params.slug || params.page || params.title || '').trim();
  const cross = slug.match(/^([A-Za-z][A-Za-z0-9_]*)\s*[/|:]\s*(.+)$/);
  if (cross) {
    return { spaceKey: cross[1]!.toUpperCase(), slug: cross[2]!.trim() };
  }
  return {
    spaceKey: (spaceParam || ctx.spaceKey).toUpperCase(),
    slug: slug || 'overview',
  };
}

function pageList(items: { spaceKey: string; slug: string; title: string; updatedAt?: string }[]): string {
  if (!items.length) return `<p class="muted">Nothing to show.</p>`;
  return `<ul class="wiki-macro-list">${items
    .map((page) => {
      const when = page.updatedAt ? ` <span class="faint">${esc(page.updatedAt.slice(0, 10))}</span>` : '';
      return `<li><a href="/wiki/${esc(page.spaceKey)}/${esc(page.slug)}">${esc(page.title)}</a>${when}</li>`;
    })
    .join('')}</ul>`;
}

function labelPills(labels: { label: string; count?: number }[]): string {
  if (!labels.length) return `<p class="muted">No labels yet.</p>`;
  return `<p class="wiki-labels">${labels
    .map((item) => `<span class="tag">${esc(item.label)}${item.count != null ? ` · ${item.count}` : ''}</span>`)
    .join(' ')}</p>`;
}

async function resolveUserId(ctx: Ctx): Promise<number> {
  return ctx.currentUserId ?? (await listUsers())[0]?.id ?? 1;
}

/** Run real JQL (lib/jql.ts) for live issue macros. */
async function issuesFromJql(jql: string, ctx: Ctx): Promise<{ issues: Issue[]; error?: string }> {
  const result = await runJql(jql.trim(), { currentUserId: await resolveUserId(ctx) });
  if (!result.ok) return { issues: [], error: result.error };
  return { issues: result.issues.slice(0, ISSUE_MACRO_LIMIT) };
}

async function issuesTable(jql: string, ctx: Ctx): Promise<string> {
  const { issues, error } = await issuesFromJql(jql, ctx);
  if (error) return `<p class="muted">QQL error: ${esc(error)}</p>`;
  if (!issues.length) return `<p class="muted">No issues match.</p>`;
  const rows = issues
    .map(
      (issue) =>
        `<tr><td><a href="/issues/${esc(issue.key)}">${esc(issue.key)}</a></td><td>${esc(issue.summary)}</td><td>${esc(STATUS_LABEL[issue.status as IssueStatus] || issue.status)}</td><td>${esc(issue.priority)}</td></tr>`,
    )
    .join('');
  return `<div class="wiki-jira-table-wrap"><table class="wiki-jira-table"><thead><tr><th>Key</th><th>Summary</th><th>Status</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function statusBars(jql: string, ctx: Ctx): Promise<string> {
  const { issues, error } = await issuesFromJql(jql, ctx);
  if (error) return `<p class="muted">QQL error: ${esc(error)}</p>`;
  const buckets = new Map<string, number>();
  for (const issue of issues) buckets.set(issue.status, (buckets.get(issue.status) || 0) + 1);
  if (!buckets.size) return `<p class="muted">No chart data.</p>`;
  const max = Math.max(...buckets.values());
  return `<div class="wiki-chart">${[...buckets.entries()]
    .map(([status, count]) => {
      const width = Math.max(8, Math.round((count / max) * 100));
      return `<div class="wiki-chart-row"><span>${esc(STATUS_LABEL[status as IssueStatus] || status)}</span><div class="wiki-chart-bar" style="width:${width}%"></div><em>${count}</em></div>`;
    })
    .join('')}</div>`;
}

function extractExcerptHtml(body: string): string | null {
  const match = body.match(/<div[^>]*data-type="excerpt"[^>]*>([\s\S]*?)<\/div>/i);
  return match?.[1] ?? null;
}

async function expandOne(macro: string, params: Record<string, string>, ctx: Ctx, opts: ExpandOpts = {}): Promise<string> {
  const pages = await pagesInSpace(ctx.spaceKey);
  const current = await getPage(ctx.spaceKey, ctx.slug);
  const depth = opts.depth ?? 0;

  switch (macro) {
    case 'toc':
    case 'toc-zone': {
      // Prefer headings from the HTML being rendered so anchors always match.
      if (opts.headings) return await renderToc(opts.headings);
      const fromBody = collectAndIdHeadings(current?.body || '');
      return await renderToc(fromBody.headings);
    }
    case 'children': {
      if (!current) return `<p class="muted">No page.</p>`;
      const kids = pages
        .filter((page) => page.parentId != null && Number(page.parentId) === Number(current.id))
        .sort((a, b) => a.title.localeCompare(b.title));
      if (!kids.length) return `<p class="muted">No child pages.</p>`;
      return pageList(kids);
    }
    case 'page-tree':
    case 'page-index':
      return pageList(pages);
    case 'page-tree-search':
    case 'livesearch':
      return `<form class="wiki-livesearch" action="/search" method="get"><input name="q" placeholder="Search…" aria-label="Search" /><button class="btn" type="submit">Search</button></form>`;
    case 'include-page': {
      const ref = resolvePageRef(params, ctx);
      if (!ref.slug) return `<p class="muted">Set a page slug to include.</p>`;
      // Avoid self-include loops.
      if (ref.spaceKey === ctx.spaceKey && ref.slug === ctx.slug) {
        return `<p class="muted">Cannot include the current page.</p>`;
      }
      const page = await getPage(ref.spaceKey, ref.slug);
      if (!page) {
        return `<p class="muted">Page not found: ${esc(ref.spaceKey)}/${esc(ref.slug)}</p>`;
      }
      const href = `/wiki/${esc(page.spaceKey)}/${esc(page.slug)}`;
      const body =
        depth >= INCLUDE_MAX_DEPTH
          ? page.body
          : expandMacros(page.body, { spaceKey: page.spaceKey, slug: page.slug, currentUserId: ctx.currentUserId }, depth + 1);
      return `<div class="wiki-include"><div class="wiki-include-head">Included: <a href="${href}">${esc(page.title)}</a></div><div class="wiki-include-body">${body}</div></div>`;
    }
    case 'excerpt': {
      // Live preview of this page's Excerpt element (data-type="excerpt").
      if (!current) return `<p class="muted">No page.</p>`;
      const inner = extractExcerptHtml(current.body);
      return inner
        ? `<div class="wiki-include wiki-excerpt-view">${inner}</div>`
        : `<p class="muted">No excerpt on this page — insert an Excerpt block first.</p>`;
    }
    case 'include-excerpt':
    case 'excerpt-include': {
      const ref = resolvePageRef(params, ctx);
      const page = await getPage(ref.spaceKey, ref.slug);
      if (!page) return `<p class="muted">Page not found: ${esc(ref.spaceKey)}/${esc(ref.slug)}</p>`;
      const inner = extractExcerptHtml(page.body);
      return `<div class="wiki-include">${inner ?? `<p class="muted">No excerpt on ${esc(page.title)}</p>`}</div>`;
    }
    case 'attachments': {
      if (!current) return `<p class="muted">No page.</p>`;
      const files = await listPageAttachments(current.id);
      if (!files.length) return `<p class="muted">No attachments yet.</p>`;
      return `<ul class="wiki-macro-list">${files
        .map((file) => `<li><a href="${esc(file.url)}" target="_blank" rel="noreferrer">${esc(file.filename)}</a> <span class="faint">${Math.round(file.size / 1024)} KB</span></li>`)
        .join('')}</ul>`;
    }
    case 'spaces-list':
      return `<ul class="wiki-macro-list">${(await listSpaces())
        .map((space) => `<li><a href="/wiki/${esc(space.key)}">${esc(space.name)}</a> <span class="faint">${esc(space.key)}</span></li>`)
        .join('')}</ul>`;
    case 'recently-updated':
    case 'recently-updated-dashboard':
      return pageList([...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8));
    case 'blog-posts':
      return pageList(await pagesByLabel('blog', ctx.spaceKey));
    case 'content-by-label':
    case 'content-report-table': {
      const label = (params.label || '').toLowerCase();
      const hits = await pagesByLabel(label, ctx.spaceKey);
      return pageList(hits.length ? hits : pages.filter((page) => page.title.toLowerCase().includes(label) || page.body.toLowerCase().includes(label)));
    }
    case 'labels-list':
    case 'related-labels': {
      const labels = current ? await listPageLabels(current.id) : [];
      return labelPills(labels.map((label) => ({ label })));
    }
    case 'popular-labels':
      return labelPills(await popularLabels());
    case 'contributors':
    case 'contributors-summary': {
      if (!current) return `<p class="muted">No page.</p>`;
      const versions = await listPageVersions(current.id);
      const ids = new Set<number>([current.authorId, ...versions.map((item) => item.authorId)]);
      const people = (await Promise.all([...ids].map((id) => getUser(id)))).filter(Boolean);
      if (!people.length) return `<p class="muted">No contributors.</p>`;
      return `<div class="wiki-contribs">${people
        .map((user) => `<span class="wiki-user-card"><span class="avatar">${esc(user!.name.slice(0, 1))}</span><strong>${esc(user!.name)}</strong></span>`)
        .join(' ')}</div>`;
    }
    case 'user-list':
      return `<ul class="wiki-macro-list">${(await listUsers())
        .map((user) => `<li>${esc(user.name)} <span class="faint">${esc(user.role)}</span></li>`)
        .join('')}</ul>`;
    case 'user-profile':
    case 'profile-picture': {
      const name = params.name || 'User';
      const user = (await listUsers()).find((item) => item.name.toLowerCase() === name.toLowerCase());
      return `<div class="wiki-user-card"><span class="avatar">${esc((user?.name || name).slice(0, 1))}</span><div><strong>${esc(user?.name || name)}</strong>${user ? `<div class="faint">${esc(user.role)}</div>` : ''}</div></div>`;
    }
    case 'change-history': {
      if (!current) return `<p class="muted">No history.</p>`;
      const versions = await listPageVersions(current.id);
      if (!versions.length) return `<p class="muted">No versions yet — edit &amp; save to start history.</p>`;
      const vItems: string[] = [];
      for (const item of versions) {
        const who = (await getUser(item.authorId))?.name || 'Someone';
        vItems.push(`<li><strong>v${item.version}</strong> ${esc(item.title)} · ${esc(who)} · <span class="faint">${esc(item.createdAt.slice(0, 16))}</span></li>`);
      }
      return `<ol class="wiki-history">${vItems.join('')}</ol>`;
    }
    case 'task-report': {
      const tasks = await scanTasksInSpace(ctx.spaceKey);
      if (!tasks.length) return `<p class="muted">No tasks found in this space.</p>`;
      return `<table class="wiki-jira-table"><thead><tr><th>Task</th><th>Status</th><th>Page</th></tr></thead><tbody>${tasks
        .map(
          (task) =>
            `<tr><td>${esc(task.text)}</td><td>${task.done ? 'Done' : 'Open'}</td><td><a href="${esc(task.href)}">${esc(task.pageTitle)}</a></td></tr>`,
        )
        .join('')}</tbody></table>`;
    }
    case 'decision-report': {
      const decisions = await scanDecisionsInSpace(ctx.spaceKey);
      if (!decisions.length) return `<p class="muted">No decisions found.</p>`;
      return `<ul class="wiki-macro-list">${decisions
        .map((item) => `<li>${esc(item.text)} · <a href="${esc(item.href)}">${esc(item.pageTitle)}</a></li>`)
        .join('')}</ul>`;
    }
    case 'create-from-template':
      return `<p><a class="btn" href="/wiki/${esc(ctx.spaceKey)}/new?title=${encodeURIComponent(params.title || 'New page')}">${esc(params.title || 'Create page')}</a></p>`;
    case 'iframe':
      if (!params.url) return `<p class="muted">Set an iframe URL.</p>`;
      return `<iframe class="wiki-iframe" src="${esc(params.url)}" title="Embedded frame" loading="lazy"></iframe>`;
    case 'widget': {
      const id = youtubeId(params.url || '');
      if (id) {
        return `<iframe class="wiki-iframe" src="https://www.youtube.com/embed/${esc(id)}" title="YouTube" allowfullscreen loading="lazy"></iframe>`;
      }
      if (params.url) return `<p><a href="${esc(params.url)}">${esc(params.url)}</a></p>`;
      return `<p class="muted">Paste a media URL.</p>`;
    }
    case 'pdf': {
      if (!params.url) return `<p class="muted">Add a PDF URL — or upload via Attachments.</p>`;
      return `<div class="wiki-file-preview"><iframe class="wiki-iframe wiki-iframe-doc" src="${esc(params.url)}" title="PDF preview" loading="lazy"></iframe><p><a href="${esc(params.url)}" target="_blank" rel="noreferrer">Open PDF</a></p></div>`;
    }
    case 'office':
    case 'onedrive': {
      if (!params.url) return `<p class="muted">Add a file URL — or upload via Attachments.</p>`;
      const lower = params.url.toLowerCase();
      if (lower.endsWith('.pdf') || lower.includes('.pdf?')) {
        return expandOne('pdf', params, ctx);
      }
      // Microsoft Office Online viewer (public URLs). Local/uploads fall back to download.
      const isHttp = /^https?:\/\//i.test(params.url);
      if (isHttp) {
        const src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(params.url)}`;
        return `<div class="wiki-file-preview"><iframe class="wiki-iframe wiki-iframe-doc" src="${esc(src)}" title="Office preview" loading="lazy"></iframe><p><a href="${esc(params.url)}" target="_blank" rel="noreferrer">Open file</a></p></div>`;
      }
      return `<div class="wiki-file-preview"><p class="muted">Local files open in a new tab (Office Online needs a public URL).</p><p><a class="btn" href="${esc(params.url)}" target="_blank" rel="noreferrer">Open file</a></p></div>`;
    }
    case 'gallery': {
      if (!current) return `<p class="muted">No page.</p>`;
      const images = (await listPageAttachments(current.id)).filter((file) => file.mime.startsWith('image/'));
      if (!images.length) return `<p class="muted">Upload images to this page to build a gallery.</p>`;
      return `<div class="wiki-gallery">${images
        .map((file) => `<a href="${esc(file.url)}" target="_blank" rel="noreferrer"><img src="${esc(file.url)}" alt="${esc(file.filename)}" /></a>`)
        .join('')}</div>`;
    }
    case 'chart':
    case 'jira-chart':
      return statusBars(params.jql || 'project = OPS', ctx);
    case 'page-properties': {
      if (!current) return `<p class="muted">No page.</p>`;
      const keyFilter = (params.key || params.name || '').trim().toLowerCase();
      let props = await listPageProperties(current.id);
      if (keyFilter) props = props.filter((prop) => prop.key.toLowerCase() === keyFilter);
      const rows: [string, string][] = keyFilter
        ? props.map((prop) => [prop.key, prop.value])
        : [
            ['Space', ctx.spaceKey],
            ['Slug', ctx.slug],
            ...props.map((prop) => [prop.key, prop.value] as [string, string]),
          ];
      if (!rows.length) return `<p class="muted">No properties${keyFilter ? ` for “${esc(keyFilter)}”` : ''}.</p>`;
      return `<table class="wiki-props"><tbody>${rows
        .map(([key, value]) => `<tr><th>${esc(key)}</th><td>${esc(value)}</td></tr>`)
        .join('')}</tbody></table>`;
    }
    case 'page-properties-report': {
      const label = (params.label || '').toLowerCase();
      const targets = label ? await pagesByLabel(label, ctx.spaceKey) : pages.slice(0, 12);
      if (!targets.length) return `<p class="muted">No pages for report.</p>`;
      const propRows: string[] = [];
      for (const page of targets) {
        const props = (await listPageProperties(page.id))
          .map((prop) => `${esc(prop.key)}=${esc(prop.value)}`)
          .join(', ');
        propRows.push(`<tr><td><a href="/wiki/${esc(page.spaceKey)}/${esc(page.slug)}">${esc(page.title)}</a></td><td>${props || '—'}</td></tr>`);
      }
      return `<table class="wiki-jira-table"><thead><tr><th>Page</th><th>Properties</th></tr></thead><tbody>${propRows.join('')}</tbody></table>`;
    }
    case 'roadmap-planner': {
      const issues = await queryIssuesLoose(params.jql || params.project ? `project = ${params.project || 'OPS'}` : 'status != done');
      return `<div class="wiki-roadmap">${issues
        .map((issue) => `<div class="wiki-roadmap-card status-${esc(issue.status)}"><a href="/issues/${esc(issue.key)}">${esc(issue.key)}</a> ${esc(issue.summary)}</div>`)
        .join('') || '<p class="muted">No roadmap items.</p>'}</div>`;
    }
    case 'network':
      return params.url ? `<p><a href="${esc(params.url)}">${esc(params.url)}</a></p>` : `<p class="muted">Add a profile URL.</p>`;
    case 'jira-issues':
    case 'work-items':
      return await issuesTable(params.jql || 'project = OPS', ctx);
    case 'jira-roadmap':
      return expandOne('roadmap-planner', { ...params, project: params.project || 'OPS' }, ctx);
    default:
      return `<div class="wiki-macro-card"><strong>${esc(macro)}</strong><p class="muted">Macro placeholder</p></div>`;
  }
}

/** Expand stored macro placeholders for view mode. */
export async function expandMacros(html: string, ctx: Ctx, depth = 0): Promise<string> {
  if (depth > INCLUDE_MAX_DEPTH) return html;
  const { html: withIds, headings } = collectAndIdHeadings(html);
  const regex = /<div([^>]*data-type="wiki-macro"[^>]*)>[\s\S]*?<\/div>/gi;
  let result = '';
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(withIds)) !== null) {
    result += withIds.slice(lastIdx, m.index);
    const attrs = m[1] || '';
    const macro = /data-macro="([^"]*)"/i.exec(attrs)?.[1] || '';
    const paramsRaw = /data-params="([^"]*)"/i.exec(attrs)?.[1] || null;
    const body = await expandOne(macro, parseParams(paramsRaw), ctx, { headings, depth });
    result += `<div class="wiki-macro-view wiki-macro-${esc(macro)}" data-macro="${esc(macro)}">${body}</div>`;
    lastIdx = regex.lastIndex;
  }
  result += withIds.slice(lastIdx);
  return result;
}
