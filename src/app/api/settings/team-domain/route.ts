// API Route: Team Domain Management
// GET /api/settings/team-domain - Get team's custom domain
// POST /api/settings/team-domain - Add/update team custom domain (paid plans only)
// DELETE /api/settings/team-domain - Remove team custom domain

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getUserPlan } from '@/lib/auth/plan-limits';
import { addDomain, removeDomain } from '@/lib/integrations/vercel-domains';
import { invalidateDomainCache } from '@/lib/utils/domain-lookup';

// Validate domain format: alphanumeric + dots + hyphens, no protocol
const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

function isValidDomain(domain: string): boolean {
  return domainRegex.test(domain) && domain.length <= 253;
}

// GET - Get the team's custom domain
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
      logApiError('team-domain/get', teamError, { userId: session.user.id });
      return ApiErrors.notFound('Team');
    }

    // Get domain row
    const { data: domainRow, error: domainError } = await supabase
      .from('team_domains')
      .select('id, domain, status, dns_config, last_checked_at, created_at')
      .eq('team_id', team.id)
      .single();

    if (domainError && domainError.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected if no domain set)
      logApiError('team-domain/get', domainError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to fetch domain');
    }

    return NextResponse.json({ domain: domainRow || null });
  } catch (error) {
    logApiError('team-domain/get', error);
    return ApiErrors.internalError('Failed to fetch team domain');
  }
}

// POST - Add or update team custom domain
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check plan — custom domains require pro or unlimited
    const plan = await getUserPlan(session.user.id);
    if (plan === 'free') {
      return NextResponse.json({
        error: 'Custom domains require a Pro or Unlimited plan',
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
        'Invalid domain format. Use a domain like "mysite.com" or "leads.mysite.com" without http://'
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
      logApiError('team-domain/post', teamError, { userId: session.user.id });
      return ApiErrors.notFound('Team');
    }

    // Check uniqueness — another team might already use this domain
    const { data: existing } = await supabase
      .from('team_domains')
      .select('id, team_id')
      .eq('domain', cleanDomain)
      .single();

    if (existing && existing.team_id !== team.id) {
      return ApiErrors.conflict('This domain is already in use by another team');
    }

    // Add domain to Vercel
    const vercelResult = await addDomain(cleanDomain);

    if (vercelResult.error) {
      return ApiErrors.validationError(
        `Failed to add domain to Vercel: ${vercelResult.error.message}`
      );
    }

    // Build DNS config from Vercel response
    const dnsConfig = {
      type: 'CNAME',
      name: cleanDomain,
      value: 'cname.vercel-dns.com',
      verification: vercelResult.verification || [],
    };

    // Upsert team_domains row (one domain per team)
    const { data: domainRow, error: upsertError } = await supabase
      .from('team_domains')
      .upsert(
        {
          team_id: team.id,
          domain: cleanDomain,
          vercel_domain_id: vercelResult.name || cleanDomain,
          status: vercelResult.verified ? 'active' : 'pending_dns',
          dns_config: dnsConfig,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: 'team_id' }
      )
      .select('id, domain, status, dns_config, last_checked_at, created_at')
      .single();

    if (upsertError) {
      logApiError('team-domain/post', upsertError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to save domain');
    }

    // Enable whitelabel on the team
    const { error: teamUpdateError } = await supabase
      .from('teams')
      .update({ whitelabel_enabled: true })
      .eq('id', team.id);

    if (teamUpdateError) {
      logApiError('team-domain/post/whitelabel', teamUpdateError, { teamId: team.id });
      // Non-fatal — domain was saved, whitelabel flag is secondary
    }

    // Invalidate domain cache
    invalidateDomainCache(cleanDomain);

    return NextResponse.json({
      domain: domainRow,
      dnsInstructions: {
        type: 'CNAME',
        name: cleanDomain,
        value: 'cname.vercel-dns.com',
        note: 'Add this CNAME record in your domain DNS settings. Verification may take a few minutes.',
        verification: vercelResult.verification || [],
      },
    });
  } catch (error) {
    logApiError('team-domain/post', error);
    return ApiErrors.internalError('Failed to set team domain');
  }
}

// DELETE - Remove team custom domain
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
      logApiError('team-domain/delete', teamError, { userId: session.user.id });
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

    // Remove domain from Vercel
    const removeResult = await removeDomain(domainRow.domain);
    if (!removeResult.success) {
      return ApiErrors.validationError(
        'Failed to remove domain from Vercel. Please try again or contact support.'
      );
    }

    // Delete the domain row from DB
    const { error: deleteError } = await supabase
      .from('team_domains')
      .delete()
      .eq('id', domainRow.id);

    if (deleteError) {
      logApiError('team-domain/delete', deleteError, { userId: session.user.id, teamId: team.id });
      return ApiErrors.databaseError('Failed to remove domain');
    }

    // Invalidate domain cache
    invalidateDomainCache(domainRow.domain);

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('team-domain/delete', error);
    return ApiErrors.internalError('Failed to remove team domain');
  }
}
