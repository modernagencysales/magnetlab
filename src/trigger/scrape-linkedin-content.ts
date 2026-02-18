import { schedules, logger, tasks } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  isBrightDataConfigured,
  scrapeCreatorPostsBatch,
  scrapeSearchPosts,
  computeEngagementScore,
  filterWinners,
  type LinkedInPost,
} from '@/lib/integrations/bright-data-linkedin';

export const scrapeLinkedinContent = schedules.task({
  id: 'scrape-linkedin-content',
  cron: '0 4 * * *', // 4 AM UTC daily
  maxDuration: 600,
  retry: { maxAttempts: 1 },
  run: async () => {
    const runStartedAt = new Date().toISOString();

    if (!isBrightDataConfigured()) {
      logger.warn('Bright Data not configured, skipping scrape');
      return { skipped: true, reason: 'BRIGHT_DATA_API_KEY not set' };
    }

    const supabase = createSupabaseAdminClient();

    // ─── 1. Fetch active creators ──────────────────────────────────────────────
    const { data: creators, error: creatorsError } = await supabase
      .from('cp_tracked_creators')
      .select('id, linkedin_url, name')
      .eq('is_active', true);

    if (creatorsError) {
      logger.error('Failed to fetch tracked creators', { error: creatorsError.message });
      throw new Error(`Failed to fetch creators: ${creatorsError.message}`);
    }

    // ─── 2. Fetch active searches ──────────────────────────────────────────────
    const { data: searches, error: searchesError } = await supabase
      .from('cp_scrape_searches')
      .select('id, query, label')
      .eq('is_active', true);

    if (searchesError) {
      logger.error('Failed to fetch scrape searches', { error: searchesError.message });
      throw new Error(`Failed to fetch searches: ${searchesError.message}`);
    }

    logger.info('Scrape targets loaded', {
      creators: creators?.length ?? 0,
      searches: searches?.length ?? 0,
    });

    let totalPostsSaved = 0;
    let totalWinners = 0;
    const errors: string[] = [];

    // ─── 3. Batch scrape creator posts ─────────────────────────────────────────
    let allCreatorPosts: LinkedInPost[] = [];

    if (creators && creators.length > 0) {
      const profileUrls = creators.map((c) => c.linkedin_url);

      try {
        allCreatorPosts = await scrapeCreatorPostsBatch(profileUrls, 7);
        logger.info('Creator batch scrape complete', { postCount: allCreatorPosts.length });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('Creator batch scrape failed', { error: msg });
        errors.push(`Creator batch scrape: ${msg}`);
      }
    }

    // ─── 4. Group creator posts by profile URL and filter winners ──────────────
    if (allCreatorPosts.length > 0 && creators) {
      // Build a lookup: normalized profile URL -> creator record
      const creatorByUrl = new Map<string, { id: string; linkedin_url: string; name: string }>();
      for (const creator of creators) {
        creatorByUrl.set(normalizeUrl(creator.linkedin_url), creator);
      }

      // Group posts by creator
      const postsByCreator = new Map<string, LinkedInPost[]>();
      for (const post of allCreatorPosts) {
        const normalizedAuthorUrl = normalizeUrl(post.author.profile_url);
        const existing = postsByCreator.get(normalizedAuthorUrl) || [];
        existing.push(post);
        postsByCreator.set(normalizedAuthorUrl, existing);
      }

      // Process each creator's posts
      for (const [normalizedUrl, posts] of postsByCreator) {
        const creator = creatorByUrl.get(normalizedUrl);
        if (!creator) {
          logger.warn('Could not match posts to creator', {
            authorUrl: normalizedUrl,
            postCount: posts.length,
          });
          continue;
        }

        // Filter winners: absoluteFloor 100 likes, top 30%
        const winners = filterWinners(posts, { minLikes: 100, topPercentile: 30 });
        const winnerUrls = new Set(winners.map((w) => w.url));

        // Save all posts (winners and non-winners) to cp_viral_posts
        const postRows = posts.map((post) => ({
          bright_data_id: post.url,
          user_id: null,
          author_name: post.author.name,
          author_headline: post.author.headline,
          author_url: post.author.profile_url,
          content: post.content,
          likes: post.engagement.likes,
          comments: post.engagement.comments,
          shares: post.engagement.shares,
          engagement_score: computeEngagementScore(post),
          creator_id: creator.id,
          source_search_id: null,
          is_winner: winnerUrls.has(post.url),
        }));

        if (postRows.length > 0) {
          const { error: upsertError } = await supabase
            .from('cp_viral_posts')
            .upsert(postRows, { onConflict: 'bright_data_id' });

          if (upsertError) {
            logger.error('Failed to upsert creator posts', {
              creatorId: creator.id,
              error: upsertError.message,
            });
            errors.push(`Upsert creator ${creator.name}: ${upsertError.message}`);
          } else {
            totalPostsSaved += postRows.length;
            totalWinners += winners.length;
          }
        }

        // Update creator stats
        const avgEngagement =
          posts.length > 0
            ? posts.reduce((sum, p) => sum + computeEngagementScore(p), 0) / posts.length
            : 0;

        const { error: updateError } = await supabase
          .from('cp_tracked_creators')
          .update({
            last_scraped_at: new Date().toISOString(),
            avg_engagement: Math.round(avgEngagement),
            post_count: posts.length,
          })
          .eq('id', creator.id);

        if (updateError) {
          logger.warn('Failed to update creator stats', {
            creatorId: creator.id,
            error: updateError.message,
          });
        }

        logger.info('Creator processed', {
          creatorName: creator.name,
          totalPosts: posts.length,
          winners: winners.length,
          avgEngagement: Math.round(avgEngagement),
        });
      }
    }

    // ─── 5. Scrape search results ──────────────────────────────────────────────
    if (searches && searches.length > 0) {
      for (const search of searches) {
        try {
          const searchPosts = await scrapeSearchPosts(search.query);
          logger.info('Search scrape complete', {
            searchId: search.id,
            label: search.label,
            postCount: searchPosts.length,
          });

          if (searchPosts.length === 0) continue;

          // Filter winners: absoluteFloor 200 likes, top 30%
          const winners = filterWinners(searchPosts, { minLikes: 200, topPercentile: 30 });
          const winnerUrls = new Set(winners.map((w) => w.url));

          // Save all posts
          const postRows = searchPosts.map((post) => ({
            bright_data_id: post.url,
            user_id: null,
            author_name: post.author.name,
            author_headline: post.author.headline,
            author_url: post.author.profile_url,
            content: post.content,
            likes: post.engagement.likes,
            comments: post.engagement.comments,
            shares: post.engagement.shares,
            engagement_score: computeEngagementScore(post),
            creator_id: null,
            source_search_id: search.id,
            is_winner: winnerUrls.has(post.url),
          }));

          const { error: upsertError } = await supabase
            .from('cp_viral_posts')
            .upsert(postRows, { onConflict: 'bright_data_id' });

          if (upsertError) {
            logger.error('Failed to upsert search posts', {
              searchId: search.id,
              error: upsertError.message,
            });
            errors.push(`Upsert search ${search.label}: ${upsertError.message}`);
          } else {
            totalPostsSaved += postRows.length;
            totalWinners += winners.length;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.error('Search scrape failed', {
            searchId: search.id,
            label: search.label,
            error: msg,
          });
          errors.push(`Search ${search.label}: ${msg}`);
        }
      }
    }

    // ─── 6. Log the scrape run ─────────────────────────────────────────────────
    const { error: logError } = await supabase.from('cp_pipeline_scrape_runs').insert({
      started_at: runStartedAt,
      completed_at: new Date().toISOString(),
      creators_scraped: creators?.length ?? 0,
      searches_scraped: searches?.length ?? 0,
      posts_found: totalPostsSaved,
      winners_found: totalWinners,
      errors: errors.length > 0 ? errors : null,
    });

    if (logError) {
      logger.warn('Failed to log scrape run', { error: logError.message });
    }

    // ─── 7. Trigger template extraction if winners found ───────────────────────
    if (totalWinners > 0) {
      try {
        await tasks.trigger('extract-winning-templates', {});
        logger.info('Triggered extract-winning-templates', { winnersCount: totalWinners });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('Failed to trigger extract-winning-templates (task may not exist yet)', {
          error: msg,
        });
      }
    }

    const summary = {
      creatorsScraped: creators?.length ?? 0,
      searchesScraped: searches?.length ?? 0,
      totalPostsSaved,
      totalWinners,
      errors: errors.length,
    };

    logger.info('Scrape run complete', summary);

    return summary;
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a LinkedIn profile URL for matching.
 * Strips trailing slashes and lowercases.
 */
function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}
