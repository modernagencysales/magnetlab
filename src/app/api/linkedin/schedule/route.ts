// API Route: Schedule LinkedIn Post
// POST /api/linkedin/schedule
// Creates a cp_pipeline_posts row; the auto-publish cron handles actual publishing.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const {
      leadMagnetId,
      content,
      scheduledTime,
    } = body as {
      leadMagnetId: string;
      content: string;
      scheduledTime: string;
    };

    if (!leadMagnetId || !content || !scheduledTime) {
      return ApiErrors.validationError('leadMagnetId, content, and scheduledTime are required');
    }

    // Check subscription for scheduling feature
    const supabase = createSupabaseAdminClient();
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', session.user.id)
      .single();

    if (!subscription || subscription.plan === 'free') {
      return ApiErrors.forbidden('Scheduling requires an Unlimited subscription');
    }

    // Insert a cp_pipeline_posts row — the cron task will publish it
    const { data: newPost, error: insertError } = await supabase
      .from('cp_pipeline_posts')
      .insert({
        user_id: session.user.id,
        final_content: content,
        status: 'scheduled',
        scheduled_time: scheduledTime,
        lead_magnet_id: leadMagnetId,
      })
      .select('id')
      .single();

    if (insertError) {
      logApiError('linkedin/schedule/insert', new Error(insertError.message), { leadMagnetId });
      return ApiErrors.internalError('Failed to create scheduled post');
    }

    // Update lead magnet with scheduling info
    const { error: updateError } = await supabase
      .from('lead_magnets')
      .update({
        scheduled_time: scheduledTime,
        status: 'scheduled',
      })
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id);

    if (updateError) {
      logApiError('linkedin/schedule/db-update', new Error(updateError.message), { leadMagnetId });
    }

    // Increment usage
    await supabase.rpc('increment_usage', {
      p_user_id: session.user.id,
      p_limit_type: 'posts',
    });

    return NextResponse.json({
      success: true,
      postId: newPost.id,
      scheduledTime,
      scheduled_via: 'pending',
    });
  } catch (error) {
    logApiError('linkedin/schedule', error);
    return ApiErrors.internalError('Failed to schedule post');
  }
}
