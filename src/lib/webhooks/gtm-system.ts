// GTM System Webhook
// Fires a non-blocking webhook to gtm-system when a lead is captured
// This is a system-level webhook, separate from user-configurable webhooks

const GTM_SYSTEM_WEBHOOK_URL = process.env.GTM_SYSTEM_WEBHOOK_URL;
const GTM_SYSTEM_WEBHOOK_SECRET = process.env.GTM_SYSTEM_WEBHOOK_SECRET;
const GTM_WEBHOOK_TIMEOUT_MS = 5000; // 5 seconds

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
  data: GtmLeadMagnetDeployedPayload['data']
): Promise<void> {
  if (!GTM_SYSTEM_WEBHOOK_URL || !GTM_SYSTEM_WEBHOOK_SECRET) {
    // GTM system webhook not configured — silently skip
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
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GTM_WEBHOOK_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      console.log('[gtm-system] lead_magnet.deployed webhook delivered successfully');
    } else {
      console.error(
        `[gtm-system] lead_magnet.deployed webhook failed with status ${response.status}`
      );
    }
  } catch (err) {
    console.error(
      '[gtm-system] lead_magnet.deployed webhook error:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Fire a lead.qualified webhook to gtm-system.
 * This is fire-and-forget — errors are logged but never thrown.
 * Should be called without await so it does not block the response.
 */
export async function fireGtmLeadQualifiedWebhook(
  data: GtmLeadQualifiedPayload['data']
): Promise<void> {
  if (!GTM_SYSTEM_WEBHOOK_URL || !GTM_SYSTEM_WEBHOOK_SECRET) {
    // GTM system webhook not configured — silently skip
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
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GTM_WEBHOOK_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      console.log('[gtm-system] lead.qualified webhook delivered successfully');
    } else {
      console.error(
        `[gtm-system] lead.qualified webhook failed with status ${response.status}`
      );
    }
  } catch (err) {
    console.error(
      '[gtm-system] lead.qualified webhook error:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Fire a lead.created webhook to gtm-system.
 * This is fire-and-forget — errors are logged but never thrown.
 * Should be called without await so it does not block the response.
 */
export async function fireGtmLeadCreatedWebhook(
  data: GtmLeadCreatedPayload['data']
): Promise<void> {
  if (!GTM_SYSTEM_WEBHOOK_URL || !GTM_SYSTEM_WEBHOOK_SECRET) {
    // GTM system webhook not configured — silently skip
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
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GTM_WEBHOOK_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      console.log('[gtm-system] lead.created webhook delivered successfully');
    } else {
      console.error(
        `[gtm-system] lead.created webhook failed with status ${response.status}`
      );
    }
  } catch (err) {
    console.error(
      '[gtm-system] lead.created webhook error:',
      err instanceof Error ? err.message : err
    );
  }
}
