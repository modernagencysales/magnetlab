import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

/**
 * POST /api/content-pipeline/performance
 * Submit post performance metrics (manual entry or via integration).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const {
      post_id,
      platform = 'linkedin',
      views,
      likes,
      comments,
      shares,
      saves,
      clicks,
      impressions,
      engagement_rate,
      captured_at,
    } = body;

    // Validation
    if (!post_id || !isValidUUID(post_id)) {
      return ApiErrors.validationError('Valid post_id is required');
    }

    const VALID_PLATFORMS = ['linkedin', 'twitter', 'instagram', 'other'];
    if (!VALID_PLATFORMS.includes(platform)) {
      return ApiErrors.validationError(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`);
    }

    // At least one metric must be provided
    const hasMetric = [views, likes, comments, shares, saves, clicks, impressions, engagement_rate]
      .some((v) => v !== undefined && v !== null);
    if (!hasMetric) {
      return ApiErrors.validationError('At least one metric must be provided');
    }

    const supabase = createSupabaseAdminClient();

    // Verify the post belongs to this user
    const { data: post, error: postError } = await supabase
      .from('cp_pipeline_posts')
      .select('id')
      .eq('id', post_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (postError || !post) {
      return ApiErrors.notFound('Post');
    }

    // Calculate engagement_rate if not provided but we have views
    let calculatedEngagementRate = engagement_rate;
    if (calculatedEngagementRate === undefined && views && views > 0) {
      const totalEngagements = (likes || 0) + (comments || 0) + (shares || 0) + (saves || 0);
      calculatedEngagementRate = (totalEngagements / views) * 100;
    }

    const { data, error } = await supabase
      .from('cp_post_performance')
      .insert({
        user_id: session.user.id,
        post_id,
        platform,
        views: views || 0,
        likes: likes || 0,
        comments: comments || 0,
        shares: shares || 0,
        saves: saves || 0,
        clicks: clicks || 0,
        impressions: impressions || 0,
        engagement_rate: calculatedEngagementRate || 0,
        captured_at: captured_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (duplicate capture)
      if (error.code === '23505') {
        return ApiErrors.conflict('Performance data already captured for this post at this timestamp');
      }
      logApiError('content-pipeline/performance', error);
      return ApiErrors.databaseError('Failed to save performance data');
    }

    return NextResponse.json({ performance: data }, { status: 201 });
  } catch (error) {
    logApiError('content-pipeline/performance', error);
    return ApiErrors.internalError();
  }
}

/**
 * GET /api/content-pipeline/performance
 * Get performance analytics for user's posts.
 * Query params: post_id, platform, from, to, limit
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = request.nextUrl;
    const postId = searchParams.get('post_id');
    const platform = searchParams.get('platform');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_post_performance')
      .select('id, user_id, post_id, platform, views, likes, comments, shares, saves, clicks, impressions, engagement_rate, captured_at, created_at')
      .eq('user_id', session.user.id)
      .order('captured_at', { ascending: false })
      .limit(limit);

    if (postId) {
      if (!isValidUUID(postId)) {
        return ApiErrors.validationError('Invalid post_id');
      }
      query = query.eq('post_id', postId);
    }

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (from) {
      query = query.gte('captured_at', from);
    }

    if (to) {
      query = query.lte('captured_at', to);
    }

    const { data, error } = await query;

    if (error) {
      logApiError('content-pipeline/performance', error);
      return ApiErrors.databaseError('Failed to fetch performance data');
    }

    // Compute aggregate stats
    const aggregates = computeAggregates(data || []);

    return NextResponse.json({
      performance: data || [],
      aggregates,
    });
  } catch (error) {
    logApiError('content-pipeline/performance', error);
    return ApiErrors.internalError();
  }
}

function computeAggregates(records: Array<{
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  impressions: number;
  engagement_rate: number;
}>) {
  if (records.length === 0) {
    return {
      total_posts: 0,
      avg_views: 0,
      avg_likes: 0,
      avg_comments: 0,
      avg_engagement_rate: 0,
      total_views: 0,
      total_likes: 0,
      total_comments: 0,
      total_shares: 0,
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0;

  return {
    total_posts: records.length,
    avg_views: Math.round(avg(records.map((r) => r.views))),
    avg_likes: Math.round(avg(records.map((r) => r.likes))),
    avg_comments: Math.round(avg(records.map((r) => r.comments))),
    avg_engagement_rate: Number(avg(records.map((r) => Number(r.engagement_rate))).toFixed(4)),
    total_views: sum(records.map((r) => r.views)),
    total_likes: sum(records.map((r) => r.likes)),
    total_comments: sum(records.map((r) => r.comments)),
    total_shares: sum(records.map((r) => r.shares)),
  };
}
