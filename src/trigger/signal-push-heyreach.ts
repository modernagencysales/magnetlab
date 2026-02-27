import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { pushLeadsToHeyReach } from '@/lib/integrations/heyreach';

// ============================================
// CRON TASK: every 30 minutes
// Push qualified signal leads to HeyReach campaigns
// ============================================

export const signalPushHeyreach = schedules.task({
  id: 'signal-push-heyreach',
  cron: '*/30 * * * *',
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting signal HeyReach push');

    let totalPushed = 0;

    // Step 1: Fetch configs with auto-push enabled and a campaign configured
    const { data: configs, error: configError } = await supabase
      .from('signal_configs')
      .select('*')
      .eq('auto_push_enabled', true)
      .not('default_heyreach_campaign_id', 'is', null);

    if (configError) {
      logger.error('Failed to fetch signal configs', { error: configError.message });
      return { pushed: 0 };
    }

    if (!configs || configs.length === 0) {
      logger.info('No signal configs with auto-push enabled');
      return { pushed: 0 };
    }

    logger.info(`Found ${configs.length} configs with auto-push enabled`);

    // Step 2: Process each config
    for (const config of configs) {
      const campaignId = config.default_heyreach_campaign_id!;

      try {
        // Step 3a: Fetch qualified, ICP-matched leads not yet pushed
        const { data: leads, error: leadError } = await supabase
          .from('signal_leads')
          .select('id, linkedin_url, first_name, last_name, headline, compound_score, signal_count')
          .eq('user_id', config.user_id)
          .eq('status', 'qualified')
          .eq('icp_match', true)
          .is('heyreach_pushed_at', null)
          .order('compound_score', { ascending: false })
          .limit(100);

        if (leadError) {
          logger.error('Failed to fetch signal leads', {
            userId: config.user_id,
            error: leadError.message,
          });
          continue;
        }

        if (!leads || leads.length === 0) {
          logger.info('No qualified leads to push', { userId: config.user_id });
          continue;
        }

        logger.info(`Found ${leads.length} qualified leads for user ${config.user_id}`);

        // Step 3c: Map leads to HeyReach format
        const heyreachLeads = leads.map(lead => ({
          profileUrl: lead.linkedin_url.endsWith('/')
            ? lead.linkedin_url
            : `${lead.linkedin_url}/`,
          firstName: lead.first_name || undefined,
          lastName: lead.last_name || undefined,
          customVariables: {
            compound_score: String(lead.compound_score ?? 0),
            signal_count: String(lead.signal_count ?? 0),
            headline: lead.headline || '',
          },
        }));

        // Step 3d: Push to HeyReach
        const result = await pushLeadsToHeyReach(campaignId, heyreachLeads);

        if (result.success) {
          // Step 3e: Mark leads as pushed
          const leadIds = leads.map(l => l.id);
          const now = new Date().toISOString();

          const { error: updateError } = await supabase
            .from('signal_leads')
            .update({
              status: 'pushed',
              heyreach_campaign_id: campaignId,
              heyreach_pushed_at: now,
              heyreach_error: null,
            })
            .in('id', leadIds);

          if (updateError) {
            logger.error('Failed to update lead status after push', {
              userId: config.user_id,
              error: updateError.message,
            });
          } else {
            totalPushed += leads.length;
            logger.info(`Pushed ${leads.length} leads to HeyReach`, {
              userId: config.user_id,
              campaignId,
            });
          }
        } else {
          // Step 3f: Record error for retry
          const leadIds = leads.map(l => l.id);
          const errorMsg = result.error || 'Unknown HeyReach push error';

          const { error: updateError } = await supabase
            .from('signal_leads')
            .update({ heyreach_error: errorMsg })
            .in('id', leadIds);

          if (updateError) {
            logger.error('Failed to record HeyReach error on leads', {
              userId: config.user_id,
              error: updateError.message,
            });
          }

          logger.error('HeyReach push failed', {
            userId: config.user_id,
            campaignId,
            error: errorMsg,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Unexpected error processing config', {
          userId: config.user_id,
          error: msg,
        });
      }
    }

    logger.info('Signal HeyReach push complete', { pushed: totalPushed });
    return { pushed: totalPushed };
  },
});
