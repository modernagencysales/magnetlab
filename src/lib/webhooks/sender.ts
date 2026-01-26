// Webhook Delivery Service
// Sends webhook payloads to configured URLs

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { WebhookLeadPayload } from '@/lib/types/funnel';

export async function deliverWebhook(
  userId: string,
  event: string,
  data: WebhookLeadPayload['data']
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Get active webhooks for user
  const { data: webhooks, error } = await supabase
    .from('webhook_configs')
    .select('id, url, name')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !webhooks || webhooks.length === 0) {
    return;
  }

  const payload: WebhookLeadPayload = {
    event: event as 'lead.created',
    timestamp: new Date().toISOString(),
    data,
  };

  // Deliver to all active webhooks
  const deliveryPromises = webhooks.map(async (webhook) => {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Id': webhook.id,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.error(`Webhook delivery failed for ${webhook.name}:`, response.status);
      }
    } catch (err) {
      console.error(`Webhook delivery error for ${webhook.name}:`, err);
    }
  });

  // Execute all deliveries in parallel but don't throw
  await Promise.allSettled(deliveryPromises);
}
