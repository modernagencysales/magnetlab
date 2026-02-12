// API Route: Schedule LinkedIn Post
// POST /api/linkedin/schedule

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserLeadSharkClient } from '@/lib/integrations/leadshark';
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
      enableAutomation,
      keywords,
      dmTemplate,
    } = body as {
      leadMagnetId: string;
      content: string;
      scheduledTime: string;
      enableAutomation?: boolean;
      keywords?: string[];
      dmTemplate?: string;
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

    // Schedule via LeadShark using user's encrypted API key
    const leadShark = await getUserLeadSharkClient(session.user.id);
    if (!leadShark) {
      return ApiErrors.validationError('LeadShark not connected. Add your API key in Settings.');
    }

    // LeadShark requires scheduled_time at least 15 minutes in the future
    const minTime = new Date(Date.now() + 16 * 60 * 1000);
    const requestedTime = new Date(scheduledTime);
    const validScheduledTime = requestedTime > minTime
      ? scheduledTime
      : minTime.toISOString();

    const scheduleResult = await leadShark.createScheduledPost({
      content,
      scheduled_time: validScheduledTime,
      is_public: true,
      automation: enableAutomation
        ? {
            keywords: keywords || [],
            dm_template: dmTemplate || '',
            auto_connect: true,
            auto_like: true,
          }
        : undefined,
    });

    if (scheduleResult.error) {
      logApiError('linkedin/schedule/leadshark', new Error(scheduleResult.error), { leadMagnetId });
      return ApiErrors.internalError(scheduleResult.error);
    }

    // Update lead magnet with scheduling info
    const { error: updateError } = await supabase
      .from('lead_magnets')
      .update({
        leadshark_post_id: scheduleResult.data?.id,
        scheduled_time: validScheduledTime,
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
      postId: scheduleResult.data?.id,
      scheduledTime,
    });
  } catch (error) {
    logApiError('linkedin/schedule', error);
    return ApiErrors.internalError('Failed to schedule post');
  }
}
