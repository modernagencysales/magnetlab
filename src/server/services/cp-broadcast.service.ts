/**
 * Content Pipeline Broadcast Service
 * Authorize and trigger broadcast-post-variations task.
 */

import { tasks } from '@trigger.dev/sdk/v3';
import type { broadcastPostVariations } from '@/trigger/broadcast-post-variations';
import { logError } from '@/lib/utils/logger';
import { verifyTeamMembership } from '@/lib/services/team-integrations';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import * as cpBroadcastRepo from '@/server/repositories/cp-broadcast.repo';

export type TriggerBroadcastInput = {
  sourcePostId: string;
  targetProfileIds: string[];
  staggerDays: number;
};

export async function triggerBroadcast(
  userId: string,
  input: TriggerBroadcastInput
): Promise<
  | { success: true; runId: string }
  | { success: false; error: string; status: number }
> {
  const { data: sourcePost } = await cpBroadcastRepo.getSourcePostTeamProfile(input.sourcePostId);
  if (!sourcePost?.team_profile_id) {
    return { success: false, error: 'Source post not found', status: 404 };
  }

  const { data: teamId } = await cpBroadcastRepo.getTeamIdByProfileId(sourcePost.team_profile_id);
  if (teamId) {
    const supabase = createSupabaseAdminClient();
    const memberCheck = await verifyTeamMembership(supabase, teamId, userId);
    if (!memberCheck.authorized) {
      return { success: false, error: memberCheck.error, status: memberCheck.status };
    }
  }

  try {
    const handle = await tasks.trigger<typeof broadcastPostVariations>(
      'broadcast-post-variations',
      {
        sourcePostId: input.sourcePostId,
        targetProfileIds: input.targetProfileIds,
        userId,
        staggerDays: input.staggerDays,
      }
    );
    return { success: true, runId: handle.id };
  } catch (error) {
    logError('cp/broadcast', error, { step: 'broadcast_trigger_error' });
    return { success: false, error: 'Internal server error', status: 500 };
  }
}
