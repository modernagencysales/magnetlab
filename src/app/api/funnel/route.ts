// API Route: Funnel Pages List and Create
// GET /api/funnel?leadMagnetId=xxx - Get funnel for lead magnet
// POST /api/funnel - Create new funnel page

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageFromRow, type FunnelPageRow } from '@/lib/types/funnel';

// GET - Get funnel page for a lead magnet
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leadMagnetId = searchParams.get('leadMagnetId');

    if (!leadMagnetId) {
      return NextResponse.json({ error: 'leadMagnetId is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Verify lead magnet ownership
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id')
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (lmError || !leadMagnet) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 });
    }

    // Get funnel page
    const { data, error } = await supabase
      .from('funnel_pages')
      .select('*')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Get funnel error:', error);
      return NextResponse.json({ error: 'Failed to fetch funnel page' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ funnel: null });
    }

    return NextResponse.json({ funnel: funnelPageFromRow(data as FunnelPageRow) });
  } catch (error) {
    console.error('Get funnel error:', error);
    return NextResponse.json({ error: 'Failed to fetch funnel page' }, { status: 500 });
  }
}

// POST - Create a new funnel page
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leadMagnetId, slug, ...funnelData } = body;

    if (!leadMagnetId || !slug) {
      return NextResponse.json(
        { error: 'leadMagnetId and slug are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify lead magnet ownership
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id, title')
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (lmError || !leadMagnet) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 });
    }

    // Check if funnel already exists for this lead magnet
    const { data: existing } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('lead_magnet_id', leadMagnetId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Funnel page already exists for this lead magnet' },
        { status: 409 }
      );
    }

    // Check for slug collision and auto-increment if needed
    let finalSlug = slug;
    let slugSuffix = 0;

    while (true) {
      const { data: slugExists } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('slug', finalSlug)
        .single();

      if (!slugExists) break;

      slugSuffix++;
      finalSlug = `${slug}-${slugSuffix}`;
    }

    // Create funnel page
    const { data, error } = await supabase
      .from('funnel_pages')
      .insert({
        lead_magnet_id: leadMagnetId,
        user_id: session.user.id,
        slug: finalSlug,
        optin_headline: funnelData.optinHeadline || leadMagnet.title,
        optin_subline: funnelData.optinSubline || null,
        optin_button_text: funnelData.optinButtonText || 'Get Free Access',
        optin_social_proof: funnelData.optinSocialProof || null,
        thankyou_headline: funnelData.thankyouHeadline || 'Thanks! Check your email.',
        thankyou_subline: funnelData.thankyouSubline || null,
        vsl_url: funnelData.vslUrl || null,
        calendly_url: funnelData.calendlyUrl || null,
        qualification_pass_message: funnelData.qualificationPassMessage || 'Great! Book a call below.',
        qualification_fail_message: funnelData.qualificationFailMessage || 'Thanks for your interest!',
      })
      .select()
      .single();

    if (error) {
      console.error('Create funnel error:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A funnel with this slug already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to create funnel page' }, { status: 500 });
    }

    return NextResponse.json(
      { funnel: funnelPageFromRow(data as FunnelPageRow) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create funnel error:', error);
    return NextResponse.json({ error: 'Failed to create funnel page' }, { status: 500 });
  }
}
