import { inflateRawSync } from 'node:zlib';
import {
  createIssue,
  createPage,
  ensureUserByEmail,
  getIssue,
  getPage,
  getSpace,
  getUserByEmail,
  listProjects,
  slugify,
} from '@/lib/db';
import type { IssueType, Priority, UserRole } from '@/lib/types';
import { storePageAttachment } from '@/lib/wikiExtras';

export type ImportCounts = {
  created: number;
  skipped: number;
  errors: number;
  messages: string[];
};

export type IssueImportRow = {
  project?: string;
  projectKey?: string;
  key?: string;
  type?: string;
  issuetype?: string | { name?: string };
  summary?: string;
  fields?: {
    summary?: string;
    description?: string | { content?: unknown };
    issuetype?: { name?: string };
    priority?: { name?: string } | string;
    labels?: string[] | string;
    assignee?: { emailAddress?: string; email?: string } | string;
    parent?: { key?: string } | string;
    duedate?: string;
    story_points?: number | string;
  };
  description?: string;
  priority?: string;
  labels?: string[] | string;
  assigneeEmail?: string;
  assignee?: string;
  parent?: string;
  parentKey?: string;
  points?: number | string;
  dueOn?: string;
  due?: string;
};

export type PageImportRow = {
  space?: string;
  spaceKey?: string;
  title?: string;
  body?: string;
  content?: string;
  slug?: string;
  parentId?: number | string | null;
  parentSlug?: string | null;
};

export type UserImportRow = {
  email?: string;
  name?: string;
  displayName?: string;
  role?: string;
};

export type AttachmentImportRow = {
  space?: string;
  spaceKey?: string;
  slug?: string;
  pageSlug?: string;
  filename?: string;
  name?: string;
  mime?: string;
  contentType?: string;
  /** Base64 file bytes (preferred for JSON bulk). */
  contentBase64?: string;
  data?: string;
  /** Plain UTF-8 body when contentBase64 is omitted. */
  content?: string;
  text?: string;
};

export type AttachmentFileInput = {
  spaceKey: string;
  slug: string;
  filename: string;
  mime?: string;
  bytes: Buffer | Uint8Array;
};

const ISSUE_TYPES = new Set<string>([
  'epic',
  'story',
  'task',
  'bug',
  'subtask',
  'feature',
  'improvement',
  'spike',
]);

const PRIORITIES = new Set<string>(['blocker', 'highest', 'high', 'medium', 'low', 'lowest']);

function emptyCounts(): ImportCounts {
  return { created: 0, skipped: 0, errors: 0, messages: [] };
}

function note(counts: ImportCounts, level: 'skip' | 'error' | 'ok', msg: string): void {
  if (level === 'skip') counts.skipped += 1;
  else if (level === 'error') counts.errors += 1;
  else counts.created += 1;
  if (counts.messages.length < 40) counts.messages.push(msg);
}

function asString(value: unknown, max = 50000): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim().slice(0, max);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, max);
  return '';
}

function normalizeType(raw: string): IssueType {
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, '');
  if (t === 'sub-task' || t === 'subtask') return 'subtask';
  if (ISSUE_TYPES.has(t)) return t as IssueType;
  return 'task';
}

function normalizePriority(raw: string): Priority {
  const p = raw.trim().toLowerCase();
  if (PRIORITIES.has(p)) return p as Priority;
  if (p === 'critical' || p === 'urgent') return 'highest';
  return 'medium';
}

function labelsToString(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((x) => asString(x, 40)).filter(Boolean).join(', ').slice(0, 200);
  return asString(raw, 200);
}

