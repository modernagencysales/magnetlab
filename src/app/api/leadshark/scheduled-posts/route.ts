// LeadShark Scheduled Posts API
// GET /api/leadshark/scheduled-posts - List all scheduled posts
// POST /api/leadshark/scheduled-posts - Create a scheduled post with optional automation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserLeadSharkClient } from '@/lib/integrations/leadshark';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// GET - List all scheduled posts with automation info
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const client = await getUserLeadSharkClient(session.user.id);
    if (!client) {
      return ApiErrors.validationError('LeadShark not connected. Add your API key in Settings.');
    }

    // Fetch posts and automations in parallel
    const [postsResult, automationsResult] = await Promise.all([
      client.listScheduledPosts().catch((err) => ({ data: null, error: err.message, status: 500 })),
      client.listAutomations().catch((err) => ({ data: null, error: err.message, status: 500 })),
    ]);

    // If scheduled posts endpoint fails, return empty list with warning
    if (postsResult.error) {
      logApiError('leadshark/scheduled-posts', new Error(postsResult.error as string), { note: 'Non-critical, returning empty list' });
      return NextResponse.json({
        posts: [],
        total: 0,
        with_automation: 0,
        by_status: { scheduled: 0, published: 0, failed: 0 },
        warning: 'Scheduled posts not available: ' + postsResult.error,
      });
    }

    // Handle various response formats from LeadShark API
    const postsData = postsResult.data as unknown;
    const posts = Array.isArray(postsData)
      ? postsData
      : ((postsData as Record<string, unknown>)?.posts || (postsData as Record<string, unknown>)?.data || []) as Array<Record<string, unknown>>;

    const automationsData = automationsResult.data as unknown;
    const automations = Array.isArray(automationsData)
      ? automationsData
      : ((automationsData as Record<string, unknown>)?.automations || (automationsData as Record<string, unknown>)?.data || []) as Array<Record<string, unknown>>;

    // Create a map of automation by post_id for quick lookup
    const automationByPostId = new Map(
      automations.map((a) => [a.post_id, a])
    );

    // Enrich posts with automation details
    const enrichedPosts = posts.map((post) => {
      const automation = post.automation || automationByPostId.get(post.id);

      return {
        id: post.id,
        content: post.content,
        scheduled_time: post.scheduled_time,
        is_public: post.is_public,
        status: post.status,
        created_at: post.created_at,
        automation: automation
          ? {
              id: automation.id,
              name: automation.name,
              keywords: automation.keywords,
              status: automation.status,
            }
          : undefined,
      };
    });

    // Sort by scheduled time
    enrichedPosts.sort((a, b) =>
      new Date(a.scheduled_time as string).getTime() - new Date(b.scheduled_time as string).getTime()
    );

    return NextResponse.json({
      posts: enrichedPosts,
      total: enrichedPosts.length,
      with_automation: enrichedPosts.filter((p) => p.automation).length,
      by_status: {
        scheduled: enrichedPosts.filter((p) => p.status === 'scheduled').length,
        published: enrichedPosts.filter((p) => p.status === 'published').length,
        failed: enrichedPosts.filter((p) => p.status === 'failed').length,
      },
    });
  } catch (error) {
    logApiError('leadshark/scheduled-posts', error);
    return ApiErrors.internalError(error instanceof Error ? error.message : 'Failed to fetch scheduled posts');
  }
}

// POST - Create a scheduled post with optional automation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();

    // Validate required fields
    if (!body.content || !body.scheduled_time) {
      return ApiErrors.validationError('content and scheduled_time are required');
    }

    // Validate content length
    if (body.content.length < 1 || body.content.length > 3000) {
      return ApiErrors.validationError('Content must be between 1 and 3000 characters');
    }

    // Validate scheduled_time is in the future (15min to 90 days)
    const scheduledTime = new Date(body.scheduled_time);
    const now = new Date();
    const minTime = new Date(now.getTime() + 15 * 60 * 1000);
    const maxTime = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (scheduledTime < minTime || scheduledTime > maxTime) {
      return ApiErrors.validationError('Scheduled time must be between 15 minutes and 90 days in the future');
    }

    const client = await getUserLeadSharkClient(session.user.id);
    if (!client) {
      return ApiErrors.validationError('LeadShark not connected. Add your API key in Settings.');
    }

    // Create the scheduled post in LeadShark
    const result = await client.createScheduledPost({
      content: body.content,
      scheduled_time: body.scheduled_time,
      is_public: body.is_public ?? true,
      automation: body.automation,
    });

    if (result.error) {
      return ApiErrors.internalError(result.error);
    }

    // If linked to a lead magnet, update the lead magnet record
    if (body.lead_magnet_id && result.data) {
      const supabase = createSupabaseAdminClient();
      await supabase
        .from('lead_magnets')
        .update({
          leadshark_post_id: result.data.id,
          scheduled_time: body.scheduled_time,
          status: 'scheduled',
        })
        .eq('id', body.lead_magnet_id)
        .eq('user_id', session.user.id);
    }

    return NextResponse.json({
      post: result.data,
      message: 'Scheduled post created successfully',
    });
  } catch (error) {
    logApiError('leadshark/scheduled-posts/create', error);
    return ApiErrors.internalError(error instanceof Error ? error.message : 'Failed to create scheduled post');
  }
}
