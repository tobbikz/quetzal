'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addGadget,
  canEditDashboard,
  createDashboard,
  deleteDashboard,
  GADGET_TYPES,
  getDashboard,
  isProtectedDashboard,
  removeGadget,
  type GadgetType,
} from '@/lib/dashboards';
import { currentProject, requireUser } from '@/lib/session';

type Template = 'blank' | 'sprint';

function parseTemplate(raw: string): Template {
  if (raw === 'sprint') return 'sprint';
  // `personal` is accepted but coerced to blank — Personal Home was removed.
  return 'blank';
}

function templateSeeds(
  template: Template,
  projectKey: string,
): Array<{ type: GadgetType; config: Record<string, unknown> }> {
  if (template === 'sprint') {
    return [
      { type: 'sprint_burndown', config: { title: 'Burndown', projectKey } },
      { type: 'sprint_commitment', config: { title: 'Commitment vs delivered', projectKey } },
      { type: 'sprint_blockers', config: { title: 'Blockers & at-risk', projectKey } },
      { type: 'status_breakdown', config: { title: 'Status mix', projectKey } },
    ];
  }
  return [];
}

function text(value: FormDataEntryValue | null, max = 400): string {
  return String(value ?? '').trim().slice(0, max);
}

function parseId(value: FormDataEntryValue | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function parseGadgetType(raw: string): GadgetType {
  return (GADGET_TYPES as readonly string[]).includes(raw)
    ? (raw as GadgetType)
    : 'jql_count';
}

export async function createDashboardAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = text(formData.get('name'), 120);
  const description = text(formData.get('description'), 400);
  const template = parseTemplate(text(formData.get('template'), 20));
  if (!name) throw new Error('Name is required');
  const dash = await createDashboard(user.id, name, description);
  if (template !== 'blank') {
    const project = await currentProject();
    const seeds = templateSeeds(template, project.key);
    for (const seed of seeds) {
      await addGadget(dash.id, seed.type, seed.config);
    }
  }
  revalidatePath('/dashboards');
  redirect(`/dashboards/${dash.id}`);
}

export async function deleteDashboardAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = parseId(formData.get('dashboard_id'));
  const dash = await getDashboard(id);
  if (!dash || isProtectedDashboard(dash) || !(await canEditDashboard(dash, user.id, user.role))) {
    throw new Error('Cannot delete this dashboard');
  }
  await deleteDashboard(id, user.id);
  revalidatePath('/dashboards');
  redirect('/dashboards');
}

export async function addGadgetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const dashboardId = parseId(formData.get('dashboard_id'));
  const dash = await getDashboard(dashboardId);
  if (!dash || !await canEditDashboard(dash, user.id, user.role)) {
    throw new Error('Cannot edit this dashboard');
  }

  const type = parseGadgetType(text(formData.get('type'), 40));
  const title = text(formData.get('title'), 120);
  const jql = text(formData.get('jql'), 500);
  const projectKey = text(formData.get('project_key'), 40);
  const limitRaw = text(formData.get('limit'), 10);
  const limit = Number(limitRaw);
  const windowRaw = text(formData.get('window_days'), 10);
  const windowDays = Number(windowRaw);

  const config: Record<string, unknown> = {};
  if (title) config.title = title;
  if (type === 'jql_count' && jql) config.jql = jql;
  if (
    (type === 'status_breakdown' ||
      type === 'recent_activity' ||
      type === 'sprint_burndown' ||
      type === 'sprint_commitment' ||
      type === 'sprint_blockers') &&
    projectKey
  ) {
    config.projectKey = projectKey;
  }
  if (
    (type === 'recent_activity' || type === 'my_open_issues' || type === 'my_mentions') &&
    Number.isFinite(limit) &&
    limit > 0
  ) {
    config.limit = Math.min(Math.floor(limit), 40);
  }
  if (type === 'my_due_soon' && Number.isFinite(windowDays) && windowDays > 0) {
    config.windowDays = Math.min(Math.floor(windowDays), 60);
  }

  await addGadget(dashboardId, type, config);
  revalidatePath(`/dashboards/${dashboardId}`);
  revalidatePath('/dashboards');
}

export async function removeGadgetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const dashboardId = parseId(formData.get('dashboard_id'));
  const gadgetId = parseId(formData.get('gadget_id'));
  const dash = await getDashboard(dashboardId);
  if (!dash || !await canEditDashboard(dash, user.id, user.role)) {
    throw new Error('Cannot edit this dashboard');
  }
  await removeGadget(gadgetId, dash.ownerUserId);
  revalidatePath(`/dashboards/${dashboardId}`);
  revalidatePath('/dashboards');
}
