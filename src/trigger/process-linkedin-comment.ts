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

        // If follow-up was scheduled, trigger the delayed task
        if (
          result.actions.includes('follow_up_scheduled') &&
          automation.enable_follow_up &&
          automation.follow_up_template
        ) {
          // Import and trigger inline to avoid circular deps at module level
          const { sendFollowUpDm } = await import('./send-follow-up-dm');
          await sendFollowUpDm.trigger(
            {
              automationId: automation.id,
              commenterProviderId,
              commenterName,
              commenterLinkedinUrl: payload.commenterLinkedinUrl,
              followUpTemplate: automation.follow_up_template,
              accountId: automation.unipile_account_id || '',
            },
            {
              delay: `${automation.follow_up_delay_minutes}m`,
            }
          );

          logger.info(`Follow-up DM scheduled for ${automation.follow_up_delay_minutes}m`, {
            automationId: automation.id,
            commenterProviderId,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Automation ${automation.id} failed`, { error: msg });
        results.push({ automationId: automation.id, actions: [], errors: [msg] });
      }
    }

    return { processed: true, results };
  },
});
