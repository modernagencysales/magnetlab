/**
 * Recycling Service.
 * Detects high-performing posts, creates reposts and cousins.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { generateFromPrimitives } from '@/lib/ai/content-pipeline/primitives-assembler';
import type { PrimitivesInput } from '@/lib/ai/content-pipeline/primitives-assembler';
import type { PipelinePost } from '@/lib/types/content-pipeline';

// ─── Column constants ───────────────────────────────────────────────────────

const POST_COLUMNS =
  'id, user_id, draft_content, final_content, status, exploit_id, creative_id, published_at, recycle_after, engagement_stats' as const;

const POST_RECYCLE_COLUMNS =
  'id, user_id, team_profile_id, draft_content, final_content, status, exploit_id, creative_id, image_url, published_at, recycle_after, engagement_stats' as const;

const PERF_COLUMNS = 'post_id, impressions, engagement_rate' as const;

const EXPLOIT_COLUMNS = 'id, name, prompt_template, example_posts' as const;

const CREATIVE_COLUMNS = 'id, content_text, image_url' as const;

// ─── Thresholds ─────────────────────────────────────────────────────────────

const IMPRESSIONS_MULTIPLIER = 2;
const ENGAGEMENT_MULTIPLIER = 1.5;
const RECYCLE_CYCLE_DAYS = 75;
const STABILIZATION_DAYS = 7;
const BASELINE_WINDOW_DAYS = 30;

// ─── Result types ────────────────────────────────────────────────────────────

export interface PerformanceBaseline {
  avgImpressions: number;
  avgEngagementRate: number;
  postCount: number;
}

export interface RecyclablePost {
  id: string;
  user_id: string;
  draft_content: string | null;
  final_content: string | null;
  status: string;
  exploit_id: string | null;
  creative_id: string | null;
  published_at: string | null;
  recycle_after: string | null;
  engagement_stats: Record<string, unknown> | null;
  exploit_name: string | null;
}

export interface RecyclingLoopResult {
  repostsCreated: number;
  cousinsCreated: number;
}

// ─── Read operations ─────────────────────────────────────────────────────────

/**
 * Compute the user's average impressions and engagement_rate from the last 30 days.
 * Returns zeros if insufficient data.
 */
export async function getUserPerformanceBaseline(userId: string): Promise<PerformanceBaseline> {
  const supabase = createSupabaseAdminClient();

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - BASELINE_WINDOW_DAYS);

  // Fetch published posts from the last 30 days
  const { data: posts, error: postsError } = await supabase
    .from('cp_pipeline_posts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'published')
    .gte('published_at', windowStart.toISOString());

  if (postsError) {
    logError('recycling/baseline/posts', postsError, { userId });
    throw Object.assign(new Error('Failed to fetch posts for baseline'), { statusCode: 500 });
  }

  const postIds = (posts ?? []).map((p: { id: string }) => p.id);
  if (postIds.length === 0) {
    return { avgImpressions: 0, avgEngagementRate: 0, postCount: 0 };
  }

  const { data: perf, error: perfError } = await supabase
    .from('cp_post_performance')
    .select(PERF_COLUMNS)
    .in('post_id', postIds);

  if (perfError) {
    logError('recycling/baseline/perf', perfError, { userId });
    throw Object.assign(new Error('Failed to fetch performance data for baseline'), {
      statusCode: 500,
    });
  }

  const rows = (perf ?? []) as Array<{
    post_id: string;
    impressions: number;
    engagement_rate: number;
  }>;

  if (rows.length === 0) {
    return { avgImpressions: 0, avgEngagementRate: 0, postCount: postIds.length };
  }

  const avgImpressions = rows.reduce((sum, r) => sum + r.impressions, 0) / rows.length;
  const avgEngagementRate = rows.reduce((sum, r) => sum + r.engagement_rate, 0) / rows.length;

  return { avgImpressions, avgEngagementRate, postCount: postIds.length };
}

/**
 * List posts due for recycling (recycle_after <= now, status = published).
 * Ordered by recycle_after ASC (oldest first).
 */
