import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export const CUSTOM_FIELD_TYPES = ['text', 'number', 'select', 'date'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomField {
  id: number;
  key: string;
  name: string;
  type: CustomFieldType;
  options: string[];
  description: string;
}

export interface Screen {
  id: number;
  name: string;
  description: string;
}

export interface ScreenField {
  screenId: number;
  fieldId: number;
  position: number;
  required: boolean;
  field: CustomField;
}

export interface FieldContext {
  id: number;
  projectId: number;
  screenId: number;
  projectKey?: string;
  projectName?: string;
  screenName?: string;
}

export interface IssueCustomValue {
  fieldId: number;
  value: string;
  field: CustomField;
  required: boolean;
  position: number;
}

function now(): string {
  return new Date().toISOString();
}

function parseOptions(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function mapField(row: Record<string, unknown>): CustomField {
  const type = String(row.type);
  return {
    id: Number(row.id),
    key: String(row.key),
    name: String(row.name),
    type: (CUSTOM_FIELD_TYPES as readonly string[]).includes(type) ? (type as CustomFieldType) : 'text',
    options: parseOptions(row.options_json),
    description: String(row.description ?? ''),
  };
}

function mapScreen(row: Record<string, unknown>): Screen {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
  };
}

async function projectsReady(): Promise<boolean> {
  const row = await qGet(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'quetzal' AND table_name = 'projects'`) as { name: string } | undefined;
  return Boolean(row);
}

async function issuesReady(): Promise<boolean> {
  const row = await qGet(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'quetzal' AND table_name = 'issues'`) as { name: string } | undefined;
  return Boolean(row);
}

/** Schema + seed for custom fields / screens / contexts. Own module — do not touch workflows. */
export async function ensureCustomFields(): Promise<void> {
  /* DDL skipped — migrations */ void 0;

  await seedDefaults();
}

async function seedDefaults(): Promise<void> {
  const fieldCount = await qGet('SELECT COUNT(*) AS n FROM custom_fields') as { n: number };
  if (fieldCount.n === 0) {
    const insertSql = `
      INSERT INTO custom_fields (key, name, type, options_json, description)
      VALUES (?, ?, ?, ?, ?)
    `;
    await qRun(insertSql, ['environment', 'Environment', 'select', JSON.stringify(['Production', 'Staging', 'Dev']), 'Where the work applies']);
    await qRun(insertSql, ['story_points_extra', 'Business value', 'number', '[]', 'Relative business value']);
    await qRun(insertSql, ['target_date', 'Target date', 'date', '[]', 'Desired delivery day']);
    await qRun(insertSql, ['acceptance_notes', 'Acceptance notes', 'text', '[]', 'Extra acceptance criteria']);
  }

  const screenCount = await qGet('SELECT COUNT(*) AS n FROM screens') as { n: number };
  if (screenCount.n === 0) {
    await qRun(`INSERT INTO screens (id, name, description) VALUES (1, 'Default create/view', 'Standard custom field screen')`);
    const fields = await listCustomFields();
    const attachSql = `
      INSERT INTO screen_fields (screen_id, field_id, position, required)
      VALUES (1, ?, ?, ?) ON CONFLICT DO NOTHING
    `;
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index];
      await qRun(attachSql, [field.id, index, field.key === 'environment' ? 1 : 0]);
    }
  }

  if (!(await projectsReady())) return;

  const projects = await qAll('SELECT id FROM projects ORDER BY id') as { id: number }[];
  const defaultScreen = (await listScreens())[0];
  if (!defaultScreen || projects.length === 0) return;

  const insertCtxSql = `
    INSERT INTO field_contexts (project_id, screen_id) VALUES (?, ?) ON CONFLICT DO NOTHING
  `;
  for (const project of projects) {
    await qRun(insertCtxSql, [project.id, defaultScreen.id]);
  }
}

// deferred: await ensureCustomFields();
export async function listCustomFields(): Promise<CustomField[]> {
  return (await qAll('SELECT * FROM custom_fields ORDER BY name, id') as Record<string, unknown>[]).map(mapField);
}

export async function getCustomField(id: number): Promise<CustomField | undefined> {
  const row = await qGet('SELECT * FROM custom_fields WHERE id = ?', [id]) as Record<string, unknown> | undefined;
  return row ? mapField(row) : undefined;
}

export async function getCustomFieldByKey(key: string): Promise<CustomField | undefined> {
  const row = await qGet('SELECT * FROM custom_fields WHERE key = ?', [key]) as Record<string, unknown> | undefined;
  return row ? mapField(row) : undefined;
}

function slugKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export async function createCustomField(input: {
  key?: string;
  name: string;
  type: CustomFieldType;
  options?: string[];
  description?: string;
}): Promise<CustomField> {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error('Name required');
  const type = CUSTOM_FIELD_TYPES.includes(input.type) ? input.type : 'text';
  let key = slugKey(input.key || name) || `field_${Date.now()}`;
  if (await getCustomFieldByKey(key)) {
    key = `${key}_${Date.now().toString(36).slice(-4)}`;
  }
  const options = type === 'select' ? (input.options ?? []).map((o) => o.trim()).filter(Boolean) : [];
  const info = await qRun(`INSERT INTO custom_fields (key, name, type, options_json, description) VALUES (?, ?, ?, ?, ?)`, [key, name, type, JSON.stringify(options), (input.description ?? '').trim().slice(0, 400)]);
  const field = await getCustomField(Number(info));
  if (!field) throw new Error('Failed to create custom field');
  return field;
}

export async function updateCustomField(
  id: number,
  patch: { name?: string; type?: CustomFieldType; options?: string[]; description?: string },
): Promise<CustomField | undefined> {

  const existing = await getCustomField(id);
  if (!existing) return undefined;
  const name = (patch.name ?? existing.name).trim().slice(0, 80) || existing.name;
  const type = patch.type && CUSTOM_FIELD_TYPES.includes(patch.type) ? patch.type : existing.type;
  const options =
    type === 'select'
      ? (patch.options ?? existing.options).map((o) => o.trim()).filter(Boolean)
      : [];
  const description = (patch.description ?? existing.description).trim().slice(0, 400);
  await qRun(`UPDATE custom_fields SET name = ?, type = ?, options_json = ?, description = ? WHERE id = ?`, [name, type, JSON.stringify(options), description, id]);
  return await getCustomField(id);
}

export async function deleteCustomField(id: number): Promise<void> {
  await qRun('DELETE FROM custom_fields WHERE id = ?', [id]);
}

export async function listScreens(): Promise<Screen[]> {
  return (await qAll('SELECT * FROM screens ORDER BY id') as Record<string, unknown>[]).map(mapScreen);
}

export async function getScreen(id: number): Promise<Screen | undefined> {
  const row = await qGet('SELECT * FROM screens WHERE id = ?', [id]) as Record<string, unknown> | undefined;
  return row ? mapScreen(row) : undefined;
}

export async function createScreen(input: { name: string; description?: string }): Promise<Screen> {
  const name = input.name.trim().slice(0, 80) || 'Screen';
  const info = await qRun(`INSERT INTO screens (name, description) VALUES (?, ?)`, [name, (input.description ?? '').trim().slice(0, 400)]);
  const screen = await getScreen(Number(info));
  if (!screen) throw new Error('Failed to create screen');
  return screen;
}

export async function deleteScreen(id: number): Promise<void> {
  if (id === 1) return; // keep default
  await qRun('DELETE FROM screens WHERE id = ?', [id]);
}

export async function listScreenFields(screenId: number): Promise<ScreenField[]> {
  const rows = await qAll(`SELECT sf.screen_id, sf.field_id, sf.position, sf.required, f.*
       FROM screen_fields sf
       JOIN custom_fields f ON f.id = sf.field_id
       WHERE sf.screen_id = ?
       ORDER BY sf.position, f.name`, [screenId]) as Record<string, unknown>[];
  return rows.map((row) => ({
    screenId: Number(row.screen_id),
    fieldId: Number(row.field_id),
    position: Number(row.position),
    required: Number(row.required) === 1,
    field: mapField(row),
  }));
}

export async function setScreenFields(
  screenId: number,
  items: Array<{ fieldId: number; position?: number; required?: boolean }>,
): Promise<void> {

  if (!await getScreen(screenId)) return;
  await qRun('DELETE FROM screen_fields WHERE screen_id = ?', [screenId]);
  const insertSql = `INSERT INTO screen_fields (screen_id, field_id, position, required) VALUES (?, ?, ?, ?)`;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!(await getCustomField(item.fieldId))) continue;
    await qRun(insertSql, [screenId, item.fieldId, item.position ?? index, item.required ? 1 : 0]);
  }
}

export async function addFieldToScreen(screenId: number, fieldId: number, required = false): Promise<void> {
  if (!await getScreen(screenId) || !await getCustomField(fieldId)) return;
  const max = await qGet('SELECT COALESCE(MAX(position), -1) AS m FROM screen_fields WHERE screen_id = ?', [screenId]) as { m: number };
  await qRun(`INSERT INTO screen_fields (screen_id, field_id, position, required) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`, [screenId, fieldId, Number(max.m) + 1, required ? 1 : 0]);
}

