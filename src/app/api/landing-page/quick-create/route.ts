// API Route: Quick-create landing page
// POST /api/landing-page/quick-create
// Creates a stub lead magnet, AI-generates opt-in copy, and creates a funnel page

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { generateOptinContent } from '@/lib/ai/funnel-content-generator';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { title, description } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return ApiErrors.validationError('Title is required');
    }

    const supabase = createSupabaseAdminClient();

    // 1. Create stub lead magnet
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .insert({
        user_id: session.user.id,
        title: title.trim(),
        archetype: 'focused-toolkit',
        status: 'draft',
        concept: {
          title: title.trim(),
          painSolved: description || '',
          deliveryFormat: 'Landing Page',
          isQuickCreate: true,
        },
      })
      .select('id, title')
      .single();

    if (lmError) {
      logApiError('landing-page/quick-create/create-lm', lmError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create lead magnet');
    }

    // 2. AI-generate opt-in copy
    let optinContent;
    try {
      optinContent = await generateOptinContent({
        leadMagnetTitle: title.trim(),
        concept: null,
        extractedContent: null,
        credibility: description || undefined,
      });
    } catch (aiError) {
      logApiError('landing-page/quick-create/ai-generate', aiError, { userId: session.user.id });
      // Fall back to defaults if AI fails — don't block page creation
      optinContent = {
        headline: title.trim(),
        subline: description || 'Get instant access to proven strategies',
        socialProof: 'Join thousands of professionals using this resource',
        buttonText: 'Get Free Access',
      };
    }

    // 3. Generate unique slug
    let slug = generateSlug(title.trim());
    let slugSuffix = 0;

    while (true) {
      const { data: slugExists } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('slug', slug)
        .single();

      if (!slugExists) break;
      slugSuffix++;
      slug = `${generateSlug(title.trim())}-${slugSuffix}`;
    }

    // 4. Create funnel page
    const { data: funnelPage, error: fpError } = await supabase
      .from('funnel_pages')
      .insert({
        lead_magnet_id: leadMagnet.id,
        user_id: session.user.id,
        slug,
        optin_headline: optinContent.headline,
        optin_subline: optinContent.subline,
        optin_button_text: optinContent.buttonText,
        optin_social_proof: optinContent.socialProof,
        thankyou_headline: 'Thanks! Check your email.',
        thankyou_subline: 'Your download is on its way.',
        qualification_pass_message: 'Great! Book a call below.',
        qualification_fail_message: 'Thanks for your interest!',
        theme: 'dark',
        primary_color: '#8b5cf6',
        background_style: 'solid',
      })
      .select('id')
      .single();

    if (fpError) {
      // Clean up the lead magnet if funnel page creation fails
      await supabase.from('lead_magnets').delete().eq('id', leadMagnet.id);
      logApiError('landing-page/quick-create/create-fp', fpError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create funnel page');
    }

    return NextResponse.json({
      success: true,
      leadMagnetId: leadMagnet.id,
      funnelPageId: funnelPage.id,
    }, { status: 201 });
  } catch (error) {
    logApiError('landing-page/quick-create', error);
    return ApiErrors.internalError('Failed to create landing page');
  }
}
