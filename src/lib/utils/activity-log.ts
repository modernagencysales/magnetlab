import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

/**
 * Log a team activity event for audit trail.
 * Non-blocking — logs but does not throw on failure.
 */
export async function logTeamActivity(params: {
  teamId: string;
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('team_activity_log').insert({
      team_id: params.teamId,
      user_id: params.userId,
      action: params.action,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      details: params.details || {},
    });
  } catch (error) {
    // Non-blocking — log but don't throw
    logError('activity-log', error);
  }
}
