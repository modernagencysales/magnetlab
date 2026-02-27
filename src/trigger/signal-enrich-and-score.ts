import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getProfile } from '@/lib/integrations/harvest-api';
import {
  matchesIcp,
  computeIcpScore,
  extractJobTitle,
  extractCompany,
} from '@/lib/services/signal-icp-filter';
import { updateSignalCounts } from '@/lib/services/signal-engine';
import { batchClassifySentiment } from '@/lib/ai/signal-sentiment';
import type { SignalConfig } from '@/lib/types/signals';

export const signalEnrichAndScore = schedules.task({
  id: 'signal-enrich-and-score',
  cron: '15 */2 * * *', // every 2 hours, offset 15 min
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    let enrichedCount = 0;
    let qualifiedCount = 0;

    // ==========================================
    // PHASE 1: Enrich new leads
    // ==========================================

    logger.info('Phase 1: Enriching new signal leads');

    const { data: newLeads, error: leadsError } = await supabase
      .from('signal_leads')
      .select('id, user_id, linkedin_url, status')
      .eq('status', 'new')
      .limit(100);

    if (leadsError) {
      logger.error('Failed to fetch new signal leads', { error: leadsError.message });
    }

    if (newLeads && newLeads.length > 0) {
      logger.info(`Found ${newLeads.length} new leads to enrich`);

      // Collect unique user_ids and fetch their configs
      const userIds = [...new Set(newLeads.map((l) => l.user_id))];
      const { data: configs } = await supabase
        .from('signal_configs')
        .select('*')
        .in('user_id', userIds);

      const configMap = new Map<string, SignalConfig>();
      if (configs) {
        for (const config of configs) {
          configMap.set(config.user_id, config as SignalConfig);
        }
      }

      for (const lead of newLeads) {
        try {
          const config = configMap.get(lead.user_id);
          const enrichmentEnabled = config?.enrichment_enabled !== false;

          if (enrichmentEnabled) {
            const { data: profile, error: profileError } = await getProfile({
              url: lead.linkedin_url,
            });

            if (profileError) {
              logger.warn(`Enrichment failed for lead ${lead.id}`, { error: profileError });
              // Set enriched anyway even if enrichment failed
              await supabase
                .from('signal_leads')
                .update({
                  status: 'enriched',
                  enriched_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lead.id);
              enrichedCount++;
              continue;
            }

            if (profile) {
              const jobTitle = extractJobTitle(profile.headline || '');
              const company =
                extractCompany(profile.headline || '') ||
                profile.currentPosition?.[0]?.companyName ||
                null;
              const country =
                profile.location?.parsed?.countryCode || null;

              // Build update payload
              const updatePayload: Record<string, unknown> = {
                first_name: profile.firstName || null,
                last_name: profile.lastName || null,
                headline: profile.headline || null,
                job_title: jobTitle,
                company,
                country,
                profile_data: profile as unknown as Record<string, unknown>,
                status: 'enriched',
                enriched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              // Run ICP filtering if config exists
              if (config) {
                const icpMatch = matchesIcp(profile, config);
                const icpScore = computeIcpScore(profile, config);

                updatePayload.icp_match = icpMatch;
                updatePayload.icp_score = icpScore;
                updatePayload.status = icpMatch ? 'qualified' : 'excluded';

                if (icpMatch) {
                  qualifiedCount++;
                }
              }

              await supabase
                .from('signal_leads')
                .update(updatePayload)
                .eq('id', lead.id);

              enrichedCount++;

              logger.info(`Enriched lead ${lead.id}`, {
                status: updatePayload.status,
                icpMatch: updatePayload.icp_match,
                icpScore: updatePayload.icp_score,
              });
            } else {
              // No profile returned — mark enriched anyway
              await supabase
                .from('signal_leads')
                .update({
                  status: 'enriched',
                  enriched_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lead.id);
              enrichedCount++;
            }
          } else {
            // Enrichment disabled — mark enriched
            await supabase
              .from('signal_leads')
              .update({
                status: 'enriched',
                enriched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', lead.id);
            enrichedCount++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Failed to enrich lead ${lead.id}`, { error: msg });
        }
      }
    } else {
      logger.info('No new leads to enrich');
    }

    // ==========================================
    // PHASE 2: Sentiment scoring
    // ==========================================

    logger.info('Phase 2: Scoring sentiment on unscored comments');

    // Only score events for users who have sentiment scoring enabled
    const { data: sentimentEnabledUsers } = await supabase
      .from('signal_configs')
      .select('user_id')
      .eq('sentiment_scoring_enabled', true);

    const sentimentUserIds = (sentimentEnabledUsers || []).map((u) => u.user_id);

    const unscoredQuery = supabase
      .from('signal_events')
      .select('id, comment_text')
      .is('sentiment', null)
      .not('comment_text', 'is', null)
      .limit(50);

    // If we have explicit configs, only score those users' events
    if (sentimentUserIds.length > 0) {
      unscoredQuery.in('user_id', sentimentUserIds);
    }

    const { data: unscoredEvents, error: eventsError } = await unscoredQuery;

    if (eventsError) {
      logger.error('Failed to fetch unscored events', { error: eventsError.message });
    }

    if (unscoredEvents && unscoredEvents.length > 0) {
      logger.info(`Scoring sentiment for ${unscoredEvents.length} events`);

      const comments = unscoredEvents.map((e) => ({
        id: e.id,
        text: e.comment_text!,
      }));

      const sentimentResults = await batchClassifySentiment(comments);

      for (const result of sentimentResults) {
        const { error: updateError } = await supabase
          .from('signal_events')
          .update({ sentiment: result.sentiment })
          .eq('id', result.id);

        if (updateError) {
          logger.warn(`Failed to update sentiment for event ${result.id}`, {
            error: updateError.message,
          });
        }
      }

      logger.info(`Scored ${sentimentResults.length} events`);
    } else {
      logger.info('No unscored events to process');
    }

    // ==========================================
    // PHASE 3: Update compound scores
    // ==========================================

    logger.info('Phase 3: Updating compound scores');

    const { data: leadsToScore, error: scoreError } = await supabase
      .from('signal_leads')
      .select('id, user_id')
      .in('status', ['enriched', 'qualified'])
      .limit(100);

    if (scoreError) {
      logger.error('Failed to fetch leads for scoring', { error: scoreError.message });
    }

    if (leadsToScore && leadsToScore.length > 0) {
      logger.info(`Updating compound scores for ${leadsToScore.length} leads`);

      for (const lead of leadsToScore) {
        try {
          await updateSignalCounts(lead.user_id, lead.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`Failed to update counts for lead ${lead.id}`, { error: msg });
        }
      }

      logger.info(`Updated compound scores for ${leadsToScore.length} leads`);
    } else {
      logger.info('No leads need score updates');
    }

    // ==========================================
    // DONE
    // ==========================================

    logger.info('Signal enrich-and-score complete', { enriched: enrichedCount, qualified: qualifiedCount });

    return { enriched: enrichedCount, qualified: qualifiedCount };
  },
});
