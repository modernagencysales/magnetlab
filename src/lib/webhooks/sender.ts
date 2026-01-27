// Webhook Delivery Service
// Sends webhook payloads to configured URLs with retry logic

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { WebhookLeadPayload } from '@/lib/types/funnel';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const TIMEOUT_MS = 10000; // 10 seconds

// Helper to wait for a specified duration
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Deliver a single webhook with retry logic
async function deliverWithRetry(
  webhook: { id: string; url: string; name: string },
  payload: WebhookLeadPayload,
  event: string
): Promise<{ success: boolean; attempts: number; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Id': webhook.id,
          'X-Webhook-Attempt': String(attempt),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.ok) {
        return { success: true, attempts: attempt };
      }

      // Non-retryable status codes (client errors except 408, 429)
      if (response.status >= 400 && response.status < 500 &&
          response.status !== 408 && response.status !== 429) {
        lastError = `HTTP ${response.status}`;
        console.error(`Webhook ${webhook.name} failed with non-retryable status: ${response.status}`);
        return { success: false, attempts: attempt, error: lastError };
      }

      // Retryable error
      lastError = `HTTP ${response.status}`;
      console.warn(`Webhook ${webhook.name} failed (attempt ${attempt}/${MAX_RETRIES}): ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`Webhook ${webhook.name} error (attempt ${attempt}/${MAX_RETRIES}):`, lastError);
    }

    // Wait before retrying (exponential backoff)
    if (attempt < MAX_RETRIES) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      await delay(backoffMs);
    }
  }

  console.error(`Webhook ${webhook.name} failed after ${MAX_RETRIES} attempts: ${lastError}`);
  return { success: false, attempts: MAX_RETRIES, error: lastError };
}

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

  // Deliver to all active webhooks with retry
  const deliveryPromises = webhooks.map((webhook) =>
    deliverWithRetry(webhook, payload, event)
  );

  // Execute all deliveries in parallel but don't throw
  await Promise.allSettled(deliveryPromises);
}