/** Minimal CSV parser: supports quotes, commas, CRLF. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      if (ch === '\r') i += 1;
      continue;
    }
    if (ch === '\r') {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = (cells[idx] ?? '').trim();
    });
    return obj;
  });
}

function unwrapIssueList(parsed: unknown): IssueImportRow[] {
  if (Array.isArray(parsed)) return parsed as IssueImportRow[];
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.issues)) return obj.issues as IssueImportRow[];
    if (Array.isArray(obj.values)) return obj.values as IssueImportRow[];
  }
  throw new Error('Issues JSON must be an array or { "issues": [...] }');
}

function unwrapPageList(parsed: unknown): PageImportRow[] {
  if (Array.isArray(parsed)) return parsed as PageImportRow[];
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.pages)) return obj.pages as PageImportRow[];
    if (Array.isArray(obj.results)) return obj.results as PageImportRow[];
  }
  throw new Error('Wiki JSON must be an array or { "pages": [...] }');
}

function unwrapUserList(parsed: unknown): UserImportRow[] {
  if (Array.isArray(parsed)) return parsed as UserImportRow[];
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.users)) return obj.users as UserImportRow[];
    if (Array.isArray(obj.values)) return obj.values as UserImportRow[];
  }
  throw new Error('Users JSON must be an array or { "users": [...] }');
}

function unwrapAttachmentList(parsed: unknown): AttachmentImportRow[] {
  if (Array.isArray(parsed)) return parsed as AttachmentImportRow[];
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.attachments)) return obj.attachments as AttachmentImportRow[];
    if (Array.isArray(obj.files)) return obj.files as AttachmentImportRow[];
  }
  throw new Error('Attachments JSON must be an array or { "attachments": [...] }');
}

function normalizeRole(raw: string): UserRole {
  const r = raw.trim().toLowerCase();
  if (r === 'admin' || r === 'viewer' || r === 'member') return r;
  return 'member';
}

/** Minimal ZIP reader (store + deflate). Skips directories and encrypted entries. */
export function extractZipEntries(buf: Buffer): { name: string; data: Buffer }[] {
  const out: { name: string; data: Buffer }[] = [];
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const flags = buf.readUInt16LE(offset + 6);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    const dataStart = nameEnd + extraLen;
    if (dataStart + compSize > buf.length) break;
    const name = buf.subarray(nameStart, nameEnd).toString('utf8');
    const compressed = buf.subarray(dataStart, dataStart + compSize);
    offset = dataStart + compSize;
    if (flags & 0x1) continue; // encrypted
    if (name.endsWith('/')) continue;
    try {
      let data: Buffer;
      if (method === 0) data = Buffer.from(compressed);
      else if (method === 8) data = inflateRawSync(compressed);
      else continue;
      out.push({ name, data });
    } catch {
      /* skip bad entry */
    }
  }
  return out;
}

function decodeAttachmentBytes(row: AttachmentImportRow): Buffer | null {
  const b64 = asString(row.contentBase64 ?? row.data, 12_000_000);
  if (b64) {
    try {
      return Buffer.from(b64.replace(/\s+/g, ''), 'base64');
    } catch {
      return null;
    }
  }
  const text = asString(row.content ?? row.text, 2_000_000);
  if (text) return Buffer.from(text, 'utf8');
  return null;
}

