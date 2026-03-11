/** Scan Own Account Performance. Daily cron that finds high-performing own posts and creates cs_signals. */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import * as signalsRepo from '@/server/repositories/cs-signals.repo';

import type { SignalMediaType } from '@/lib/types/creative-strategy';

// ─── Constants ──────────────────────────────────────────────────────────────

const CONFIG_COLUMNS =
  'id, config_type, outlier_threshold_multiplier, min_reactions, min_comments, target_niches, search_keywords, active';

/** Only scan posts published in the last N days. */
const LOOKBACK_DAYS = 14;

/** Columns needed from cp_pipeline_posts for signal creation. */
const POST_SCAN_COLUMNS =
  'id, user_id, final_content, draft_content, linkedin_post_id, published_at, engagement_stats, image_urls';

// ─── Cron task ──────────────────────────────────────────────────────────────

export const scanOwnAccountPerformance = schedules.task({
  id: 'scan-own-account-performance',
  cron: '30 3 * * *',
  maxDuration: 180,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting own account performance scan');

    // Step 1: Get scrape config for own_account
    const { data: config, error: configError } = await supabase
      .from('cs_scrape_config')
      .select(CONFIG_COLUMNS)
      .eq('config_type', 'own_account')
      .single();

    if (configError || !config) {
      logger.info('No own_account scrape config found, skipping');
      return { scanned: 0, signals_created: 0 };
    }

    if (!config.active) {
      logger.info('Own account scrape config is inactive, skipping');
      return { scanned: 0, signals_created: 0 };
    }

    const minReactions = config.min_reactions as number;
    const minComments = config.min_comments as number;

    // Step 2: Find recent published posts that don't already have a cs_signal
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOOKBACK_DAYS);

    const { data: posts, error: postsError } = await supabase
      .from('cp_pipeline_posts')
      .select(POST_SCAN_COLUMNS)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .not('engagement_stats', 'is', null)
      .gte('published_at', cutoffDate.toISOString())
      .order('published_at', { ascending: false })
      .limit(50);

    if (postsError) {
      logger.error('Failed to fetch published posts', { error: postsError.message });
      return { scanned: 0, signals_created: 0 };
    }

    if (!posts || posts.length === 0) {
      logger.info('No published posts with engagement data found');
      return { scanned: 0, signals_created: 0 };
    }

    logger.info(`Found ${posts.length} published posts to check`);

    // Step 3: Filter to posts exceeding threshold, create signals
    let signalsCreated = 0;

    for (const post of posts) {
      try {
        const stats = post.engagement_stats as {
          likes?: number;
          comments?: number;
          shares?: number;
        } | null;
        if (!stats) continue;

        const likes = stats.likes ?? 0;
        const comments = stats.comments ?? 0;

        // Check if engagement exceeds configured thresholds
        if (likes < minReactions && comments < minComments) {
          continue;
        }

        const content = (post.final_content || post.draft_content || '') as string;
        if (!content.trim()) continue;

        // Check if signal already exists for this LinkedIn post
        const linkedinPostId = post.linkedin_post_id as string | null;
        if (linkedinPostId) {
          const linkedinUrl = `https://www.linkedin.com/feed/update/${linkedinPostId}`;
          const existing = await signalsRepo.findSignalByUrl(linkedinUrl);
          if (existing) continue;
        }

        // Determine media type
        const imageUrls = (post.image_urls as string[] | null) ?? [];
        let mediaType: SignalMediaType = 'none';
        if (imageUrls.length > 1) {
          mediaType = 'carousel';
        } else if (imageUrls.length === 1) {
          mediaType = 'image';
        }

        // Create signal
        const signal = await signalsRepo.createSignal({
          source: 'own_account',
          source_account_id: (post.user_id as string) ?? null,
          linkedin_url: linkedinPostId
            ? `https://www.linkedin.com/feed/update/${linkedinPostId}`
            : null,
          author_name: 'Own Account',
          author_headline: null,
          author_follower_count: null,
          content,
          media_type: mediaType,
          media_description: null,
          media_urls: imageUrls,
          impressions: null,
          likes,
          comments,
          shares: stats.shares ?? null,
          engagement_multiplier: null,
          niche: null,
          status: 'pending',
          submitted_by: null,
        });

        signalsCreated++;

        // Fire analyze-signal task (non-blocking)
        try {
          const { tasks } = await import('@trigger.dev/sdk/v3');
          await tasks.trigger('analyze-signal', { signalId: signal.id });
        } catch (triggerErr) {
          const msg = triggerErr instanceof Error ? triggerErr.message : 'Unknown error';
          logger.warn('Failed to trigger analysis for own account signal', {
            signalId: signal.id,
            error: msg,
          });
        }

        logger.info('Created own account signal', {
          signalId: signal.id,
          postId: post.id,
          likes,
          comments,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to process post for own account signal', {
          postId: post.id,
          error: msg,
        });
      }
    }

    logger.info('Own account performance scan complete', {
      scanned: posts.length,
      signals_created: signalsCreated,
    });

    return { scanned: posts.length, signals_created: signalsCreated };
  },
});
