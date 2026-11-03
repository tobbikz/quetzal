'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveNotifyChannelSettings } from '@/lib/notify';
import { requireUser } from '@/lib/session';

function text(value: FormDataEntryValue | null, max = 2000): string {
  return String(value ?? '').trim().slice(0, max);
}

export async function saveNotifySettingsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new Error('Forbidden: admin only');
  }

  const mailEnabled = formData.get('mail_enabled') === 'on' || formData.get('mail_enabled') === '1';
  const slackEnabled =
    formData.get('slack_enabled') === 'on' || formData.get('slack_enabled') === '1';
  const smtpHost = text(formData.get('smtp_host'), 255);
  const smtpPort = Number(text(formData.get('smtp_port'), 10)) || 587;
  const smtpUser = text(formData.get('smtp_user'), 255);
  const smtpPassRaw = String(formData.get('smtp_pass') ?? '');
  const smtpFrom = text(formData.get('smtp_from'), 255);
  const slackWebhookUrl = text(formData.get('slack_webhook_url'), 2000);
  const updateSmtpPass = smtpPassRaw.trim().length > 0;

  await saveNotifyChannelSettings({
    mailEnabled,
    slackEnabled,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass: updateSmtpPass ? smtpPassRaw.slice(0, 500) : undefined,
    updateSmtpPass,
    smtpFrom,
    slackWebhookUrl,
  });

  revalidatePath('/settings/notifications');
  redirect('/settings/notifications?saved=1');
}
