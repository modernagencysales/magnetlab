/**
 * Content Source Scanner.
 * Scans LinkedIn for commentary-worthy content using HarvestAPI.
 * Creates cp_creatives for high-scoring content.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import { schedules, task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { searchPosts, getProfilePosts, getCompanyPosts } from '@/lib/integrations/harvest-api';
import { fetchSubredditPosts, searchReddit } from '@/lib/scanners/reddit-fetcher';
import { analyzeCreative } from '@/lib/ai/content-pipeline/creative-analyzer';
import { getExploitBySlug } from '@/server/services/exploits.service';
import { updateTopicCounts } from '@/server/services/trends.service';
import type { HarvestPostShort } from '@/lib/types/signals';
import type { ScannedContent } from '@/lib/types/exploits';

// ─── Constants ──────────────────────────────────────────────────────────────

const ENGAGEMENT_THRESHOLD = 50; // Min likes to consider
const SCORE_AUTO_CREATIVE = 7; // Auto-create creative above this

const CREATIVE_COLUMNS =
  'id, user_id, team_id, source_platform, source_url, source_author, content_text, image_url, creative_type, topics, commentary_worthy_score, suggested_hooks, suggested_exploit_id, status, times_used, created_at' as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface SourceRow {
  id: string;
  user_id: string;
  source_type: string;
  source_value: string;
  priority: number;
  is_active: boolean;
}

interface ScanResult {
  postsScanned: number;
  creativesCreated: number;
  errors: string[];
}

/** LinkedIn sources return HarvestPostShort[]; Reddit sources return ScannedContent[]. */
type FetchResult =
  | { kind: 'linkedin'; posts: HarvestPostShort[] }
  | { kind: 'reddit'; posts: ScannedContent[] };

// ─── Core logic ─────────────────────────────────────────────────────────────

/**
 * Processes a single HarvestPostShort into a cp_creative row.
 * Returns true if a creative was created, false if skipped or deduped.
 */
