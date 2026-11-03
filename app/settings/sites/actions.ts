'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addSiteMember, getSiteById, removeSiteMember } from '@/lib/sites';
import { requireUser } from '@/lib/session';

function optionalId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function addSiteMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Forbidden: admin only');

  const siteId = optionalId(formData.get('site_id'));
  const userId = optionalId(formData.get('user_id'));
  if (siteId && userId && await getSiteById(siteId)) {
    await addSiteMember(siteId, userId);
  }
  revalidatePath('/settings/sites');
  redirect(siteId ? `/settings/sites?site=${siteId}` : '/settings/sites');
}

export async function removeSiteMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Forbidden: admin only');

  const siteId = optionalId(formData.get('site_id'));
  const userId = optionalId(formData.get('user_id'));
  if (siteId && userId) {
    await removeSiteMember(siteId, userId);
  }
  revalidatePath('/settings/sites');
  redirect(siteId ? `/settings/sites?site=${siteId}` : '/settings/sites');
}
