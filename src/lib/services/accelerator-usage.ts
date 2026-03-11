/** Accelerator Usage Tracking.
 *  Append-only event logging + allocation checks.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { UsageEventType } from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-usage';

// Default allocation per enrollment (can be overridden per plan)
const DEFAULT_MONTHLY_ALLOCATION = {
  sessions: 30,
  deliverables: 15,
  api_calls: 500,
};

export async function trackUsageEvent(
  enrollmentId: string,
  eventType: UsageEventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('program_usage_events')
    .insert({ enrollment_id: enrollmentId, event_type: eventType, metadata });

  if (error) {
    logError(LOG_CTX, error, { enrollmentId, eventType });
  }
}

export async function checkUsageAllocation(
  enrollmentId: string
): Promise<{
  withinLimits: boolean;
  usage: Record<string, number>;
  limits: Record<string, number>;
}> {
  const supabase = getSupabaseAdminClient();
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('program_usage_events')
    .select('event_type')
    .eq('enrollment_id', enrollmentId)
    .gte('created_at', periodStart.toISOString());

  if (error || !data) {
    logError(LOG_CTX, error, { enrollmentId });
    return { withinLimits: true, usage: {}, limits: DEFAULT_MONTHLY_ALLOCATION };
  }

  const usage = {
    sessions: data.filter((e: { event_type: string }) => e.event_type === 'session_start').length,
    deliverables: data.filter((e: { event_type: string }) => e.event_type === 'deliverable_created')
      .length,
    api_calls: data.filter((e: { event_type: string }) => e.event_type === 'api_call').length,
  };

  const withinLimits =
    usage.sessions <= DEFAULT_MONTHLY_ALLOCATION.sessions &&
    usage.deliverables <= DEFAULT_MONTHLY_ALLOCATION.deliverables;

  return { withinLimits, usage, limits: DEFAULT_MONTHLY_ALLOCATION };
}
