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

    return result;
  },
});
