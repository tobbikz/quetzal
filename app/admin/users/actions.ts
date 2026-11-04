'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { setUserRole } from '@/lib/audit';
import {
  createLocalUser,
  getUserAuth,
  setUserDisabled,
  setUserPassword,
} from '@/lib/db';
import { hashPassword } from '@/lib/passwords';
import { requireUser } from '@/lib/session';
import type { UserRole } from '@/lib/types';

function optionalId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function text(value: FormDataEntryValue | null, max = 200): string {
  return String(value ?? '').trim().slice(0, max);
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

export async function createLocalUserAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.role !== 'admin') throw new Error('Forbidden: admin only');

  const name = text(formData.get('name'), 80);
  const email = text(formData.get('email'), 120).toLowerCase();
  const password = String(formData.get('password') ?? '');
  const roleRaw = text(formData.get('role'), 20);
  const role: UserRole =
    roleRaw === 'admin' || roleRaw === 'viewer' ? roleRaw : 'member';

  if (!name || !email.includes('@') || password.length < 6) {
    redirect('/admin/users?error=create');
  }

  try {
    await createLocalUser({
      name,
      email,
      role,
      passwordHash: hashPassword(password),
    });
  } catch {
    redirect('/admin/users?error=exists');
  }

  revalidatePath('/admin/users');
  redirect('/admin/users?saved=created');
}

export async function resetLocalPasswordAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.role !== 'admin') throw new Error('Forbidden: admin only');

  const userId = optionalId(formData.get('user_id'));
  const password = String(formData.get('password') ?? '');
  if (!userId || password.length < 6) redirect('/admin/users?error=password');

  const target = await getUserAuth(userId);
  if (!target) redirect('/admin/users?error=invalid');

  await setUserPassword(userId, hashPassword(password));
  revalidatePath('/admin/users');
  redirect('/admin/users?saved=password');
}

export async function toggleUserDisabledAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (actor.role !== 'admin') throw new Error('Forbidden: admin only');

  const userId = optionalId(formData.get('user_id'));
  const disabled = text(formData.get('disabled'), 8) === '1';
  if (!userId) redirect('/admin/users?error=invalid');
  if (userId === actor.id) redirect('/admin/users?error=self');

  await setUserDisabled(userId, disabled);
  revalidatePath('/admin/users');
  redirect('/admin/users?saved=1');
}
