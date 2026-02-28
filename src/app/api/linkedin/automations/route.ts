// API Route: LinkedIn Automations CRUD
// GET /api/linkedin/automations — List user's automations
// POST /api/linkedin/automations — Create a new automation

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as linkedinService from '@/server/services/linkedin.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const result = await linkedinService.listAutomations(session.user.id);
    if (!result.success) {
      return ApiErrors.databaseError('Failed to fetch automations');
    }

    return NextResponse.json({ automations: result.automations });
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
<<<<<<< HEAD

    const result = await linkedinService.createAutomation(session.user.id, body);
    if (!result.success) {
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Name is required');
=======
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
      plusvibeCampaignId,
      optInUrl,
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
      plusvibeCampaignId?: string;
      optInUrl?: string;
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
        plusvibe_campaign_id: plusvibeCampaignId || null,
        opt_in_url: optInUrl || null,
      })
      .select()
      .single();

    if (error) {
      logApiError('linkedin/automations/create', error);
>>>>>>> cd46c59795c3148789086a657c2176e3dd0f8a47
      return ApiErrors.databaseError('Failed to create automation');
    }

    return NextResponse.json({ automation: result.automation }, { status: 201 });
  } catch (error) {
    logApiError('linkedin/automations/create', error);
    return ApiErrors.internalError('Failed to create automation');
  }
}
