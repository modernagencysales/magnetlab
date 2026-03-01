/**
 * Webhooks Service
 * List, create, update, delete, test (send test payload to URL).
 */

import { webhookConfigFromRow, type WebhookConfigRow } from '@/lib/types/funnel';
import { logApiError } from '@/lib/api/errors';
import * as webhooksRepo from '@/server/repositories/webhooks.repo';

export async function list(userId: string, limit: number, offset: number) {
  const { data, error } = await webhooksRepo.listWebhooks(userId, limit, offset);
  if (error) {
    logApiError('webhooks/list', error, { userId });
    return { success: false, error: 'database' as const };
  }
  return { success: true, webhooks: (data as WebhookConfigRow[]).map(webhookConfigFromRow) };
}

export async function create(userId: string, name: string, url: string) {
  const { data, error } = await webhooksRepo.createWebhook(userId, name, url);
  if (error) {
    logApiError('webhooks/create', error, { userId });
    return { success: false, error: 'database' as const };
  }
  return { success: true, webhook: webhookConfigFromRow(data as WebhookConfigRow) };
}

export async function getById(userId: string, id: string) {
  const { data, error } = await webhooksRepo.getWebhookById(id, userId);
  if (error || !data) return { success: false, error: 'not_found' as const };
  return { success: true, webhook: webhookConfigFromRow(data as WebhookConfigRow) };
}

export async function update(
  userId: string,
  id: string,
  payload: { name?: string; url?: string; isActive?: boolean }
) {
  const updates: Partial<{ name: string; url: string; is_active: boolean }> = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.url !== undefined) updates.url = payload.url;
  if (payload.isActive !== undefined) updates.is_active = payload.isActive;
  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'validation' as const, message: 'No valid fields to update' };
  }

  const { data, error } = await webhooksRepo.updateWebhook(id, userId, updates);
  if (error) {
    logApiError('webhooks/update', error, { webhookId: id });
    return { success: false, error: 'database' as const };
  }
  if (!data) return { success: false, error: 'not_found' as const };
  return { success: true, webhook: webhookConfigFromRow(data as WebhookConfigRow) };
}

export async function deleteWebhook(userId: string, id: string) {
  const { error } = await webhooksRepo.deleteWebhook(id, userId);
  if (error) {
    logApiError('webhooks/delete', error, { webhookId: id });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

export async function testWebhook(userId: string, id: string) {
  const { data: webhook, error } = await webhooksRepo.getWebhookUrlAndName(id, userId);
  if (error || !webhook) return { success: false, error: 'not_found' as const };

  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from MagnetLab',
      webhookName: webhook.name,
    },
  };

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'test',
        'X-Webhook-Id': id,
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return {
        success: false,
        error: 'delivery' as const,
        status: response.status,
        message: `Webhook returned status ${response.status}`,
      };
    }
    return { success: true, status: response.status, message: 'Test webhook delivered successfully' };
  } catch (fetchError) {
    return {
      success: false,
      error: 'delivery' as const,
      message: fetchError instanceof Error ? fetchError.message : 'Request failed',
    };
  }
}
