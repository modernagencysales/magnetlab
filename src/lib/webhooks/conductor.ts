// Conductor Webhook Delivery
// Per-user webhook delivery to their connected GTM Conductor instance.
// Fire-and-forget — errors are logged but never thrown.

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { logApiError } from '@/lib/api/errors';

const CONDUCTOR_TIMEOUT_MS = 5000;

/**
 * Deliver a webhook event to the user's connected Conductor instance.
 * Returns silently if the user hasn't connected Conductor.
 * Fire-and-forget — should be called without await.
 */
export async function deliverConductorWebhook(
  userId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const integration = await getUserIntegration(userId, 'conductor');

    if (!integration || !integration.is_active || !integration.api_key) {
      // User hasn't connected Conductor — silently skip
      return;
    }

    const endpointUrl = (integration.metadata as { endpointUrl?: string })?.endpointUrl;
    if (!endpointUrl) {
      return;
    }

    const payload = {
      event,
      source: 'magnetlab',
      timestamp: new Date().toISOString(),
      data,
    };

    const response = await fetch(`${endpointUrl}/api/webhooks/conductor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.api_key}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CONDUCTOR_TIMEOUT_MS),
    });

    if (response.ok) {
      console.log(`[conductor] ${event} webhook delivered to ${endpointUrl}`);
    } else {
      console.error(`[conductor] ${event} webhook failed with status ${response.status}`);
    }
  } catch (err) {
    logApiError('conductor/webhook-delivery', err, { userId, event });
  }
}
