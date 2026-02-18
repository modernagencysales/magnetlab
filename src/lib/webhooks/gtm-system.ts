// GTM System Webhook
// Fires a non-blocking webhook to gtm-system when a lead is captured
// This is a system-level webhook, separate from user-configurable webhooks

import { logError, logInfo } from '@/lib/utils/logger';

const GTM_SYSTEM_WEBHOOK_URL = process.env.GTM_SYSTEM_WEBHOOK_URL;
const GTM_SYSTEM_WEBHOOK_SECRET = process.env.GTM_SYSTEM_WEBHOOK_SECRET;
const GTM_SYSTEM_TENANT_ID = process.env.GTM_SYSTEM_TENANT_ID;
const GTM_SYSTEM_USER_ID = process.env.GTM_SYSTEM_USER_ID;
const GTM_WEBHOOK_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Only fire GTM webhooks for the GTM system owner's leads.
 * Other magnetlab users' leads should not be processed through gtm-system.
 */
function isGtmSystemOwner(userId: string): boolean {
  if (!GTM_SYSTEM_USER_ID) return true; // If not configured, fire for all (backwards compat)
  return userId === GTM_SYSTEM_USER_ID;
}

export interface GtmLeadCreatedPayload {
  event: 'lead.created';
  source: 'magnetlab';
  timestamp: string;
  data: {
    email: string;
    name: string | null;
    leadMagnetId: string;
    leadMagnetTitle: string;
    funnelPageId: string;
    funnelPageSlug: string;
    resourceUrl: string | null;
    isQualified: false;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    createdAt: string;
  };
}

export interface GtmLeadQualifiedPayload {
  event: 'lead.qualified';
  source: 'magnetlab';
  timestamp: string;
  data: {
    email: string;
    name: string | null;
    leadMagnetTitle: string | null;
    funnelPageSlug: string | null;
    isQualified: boolean;
    qualificationAnswers: Record<string, unknown>;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
  };
}

export interface GtmLeadMagnetDeployedPayload {
  event: 'lead_magnet.deployed';
  source: 'magnetlab';
  timestamp: string;
  data: {
    leadMagnetId: string;
    leadMagnetTitle: string;
    archetype: string;
    funnelPageUrl: string | null;
    funnelPageSlug: string | null;
    scheduledPostId: string | null;
    postVariations: Array<{
      hookType: string;
      post: string;
      whyThisAngle: string;
    }> | null;
  };
}

/**
 * Fire a lead_magnet.deployed webhook to gtm-system.
 * This is fire-and-forget — errors are logged but never thrown.
 * Should be called without await so it does not block the response.
 */
export async function fireGtmLeadMagnetDeployedWebhook(
  data: GtmLeadMagnetDeployedPayload['data'],
  userId: string
): Promise<void> {
  if (!GTM_SYSTEM_WEBHOOK_URL || !GTM_SYSTEM_WEBHOOK_SECRET) {
    return;
  }
  if (!isGtmSystemOwner(userId)) {
    return;
  }

  const payload: GtmLeadMagnetDeployedPayload = {
    event: 'lead_magnet.deployed',
    source: 'magnetlab',
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const response = await fetch(
      `${GTM_SYSTEM_WEBHOOK_URL}/api/webhooks/magnetlab`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': GTM_SYSTEM_WEBHOOK_SECRET,
          ...(GTM_SYSTEM_TENANT_ID && { 'x-tenant-id': GTM_SYSTEM_TENANT_ID }),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GTM_WEBHOOK_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      logInfo('webhooks/gtm-system', 'lead_magnet.deployed webhook delivered successfully');
    } else {
      logError('webhooks/gtm-system', new Error('lead_magnet.deployed webhook failed'), { status: response.status });
    }
  } catch (err) {
    logError('webhooks/gtm-system', err, { event: 'lead_magnet.deployed' });
  }
}

/**
 * Fire a lead.qualified webhook to gtm-system.
 * This is fire-and-forget — errors are logged but never thrown.
 * Should be called without await so it does not block the response.
 */
export async function fireGtmLeadQualifiedWebhook(
  data: GtmLeadQualifiedPayload['data'],
  userId: string
): Promise<void> {
  if (!GTM_SYSTEM_WEBHOOK_URL || !GTM_SYSTEM_WEBHOOK_SECRET) {
    return;
  }
  if (!isGtmSystemOwner(userId)) {
    return;
  }

  const payload: GtmLeadQualifiedPayload = {
    event: 'lead.qualified',
    source: 'magnetlab',
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const response = await fetch(
      `${GTM_SYSTEM_WEBHOOK_URL}/api/webhooks/magnetlab`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': GTM_SYSTEM_WEBHOOK_SECRET,
          ...(GTM_SYSTEM_TENANT_ID && { 'x-tenant-id': GTM_SYSTEM_TENANT_ID }),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GTM_WEBHOOK_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      logInfo('webhooks/gtm-system', 'lead.qualified webhook delivered successfully');
    } else {
      logError('webhooks/gtm-system', new Error('lead.qualified webhook failed'), { status: response.status });
    }
  } catch (err) {
    logError('webhooks/gtm-system', err, { event: 'lead.qualified' });
  }
}

/**
 * Fire a lead.created webhook to gtm-system.
 * This is fire-and-forget — errors are logged but never thrown.
 * Should be called without await so it does not block the response.
 */
export async function fireGtmLeadCreatedWebhook(
  data: GtmLeadCreatedPayload['data'],
  userId: string
): Promise<void> {
  if (!GTM_SYSTEM_WEBHOOK_URL || !GTM_SYSTEM_WEBHOOK_SECRET) {
    return;
  }
  if (!isGtmSystemOwner(userId)) {
    return;
  }

  const payload: GtmLeadCreatedPayload = {
    event: 'lead.created',
    source: 'magnetlab',
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const response = await fetch(
      `${GTM_SYSTEM_WEBHOOK_URL}/api/webhooks/magnetlab`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': GTM_SYSTEM_WEBHOOK_SECRET,
          ...(GTM_SYSTEM_TENANT_ID && { 'x-tenant-id': GTM_SYSTEM_TENANT_ID }),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GTM_WEBHOOK_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      logInfo('webhooks/gtm-system', 'lead.created webhook delivered successfully');
    } else {
      logError('webhooks/gtm-system', new Error('lead.created webhook failed'), { status: response.status });
    }
  } catch (err) {
    logError('webhooks/gtm-system', err, { event: 'lead.created' });
  }
}
