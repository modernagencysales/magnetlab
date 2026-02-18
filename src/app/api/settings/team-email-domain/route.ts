// API Route: Team Email Domain Management
// GET /api/settings/team-email-domain - Get team's custom email domain
// POST /api/settings/team-email-domain - Add/update team email domain (paid plans only)
// DELETE /api/settings/team-email-domain - Remove team email domain

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getUserPlan } from '@/lib/auth/plan-limits';
import { createResendDomain, deleteResendDomain } from '@/lib/integrations/resend-domains';

// Validate domain format: alphanumeric + dots + hyphens, no protocol
const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

function isValidDomain(domain: string): boolean {
  return domainRegex.test(domain) && domain.length <= 253;
}

// GET - Get the team's custom email domain
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
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
      logApiError('team-email-domain/get', teamError, { userId: session.user.id });
      return ApiErrors.notFound('Team');
    }

    // Get email domain row
    const { data: domainRow, error: domainError } = await supabase
      .from('team_email_domains')
      .select('id, domain, resend_domain_id, status, dns_records, region, last_checked_at, created_at')
      .eq('team_id', team.id)
      .single();

    if (domainError && domainError.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected if no email domain set)
      logApiError('team-email-domain/get', domainError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to fetch email domain');
    }

    return NextResponse.json({ emailDomain: domainRow || null });
  } catch (error) {
    logApiError('team-email-domain/get', error);
    return ApiErrors.internalError('Failed to fetch team email domain');
  }
}

// POST - Add or update team custom email domain
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
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return ApiErrors.validationError('domain is required');
    }

    // Strip protocol if accidentally included, lowercase
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    if (!isValidDomain(cleanDomain)) {
      return ApiErrors.validationError(
        'Invalid domain format. Use a domain like "mysite.com" or "mail.mysite.com" without http://'
      );
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
      logApiError('team-email-domain/post', teamError, { userId: session.user.id });
      return ApiErrors.notFound('Team');
    }

    // Check uniqueness — another team might already use this domain
    const { data: existing } = await supabase
      .from('team_email_domains')
      .select('id, team_id')
      .eq('domain', cleanDomain)
      .single();

    if (existing && existing.team_id !== team.id) {
      return ApiErrors.conflict('This email domain is already in use by another team');
    }

    // Create domain on Resend
    const result = await createResendDomain(cleanDomain);

    if (result.error) {
      return ApiErrors.validationError(
        `Failed to add domain to Resend: ${result.error.message}`
      );
    }

    // Upsert team_email_domains row (one email domain per team)
    const { data: domainRow, error: upsertError } = await supabase
      .from('team_email_domains')
      .upsert(
        {
          team_id: team.id,
          domain: cleanDomain,
          resend_domain_id: result.id,
          status: 'pending',
          dns_records: result.records,
          region: result.region || 'us-east-1',
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: 'team_id' }
      )
      .select('id, domain, resend_domain_id, status, dns_records, region, last_checked_at, created_at')
      .single();

    if (upsertError) {
      logApiError('team-email-domain/post', upsertError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to save email domain');
    }

    return NextResponse.json({
      emailDomain: domainRow,
      dnsRecords: result.records,
    });
  } catch (error) {
    logApiError('team-email-domain/post', error);
    return ApiErrors.internalError('Failed to set team email domain');
  }
}

// DELETE - Remove team custom email domain
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
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
      logApiError('team-email-domain/delete', teamError, { userId: session.user.id });
      return ApiErrors.notFound('Team');
    }

    // Get the email domain row
    const { data: domainRow, error: domainError } = await supabase
      .from('team_email_domains')
      .select('id, resend_domain_id')
      .eq('team_id', team.id)
      .single();

    if (domainError || !domainRow) {
      return ApiErrors.notFound('Email domain');
    }

    // Remove domain from Resend
    await deleteResendDomain(domainRow.resend_domain_id);

    // Delete the email domain row from DB
    const { error: deleteError } = await supabase
      .from('team_email_domains')
      .delete()
      .eq('id', domainRow.id);

    if (deleteError) {
      logApiError('team-email-domain/delete', deleteError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to remove email domain');
    }

    // Clear custom_from_email on the team since the domain is being removed
    const { error: teamUpdateError } = await supabase
      .from('teams')
      .update({ custom_from_email: null })
      .eq('id', team.id);

    if (teamUpdateError) {
      logApiError('team-email-domain/delete/clear-email', teamUpdateError, { teamId: team.id });
      // Non-fatal — domain was deleted, clearing from_email is secondary
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('team-email-domain/delete', error);
    return ApiErrors.internalError('Failed to remove team email domain');
  }
}
