// API Route: Team Email Domain Verification
// POST /api/settings/team-email-domain/verify - Trigger DNS verification and check status

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { verifyResendDomain, getResendDomain } from '@/lib/integrations/resend-domains';

// POST - Verify email domain DNS configuration
export async function POST() {
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
      logApiError('team-email-domain/verify', teamError, { userId: session.user.id });
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

    // Trigger async verification on Resend
    const verifyResult = await verifyResendDomain(domainRow.resend_domain_id);

    if (verifyResult.error) {
      logApiError('team-email-domain/verify/resend', verifyResult.error, {
        resendDomainId: domainRow.resend_domain_id,
        teamId: team.id,
      });
      return ApiErrors.validationError(
        `Failed to verify domain: ${verifyResult.error.message}`
      );
    }

    // Get current domain status + per-record statuses from Resend
    const result = await getResendDomain(domainRow.resend_domain_id);

    if (result.error) {
      logApiError('team-email-domain/verify/get-status', result.error, {
        resendDomainId: domainRow.resend_domain_id,
        teamId: team.id,
      });
      return ApiErrors.validationError(
        `Failed to check domain status: ${result.error.message}`
      );
    }

    const isVerified = result.status === 'verified';
    const newStatus = isVerified ? 'verified' : 'pending';

    // Update team_email_domains with verification result
    const { error: updateError } = await supabase
      .from('team_email_domains')
      .update({
        status: newStatus,
        dns_records: result.records,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', domainRow.id);

    if (updateError) {
      logApiError('team-email-domain/verify/update', updateError, {
        domainId: domainRow.id,
        teamId: team.id,
      });
      return ApiErrors.databaseError('Failed to update email domain status');
    }

    return NextResponse.json({
      status: newStatus,
      verified: isVerified,
      records: result.records,
    });
  } catch (error) {
    logApiError('team-email-domain/verify', error);
    return ApiErrors.internalError('Failed to verify email domain');
  }
}
