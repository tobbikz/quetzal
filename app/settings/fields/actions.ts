'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  CUSTOM_FIELD_TYPES,
  addFieldToScreen,
  createCustomField,
  createScreen,
  deleteCustomField,
  deleteScreen,
  removeFieldFromScreen,
  setProjectScreen,
  updateCustomField,
  type CustomFieldType,
} from '@/lib/customFields';
import { requireUser } from '@/lib/session';

function text(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function optionalId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Forbidden: admin only');
  return user;
}

function bounce(path = '/settings/fields'): never {
  revalidatePath('/settings/fields');
  redirect(path);
}

export async function createFieldAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const typeRaw = text(formData.get('type'), 20);
  const type = (CUSTOM_FIELD_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as CustomFieldType)
    : 'text';
  const options = text(formData.get('options'), 500)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  await createCustomField({
    name: text(formData.get('name'), 80),
    key: text(formData.get('key'), 40),
    type,
    options,
    description: text(formData.get('description'), 400),
  });
  bounce('/settings/fields?saved=1');
}

export async function updateFieldAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = optionalId(formData.get('id'));
  if (!id) bounce();
  const typeRaw = text(formData.get('type'), 20);
  const type = (CUSTOM_FIELD_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as CustomFieldType)
    : 'text';
  const options = text(formData.get('options'), 500)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  await updateCustomField(id, {
    name: text(formData.get('name'), 80),
    type,
    options,
    description: text(formData.get('description'), 400),
  });
  bounce('/settings/fields?saved=1');
}

export async function deleteFieldAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = optionalId(formData.get('id'));
  if (id) await deleteCustomField(id);
  bounce('/settings/fields?saved=1');
}

export async function createScreenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await createScreen({
    name: text(formData.get('name'), 80),
    description: text(formData.get('description'), 400),
  });
  bounce('/settings/fields?tab=screens&saved=1');
}

export async function deleteScreenAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = optionalId(formData.get('id'));
  if (id) await deleteScreen(id);
  bounce('/settings/fields?tab=screens&saved=1');
}

export async function addScreenFieldAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const screenId = optionalId(formData.get('screen_id'));
  const fieldId = optionalId(formData.get('field_id'));
  const required = formData.get('required') === '1';
  if (screenId && fieldId) await addFieldToScreen(screenId, fieldId, required);
  bounce(`/settings/fields?tab=screens&screen=${screenId ?? ''}&saved=1`);
}

export async function removeScreenFieldAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const screenId = optionalId(formData.get('screen_id'));
  const fieldId = optionalId(formData.get('field_id'));
  if (screenId && fieldId) await removeFieldFromScreen(screenId, fieldId);
  bounce(`/settings/fields?tab=screens&screen=${screenId ?? ''}&saved=1`);
}

export async function setContextAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = optionalId(formData.get('project_id'));
  const screenId = optionalId(formData.get('screen_id'));
  if (projectId && screenId) await setProjectScreen(projectId, screenId);
  bounce('/settings/fields?tab=contexts&saved=1');
}
