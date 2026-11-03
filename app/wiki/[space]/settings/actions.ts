'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canManageSpaceAcl } from '@/lib/acl';
import { getSpace } from '@/lib/db';
import {
  SPACE_PERMS,
  replaceSpacePermissionSet,
  type GranteeType,
} from '@/lib/permissions';
import { requireUser } from '@/lib/session';

function text(value: FormDataEntryValue | null, max = 200): string {
  return String(value ?? '').trim().slice(0, max);
}

export async function saveSpaceAclAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const spaceKey = text(formData.get('space'), 12).toUpperCase();
  const space = await getSpace(spaceKey);
  if (!space) redirect('/wiki/spaces');
  if (!await canManageSpaceAcl(user, space.key)) redirect(`/wiki/${space.key}`);

  const viewMode = text(formData.get('view_mode'), 40);
  const editMode = text(formData.get('edit_mode'), 40);

  const viewGrants: Array<{ granteeType: GranteeType; grantee?: string }> =
    viewMode === 'members'
      ? [{ granteeType: 'space_member' }, { granteeType: 'application_role', grantee: 'admin' }]
      : [
          { granteeType: 'anyone' },
          { granteeType: 'application_role', grantee: 'admin' },
          { granteeType: 'application_role', grantee: 'member' },
          { granteeType: 'application_role', grantee: 'viewer' },
        ];

  const editGrants: Array<{ granteeType: GranteeType; grantee?: string }> =
    editMode === 'admins'
      ? [{ granteeType: 'application_role', grantee: 'admin' }]
      : [
          { granteeType: 'space_member' },
          { granteeType: 'application_role', grantee: 'admin' },
        ];

  await replaceSpacePermissionSet(space.id, SPACE_PERMS.VIEW_SPACE, viewGrants);
  await replaceSpacePermissionSet(space.id, SPACE_PERMS.EDIT_SPACE, editGrants);

  revalidatePath(`/wiki/${space.key}`);
  revalidatePath(`/wiki/${space.key}/settings`);
  redirect(`/wiki/${space.key}/settings?saved=1`);
}
