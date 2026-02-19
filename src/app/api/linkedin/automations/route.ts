// API Route: LinkedIn Automations CRUD
// GET /api/linkedin/automations — List user's automations
// POST /api/linkedin/automations — Create a new automation

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('linkedin_automations')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logApiError('linkedin/automations/list', error);
      return ApiErrors.databaseError('Failed to fetch automations');
    }

    return NextResponse.json({ automations: data });
  } catch (error) {
    logApiError('linkedin/automations/list', error);
    return ApiErrors.internalError('Failed to fetch automations');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const {
      name,
      postId,
      postSocialId,
      keywords,
      dmTemplate,
      autoConnect,
      autoLike,
      commentReplyTemplate,
      enableFollowUp,
      followUpTemplate,
      followUpDelayMinutes,
      unipileAccountId,
      heyreachCampaignId,
      resourceUrl,
    } = body as {
      name: string;
      postId?: string;
      postSocialId?: string;
      keywords?: string[];
      dmTemplate?: string;
      autoConnect?: boolean;
      autoLike?: boolean;
      commentReplyTemplate?: string;
      enableFollowUp?: boolean;
      followUpTemplate?: string;
      followUpDelayMinutes?: number;
      unipileAccountId?: string;
      heyreachCampaignId?: string;
      resourceUrl?: string;
    };

    if (!name?.trim()) {
      return ApiErrors.validationError('Name is required');
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('linkedin_automations')
      .insert({
        user_id: session.user.id,
        name: name.trim(),
        post_id: postId || null,
        post_social_id: postSocialId || null,
        keywords: keywords || [],
        dm_template: dmTemplate || null,
        auto_connect: autoConnect ?? false,
        auto_like: autoLike ?? false,
        comment_reply_template: commentReplyTemplate || null,
        enable_follow_up: enableFollowUp ?? false,
        follow_up_template: followUpTemplate || null,
        follow_up_delay_minutes: followUpDelayMinutes || 1440,
        unipile_account_id: unipileAccountId || null,
        heyreach_campaign_id: heyreachCampaignId || null,
        resource_url: resourceUrl || null,
      })
      .select()
      .single();

    if (error) {
      logApiError('linkedin/automations/create', error);
      return ApiErrors.databaseError('Failed to create automation');
    }

    return NextResponse.json({ automation: data }, { status: 201 });
  } catch (error) {
    logApiError('linkedin/automations/create', error);
    return ApiErrors.internalError('Failed to create automation');
  }
}
