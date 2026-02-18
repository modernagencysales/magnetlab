// API Route: Team Domain Verification
// POST /api/settings/team-domain/verify - Check DNS verification status

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { checkDomain } from '@/lib/integrations/vercel-domains';
import { invalidateDomainCache } from '@/lib/utils/domain-lookup';

// POST - Verify domain DNS configuration
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
      logApiError('team-domain/verify', teamError, { userId: session.user.id });
      return ApiErrors.notFound('Team');
    }

    // Get the domain row
    const { data: domainRow, error: domainError } = await supabase
      .from('team_domains')
      .select('id, domain')
      .eq('team_id', team.id)
      .single();

    if (domainError || !domainRow) {
      return ApiErrors.notFound('Domain');
    }

    // Check domain status via Vercel API
    const vercelResult = await checkDomain(domainRow.domain);

    if (vercelResult.error) {
      logApiError('team-domain/verify/vercel', vercelResult.error, {
        domain: domainRow.domain,
        teamId: team.id,
      });
      return ApiErrors.validationError(
        `Failed to check domain: ${vercelResult.error.message}`
      );
    }

    const isVerified = vercelResult.verified === true;
    const newStatus = isVerified ? 'active' : 'pending_dns';

    // Build updated DNS config
    const dnsConfig = {
      type: 'CNAME',
      name: domainRow.domain,
      value: 'cname.vercel-dns.com',
      verification: vercelResult.verification || [],
    };

    // Update team_domains with verification result
    const { error: updateError } = await supabase
      .from('team_domains')
      .update({
        status: newStatus,
        dns_config: dnsConfig,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', domainRow.id);

    if (updateError) {
      logApiError('team-domain/verify/update', updateError, {
        domainId: domainRow.id,
        teamId: team.id,
      });
      return ApiErrors.databaseError('Failed to update domain status');
    }

    // Invalidate cache when domain becomes active
    if (isVerified) {
      invalidateDomainCache(domainRow.domain);
    }

    return NextResponse.json({
      status: newStatus,
      verified: isVerified,
      verification: vercelResult.verification || [],
    });
  } catch (error) {
    logApiError('team-domain/verify', error);
    return ApiErrors.internalError('Failed to verify domain');
  }
}
