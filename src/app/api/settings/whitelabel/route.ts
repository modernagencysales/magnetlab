// API Route: White-Label Settings
// GET /api/settings/whitelabel - Read current white-label settings
// PATCH /api/settings/whitelabel - Update white-label settings (paid plans only)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getUserPlan } from '@/lib/auth/plan-limits';

// GET - Read white-label settings for the authenticated user's team
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();
    const { data: team, error } = await supabase
      .from('teams')
      .select('id, whitelabel_enabled, hide_branding, custom_favicon_url, custom_site_name, custom_email_sender_name')
      .eq('owner_id', session.user.id)
      .limit(1)
      .single();

    if (error) {
      logApiError('whitelabel/get', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch white-label settings');
    }

    return NextResponse.json({ whitelabel: team });
  } catch (error) {
    logApiError('whitelabel/get', error);
    return ApiErrors.internalError('Failed to fetch white-label settings');
  }
}

// PATCH - Update white-label settings (requires paid plan)
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check plan - free users cannot modify white-label settings
    const plan = await getUserPlan(session.user.id);
    if (plan === 'free') {
      return NextResponse.json({
        error: 'White-label settings require a Pro or Unlimited plan',
        upgrade: '/settings#billing',
      }, { status: 403 });
    }

    const body = await request.json();
    const { hideBranding, customFaviconUrl, customSiteName, customEmailSenderName } = body;

    const supabase = createSupabaseAdminClient();

    // Get the user's team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', session.user.id)
      .limit(1)
      .single();

    if (teamError || !team) {
      logApiError('whitelabel/patch', teamError, { userId: session.user.id });
      return ApiErrors.notFound('Team');
    }

    // Update white-label fields
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        hide_branding: hideBranding ?? false,
        custom_favicon_url: customFaviconUrl ?? null,
        custom_site_name: customSiteName ?? null,
        custom_email_sender_name: customEmailSenderName ?? null,
      })
      .eq('id', team.id);

    if (updateError) {
      logApiError('whitelabel/patch', updateError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to update white-label settings');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('whitelabel/patch', error);
    return ApiErrors.internalError('Failed to update white-label settings');
  }
}
