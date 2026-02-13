import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient } from '@/lib/integrations/unipile';

interface FollowUpPayload {
  automationId: string;
  commenterProviderId: string;
  commenterName: string;
  commenterLinkedinUrl?: string;
  followUpTemplate: string;
  accountId: string;
}

export const sendFollowUpDm = task({
  id: 'send-follow-up-dm',
  maxDuration: 30,
  retry: { maxAttempts: 2 },
  run: async (payload: FollowUpPayload) => {
    const {
      automationId,
      commenterProviderId,
      commenterName,
      followUpTemplate,
      accountId,
    } = payload;

    logger.info('Sending follow-up DM', { automationId, commenterProviderId, commenterName });

    const supabase = createSupabaseAdminClient();

    // Verify automation still exists and is running
    const { data: automation } = await supabase
      .from('linkedin_automations')
      .select('id, status')
      .eq('id', automationId)
      .single();

    if (!automation || automation.status !== 'running') {
      logger.info('Automation no longer active, skipping follow-up', { automationId });
      return { sent: false, reason: 'automation_inactive' };
    }

    if (!accountId) {
      logger.error('No account ID for follow-up DM', { automationId });
      await logFollowUpEvent(automationId, commenterProviderId, commenterName, payload.commenterLinkedinUrl, 'follow_up_failed', 'No account ID');
      return { sent: false, reason: 'no_account' };
    }

    // Interpolate template
    const firstName = commenterName.split(' ')[0] || 'there';
    const dmText = followUpTemplate
      .replace(/\{\{name\}\}/g, firstName)
      .replace(/\{\{full_name\}\}/g, commenterName);

    try {
      const client = getUnipileClient();
      const result = await client.startChat(accountId, commenterProviderId, dmText);

      if (result.error) {
        throw new Error(result.error);
      }

      logger.info('Follow-up DM sent', { automationId, commenterProviderId });
      await logFollowUpEvent(automationId, commenterProviderId, commenterName, payload.commenterLinkedinUrl, 'follow_up_sent', undefined, dmText);

      return { sent: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Follow-up DM failed', { automationId, error: msg });
      await logFollowUpEvent(automationId, commenterProviderId, commenterName, payload.commenterLinkedinUrl, 'follow_up_failed', msg);

      return { sent: false, reason: msg };
    }
  },
});

async function logFollowUpEvent(
  automationId: string,
  commenterProviderId: string,
  commenterName: string,
  commenterLinkedinUrl: string | undefined,
  eventType: 'follow_up_sent' | 'follow_up_failed',
  error?: string,
  actionDetails?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('linkedin_automation_events').insert({
    automation_id: automationId,
    event_type: eventType,
    commenter_name: commenterName,
    commenter_provider_id: commenterProviderId,
    commenter_linkedin_url: commenterLinkedinUrl || null,
    action_details: actionDetails || null,
    error: error || null,
  });
}