function extractIssueFields(row: IssueImportRow): {
  projectKey: string;
  key: string | null;
  type: IssueType;
  summary: string;
  description: string;
  priority: Priority;
  labels: string;
  assigneeEmail: string;
  parentKey: string | null;
  points: number | null;
  dueOn: string | null;
} {
  const fields = row.fields;
  const projectKey = asString(row.project ?? row.projectKey, 12).toUpperCase();
  const key = asString(row.key, 20).toUpperCase() || null;

  let typeRaw = asString(row.type, 20);
  if (!typeRaw && typeof row.issuetype === 'string') typeRaw = row.issuetype;
  if (!typeRaw && row.issuetype && typeof row.issuetype === 'object') typeRaw = asString(row.issuetype.name, 20);
  if (!typeRaw && fields?.issuetype) typeRaw = asString(fields.issuetype.name, 20);

  const summary = asString(row.summary ?? fields?.summary, 180);

  let description = asString(row.description, 50000);
  if (!description && typeof fields?.description === 'string') description = asString(fields.description, 50000);

  let priorityRaw = asString(row.priority, 20);
  if (!priorityRaw && typeof fields?.priority === 'string') priorityRaw = fields.priority;
  if (!priorityRaw && fields?.priority && typeof fields.priority === 'object') {
    priorityRaw = asString(fields.priority.name, 20);
  }

  const labels = labelsToString(row.labels ?? fields?.labels);

  let assigneeEmail = asString(row.assigneeEmail ?? row.assignee, 120).toLowerCase();
  if (!assigneeEmail && typeof fields?.assignee === 'string') assigneeEmail = fields.assignee.toLowerCase();
  if (!assigneeEmail && fields?.assignee && typeof fields.assignee === 'object') {
    assigneeEmail = asString(
      fields.assignee.emailAddress ?? fields.assignee.email,
      120,
    ).toLowerCase();
  }

  let parentKey = asString(row.parent ?? row.parentKey, 20).toUpperCase() || null;
  if (!parentKey && typeof fields?.parent === 'string') parentKey = fields.parent.toUpperCase();
  if (!parentKey && fields?.parent && typeof fields.parent === 'object') {
    parentKey = asString(fields.parent.key, 20).toUpperCase() || null;
  }

  const pointsRaw = row.points ?? fields?.story_points;
  const pointsNum = pointsRaw === '' || pointsRaw == null ? NaN : Number(pointsRaw);
  const points = Number.isFinite(pointsNum) ? pointsNum : null;

  const dueOn =
    asString(row.dueOn ?? row.due ?? fields?.duedate, 10) || null;

  return {
    projectKey,
    key,
    type: normalizeType(typeRaw || 'task'),
    summary,
    description,
    priority: normalizePriority(priorityRaw || 'medium'),
    labels,
    assigneeEmail,
    parentKey,
    points,
    dueOn: dueOn && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : null,
  };
}

export async function importIssuesFromJson(raw: string, reporterId: number, defaultProject?: string): Promise<ImportCounts> {
  const counts = emptyCounts();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    note(counts, 'error', 'Invalid JSON');
    return counts;
  }

  let rows: IssueImportRow[];
  try {
    rows = unwrapIssueList(parsed);
  } catch (err) {
    note(counts, 'error', err instanceof Error ? err.message : 'Bad issues payload');
    return counts;
  }

  return importIssueRows(rows, reporterId, defaultProject, counts);
}

export async function importIssuesFromCsv(raw: string, reporterId: number, defaultProject?: string): Promise<ImportCounts> {
  const counts = emptyCounts();
  const records = parseCsv(raw);
  if (records.length === 0) {
    note(counts, 'error', 'CSV has no data rows');
    return counts;
  }
  const rows: IssueImportRow[] = records.map((r) => ({
    project: r.project ?? r.project_key ?? r.projectkey,
    key: r.key,
    type: r.type ?? r.issuetype,
    summary: r.summary ?? r.title,
    description: r.description ?? r.body,
    priority: r.priority,
    labels: r.labels,
    assigneeEmail: r.assigneeemail ?? r.assignee_email ?? r.assignee,
    parent: r.parent ?? r.parent_key ?? r.parentkey,
    points: r.points ?? r.story_points,
    dueOn: r.dueon ?? r.due_on ?? r.due ?? r.duedate,
  }));
  return importIssueRows(rows, reporterId, defaultProject, counts);
}

