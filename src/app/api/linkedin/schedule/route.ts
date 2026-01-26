// API Route: Schedule LinkedIn Post
// POST /api/linkedin/schedule

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserLeadSharkClient } from '@/lib/integrations/leadshark';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check subscription for scheduling feature
    const supabase = await createSupabaseServerClient();
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', session.user.id)
      .single();

    if (!subscription || subscription.plan === 'free') {
      return NextResponse.json(
        { error: 'Scheduling requires a Pro or Unlimited subscription' },
        { status: 403 }
      );
    }

    // Schedule via LeadShark using user's encrypted API key
    const leadShark = await getUserLeadSharkClient(session.user.id);
    if (!leadShark) {
      return NextResponse.json(
        { error: 'LeadShark not connected. Add your API key in Settings.' },
        { status: 400 }
      );
    }

    const scheduleResult = await leadShark.createScheduledPost({
      content,
      scheduled_time: scheduledTime,
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
      console.error('LeadShark scheduling error:', scheduleResult.error);
      return NextResponse.json({ error: scheduleResult.error }, { status: 500 });
    }

    // Update lead magnet with scheduling info
    await supabase
      .from('lead_magnets')
      .update({
        leadshark_post_id: scheduleResult.data?.id,
        scheduled_time: scheduledTime,
        status: 'scheduled',
      })
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id);

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
    console.error('LinkedIn schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to schedule post' },
      { status: 500 }
    );
  }
}
