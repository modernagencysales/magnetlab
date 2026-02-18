// API Route: Custom From Email
// POST /api/settings/team-email-domain/from-email - Set custom from email (must match verified email domain)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getUserPlan } from '@/lib/auth/plan-limits';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check plan — custom email domains require pro or unlimited
    const plan = await getUserPlan(session.user.id);
    if (plan === 'free') {
      return NextResponse.json({
        error: 'Custom email domains require a Pro or Unlimited plan',
        upgrade: '/settings#billing',
      }, { status: 403 });
    }

    const body = await request.json();
    const { fromEmail } = body;

    if (!fromEmail || typeof fromEmail !== 'string') {
      return ApiErrors.validationError('fromEmail is required');
    }

    // Basic email format check
    if (!fromEmail.includes('@')) {
      return ApiErrors.validationError('fromEmail must be a valid email address');
    }

    const supabase = createSupabaseAdminClient();

    // Get user's team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', session.user.id)
      .limit(1)
      .single();

    if (teamError || !team) {
      logApiError('team-email-domain/from-email', teamError, { userId: session.user.id });
      return ApiErrors.notFound('Team');
    }

    // Get team's verified email domain
    const { data: emailDomain, error: domainError } = await supabase
      .from('team_email_domains')
      .select('id, domain')
      .eq('team_id', team.id)
      .eq('status', 'verified')
      .single();

    if (domainError && domainError.code !== 'PGRST116') {
      logApiError('team-email-domain/from-email', domainError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to check email domain');
    }

    if (!emailDomain) {
      return ApiErrors.validationError('You must have a verified email domain first');
    }

    // Validate that fromEmail ends with @verifiedDomain
    const expectedSuffix = `@${emailDomain.domain}`;
    if (!fromEmail.toLowerCase().endsWith(expectedSuffix.toLowerCase())) {
      return ApiErrors.validationError(
        `Email must use your verified domain (${emailDomain.domain})`
      );
    }

    // Update teams table with the custom from email
    const { error: updateError } = await supabase
      .from('teams')
      .update({ custom_from_email: fromEmail })
      .eq('id', team.id);

    if (updateError) {
      logApiError('team-email-domain/from-email', updateError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to save from email');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('team-email-domain/from-email', error);
    return ApiErrors.internalError('Failed to set from email');
  }
}
