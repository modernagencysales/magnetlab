// API Route: Re-apply Brand Kit to Funnel
// POST /api/funnel/[id]/reapply-brand
//
// Fetches the user's current brand kit and applies it to the specified funnel page
// (theme, colors, fonts, logo) and its sections (logos, testimonial, steps).

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { resolveBrandKit } from '@/lib/api/resolve-brand-kit';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: funnelPageId } = await params;
  const supabase = createSupabaseAdminClient();

  // Verify funnel belongs to user
  const { data: funnel, error: funnelError } = await supabase
    .from('funnel_pages')
    .select('id, user_id')
    .eq('id', funnelPageId)
    .eq('user_id', session.user.id)
    .single();

  if (funnelError || !funnel) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  }

  // Resolve brand kit
  const brandKit = await resolveBrandKit(supabase, session.user.id);

  if (!brandKit) {
    return NextResponse.json({ success: true, applied: [], message: 'No brand kit found' });
  }

  // Apply to funnel_pages row
  const applied: string[] = [];
  const funnelUpdate: Record<string, unknown> = {};
  const values: Record<string, unknown> = {};

  if (brandKit.default_theme) {
    funnelUpdate.theme = brandKit.default_theme;
    values.theme = brandKit.default_theme;
    applied.push('theme');
  }
  if (brandKit.default_primary_color) {
    funnelUpdate.primary_color = brandKit.default_primary_color;
    values.primaryColor = brandKit.default_primary_color;
    applied.push('primary_color');
  }
  if (brandKit.default_background_style) {
    funnelUpdate.background_style = brandKit.default_background_style;
    values.backgroundStyle = brandKit.default_background_style;
    applied.push('background_style');
  }
  if (brandKit.logo_url) {
    funnelUpdate.logo_url = brandKit.logo_url;
    values.logoUrl = brandKit.logo_url;
    applied.push('logo_url');
  }
  if (brandKit.font_family) {
    funnelUpdate.font_family = brandKit.font_family;
    applied.push('font_family');
  }
  if (brandKit.font_url) {
    funnelUpdate.font_url = brandKit.font_url;
    applied.push('font_url');
  }

  if (Object.keys(funnelUpdate).length > 0) {
    await supabase.from('funnel_pages').update(funnelUpdate).eq('id', funnelPageId);
  }

  // Update sections
  const { data: sections } = await supabase
    .from('funnel_page_sections')
    .select('id, section_type, config')
    .eq('funnel_page_id', funnelPageId);

  if (sections) {
    for (const section of sections) {
      let config = (section.config || {}) as Record<string, unknown>;
      let updated = false;

      if (section.section_type === 'logo_bar' && brandKit.logos && brandKit.logos.length > 0) {
        config = { ...config, logos: brandKit.logos };
        updated = true;
        if (!applied.includes('logos')) applied.push('logos');
      }

      if (section.section_type === 'testimonial' && brandKit.default_testimonial?.quote) {
        config = { ...config, ...brandKit.default_testimonial };
        updated = true;
        if (!applied.includes('testimonial')) applied.push('testimonial');
      }

      if (section.section_type === 'steps' && brandKit.default_steps?.steps?.length) {
        config = { ...config, ...brandKit.default_steps };
        updated = true;
        if (!applied.includes('steps')) applied.push('steps');
      }

      if (updated) {
        await supabase.from('funnel_page_sections').update({ config }).eq('id', section.id);
      }
    }
  }

  return NextResponse.json({ success: true, applied, values });
}
