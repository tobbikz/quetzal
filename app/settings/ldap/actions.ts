'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveLdapSettings } from '@/lib/ldap';
import { requireUser } from '@/lib/session';

function text(value: FormDataEntryValue | null, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

export async function saveLdapSettingsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Forbidden: admin only');

  const roleRaw = text(formData.get('default_role'), 20);
  const defaultRole =
    roleRaw === 'admin' || roleRaw === 'viewer' ? roleRaw : ('member' as const);
  const bindPasswordRaw = String(formData.get('bind_password') ?? '');
  const updateBindPassword = bindPasswordRaw.trim().length > 0;

  await saveLdapSettings({
    enabled: formData.get('enabled') === 'on' || formData.get('enabled') === '1',
    url: text(formData.get('url'), 500),
    bindDn: text(formData.get('bind_dn'), 500),
    bindPassword: updateBindPassword ? bindPasswordRaw.slice(0, 500) : undefined,
    updateBindPassword,
    baseDn: text(formData.get('base_dn'), 500),
    userFilter: text(formData.get('user_filter'), 500),
    emailAttr: text(formData.get('email_attr'), 64),
    nameAttr: text(formData.get('name_attr'), 64),
    startTls: formData.get('start_tls') === 'on' || formData.get('start_tls') === '1',
    defaultRole,
  });

  revalidatePath('/settings/ldap');
  redirect('/settings/ldap?saved=1');
}