export async function removeFieldFromScreen(screenId: number, fieldId: number): Promise<void> {
  await qRun('DELETE FROM screen_fields WHERE screen_id = ? AND field_id = ?', [screenId, fieldId]);
}

export async function listFieldContexts(): Promise<FieldContext[]> {
  if (!(await projectsReady())) return [];
  const rows = await qAll(`SELECT fc.id, fc.project_id, fc.screen_id, p.key AS project_key, p.name AS project_name, s.name AS screen_name
       FROM field_contexts fc
       JOIN projects p ON p.id = fc.project_id
       JOIN screens s ON s.id = fc.screen_id
       ORDER BY p.key`) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    projectId: Number(row.project_id),
    screenId: Number(row.screen_id),
    projectKey: String(row.project_key),
    projectName: String(row.project_name),
    screenName: String(row.screen_name),
  }));
}

export async function getContextForProject(projectId: number): Promise<FieldContext | undefined> {
  const row = await qGet('SELECT id, project_id, screen_id FROM field_contexts WHERE project_id = ?', [projectId]) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    screenId: Number(row.screen_id),
  };
}

export async function setProjectScreen(projectId: number, screenId: number): Promise<void> {
  if (!await getScreen(screenId)) return;
  await qRun(`INSERT INTO field_contexts (project_id, screen_id) VALUES (?, ?)
     ON CONFLICT(project_id) DO UPDATE SET screen_id = excluded.screen_id`, [projectId, screenId]);
}

/** Fields shown for a project via its field context → screen. */
export async function fieldsForProject(projectId: number): Promise<ScreenField[]> {
  const ctx = await getContextForProject(projectId);
  if (!ctx) return [];
  return await listScreenFields(ctx.screenId);
}

export async function fieldsForProjectKey(projectKey: string): Promise<ScreenField[]> {
  if (!(await projectsReady())) return [];
  const project = await qGet('SELECT id FROM projects WHERE key = ?', [projectKey]) as
    | { id: number }
    | undefined;
  if (!project) return [];
  return await fieldsForProject(project.id);
}

/** Compact map for CreateIssueHost: projectId → screen fields. */
export async function customFieldsByProject(): Promise<Record<number, ScreenField[]> > {
  if (!(await projectsReady())) return {};
  const projects = await qAll('SELECT id FROM projects') as { id: number }[];
  const out: Record<number, ScreenField[]> = {};
  for (const project of projects) {
    const fields = await fieldsForProject(project.id);
    if (fields.length) out[project.id] = fields;
  }
  return out;
}

export async function getIssueCustomValues(issueId: number): Promise<IssueCustomValue[]> {
  if (!(await issuesReady())) return [];
  const issue = await qGet('SELECT project_id FROM issues WHERE id = ?', [issueId]) as
    | { project_id: number }
    | undefined;
  if (!issue) return [];
  const screenFields = await fieldsForProject(issue.project_id);
  if (!screenFields.length) return [];

  const valueRows = await qAll('SELECT field_id, value FROM issue_custom_values WHERE issue_id = ?', [issueId]) as Array<{ field_id: number; value: string }>;
  const values = new Map(valueRows.map((row) => [row.field_id, String(row.value ?? '')]));

  return screenFields.map((sf) => ({
    fieldId: sf.fieldId,
    value: values.get(sf.fieldId) ?? '',
    field: sf.field,
    required: sf.required,
    position: sf.position,
  }));
}

export async function setIssueCustomValue(issueId: number, fieldId: number, value: string): Promise<void> {
  if (!issuesReady() || !await getCustomField(fieldId)) return;
  const normalized = value.trim().slice(0, 2000);
  await qRun(`INSERT INTO issue_custom_values (issue_id, field_id, value) VALUES (?, ?, ?)
     ON CONFLICT(issue_id, field_id) DO UPDATE SET value = excluded.value`, [issueId, fieldId, normalized]);
  await qRun('UPDATE issues SET updated_at = ? WHERE id = ?', [now(), issueId]);
}

export async function saveIssueCustomValuesFromForm(
  issueId: number,
  projectId: number,
  formData: FormData,
): Promise<void> {
  const fields = await fieldsForProject(projectId);
  for (const sf of fields) {
    const raw = formData.get(`cf_${sf.fieldId}`);
    if (raw == null) continue;
    const value = String(raw);
    await setIssueCustomValue(issueId, sf.fieldId, value);
  }
}

export function formNameForField(fieldId: number): string {
  return `cf_${fieldId}`;
}
