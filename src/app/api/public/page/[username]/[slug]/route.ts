// API Route: Public Page Data
// GET /api/public/page/[username]/[slug]
// No auth required - returns published page data

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logApiError } from '@/lib/api/errors';
import type { PublicFunnelPageData } from '@/lib/types/funnel';

interface RouteParams {
  params: Promise<{ username: string; slug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { username, slug } = await params;
    const supabase = createSupabaseAdminClient();

    // Find user by username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, name, avatar_url')
      .eq('username', username)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Find published funnel page by slug
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select(`
        id,
        slug,
        optin_headline,
        optin_subline,
        optin_button_text,
        optin_social_proof,
        thankyou_headline,
        thankyou_subline,
        vsl_url,
        calendly_url,
        qualification_pass_message,
        qualification_fail_message,
        lead_magnet_id,
        is_published
      `)
      .eq('user_id', user.id)
      .eq('slug', slug)
      .single();

    if (funnelError || !funnel) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Check if published
    if (!funnel.is_published) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Get lead magnet title
    const { data: leadMagnet } = await supabase
      .from('lead_magnets')
      .select('title')
      .eq('id', funnel.lead_magnet_id)
      .single();

    // Get qualification questions
    const { data: questions } = await supabase
      .from('qualification_questions')
      .select('id, question_text, question_order')
      .eq('funnel_page_id', funnel.id)
      .order('question_order', { ascending: true });

    const pageData: PublicFunnelPageData = {
      id: funnel.id,
      slug: funnel.slug,
      optinHeadline: funnel.optin_headline,
      optinSubline: funnel.optin_subline,
      optinButtonText: funnel.optin_button_text,
      optinSocialProof: funnel.optin_social_proof,
      thankyouHeadline: funnel.thankyou_headline,
      thankyouSubline: funnel.thankyou_subline,
      vslUrl: funnel.vsl_url,
      calendlyUrl: funnel.calendly_url,
      qualificationPassMessage: funnel.qualification_pass_message,
      qualificationFailMessage: funnel.qualification_fail_message,
      leadMagnetTitle: leadMagnet?.title || 'Free Resource',
      username: user.username,
      userName: user.name,
      userAvatar: user.avatar_url,
      questions: (questions || []).map((q) => ({
        id: q.id,
        questionText: q.question_text,
        questionOrder: q.question_order,
      })),
    };

    return NextResponse.json(pageData);
  } catch (error) {
    logApiError('public/page', error);
    return NextResponse.json({ error: 'Failed to fetch page', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