async function importIssueRows(
  rows: IssueImportRow[],
  reporterId: number,
  defaultProject: string | undefined,
  counts: ImportCounts,
): Promise<ImportCounts> {
  const knownProjects = new Set((await listProjects()).map((p) => p.key));
  const fallback = (defaultProject ?? '').toUpperCase();

  for (let i = 0; i < rows.length; i++) {
    const idx = i + 1;
    try {
      const fields = extractIssueFields(rows[i]);
      const projectKey = fields.projectKey || fallback;
      if (!fields.summary) {
        note(counts, 'skip', `Row ${idx}: missing summary`);
        continue;
      }
      if (!projectKey || !knownProjects.has(projectKey)) {
        note(counts, 'error', `Row ${idx}: unknown project "${projectKey || '(empty)'}"`);
        continue;
      }
      if (fields.key && await getIssue(fields.key)) {
        note(counts, 'skip', `Row ${idx}: issue ${fields.key} already exists`);
        continue;
      }

      let assigneeId: number | null = null;
      if (fields.assigneeEmail) {
        try {
          const before = await getUserByEmail(fields.assigneeEmail);
          const user = await ensureUserByEmail(fields.assigneeEmail);
          assigneeId = user.id;
          if (!before && counts.messages.length < 40) {
            counts.messages.push(`Row ${idx}: created user ${user.email}`);
          }
        } catch {
          if (counts.messages.length < 40) {
            counts.messages.push(`Row ${idx}: bad assignee ${fields.assigneeEmail} — left unassigned`);
          }
        }
      }

      const issue = await createIssue({
        projectKey,
        type: fields.type,
        summary: fields.summary,
        description: fields.description,
        priority: fields.priority,
        assigneeId,
        reporterId,
        sprintId: null,
        parentKey: fields.parentKey,
        points: fields.points,
        labels: fields.labels,
        dueOn: fields.dueOn,
        key: fields.key,
      });
      note(counts, 'ok', `Row ${idx}: created ${issue.key}`);
    } catch (err) {
      note(counts, 'error', `Row ${idx}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }
  return counts;
}

export async function importPagesFromJson(raw: string, authorId: number, defaultSpace?: string): Promise<ImportCounts> {
  const counts = emptyCounts();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    note(counts, 'error', 'Invalid JSON');
    return counts;
  }

  let rows: PageImportRow[];
  try {
    rows = unwrapPageList(parsed);
  } catch (err) {
    note(counts, 'error', err instanceof Error ? err.message : 'Bad pages payload');
    return counts;
  }

  const fallback = (defaultSpace ?? '').toUpperCase();

  for (let i = 0; i < rows.length; i++) {
    const idx = i + 1;
    const row = rows[i];
    try {
      const spaceKey = asString(row.space ?? row.spaceKey, 12).toUpperCase() || fallback;
      const title = asString(row.title, 160);
      const body = asString(row.body ?? row.content, 100000);
      const slugHint = asString(row.slug, 80).toLowerCase() || null;

      if (!title) {
        note(counts, 'skip', `Row ${idx}: missing title`);
        continue;
      }
      if (!spaceKey || !await getSpace(spaceKey)) {
        note(counts, 'error', `Row ${idx}: unknown space "${spaceKey || '(empty)'}"`);
        continue;
      }

      const existingSlug = slugHint || await slugify(title);
      if (await getPage(spaceKey, existingSlug)) {
        note(counts, 'skip', `Row ${idx}: page ${spaceKey}/${existingSlug} already exists`);
        continue;
      }

      let parentId: number | null = null;
      if (row.parentId != null && row.parentId !== '') {
        const n = Number(row.parentId);
        parentId = Number.isInteger(n) && n > 0 ? n : null;
      } else if (row.parentSlug) {
        const parent = await getPage(spaceKey, asString(row.parentSlug, 80).toLowerCase());
        parentId = parent?.id ?? null;
        if (!parent && counts.messages.length < 40) {
          counts.messages.push(`Row ${idx}: parentSlug not found — creating at top level`);
        }
      }

      const page = await createPage({
        spaceKey,
        parentId,
        title,
        body,
        authorId,
      });
      note(counts, 'ok', `Row ${idx}: created ${page.spaceKey}/${page.slug}`);
    } catch (err) {
      note(counts, 'error', `Row ${idx}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }
  return counts;
}

export async function importUsersFromJson(raw: string): Promise<ImportCounts> {
  const counts = emptyCounts();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    note(counts, 'error', 'Invalid JSON');
    return counts;
  }
  let rows: UserImportRow[];
  try {
    rows = unwrapUserList(parsed);
  } catch (err) {
    note(counts, 'error', err instanceof Error ? err.message : 'Bad users payload');
    return counts;
  }
  return importUserRows(rows, counts);
}

export async function importUsersFromCsv(raw: string): Promise<ImportCounts> {
  const counts = emptyCounts();
  const records = parseCsv(raw);
  if (records.length === 0) {
    note(counts, 'error', 'CSV has no data rows');
    return counts;
  }
  const rows: UserImportRow[] = records.map((r) => ({
    email: r.email,
    name: r.name ?? r.display_name ?? r.displayname,
    role: r.role,
  }));
  return importUserRows(rows, counts);
}

async function importUserRows(rows: UserImportRow[], counts: ImportCounts): Promise<ImportCounts> {
  for (let i = 0; i < rows.length; i++) {
    const idx = i + 1;
    const row = rows[i];
    try {
      const email = asString(row.email, 120).toLowerCase();
      const name = asString(row.name ?? row.displayName, 80);
      const role = normalizeRole(asString(row.role, 20) || 'member');
      if (!email) {
        note(counts, 'skip', `Row ${idx}: missing email`);
        continue;
      }
      const before = await getUserByEmail(email);
      const user = await ensureUserByEmail(email, name || undefined, role);
      if (before) note(counts, 'skip', `Row ${idx}: ${user.email} already exists`);
      else note(counts, 'ok', `Row ${idx}: created ${user.email} (${user.role})`);
    } catch (err) {
      note(counts, 'error', `Row ${idx}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }
  return counts;
}

export async function importAttachmentsFromJson(
  raw: string,
  uploadedBy: number,
  defaultSpace?: string,
): Promise<ImportCounts> {
  const counts = emptyCounts();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    note(counts, 'error', 'Invalid JSON');
    return counts;
  }
  let rows: AttachmentImportRow[];
  try {
    rows = unwrapAttachmentList(parsed);
  } catch (err) {
    note(counts, 'error', err instanceof Error ? err.message : 'Bad attachments payload');
    return counts;
  }

  const fallback = (defaultSpace ?? '').toUpperCase();
  for (let i = 0; i < rows.length; i++) {
    const idx = i + 1;
    const row = rows[i];
    try {
      const spaceKey = asString(row.space ?? row.spaceKey, 12).toUpperCase() || fallback;
      const slug = asString(row.slug ?? row.pageSlug, 80).toLowerCase();
      const filename = asString(row.filename ?? row.name, 120) || 'file';
      const mime = asString(row.mime ?? row.contentType, 120) || 'application/octet-stream';
      if (!spaceKey || !await getSpace(spaceKey)) {
        note(counts, 'error', `Row ${idx}: unknown space "${spaceKey || '(empty)'}"`);
        continue;
      }
      if (!slug) {
        note(counts, 'skip', `Row ${idx}: missing page slug`);
        continue;
      }
      const page = await getPage(spaceKey, slug);
      if (!page) {
        note(counts, 'error', `Row ${idx}: page ${spaceKey}/${slug} not found`);
        continue;
      }
      const bytes = decodeAttachmentBytes(row);
      if (!bytes || bytes.length === 0) {
        note(counts, 'skip', `Row ${idx}: missing contentBase64/content`);
        continue;
      }
      const att = await storePageAttachment({
        pageId: page.id,
        filename,
        bytes,
        mime,
        uploadedBy,
      });
      note(counts, 'ok', `Row ${idx}: attached ${att.filename} → ${spaceKey}/${slug}`);
    } catch (err) {
      note(counts, 'error', `Row ${idx}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }
  return counts;
}

export async function importAttachmentsFromFiles(
  files: AttachmentFileInput[],
  uploadedBy: number,
): Promise<ImportCounts> {
  const counts = emptyCounts();
  for (let i = 0; i < files.length; i++) {
    const idx = i + 1;
    const file = files[i];
    try {
      const spaceKey = asString(file.spaceKey, 12).toUpperCase();
      const slug = asString(file.slug, 80).toLowerCase();
      if (!spaceKey || !await getSpace(spaceKey)) {
        note(counts, 'error', `File ${idx}: unknown space "${spaceKey || '(empty)'}"`);
        continue;
      }
      const page = await getPage(spaceKey, slug);
      if (!page) {
        note(counts, 'error', `File ${idx}: page ${spaceKey}/${slug} not found`);
        continue;
      }
      const att = await storePageAttachment({
        pageId: page.id,
        filename: file.filename || 'file',
        bytes: file.bytes,
        mime: file.mime,
        uploadedBy,
      });
      note(counts, 'ok', `File ${idx}: attached ${att.filename} → ${spaceKey}/${slug}`);
    } catch (err) {
      note(counts, 'error', `File ${idx}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }
  return counts;
}

/** Attach every file inside a ZIP to one wiki page (skips directories / __MACOSX). */
export async function importAttachmentsFromZip(
  zipBytes: Buffer,
  spaceKey: string,
  slug: string,
  uploadedBy: number,
): Promise<ImportCounts> {
  const counts = emptyCounts();
  const space = asString(spaceKey, 12).toUpperCase();
  const pageSlug = asString(slug, 80).toLowerCase();
  if (!space || !await getSpace(space)) {
    note(counts, 'error', `Unknown space "${space || '(empty)'}"`);
    return counts;
  }
  const page = await getPage(space, pageSlug);
  if (!page) {
    note(counts, 'error', `Page ${space}/${pageSlug} not found`);
    return counts;
  }
  const entries = extractZipEntries(zipBytes);
  if (entries.length === 0) {
    note(counts, 'error', 'ZIP had no readable files');
    return counts;
  }
  for (const entry of entries) {
    const base = entry.name.split(/[/\\]/).pop() || entry.name;
    if (!base || base.startsWith('.') || entry.name.includes('__MACOSX')) {
      note(counts, 'skip', `Skipped ${entry.name}`);
      continue;
    }
    try {
      const att = await storePageAttachment({
        pageId: page.id,
        filename: base,
        bytes: entry.data,
        uploadedBy,
      });
      note(counts, 'ok', `Attached ${att.filename} → ${space}/${pageSlug}`);
    } catch (err) {
      note(counts, 'error', `${base}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }
  return counts;
}

export const SAMPLE_ISSUES_JSON = `{
  "issues": [
    {
      "project": "OPS",
      "key": "OPS-9001",
      "type": "task",
      "summary": "Rotate staging secrets",
      "description": "Replace API keys before Friday deploy.",
      "priority": "high",
      "labels": ["security", "ops"],
      "assigneeEmail": "alice@example.com",
      "dueOn": "2026-11-07"
    },
    {
      "project": "OPS",
      "type": "bug",
      "summary": "Board drag drops wrong column",
      "priority": "medium",
      "labels": "ui"
    }
  ]
}`;

export const SAMPLE_ISSUES_CSV = `project,key,type,summary,description,priority,labels,assigneeEmail,dueOn
OPS,OPS-9001,task,Rotate staging secrets,Replace API keys before Friday deploy.,high,"security,ops",alice@example.com,2026-11-07
OPS,,bug,Board drag drops wrong column,,medium,ui,,`;

export const SAMPLE_PAGES_JSON = `{
  "pages": [
    {
      "space": "TEAM",
      "title": "Onboarding checklist",
      "body": "## Day 1\\n- Account access\\n- Read the handbook",
      "parentSlug": null
    },
    {
      "space": "TEAM",
      "title": "Deploy runbook",
      "body": "1. Merge to main\\n2. Watch CI\\n3. Tag release",
      "slug": "deploy-runbook"
    }
  ]
}`;

export const SAMPLE_USERS_JSON = `{
  "users": [
    { "email": "alice@example.com", "name": "Alice Ops", "role": "member" },
    { "email": "viewer@example.com", "name": "Rita Viewer", "role": "viewer" }
  ]
}`;

export const SAMPLE_ATTACHMENTS_JSON = `{
  "attachments": [
    {
      "space": "TEAM",
      "slug": "deploy-runbook",
      "filename": "notes.txt",
      "mime": "text/plain",
      "content": "rollback checklist"
    }
  ]
}`;
