import { task, logger } from '@trigger.dev/sdk/v3';
import { runNightlyBatch } from '@/lib/services/autopilot';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { fireDfyCallback } from '@/server/services/dfy-callback';

interface RunAutopilotPayload {
  userId: string;
  postsPerBatch?: number;
  bufferTarget?: number;
  autoPublish?: boolean;
  teamId?: string;
  profileId?: string;
  engagementId?: string;
}

export const runAutopilot = task({
  id: 'run-autopilot',
  maxDuration: 300,
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 30_000,
    maxTimeoutInMs: 480_000,
  },
  run: async (payload: RunAutopilotPayload) => {
    const {
      userId,
      postsPerBatch = 3,
      bufferTarget = 5,
      autoPublish = false,
      teamId,
      profileId,
    } = payload;

    logger.info('Running autopilot', { userId, postsPerBatch, bufferTarget, profileId });

    // Check if content ideas exist — transcript may not have been processed yet
    const supabase = createSupabaseAdminClient();
    const { count } = await supabase
      .from('cp_content_ideas')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'extracted');

    if (!count || count === 0) {
      throw new Error('No content ideas available — transcript may not have been processed yet');
    }

    const result = await runNightlyBatch({
      userId,
      postsPerBatch,
      bufferTarget,
      autoPublish,
      autoPublishDelayHours: 24,
      teamId,
      profileId,
    });

    logger.info('Autopilot complete', {
      postsCreated: result.postsCreated,
      postsScheduled: result.postsScheduled,
      ideasProcessed: result.ideasProcessed,
      errors: result.errors.length,
    });

    // Notify gtm-system when DFY content is ready for review
    if (result.postsCreated > 0 && !autoPublish) {
      const gtmUrl = process.env.GTM_SYSTEM_WEBHOOK_URL;
      const gtmSecret = process.env.GTM_SYSTEM_WEBHOOK_SECRET;
      if (gtmUrl && gtmSecret) {
        try {
          await fetch(`${gtmUrl}/api/dfy/notifications/content-ready`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-webhook-secret': gtmSecret,
            },
            body: JSON.stringify({
              tenant_id: userId,
              posts_created: result.postsCreated,
              review_link: `https://magnetlab.app/content-pipeline`,
            }),
          });
        } catch (err) {
          logger.warn('Failed to notify gtm-system of content ready', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Fire DFY callback if this was triggered by an engagement
    if (payload.engagementId) {
      fireDfyCallback({
        engagement_id: payload.engagementId,
        automation_type: 'content_calendar',
        status: 'completed',
        result: {
          posts_created: result.postsCreated,
          posts_scheduled: result.postsScheduled,
          ideas_processed: result.ideasProcessed,
        },
      }).catch(() => {
        // Fire-and-forget — already logged inside fireDfyCallback
      });
    }

    return result;
  },
});