export async function listRecyclablePosts(userId: string, limit = 50): Promise<RecyclablePost[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select(POST_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'published')
    .lte('recycle_after', new Date().toISOString())
    .order('recycle_after', { ascending: true })
    .limit(limit);

  if (error) {
    logError('recycling/list-recyclable', error, { userId });
    throw Object.assign(new Error('Failed to list recyclable posts'), { statusCode: 500 });
  }

  const posts = (data ?? []) as Array<{
    id: string;
    user_id: string;
    draft_content: string | null;
    final_content: string | null;
    status: string;
    exploit_id: string | null;
    creative_id: string | null;
    published_at: string | null;
    recycle_after: string | null;
    engagement_stats: Record<string, unknown> | null;
  }>;

  // Resolve exploit names in a single query for posts that have exploit_ids
  const exploitIds = [...new Set(posts.map((p) => p.exploit_id).filter(Boolean) as string[])];

  let exploitNameMap = new Map<string, string>();

  if (exploitIds.length > 0) {
    const { data: exploits } = await supabase
      .from('cp_exploits')
      .select('id, name')
      .in('id', exploitIds);

    exploitNameMap = new Map(
      ((exploits ?? []) as Array<{ id: string; name: string }>).map((e) => [e.id, e.name])
    );
  }

  return posts.map((p) => ({
    ...p,
    exploit_name: p.exploit_id ? (exploitNameMap.get(p.exploit_id) ?? null) : null,
  }));
}

// ─── Write operations ────────────────────────────────────────────────────────

/**
 * Scan published posts and flag winners for recycling.
 * A winner has impressions > 2x baseline AND engagement_rate > 1.5x baseline.
 * Sets recycle_after = published_at + 75 days for each winner.
 * Returns count of newly flagged winners.
 */
