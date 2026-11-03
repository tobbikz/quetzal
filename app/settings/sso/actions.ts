'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveSsoSettings } from '@/lib/sso';
import { requireUser } from '@/lib/session';

function text(value: FormDataEntryValue | null, max = 4000): string {
  return String(value ?? '').trim().slice(0, max);
}

export async function saveSsoSettingsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new Error('Forbidden: admin only');
  }

  const enabled = formData.get('enabled') === 'on' || formData.get('enabled') === '1';
  const entityId = text(formData.get('entity_id'), 200);
  const idpMetadataText = String(formData.get('idp_metadata_text') ?? '').slice(0, 200_000);
  const oidcIssuer = text(formData.get('oidc_issuer'), 500);
  const oidcClientId = text(formData.get('oidc_client_id'), 200);
  const oidcClientSecret = String(formData.get('oidc_client_secret') ?? '').slice(0, 500);
  const oidcRedirectUri = text(formData.get('oidc_redirect_uri'), 500);

  await saveSsoSettings({
    enabled,
    entityId,
    idpMetadataText,
    oidcIssuer,
    oidcClientId,
    oidcClientSecret,
    oidcRedirectUri,
  });
  revalidatePath('/settings/sso');
  revalidatePath('/login');
  revalidatePath('/login/sso');
  redirect('/settings/sso?saved=1');
}
