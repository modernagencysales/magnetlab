// API Route: Custom Domain Management
// POST /api/settings/custom-domain - Set custom domain for a funnel page
// DELETE /api/settings/custom-domain - Remove custom domain
// GET /api/settings/custom-domain - List domains with verification status
//
// TODO: Custom domain routing is NOT yet implemented in middleware.
// This API only stores the domain in the DB and returns DNS setup instructions.
// To complete custom domain support:
// 1. Add the domain in Vercel project settings (requires Vercel API or manual step)
// 2. Add middleware logic to match incoming Host header against custom_domain column
// 3. Rewrite matching requests to the correct /p/[username]/[slug] route

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { getUserPlan } from '@/lib/auth/plan-limits';

// Validate domain format: alphanumeric + dots + hyphens, no protocol
function isValidDomain(domain: string): boolean {
  const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

// GET - List custom domains for the authenticated user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('funnel_pages')
      .select('id, slug, custom_domain, is_published, target_type')
      .eq('user_id', session.user.id)
      .not('custom_domain', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      logApiError('custom-domain/list', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch custom domains');
    }

    // NOTE: Actual DNS verification requires the Vercel Domains API.
    // For now, we return the saved domains with a placeholder verification status.
    const domains = (data || []).map((fp) => ({
      funnelPageId: fp.id,
      slug: fp.slug,
      domain: fp.custom_domain,
      isPublished: fp.is_published,
      targetType: fp.target_type,
      // DNS verification is a placeholder — requires Vercel API integration
      dnsVerified: null as boolean | null,
    }));

    return NextResponse.json({ domains });
  } catch (error) {
    logApiError('custom-domain/list', error);
    return ApiErrors.internalError('Failed to fetch custom domains');
  }
}

// POST - Set a custom domain for a funnel page
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
    const { funnelPageId, domain } = body;

    if (!funnelPageId || !isValidUUID(funnelPageId)) {
      return ApiErrors.validationError('Valid funnelPageId is required');
    }

    if (!domain || typeof domain !== 'string') {
      return ApiErrors.validationError('domain is required');
    }

    // Strip protocol if accidentally included
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    if (!isValidDomain(cleanDomain)) {
      return ApiErrors.validationError(
        'Invalid domain format. Use a domain like "mysite.com" or "leads.mysite.com" without http://'
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify the user owns this funnel page
    const { data: funnelPage, error: fpError } = await supabase
      .from('funnel_pages')
      .select('id, custom_domain')
      .eq('id', funnelPageId)
      .eq('user_id', session.user.id)
      .single();

    if (fpError || !funnelPage) {
      return ApiErrors.notFound('Funnel page');
    }

    // Check uniqueness — another funnel page might already use this domain
    const { data: existing } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('custom_domain', cleanDomain)
      .neq('id', funnelPageId)
      .single();

    if (existing) {
      return ApiErrors.conflict('This domain is already in use by another funnel page');
    }

    // Update the funnel page with the custom domain
    const { error: updateError } = await supabase
      .from('funnel_pages')
      .update({ custom_domain: cleanDomain })
      .eq('id', funnelPageId);

    if (updateError) {
      logApiError('custom-domain/set', updateError, { userId: session.user.id, funnelPageId });
      return ApiErrors.databaseError('Failed to set custom domain');
    }

    return NextResponse.json({
      domain: cleanDomain,
      funnelPageId,
      // DNS setup instructions for Vercel
      dnsInstructions: {
        type: 'CNAME',
        name: cleanDomain,
        value: 'cname.vercel-dns.com',
        note: 'Add this CNAME record in your domain DNS settings. Then add the domain in Vercel project settings > Domains.',
      },
    });
  } catch (error) {
    logApiError('custom-domain/set', error);
    return ApiErrors.internalError('Failed to set custom domain');
  }
}

// DELETE - Remove custom domain from a funnel page
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { funnelPageId } = body;

    if (!funnelPageId || !isValidUUID(funnelPageId)) {
      return ApiErrors.validationError('Valid funnelPageId is required');
    }

    const supabase = createSupabaseAdminClient();

    // Verify ownership
    const { data: funnelPage, error: fpError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', funnelPageId)
      .eq('user_id', session.user.id)
      .single();

    if (fpError || !funnelPage) {
      return ApiErrors.notFound('Funnel page');
    }

    // Remove the custom domain
    const { error: updateError } = await supabase
      .from('funnel_pages')
      .update({ custom_domain: null })
      .eq('id', funnelPageId);

    if (updateError) {
      logApiError('custom-domain/remove', updateError, { userId: session.user.id, funnelPageId });
      return ApiErrors.databaseError('Failed to remove custom domain');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('custom-domain/remove', error);
    return ApiErrors.internalError('Failed to remove custom domain');
  }
}
