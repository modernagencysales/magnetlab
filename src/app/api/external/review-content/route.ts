// API Route: External Content Review
// POST /api/external/review-content
//
// Reviews all draft pipeline posts for a user/team profile using AI.
// Deletes posts marked as 'delete', updates others with review_data.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { reviewPosts, type ReviewablePost } from '@/lib/ai/content-pipeline/content-reviewer';

// ============================================
// AUTHENTICATION
// ============================================

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    logApiError('external/review-content/auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: Request) {
  try {
    // Step 1: Authenticate
    if (!authenticateRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    // Step 2: Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const { userId, teamProfileId, voiceProfile, icpSummary } = body as {
      userId?: string;
      teamProfileId?: string;
      voiceProfile?: string;
      icpSummary?: string;
    };

    if (!userId || typeof userId !== 'string') {
      return ApiErrors.validationError('userId is required');
    }

    // Step 3: Verify user exists
    const supabase = createSupabaseAdminClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return ApiErrors.notFound('User');
    }

    // Step 4: Fetch draft posts
    // If teamProfileId is provided, filter by source_profile_id; otherwise by user_id
    let postsQuery = supabase
      .from('cp_pipeline_posts')
      .select('id, final_content, draft_content, hook_score')
      .eq('status', 'draft');

    if (teamProfileId && typeof teamProfileId === 'string') {
      postsQuery = postsQuery.eq('source_profile_id', teamProfileId);
    } else {
      postsQuery = postsQuery.eq('user_id', userId);
    }

    const { data: posts, error: postsError } = await postsQuery;

    if (postsError) {
      logApiError('external/review-content/fetch-posts', postsError, { userId });
      return ApiErrors.databaseError('Failed to fetch draft posts');
    }

    // Step 5: No posts found — return early
    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: true,
        reviewed: 0,
        summary: { excellent: 0, good_with_edits: 0, needs_rewrite: 0, deleted: 0 },
        deletedPostIds: [],
      });
    }

    // Step 6: Call AI reviewer
    const reviewablePosts: ReviewablePost[] = posts.map((p) => ({
      id: p.id,
      final_content: p.final_content,
      draft_content: p.draft_content,
      hook_score: p.hook_score,
    }));

    const reviewResults = await reviewPosts(reviewablePosts, {
      voiceProfile: voiceProfile || undefined,
      icpSummary: icpSummary || undefined,
    });

    // Step 7: Apply review results
    const summary = { excellent: 0, good_with_edits: 0, needs_rewrite: 0, deleted: 0 };
    const deletedPostIds: string[] = [];

    // Build a lookup of review results by post_id
    const resultMap = new Map(reviewResults.map((r) => [r.post_id, r]));

    for (const post of posts) {
      const result = resultMap.get(post.id);
      if (!result) continue;

      if (result.review_category === 'delete') {
        // Delete the post from DB
        const { error: deleteError } = await supabase
          .from('cp_pipeline_posts')
          .delete()
          .eq('id', post.id);

        if (deleteError) {
          logApiError('external/review-content/delete-post', deleteError, { postId: post.id });
        } else {
          summary.deleted++;
          deletedPostIds.push(post.id);
        }
      } else {
        // Update post with review_data
        const reviewData = {
          score: result.review_score,
          category: result.review_category,
          notes: result.review_notes,
          flags: result.consistency_flags,
          reviewed_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('cp_pipeline_posts')
          .update({ review_data: reviewData })
          .eq('id', post.id);

        if (updateError) {
          logApiError('external/review-content/update-post', updateError, { postId: post.id });
        } else {
          summary[result.review_category]++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      reviewed: summary.excellent + summary.good_with_edits + summary.needs_rewrite + summary.deleted,
      summary,
      deletedPostIds,
    });
  } catch (error) {
    logApiError('external/review-content', error);
    return ApiErrors.internalError('An unexpected error occurred during content review');
  }
}
