import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { buildDigestEntries, formatSlackMessage } from '@/lib/services/signal-digest';

export const signalDailyDigest = schedules.task({
  id: 'signal-daily-digest',
  cron: '0 8 * * *', // 8 AM UTC daily
  maxDuration: 120,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Get all users with signal configs
    const { data: configs, error: configError } = await supabase
      .from('signal_configs')
      .select('user_id');

    if (configError) {
      logger.error('Failed to fetch signal configs', { error: configError.message });
      return { sent: 0 };
    }

    if (!configs || configs.length === 0) {
      logger.info('No signal configs found, skipping digest');
      return { sent: 0 };
    }

    let sent = 0;

    for (const config of configs) {
      const { data: leads, error: leadsError } = await supabase
        .from('signal_leads')
        .select(
          'first_name, last_name, headline, compound_score, signal_count, linkedin_url, signal_events(signal_type)'
        )
        .eq('user_id', config.user_id)
        .in('status', ['qualified', 'enriched'])
        .order('compound_score', { ascending: false })
        .limit(10);

      if (leadsError) {
        logger.warn(`Failed to fetch leads for ${config.user_id}`, {
          error: leadsError.message,
        });
        continue;
      }

      if (!leads || leads.length === 0) continue;

      const entries = buildDigestEntries(leads as Parameters<typeof buildDigestEntries>[0]);
      const topEntries = entries.slice(0, 5);
      const message = formatSlackMessage(topEntries);

      // Post to Slack if webhook URL is configured
      const slackUrl = process.env.SLACK_DIGEST_WEBHOOK_URL;
      if (slackUrl) {
        try {
          const res = await fetch(slackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message }),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            sent++;
            logger.info(`Sent digest for user ${config.user_id}`);
          } else {
            logger.warn(`Slack webhook failed for ${config.user_id}`, {
              status: res.status,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`Slack webhook error for ${config.user_id}`, { error: msg });
        }
      }
    }

    logger.info('Daily digest complete', { sent });
    return { sent };
  },
});
