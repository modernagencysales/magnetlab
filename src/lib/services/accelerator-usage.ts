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

export async function checkUsageAllocation(enrollmentId: string): Promise<{
  withinLimits: boolean;
  usage: { sessions: number; deliverables: number; api_calls: number };
  limits: { sessions: number; deliverables: number; api_calls: number };
}> {
  const supabase = getSupabaseAdminClient();
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  // Three parallel count queries — DB-level aggregation instead of loading all rows
  const [sessions, deliverables, apiCalls] = await Promise.all([
    supabase
      .from('program_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('event_type', 'session_start')
      .gte('created_at', periodStart.toISOString()),
    supabase
      .from('program_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('event_type', 'deliverable_created')
      .gte('created_at', periodStart.toISOString()),
    supabase
      .from('program_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('event_type', 'api_call')
      .gte('created_at', periodStart.toISOString()),
  ]);

  if (sessions.error || deliverables.error || apiCalls.error) {
    logError(LOG_CTX, sessions.error ?? deliverables.error ?? apiCalls.error, { enrollmentId });
    return {
      withinLimits: true,
      usage: { sessions: 0, deliverables: 0, api_calls: 0 },
      limits: DEFAULT_MONTHLY_ALLOCATION,
    };
  }

  const usage = {
    sessions: sessions.count ?? 0,
    deliverables: deliverables.count ?? 0,
    api_calls: apiCalls.count ?? 0,
  };

  const withinLimits =
    usage.sessions <= DEFAULT_MONTHLY_ALLOCATION.sessions &&
    usage.deliverables <= DEFAULT_MONTHLY_ALLOCATION.deliverables;

  return { withinLimits, usage, limits: DEFAULT_MONTHLY_ALLOCATION };
}
