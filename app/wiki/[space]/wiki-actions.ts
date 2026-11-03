'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canManageSpaceAcl, canWriteWiki } from '@/lib/acl';
import { getPage, getSpace } from '@/lib/db';
import {
  clearPagePermissions,
  restorePage,
  softDeletePage,
  replacePagePermissionSet,
  type PagePermGrant,
} from '@/lib/wikiExtras';
import { requireUser } from '@/lib/session';

function text(value: FormDataEntryValue | null, max = 200): string {
  return String(value ?? '').trim().slice(0, max);
}

export async function softDeletePageAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const spaceKey = text(formData.get('space'), 12).toUpperCase();
  const slug = text(formData.get('slug'), 80);
  const page = await getPage(spaceKey, slug);
  if (!page || !(await canWriteWiki(user, spaceKey, page.id))) redirect(`/wiki/${spaceKey}`);
  await softDeletePage(page.id, user.id);
  revalidatePath(`/wiki/${spaceKey}`);
  revalidatePath(`/wiki/${spaceKey}/${slug}`);
  revalidatePath(`/wiki/${spaceKey}/trash`);
  redirect(`/wiki/${spaceKey}/trash?deleted=1`);
}

export async function restorePageAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const spaceKey = text(formData.get('space'), 12).toUpperCase();
  const slug = text(formData.get('slug'), 80);
  const page = await getPage(spaceKey, slug);
  if (!page || !(await canWriteWiki(user, spaceKey, page.id))) redirect(`/wiki/${spaceKey}/trash`);
  await restorePage(page.id);
  revalidatePath(`/wiki/${spaceKey}`);
  revalidatePath(`/wiki/${spaceKey}/${slug}`);
  revalidatePath(`/wiki/${spaceKey}/trash`);
  redirect(`/wiki/${spaceKey}/${slug}`);
}

export async function savePageAclAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const spaceKey = text(formData.get('space'), 12).toUpperCase();
  const slug = text(formData.get('slug'), 80);
  const space = await getSpace(spaceKey);
  const page = await getPage(spaceKey, slug);
  if (!space || !page) redirect('/wiki/spaces');
  if (!(await canManageSpaceAcl(user, space.key))) redirect(`/wiki/${space.key}/${slug}`);

  const mode = text(formData.get('restrict_mode'), 40);
  if (mode === 'inherit') {
    await clearPagePermissions(page.id);
  } else {
    const viewMode = text(formData.get('view_mode'), 40);
    const editMode = text(formData.get('edit_mode'), 40);

    const viewGrants: Array<{ granteeType: PagePermGrant['granteeType']; grantee?: string }> =
      viewMode === 'members'
        ? [
            { granteeType: 'space_member' },
            { granteeType: 'application_role', grantee: 'admin' },
            { granteeType: 'application_role', grantee: 'member' },
          ]
        : viewMode === 'admins'
          ? [{ granteeType: 'application_role', grantee: 'admin' }]
          : [{ granteeType: 'anyone' }];

    const editGrants: Array<{ granteeType: PagePermGrant['granteeType']; grantee?: string }> =
      editMode === 'admins'
        ? [{ granteeType: 'application_role', grantee: 'admin' }]
        : [
            { granteeType: 'space_member' },
            { granteeType: 'application_role', grantee: 'admin' },
            { granteeType: 'application_role', grantee: 'member' },
          ];

    await replacePagePermissionSet(page.id, 'VIEW_PAGE', viewGrants);
    await replacePagePermissionSet(page.id, 'EDIT_PAGE', editGrants);
  }

  revalidatePath(`/wiki/${space.key}/${slug}`);
  revalidatePath(`/wiki/${space.key}/${slug}/settings`);
  redirect(`/wiki/${space.key}/${slug}/settings?saved=1`);
}
