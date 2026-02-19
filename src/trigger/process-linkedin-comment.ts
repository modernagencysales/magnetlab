import { task, logger } from '@trigger.dev/sdk/v3';
import { findAutomationsForPost, processComment } from '@/lib/services/linkedin-automation';

interface ProcessCommentPayload {
  postSocialId: string;
  commentText: string;
  commenterName: string;
  commenterProviderId: string;
  commenterLinkedinUrl?: string;
  commentedAt: string;
}

export const processLinkedInComment = task({
  id: 'process-linkedin-comment',
  maxDuration: 60,
  retry: { maxAttempts: 2 },
  run: async (payload: ProcessCommentPayload) => {
    const { postSocialId, commentText, commenterName, commenterProviderId } = payload;

    logger.info('Processing LinkedIn comment', {
      postSocialId,
      commenterName,
      commentPreview: commentText.substring(0, 100),
    });

    // Find all active automations for this post
    const automations = await findAutomationsForPost(postSocialId);

    if (automations.length === 0) {
      logger.info('No active automations for this post', { postSocialId });
      return { processed: false, reason: 'no_automations' };
    }

    logger.info(`Found ${automations.length} automation(s) for post`, { postSocialId });

    const results = [];

    for (const automation of automations) {
      try {
        const result = await processComment(automation, {
          postSocialId,
          commentText,
          commenterName,
          commenterProviderId,
          commenterLinkedinUrl: payload.commenterLinkedinUrl,
          commentedAt: payload.commentedAt,
        });

        results.push(result);
        logger.info(`Automation ${automation.id} result`, {
          actions: result.actions,
          errors: result.errors,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Automation ${automation.id} failed`, { error: msg });
        results.push({ automationId: automation.id, actions: [], errors: [msg] });
      }
    }

    return { processed: true, results };
  },
});
