/**
 * DFY Callback Service
 * Fire-and-forget callback to mas-platform when DFY automations complete.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { logError, logWarn } from '@/lib/utils/logger';

// ─── Types ─────────────────────────────────────────────────────────

type DfyAutomationType = 'lead_magnet_generation' | 'content_calendar';
type DfyCallbackStatus = 'completed' | 'failed';

interface DfyCallbackPayload {
  engagement_id: string;
  automation_type: DfyAutomationType;
  status: DfyCallbackStatus;
  result?: Record<string, unknown>;
  error?: string;
}

// ─── Callback ──────────────────────────────────────────────────────

const MAX_ATTEMPTS = 2;
const TIMEOUT_MS = 10_000;

/** Fire DFY callback to mas-platform. Fire-and-forget with single retry. */
export async function fireDfyCallback(payload: DfyCallbackPayload): Promise<void> {
  const url = process.env.DFY_CALLBACK_URL;
  const secret = process.env.DFY_CALLBACK_SECRET;
  if (!url || !secret) return;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': secret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return;
      logWarn('dfy-callback', `Attempt ${attempt + 1} failed with status ${res.status}`, {
        engagementId: payload.engagement_id,
        automationType: payload.automation_type,
      });
    } catch (err) {
      logError('dfy-callback', err instanceof Error ? err : new Error(String(err)), {
        attempt: attempt + 1,
        engagementId: payload.engagement_id,
        automationType: payload.automation_type,
      });
    }
  }
}
