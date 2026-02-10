import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  searchTopPerformingPosts,
  searchCreatorContent,
  searchHashtagContent,
  searchTopLeadMagnets,
  analyzeInspiration,
  type InspirationContent,
  type InspirationAnalysis,
} from '@/lib/ai/content-pipeline/inspiration-researcher';

interface SourceRow {
  id: string;
  user_id: string;
  source_type: string;
  source_value: string;
  priority: number;
  is_active: boolean;
}

interface PullInsert {
  user_id: string;
  source_id: string;
  content_type: string;
  title: string | null;
  content_preview: string | null;
  source_url: string;
  platform: string;
  author_name: string | null;
  author_url: string | null;
  engagement_metrics: Record<string, unknown>;
  ai_analysis: Record<string, unknown>;
  pulled_at: string;
  saved_to_swipe_file: boolean;
}

/**
 * Daily Inspiration Pull
 * Runs at 6 AM UTC daily.
 * For each user with active inspiration sources:
 *   - Pulls top content from each source (web search)
 *   - Runs AI analysis on each piece
 *   - Stores in cp_inspiration_pulls
 *   - Auto-adds standout items (quality >= 8) to swipe file
 */
export const dailyInspirationPull = schedules.task({
  id: 'daily-inspiration-pull',
  cron: '0 6 * * *', // 6 AM UTC daily
  maxDuration: 600, // 10 minutes
  run: async () => {
    const supabase = createSupabaseAdminClient();

    logger.info('Starting daily inspiration pull');

    // Check if search API is available
    const hasSerper = Boolean(process.env.SERPER_API_KEY);
    if (!hasSerper) {
      logger.warn('SERPER_API_KEY not set. Skipping daily inspiration pull.');
      return { skipped: true, reason: 'SERPER_API_KEY not configured' };
    }

    // Find all users with active inspiration sources
    const { data: sources, error: sourcesError } = await supabase
      .from('cp_inspiration_sources')
      .select('id, user_id, source_type, source_value, priority, is_active')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (sourcesError || !sources || sources.length === 0) {
      logger.info('No active inspiration sources found');
      return { usersProcessed: 0, totalPulls: 0 };
    }

    // Group sources by user
    const userSources = new Map<string, SourceRow[]>();
    for (const source of sources) {
      const existing = userSources.get(source.user_id) || [];
      existing.push(source);
      userSources.set(source.user_id, existing);
    }

    logger.info('Processing inspiration pulls', {
      users: userSources.size,
      totalSources: sources.length,
    });

    let totalPulls = 0;
    let totalAutoSaved = 0;
    const errors: string[] = [];

    for (const [userId, userSourceList] of userSources) {
      try {
        logger.info('Processing user inspiration', { userId, sources: userSourceList.length });

        const userPulls: PullInsert[] = [];

        for (const source of userSourceList) {
          try {
            const content = await fetchContentForSource(source);

            if (content.length === 0) {
              logger.info('No content found for source', {
                sourceId: source.id,
                type: source.source_type,
                value: source.source_value,
              });
              continue;
            }

            // Analyze each piece (batch of 3 at a time for rate limiting)
            const analyzed = await analyzeContentBatch(content);

            for (const { item, analysis } of analyzed) {
              // Skip items without a URL (can't dedup)
              if (!item.source_url) continue;

              const isStandout = analysis && analysis.estimated_quality >= 8;

              userPulls.push({
                user_id: userId,
                source_id: source.id,
                content_type: 'post',
                title: item.title,
                content_preview: item.content_preview?.slice(0, 500) || null,
                source_url: item.source_url,
                platform: item.platform,
                author_name: item.author_name,
                author_url: item.author_url,
                engagement_metrics: item.engagement_metrics || {},
                ai_analysis: analysis ? { ...analysis } as Record<string, unknown> : {},
                pulled_at: new Date().toISOString(),
                saved_to_swipe_file: isStandout ?? false,
              });

              if (isStandout) {
                totalAutoSaved++;
              }
            }

            // Update last_pulled_at on source
            await supabase
              .from('cp_inspiration_sources')
              .update({ last_pulled_at: new Date().toISOString() })
              .eq('id', source.id);
          } catch (sourceError) {
            const msg = sourceError instanceof Error ? sourceError.message : String(sourceError);
            logger.error('Failed to process source', {
              sourceId: source.id,
              error: msg,
            });
            errors.push(`source ${source.id}: ${msg}`);
          }
        }

        // Bulk insert pulls (skip duplicates via ON CONFLICT)
        if (userPulls.length > 0) {
          // Insert in batches to handle potential conflicts gracefully
          const BATCH_SIZE = 20;
          for (let i = 0; i < userPulls.length; i += BATCH_SIZE) {
            const batch = userPulls.slice(i, i + BATCH_SIZE);
            const { error: insertError } = await supabase
              .from('cp_inspiration_pulls')
              .upsert(batch, {
                onConflict: 'user_id,source_url',
                ignoreDuplicates: true,
              });

            if (insertError) {
              logger.error('Failed to insert inspiration pulls', {
                userId,
                error: insertError.message,
                batchIndex: i,
              });
            }
          }

          totalPulls += userPulls.length;

          // Auto-save standout items to swipe file
          const standouts = userPulls.filter((p) => p.saved_to_swipe_file);
          for (const standout of standouts) {
            try {
              await supabase
                .from('swipe_file_posts')
                .insert({
                  content: standout.content_preview || standout.title || '',
                  hook: standout.title?.slice(0, 100) || null,
                  source_url: standout.source_url,
                  author_name: standout.author_name,
                  notes: (standout.ai_analysis as Record<string, string>)?.what_makes_it_work || null,
                  submitted_by: userId,
                  status: 'approved',
                });
            } catch {
              // Swipe file save is non-critical
            }
          }
        }

        logger.info('User inspiration pull complete', {
          userId,
          pullsCreated: userPulls.length,
          autoSaved: userPulls.filter((p) => p.saved_to_swipe_file).length,
        });
      } catch (userError) {
        const msg = userError instanceof Error ? userError.message : String(userError);
        logger.error('Failed to process user', { userId, error: msg });
        errors.push(`user ${userId}: ${msg}`);
      }
    }

    logger.info('Daily inspiration pull complete', {
      usersProcessed: userSources.size,
      totalPulls,
      totalAutoSaved,
      errors: errors.length,
    });

    return {
      usersProcessed: userSources.size,
      totalPulls,
      totalAutoSaved,
      errors,
    };
  },
});

