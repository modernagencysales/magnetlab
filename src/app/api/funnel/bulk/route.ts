import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { resolveUserId } from '@/lib/auth/api-key';
import { validateBody, bulkCreatePagesSchema, type BulkPageItemInput } from '@/lib/validations/api';
import { slugify } from '@/lib/utils';

interface BulkResult {
  index: number;
  status: 'created' | 'failed';
  id?: string;
  slug?: string;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return ApiErrors.unauthorized();

    const body = await request.json();
    const validation = validateBody(body, bulkCreatePagesSchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error, validation.details);
    }

    const { pages } = validation.data;
    const supabase = createSupabaseAdminClient();

    // Fetch user profile for theme defaults and username
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('default_theme, default_primary_color, default_background_style, default_logo_url, default_vsl_url, username')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return ApiErrors.internalError('Failed to load user profile');
    }

    const results: BulkResult[] = [];
    let created = 0;
    let failed = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        const result = await createSinglePage(supabase, userId, profile, page, i);
        results.push(result);
        if (result.status === 'created') created++;
        else failed++;
      } catch (err) {
        results.push({ index: i, status: 'failed', error: 'Unexpected error' });
        failed++;
        logApiError('funnel/bulk/item', err, { userId, index: i });
      }
    }

    return NextResponse.json({ created, failed, results });
  } catch (error) {
    logApiError('funnel/bulk', error);
    return ApiErrors.internalError('Bulk creation failed');
  }
}

async function createSinglePage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  profile: { default_theme: string; default_primary_color: string; default_background_style: string; default_logo_url: string | null; default_vsl_url: string | null; username: string | null },
  page: BulkPageItemInput,
  index: number
): Promise<BulkResult> {
  const slug = page.slug || slugify(page.title).slice(0, 50);

  // Check slug collision
  const { data: slugExists } = await supabase
    .from('funnel_pages')
    .select('id')
    .eq('user_id', userId)
    .eq('slug', slug)
    .single();

  if (slugExists) {
    return { index, status: 'failed', error: `Slug "${slug}" already exists` };
  }

  // Create lightweight lead magnet
  const { data: leadMagnet, error: lmError } = await supabase
    .from('lead_magnets')
    .insert({
      user_id: userId,
      title: page.title,
      external_url: page.leadMagnetUrl,
      archetype: 'resource-list',
      status: 'published',
    })
    .select('id')
    .single();

  if (lmError || !leadMagnet) {
    return { index, status: 'failed', error: 'Failed to create lead magnet' };
  }

  // Create funnel page with theme defaults from profile
  const { data: funnelPage, error: fpError } = await supabase
    .from('funnel_pages')
    .insert({
      lead_magnet_id: leadMagnet.id,
      user_id: userId,
      slug,
      optin_headline: page.optinHeadline,
      optin_subline: page.optinSubline || null,
      optin_button_text: page.optinButtonText || 'Get It Now',
      thankyou_headline: page.thankyouHeadline || 'Thanks! Check your email.',
      thankyou_subline: page.thankyouSubline || null,
      vsl_url: profile.default_vsl_url || null,
      qualification_pass_message: 'Great! Book a call below.',
      qualification_fail_message: 'Thanks for your interest!',
      theme: profile.default_theme || 'dark',
      primary_color: profile.default_primary_color || '#8b5cf6',
      background_style: profile.default_background_style || 'solid',
      logo_url: profile.default_logo_url || null,
      is_published: page.autoPublish === true,
      published_at: page.autoPublish === true ? new Date().toISOString() : null,
    })
    .select('id, slug')
    .single();

  if (fpError || !funnelPage) {
    // Clean up the lead magnet we just created
    await supabase.from('lead_magnets').delete().eq('id', leadMagnet.id);
    return { index, status: 'failed', error: 'Failed to create funnel page' };
  }

  return { index, status: 'created', id: funnelPage.id, slug: funnelPage.slug };
}
