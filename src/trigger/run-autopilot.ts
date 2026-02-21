import { task, logger } from '@trigger.dev/sdk/v3';
import { runNightlyBatch } from '@/lib/services/autopilot';

interface RunAutopilotPayload {
  userId: string;
  postsPerBatch?: number;
  bufferTarget?: number;
  autoPublish?: boolean;
  teamId?: string;
  profileId?: string;
}

export const runAutopilot = task({
  id: 'run-autopilot',
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async (payload: RunAutopilotPayload) => {
    const { userId, postsPerBatch = 3, bufferTarget = 5, autoPublish = false, teamId, profileId } = payload;

    logger.info('Running autopilot', { userId, postsPerBatch, bufferTarget, profileId });

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

    return result;
  },
});
