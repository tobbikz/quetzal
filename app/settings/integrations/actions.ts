'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createWebhook,
  deleteWebhook,
  setWebhookEnabled,
  WEBHOOK_EVENTS,
  type WebhookEvent,
} from '@/lib/webhooks';
import { getNotifyChannelSettings, saveNotifyChannelSettings } from '@/lib/notify';
import { requireUser } from '@/lib/session';

function text(value: FormDataEntryValue | null, max = 2000): string {
  return String(value ?? '').trim().slice(0, max);
}

async function requireAdmin(): Promise<void> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Forbidden: admin only');
}

export async function createWebhookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const url = text(formData.get('url'), 2000);
  const secret = text(formData.get('secret'), 200);
  const events = WEBHOOK_EVENTS.filter((event) => {
    const raw = formData.get(`event_${event}`);
    return raw === 'on' || raw === '1';
  }) as WebhookEvent[];
  try {
    await createWebhook({
      url,
      secret: secret || undefined,
      events: events.length ? events : undefined,
      enabled: true,
    });
  } catch {
    redirect('/settings/integrations?error=webhook');
  }
  revalidatePath('/settings/integrations');
  redirect('/settings/integrations?saved=webhook');
}

export async function toggleWebhookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(text(formData.get('id'), 20));
  const enabled = text(formData.get('enabled'), 8) === '1';
  if (Number.isInteger(id) && id > 0) {
    await setWebhookEnabled(id, enabled);
  }
  revalidatePath('/settings/integrations');
  redirect('/settings/integrations?saved=webhook');
}

export async function deleteWebhookAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(text(formData.get('id'), 20));
  if (Number.isInteger(id) && id > 0) {
    await deleteWebhook(id);
  }
  revalidatePath('/settings/integrations');
  redirect('/settings/integrations?saved=webhook');
}

/** Slack Incoming Webhook — first-class connector (shares notification_channels). */
export async function saveSlackConnectorAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const current = await getNotifyChannelSettings();
  const slackEnabled =
    formData.get('slack_enabled') === 'on' || formData.get('slack_enabled') === '1';
  const slackWebhookUrl = text(formData.get('slack_webhook_url'), 2000);
  await saveNotifyChannelSettings({
    mailEnabled: current.mailEnabled,
    slackEnabled,
    smtpHost: current.smtpHost,
    smtpPort: current.smtpPort,
    smtpUser: current.smtpUser,
    smtpPass: current.smtpPass,
    updateSmtpPass: false,
    smtpFrom: current.smtpFrom,
    slackWebhookUrl,
  });
  revalidatePath('/settings/integrations');
  revalidatePath('/settings/notifications');
  redirect('/settings/integrations?saved=slack');
}
