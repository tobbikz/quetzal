'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { setUserRole } from '@/lib/audit';
import { requireUser } from '@/lib/session';
import type { UserRole } from '@/lib/types';

function optionalId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function setUserRoleAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.role !== 'admin') throw new Error('Forbidden: admin only');

  const userId = optionalId(formData.get('user_id'));
  const role = String(formData.get('role') ?? '').trim() as UserRole;
  if (!userId) redirect('/admin/users?error=invalid');
  if (role !== 'admin' && role !== 'member' && role !== 'viewer') {
    redirect('/admin/users?error=invalid');
  }

  const result = await setUserRole(userId, role, actor.id);
  if (!result.ok) {
    redirect(result.error.includes('last admin') ? '/admin/users?error=last_admin' : '/admin/users?error=1');
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
  redirect('/admin/users?saved=1');
}
