import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

/**
 * GET /api/content-pipeline/inspiration
 * Get recent inspiration pulls for user (with AI analysis).
 * Query params: source_id, content_type, from, to, saved_only, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = request.nextUrl;
    const sourceId = searchParams.get('source_id');
    const contentType = searchParams.get('content_type');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const savedOnly = searchParams.get('saved_only') === 'true';
    const dismissed = searchParams.get('dismissed');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_inspiration_pulls')
      .select('id, user_id, source_id, content_type, title, content_preview, source_url, platform, author_name, author_url, engagement_metrics, ai_analysis, pulled_at, saved_to_swipe_file, dismissed, created_at', { count: 'exact' })
      .eq('user_id', session.user.id)
      .order('pulled_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    const VALID_CONTENT_TYPES = ['post', 'lead_magnet', 'funnel', 'article'];
    if (contentType) {
      if (!VALID_CONTENT_TYPES.includes(contentType)) {
        return ApiErrors.validationError(`Invalid content_type. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}`);
      }
      query = query.eq('content_type', contentType);
    }

    if (from) {
      query = query.gte('pulled_at', from);
    }

    if (to) {
      query = query.lte('pulled_at', to);
    }

    if (savedOnly) {
      query = query.eq('saved_to_swipe_file', true);
    }

    if (dismissed === 'false') {
      query = query.eq('dismissed', false);
    } else if (dismissed === 'true') {
      query = query.eq('dismissed', true);
    }

    const { data, error, count } = await query;

    if (error) {
      logApiError('content-pipeline/inspiration', error);
      return ApiErrors.databaseError('Failed to fetch inspiration pulls');
    }

    return NextResponse.json({
      pulls: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    logApiError('content-pipeline/inspiration', error);
    return ApiErrors.internalError();
  }
}

/**
 * PATCH /api/content-pipeline/inspiration
 * Update an inspiration pull (save to swipe file, dismiss, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { pull_id, saved_to_swipe_file, dismissed } = body;

    if (!pull_id || typeof pull_id !== 'string') {
      return ApiErrors.validationError('pull_id is required');
    }

    const supabase = createSupabaseAdminClient();

    const updates: Record<string, unknown> = {};
    if (saved_to_swipe_file !== undefined) updates.saved_to_swipe_file = saved_to_swipe_file;
    if (dismissed !== undefined) updates.dismissed = dismissed;

    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError('At least one field to update is required');
    }

    const { data, error } = await supabase
      .from('cp_inspiration_pulls')
      .update(updates)
      .eq('id', pull_id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error || !data) {
      return ApiErrors.notFound('Inspiration pull');
    }

    // If saving to swipe file, also create a swipe_file_posts entry
    if (saved_to_swipe_file === true && data.content_preview) {
      const { error: swipeError } = await supabase
        .from('swipe_file_posts')
        .insert({
          content: data.content_preview,
          hook: data.title || data.content_preview.split('\n')[0]?.slice(0, 100),
          post_type: (data.ai_analysis as Record<string, unknown>)?.format as string || null,
          niche: (data.ai_analysis as Record<string, unknown>)?.topic as string || null,
          source_url: data.source_url,
          author_name: data.author_name,
          notes: (data.ai_analysis as Record<string, unknown>)?.what_makes_it_work as string || null,
          submitted_by: session.user.id,
          status: 'approved', // Auto-approve since it's the user's own save
        });

      if (swipeError) {
        logApiError('content-pipeline/inspiration/save-to-swipe', swipeError);
        // Non-fatal: the pull is still updated
      }
    }

    return NextResponse.json({ pull: data });
  } catch (error) {
    logApiError('content-pipeline/inspiration', error);
    return ApiErrors.internalError();
  }
}