// ============================================
// Helper Functions
// ============================================

async function fetchContentForSource(source: SourceRow): Promise<InspirationContent[]> {
  const maxResults = Math.min(3 + source.priority, 8); // Higher priority = more results

  switch (source.source_type) {
    case 'creator':
      return searchCreatorContent(source.source_value, maxResults);

    case 'search_term':
      return searchTopPerformingPosts(source.source_value, 'linkedin');

    case 'hashtag':
      return searchHashtagContent(source.source_value, maxResults);

    case 'competitor': {
      // For competitors, search both their posts and their lead magnets
      const [posts, leadMagnets] = await Promise.all([
        searchTopPerformingPosts(`"${source.source_value}"`, 'linkedin'),
        searchTopLeadMagnets(source.source_value),
      ]);

      // Mark lead magnet results
      const lmResults = leadMagnets.map((lm) => ({
        ...lm,
        platform: 'web',
      }));

      return [...posts.slice(0, 4), ...lmResults.slice(0, 4)];
    }

    default:
      return [];
  }
}

async function analyzeContentBatch(
  items: InspirationContent[]
): Promise<Array<{ item: InspirationContent; analysis: InspirationAnalysis | null }>> {
  const results: Array<{ item: InspirationContent; analysis: InspirationAnalysis | null }> = [];
  const BATCH_SIZE = 3;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const analysisResults = await Promise.allSettled(
      batch.map((item) => analyzeInspiration(item))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = analysisResults[j];
      results.push({
        item: batch[j],
        analysis: result.status === 'fulfilled' ? result.value : null,
      });
    }
  }

  return results;
}