async function processPost(
  post: HarvestPostShort,
  userId: string,
  teamId: string | null,
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<boolean> {
  // Skip posts with no content or no URL
  if (!post.content || !post.linkedinUrl) return false;

  // Engagement filter
  const likes = post.engagement?.likes ?? 0;
  if (likes < ENGAGEMENT_THRESHOLD) return false;

  // Dedup: check cp_creatives for existing source_url
  const { data: existing } = await supabase
    .from('cp_creatives')
    .select('id')
    .eq('user_id', userId)
    .eq('source_url', post.linkedinUrl)
    .maybeSingle();

  if (existing) return false;

  // AI analysis
  const analysis = await analyzeCreative({
    content_text: post.content,
    source_platform: 'linkedin',
    source_url: post.linkedinUrl,
  });

  // Skip if score below threshold
  const score = analysis?.commentary_worthy_score ?? 0;
  if (score < SCORE_AUTO_CREATIVE) return false;

  // Resolve suggested exploit by slug
  let suggested_exploit_id: string | null = null;
  if (analysis?.suggested_exploit_slug) {
    const exploit = await getExploitBySlug(userId, analysis.suggested_exploit_slug);
    suggested_exploit_id = exploit?.id ?? null;
  }

  // Insert into cp_creatives
  const { error } = await supabase
    .from('cp_creatives')
    .insert({
      user_id: userId,
      team_id: teamId,
      source_platform: 'linkedin',
      source_url: post.linkedinUrl,
      source_author: post.name ?? null,
      content_text: post.content,
      image_url: null,
      creative_type: analysis?.creative_type ?? 'linkedin_post',
      topics: analysis?.topics ?? [],
      commentary_worthy_score: score,
      suggested_hooks: analysis?.suggested_hooks ?? [],
      suggested_exploit_id,
      status: 'new',
      times_used: 0,
    })
    .select(CREATIVE_COLUMNS);

  if (error) {
    logger.error('Failed to insert creative from scanner', {
      userId,
      sourceUrl: post.linkedinUrl,
      error: error.message,
    });
    return false;
  }

  return true;
}

/**
 * Processes a single ScannedContent (from Reddit or other non-LinkedIn sources)
 * into a cp_creative row.
 * Returns true if a creative was created, false if skipped or deduped.
 */
async function processScannedContent(
  scanned: ScannedContent,
  userId: string,
  teamId: string | null,
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<boolean> {
  // Skip posts with no content or no URL
  if (!scanned.content_text || !scanned.source_url) return false;

  // Dedup: check cp_creatives for existing source_url
  const { data: existing } = await supabase
    .from('cp_creatives')
    .select('id')
    .eq('user_id', userId)
    .eq('source_url', scanned.source_url)
    .maybeSingle();

  if (existing) return false;

  // AI analysis
  const analysis = await analyzeCreative({
    content_text: scanned.content_text,
    source_platform: scanned.source_platform,
    source_url: scanned.source_url,
  });

  // Skip if score below threshold
  const score = analysis?.commentary_worthy_score ?? 0;
  if (score < SCORE_AUTO_CREATIVE) return false;

  // Resolve suggested exploit by slug
  let suggested_exploit_id: string | null = null;
  if (analysis?.suggested_exploit_slug) {
    const exploit = await getExploitBySlug(userId, analysis.suggested_exploit_slug);
    suggested_exploit_id = exploit?.id ?? null;
  }

  // Insert into cp_creatives
  const { error } = await supabase
    .from('cp_creatives')
    .insert({
      user_id: userId,
      team_id: teamId,
      source_platform: scanned.source_platform,
      source_url: scanned.source_url,
      source_author: scanned.source_author ?? null,
      content_text: scanned.content_text,
      image_url: scanned.image_url ?? null,
      creative_type: analysis?.creative_type ?? 'reddit_post',
      topics: analysis?.topics ?? [],
      commentary_worthy_score: score,
      suggested_hooks: analysis?.suggested_hooks ?? [],
      suggested_exploit_id,
      status: 'new',
      times_used: 0,
    })
    .select(CREATIVE_COLUMNS);

  if (error) {
    logger.error('Failed to insert creative from reddit scanner', {
      userId,
      sourceUrl: scanned.source_url,
      error: error.message,
    });
    return false;
  }

  return true;
}

/**
 * Fetch posts for a single inspiration source.
 * Returns a discriminated union so the caller knows which processor to use.
 */
async function fetchPostsForSource(source: SourceRow): Promise<FetchResult> {
  switch (source.source_type) {
    case 'search_term':
    case 'hashtag': {
      const { data, error } = await searchPosts({
        search: source.source_value,
        postedLimit: '24h',
        sortBy: 'relevance',
      });
      if (error) {
        logger.warn('searchPosts error', { sourceId: source.id, error });
      }
      return { kind: 'linkedin', posts: data ?? [] };
    }

    case 'creator': {
      const { data, error } = await getProfilePosts({
        profile: source.source_value,
        postedLimit: 'week',
      });
      if (error) {
        logger.warn('getProfilePosts error', { sourceId: source.id, error });
      }
      return { kind: 'linkedin', posts: data ?? [] };
    }

    case 'competitor': {
      const { data, error } = await getCompanyPosts({
        company: source.source_value,
        postedLimit: 'week',
      });
      if (error) {
        logger.warn('getCompanyPosts error', { sourceId: source.id, error });
      }
      return { kind: 'linkedin', posts: data ?? [] };
    }

    case 'reddit_subreddit': {
      const posts = await fetchSubredditPosts(source.source_value, {
        sort: 'hot',
        limit: 25,
        minScore: 50,
      });
      return { kind: 'reddit', posts };
    }

    case 'reddit_search': {
      const posts = await searchReddit(source.source_value, {
        sort: 'relevance',
        timeframe: 'week',
        limit: 25,
        minScore: 20,
      });
      return { kind: 'reddit', posts };
    }

    default:
      return { kind: 'linkedin', posts: [] };
  }
}

/**
 * Run the content scanner for a single user's active inspiration sources.
 * Returns postsScanned, creativesCreated, errors.
 */
async function scanForUser(
  userId: string,
  sources: SourceRow[],
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<ScanResult> {
  let postsScanned = 0;
  let creativesCreated = 0;
  const errors: string[] = [];

  // Resolve team_id for this user (null if no team)
  const { data: teamRow } = await supabase
    .from('team_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  const teamId: string | null = teamRow?.id ?? null;

  for (const source of sources) {
    try {
      const fetchResult = await fetchPostsForSource(source);
      postsScanned += fetchResult.posts.length;

      if (fetchResult.kind === 'linkedin') {
        for (const post of fetchResult.posts) {
          try {
            const created = await processPost(post, userId, teamId, supabase);
            if (created) creativesCreated++;
          } catch (postError) {
            const msg = postError instanceof Error ? postError.message : String(postError);
            logger.error('Failed to process post', {
              userId,
              sourceId: source.id,
              url: post.linkedinUrl,
              error: msg,
            });
            errors.push(`post ${post.linkedinUrl ?? 'unknown'}: ${msg}`);
          }
        }
      } else {
        for (const scanned of fetchResult.posts) {
          try {
            const created = await processScannedContent(scanned, userId, teamId, supabase);
            if (created) creativesCreated++;
          } catch (postError) {
            const msg = postError instanceof Error ? postError.message : String(postError);
            logger.error('Failed to process reddit post', {
              userId,
              sourceId: source.id,
              url: scanned.source_url,
              error: msg,
            });
            errors.push(`post ${scanned.source_url}: ${msg}`);
          }
        }
      }

      // Update last_pulled_at on source
      await supabase
        .from('cp_inspiration_sources')
        .update({ last_pulled_at: new Date().toISOString() })
        .eq('id', source.id);
    } catch (sourceError) {
      const msg = sourceError instanceof Error ? sourceError.message : String(sourceError);
      logger.error('Failed to process source', { userId, sourceId: source.id, error: msg });
      errors.push(`source ${source.id}: ${msg}`);
    }
  }

  return { postsScanned, creativesCreated, errors };
}

// ─── Scheduled task ─────────────────────────────────────────────────────────

/**
 * Scheduled scanner: runs at 8 AM and 6 PM UTC daily.
 * For each user with active cp_inspiration_sources, fetches LinkedIn posts
 * and creates cp_creatives for high-scoring content.
 */
export const scanContentSources = schedules.task({
  id: 'scan-content-sources',
  cron: '0 8,18 * * *',
  maxDuration: 600, // 10 minutes
  run: async () => {
    const supabase = createSupabaseAdminClient();

    if (!process.env.HARVEST_API_KEY) {
      logger.warn('HARVEST_API_KEY not set. Skipping content source scan.');
      return { skipped: true, reason: 'HARVEST_API_KEY not configured' };
    }

    logger.info('Starting scheduled content source scan');

    // Fetch all active inspiration sources
    const { data: sources, error: sourcesError } = await supabase
      .from('cp_inspiration_sources')
      .select('id, user_id, source_type, source_value, priority, is_active')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (sourcesError || !sources || sources.length === 0) {
      logger.info('No active inspiration sources found');
      return { usersProcessed: 0, postsScanned: 0, creativesCreated: 0, errors: [] };
    }

    // Group sources by user
    const userSources = new Map<string, SourceRow[]>();
    for (const source of sources) {
      const existing = userSources.get(source.user_id) ?? [];
      existing.push(source as SourceRow);
      userSources.set(source.user_id, existing);
    }

    logger.info('Processing content scans', {
      users: userSources.size,
      totalSources: sources.length,
    });

    let totalPostsScanned = 0;
    let totalCreativesCreated = 0;
    const allErrors: string[] = [];

    for (const [userId, userSourceList] of userSources) {
      try {
        const result = await scanForUser(userId, userSourceList, supabase);
        totalPostsScanned += result.postsScanned;
        totalCreativesCreated += result.creativesCreated;
        allErrors.push(...result.errors);

        logger.info('User scan complete', {
          userId,
          postsScanned: result.postsScanned,
          creativesCreated: result.creativesCreated,
          errors: result.errors.length,
        });

        // Update trending topics after processing all sources for this user
        try {
          await updateTopicCounts(userId);
        } catch (trendError) {
          // Non-critical — log and continue
          logger.warn('Failed to update topic counts', {
            userId,
            error: trendError instanceof Error ? trendError.message : String(trendError),
          });
        }
      } catch (userError) {
        const msg = userError instanceof Error ? userError.message : String(userError);
        logger.error('Failed to scan for user', { userId, error: msg });
        allErrors.push(`user ${userId}: ${msg}`);
      }
    }

    logger.info('Scheduled content source scan complete', {
      usersProcessed: userSources.size,
      postsScanned: totalPostsScanned,
      creativesCreated: totalCreativesCreated,
      errors: allErrors.length,
    });

    return {
      usersProcessed: userSources.size,
      postsScanned: totalPostsScanned,
      creativesCreated: totalCreativesCreated,
      errors: allErrors,
    };
  },
});

// ─── Manual trigger task ─────────────────────────────────────────────────────

/**
 * Manual scanner: triggered via POST /api/content-pipeline/scanner/run.
 * Same logic as scheduled task but for a single user.
 */
export const scanContentSourcesManual = task({
  id: 'scan-content-sources-manual',
  maxDuration: 300, // 5 minutes
  run: async ({ userId }: { userId: string }) => {
    const supabase = createSupabaseAdminClient();

    if (!process.env.HARVEST_API_KEY) {
      logger.warn('HARVEST_API_KEY not set. Skipping manual content source scan.', { userId });
      return { skipped: true, reason: 'HARVEST_API_KEY not configured' };
    }

    logger.info('Starting manual content source scan', { userId });

    // Fetch active inspiration sources for this user
    const { data: sources, error: sourcesError } = await supabase
      .from('cp_inspiration_sources')
      .select('id, user_id, source_type, source_value, priority, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (sourcesError || !sources || sources.length === 0) {
      logger.info('No active inspiration sources for user', { userId });
      return { postsScanned: 0, creativesCreated: 0, errors: [] };
    }

    const result = await scanForUser(userId, sources as SourceRow[], supabase);

    logger.info('Manual content source scan complete', {
      userId,
      postsScanned: result.postsScanned,
      creativesCreated: result.creativesCreated,
      errors: result.errors.length,
    });

    // Update trending topics after processing all sources for this user
    try {
      await updateTopicCounts(userId);
    } catch (trendError) {
      // Non-critical — log and continue
      logger.warn('Failed to update topic counts after manual scan', {
        userId,
        error: trendError instanceof Error ? trendError.message : String(trendError),
      });
    }

    return result;
  },
});