export async function detectWinners(userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const baseline = await getUserPerformanceBaseline(userId);
  if (
    baseline.postCount === 0 ||
    (baseline.avgImpressions === 0 && baseline.avgEngagementRate === 0)
  ) {
    return 0;
  }

  const stabilizationCutoff = new Date();
  stabilizationCutoff.setDate(stabilizationCutoff.getDate() - STABILIZATION_DAYS);

  // Fetch published posts that haven't been flagged yet and have stabilized
  const { data: posts, error: postsError } = await supabase
    .from('cp_pipeline_posts')
    .select('id, published_at')
    .eq('user_id', userId)
    .eq('status', 'published')
    .is('recycle_after', null)
    .lte('published_at', stabilizationCutoff.toISOString());

  if (postsError) {
    logError('recycling/detect-winners/posts', postsError, { userId });
    throw Object.assign(new Error('Failed to fetch posts for winner detection'), {
      statusCode: 500,
    });
  }

  const candidates = (posts ?? []) as Array<{ id: string; published_at: string }>;
  if (candidates.length === 0) return 0;

  const candidateIds = candidates.map((p) => p.id);
  const publishedAtById = new Map(candidates.map((p) => [p.id, p.published_at]));

  // Fetch performance data for candidates
  const { data: perf, error: perfError } = await supabase
    .from('cp_post_performance')
    .select(PERF_COLUMNS)
    .in('post_id', candidateIds);

  if (perfError) {
    logError('recycling/detect-winners/perf', perfError, { userId });
    throw Object.assign(new Error('Failed to fetch performance data for winner detection'), {
      statusCode: 500,
    });
  }

  const perfRows = (perf ?? []) as Array<{
    post_id: string;
    impressions: number;
    engagement_rate: number;
  }>;

  const perfByPostId = new Map<string, { impressions: number; engagement_rate: number }>();
  for (const row of perfRows) {
    perfByPostId.set(row.post_id, {
      impressions: row.impressions,
      engagement_rate: row.engagement_rate,
    });
  }

  // Identify winners
  const winnerIds: string[] = [];
  for (const postId of candidateIds) {
    const perfData = perfByPostId.get(postId);
    if (!perfData) continue; // no performance data yet — skip

    const isImpressionsWinner =
      perfData.impressions > baseline.avgImpressions * IMPRESSIONS_MULTIPLIER;
    const isEngagementWinner =
      perfData.engagement_rate > baseline.avgEngagementRate * ENGAGEMENT_MULTIPLIER;

    // Both thresholds must be met (AND logic) per spec — a post needs
    // both high impressions AND high engagement to be worth recycling
    if (isImpressionsWinner && isEngagementWinner) {
      winnerIds.push(postId);
    }
  }

  if (winnerIds.length === 0) return 0;

  // Update recycle_after for each winner based on its own published_at
  let flagged = 0;
  for (const postId of winnerIds) {
    const publishedAt = publishedAtById.get(postId);
    if (!publishedAt) continue;

    const recycleAfter = new Date(publishedAt);
    recycleAfter.setDate(recycleAfter.getDate() + RECYCLE_CYCLE_DAYS);

    const { error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({ recycle_after: recycleAfter.toISOString() })
      .eq('id', postId)
      .eq('user_id', userId);

    if (updateError) {
      logError('recycling/detect-winners/update', updateError, { userId, postId });
      // Non-fatal: continue flagging other winners
      continue;
    }

    flagged++;
  }

  return flagged;
}

/**
 * Clone a published post as a repost (proven content, auto-approved).
 * Pushes the original's recycle_after forward by 75 days.
 */
export async function createRepost(userId: string, originalPostId: string): Promise<PipelinePost> {
  const supabase = createSupabaseAdminClient();

  // Fetch original
  const { data: original, error: fetchError } = await supabase
    .from('cp_pipeline_posts')
    .select(POST_RECYCLE_COLUMNS)
    .eq('id', originalPostId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    logError('recycling/create-repost/fetch', fetchError, { userId, originalPostId });
    throw Object.assign(new Error('Failed to fetch original post'), { statusCode: 500 });
  }

  if (!original) {
    throw Object.assign(new Error('Original post not found'), { statusCode: 404 });
  }

  const orig = original as {
    id: string;
    draft_content: string | null;
    final_content: string | null;
    exploit_id: string | null;
    creative_id: string | null;
    image_url: string | null;
    team_profile_id: string | null;
  };

  const content = orig.final_content ?? orig.draft_content;

  // Insert repost
  const { data: repost, error: insertError } = await supabase
    .from('cp_pipeline_posts')
    .insert({
      user_id: userId,
      team_profile_id: orig.team_profile_id ?? null,
      parent_post_id: originalPostId,
      lineage_type: 'repost',
      status: 'approved',
      draft_content: content,
      final_content: content,
      exploit_id: orig.exploit_id ?? null,
      creative_id: orig.creative_id ?? null,
      image_url: orig.image_url ?? null,
      source: 'recycler',
    })
    .select(POST_COLUMNS)
    .single();

  if (insertError) {
    logError('recycling/create-repost/insert', insertError, { userId, originalPostId });
    throw Object.assign(new Error('Failed to create repost'), { statusCode: 500 });
  }

  // Push original's recycle_after forward
  const nextRecycleAfter = new Date();
  nextRecycleAfter.setDate(nextRecycleAfter.getDate() + RECYCLE_CYCLE_DAYS);

  const { error: updateError } = await supabase
    .from('cp_pipeline_posts')
    .update({ recycle_after: nextRecycleAfter.toISOString() })
    .eq('id', originalPostId)
    .eq('user_id', userId);

  if (updateError) {
    // Non-fatal — repost already created; log but don't throw
    logError('recycling/create-repost/update-original', updateError, { userId, originalPostId });
  }

  return repost as PipelinePost;
}

/**
 * Generate a fresh-angle cousin from a published post (same exploit + creative, new content).
 * Status = 'draft' — needs human review before publishing.
 */
export async function createCousin(userId: string, originalPostId: string): Promise<PipelinePost> {
  const supabase = createSupabaseAdminClient();

  // ─── 1. Fetch original post ──────────────────────────────────────────
  const { data: original, error: fetchError } = await supabase
    .from('cp_pipeline_posts')
    .select(POST_RECYCLE_COLUMNS)
    .eq('id', originalPostId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    logError('recycling/create-cousin/fetch', fetchError, { userId, originalPostId });
    throw Object.assign(new Error('Failed to fetch original post'), { statusCode: 500 });
  }

  if (!original) {
    throw Object.assign(new Error('Original post not found'), { statusCode: 404 });
  }

  const orig = original as {
    id: string;
    draft_content: string | null;
    final_content: string | null;
    exploit_id: string | null;
    creative_id: string | null;
    image_url: string | null;
    team_profile_id: string | null;
  };

  // ─── 2. Fetch exploit (optional) ─────────────────────────────────────
  let exploitInput: PrimitivesInput['exploit'] | undefined;
  if (orig.exploit_id) {
    const { data: exploit } = await supabase
      .from('cp_exploits')
      .select(EXPLOIT_COLUMNS)
      .eq('id', orig.exploit_id)
      .maybeSingle();

    if (exploit) {
      const e = exploit as {
        id: string;
        name: string;
        prompt_template: string;
        example_posts: string[];
      };
      exploitInput = {
        name: e.name,
        prompt_template: e.prompt_template,
        example_posts: e.example_posts ?? [],
      };
    }
  }

  // ─── 3. Fetch creative (optional) ────────────────────────────────────
  let creativeInput: PrimitivesInput['creative'] | undefined;
  if (orig.creative_id) {
    const { data: creative } = await supabase
      .from('cp_creatives')
      .select(CREATIVE_COLUMNS)
      .eq('id', orig.creative_id)
      .maybeSingle();

    if (creative) {
      const c = creative as { id: string; content_text: string; image_url: string | null };
      creativeInput = {
        content_text: c.content_text,
        image_url: c.image_url,
      };
    }
  }

  // ─── 4. Generate cousin content ───────────────────────────────────────
  const primitivesInput: PrimitivesInput = {
    exploit: exploitInput,
    creative: creativeInput,
    instructions:
      'Write a fresh take on the same topic. Use a different hook and angle. Do NOT copy the original post.',
  };

  const generated = await generateFromPrimitives(primitivesInput);
  const draftContent = generated?.content ?? orig.final_content ?? orig.draft_content ?? '';

  // ─── 5. Insert cousin ────────────────────────────────────────────────
  const { data: cousin, error: insertError } = await supabase
    .from('cp_pipeline_posts')
    .insert({
      user_id: userId,
      team_profile_id: orig.team_profile_id ?? null,
      parent_post_id: originalPostId,
      lineage_type: 'cousin',
      status: 'draft',
      draft_content: draftContent,
      final_content: null,
      exploit_id: orig.exploit_id ?? null,
      creative_id: orig.creative_id ?? null,
      image_url: orig.image_url ?? null,
      source: 'recycler',
    })
    .select(POST_COLUMNS)
    .single();

  if (insertError) {
    logError('recycling/create-cousin/insert', insertError, { userId, originalPostId });
    throw Object.assign(new Error('Failed to create cousin post'), { statusCode: 500 });
  }

  return cousin as PipelinePost;
}

// ─── Recycling loop ──────────────────────────────────────────────────────────

/**
 * Run the full recycling loop for a user.
 * Called by the nightly autopilot batch.
 * For each recyclable post: creates one repost (auto-approved) + one cousin (draft).
 */
// TODO (Phase 2 follow-up): If repost underperforms original, stop recycling it
// TODO (Phase 2 follow-up): If cousin outperforms original, it becomes the new "original" for future recycling
export async function runRecyclingLoop(userId: string): Promise<RecyclingLoopResult> {
  const recyclable = await listRecyclablePosts(userId);

  let repostsCreated = 0;
  let cousinsCreated = 0;

  for (const post of recyclable) {
    // Repost — fire-and-forget per post, log errors but continue
    try {
      await createRepost(userId, post.id);
      repostsCreated++;
    } catch (err) {
      logError('recycling/loop/repost', err, { userId, postId: post.id });
    }

    // Cousin — fire-and-forget per post, log errors but continue
    try {
      await createCousin(userId, post.id);
      cousinsCreated++;
    } catch (err) {
      logError('recycling/loop/cousin', err, { userId, postId: post.id });
    }
  }

  return { repostsCreated, cousinsCreated };
}

// ─── Error helper used by routes ─────────────────────────────────────────────

/** Extract HTTP status from a service error (defaults to 500). */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
