import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getWhitelabelConfig } from '@/lib/utils/whitelabel';
import { OptinPage } from '@/components/funnel/public';
import { funnelPageSectionFromRow, type FunnelPageSectionRow } from '@/lib/types/funnel';
import type { Metadata } from 'next';

// Revalidate published pages every 5 minutes for ISR caching
export const revalidate = 300;

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = createSupabaseAdminClient();

  // Find user by username
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (!user) {
    return { title: 'Page Not Found' };
  }

  // Find funnel page
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('optin_headline, optin_subline, lead_magnet_id, team_id')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!funnel) {
    return { title: 'Page Not Found' };
  }

  const whitelabel = await getWhitelabelConfig(funnel.team_id);
  const siteName = whitelabel?.customSiteName || 'MagnetLab';

  return {
    title: `${funnel.optin_headline} | ${siteName}`,
    description: funnel.optin_subline || undefined,
    openGraph: {
      title: funnel.optin_headline,
      description: funnel.optin_subline || undefined,
      type: 'website',
    },
    ...(whitelabel?.customFaviconUrl ? { icons: { icon: whitelabel.customFaviconUrl } } : {}),
  };
}

export default async function PublicOptinPage({ params }: PageProps) {
  const { username, slug } = await params;
  const supabase = createSupabaseAdminClient();

  // Find user by username
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', username)
    .single();

  if (userError || !user) {
    notFound();
  }

  // Find published funnel page
  const { data: funnel, error: funnelError } = await supabase
    .from('funnel_pages')
    .select(`
      id,
      slug,
      lead_magnet_id,
      optin_headline,
      optin_subline,
      optin_button_text,
      optin_social_proof,
      is_published,
      theme,
      primary_color,
      background_style,
      logo_url,
      font_family,
      font_url,
      team_id,
      redirect_trigger,
      redirect_url
    `)
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single();

  if (funnelError || !funnel || !funnel.is_published) {
    notFound();
  }

  const whitelabel = await getWhitelabelConfig(funnel.team_id);

  // Fetch lead magnet title for pixel tracking content_name
  const { data: leadMagnet } = await supabase
    .from('lead_magnets')
    .select('title')
    .eq('id', funnel.lead_magnet_id)
    .single();

  // Fetch page sections for optin
  const { data: sectionRows } = await supabase
    .from('funnel_page_sections')
    .select('id, funnel_page_id, section_type, page_location, sort_order, is_visible, config, created_at, updated_at')
    .eq('funnel_page_id', funnel.id)
    .eq('page_location', 'optin')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });

  const sections = (sectionRows as FunnelPageSectionRow[] || []).map(funnelPageSectionFromRow);

  // Fetch user's active pixel integrations (pixel IDs only, no tokens)
  const { data: pixelIntegrations } = await supabase
    .from('user_integrations')
    .select('service, metadata, is_active')
    .eq('user_id', user.id)
    .in('service', ['meta_pixel', 'linkedin_insight'])
    .eq('is_active', true);

  const pixelConfig: { meta?: { pixelId: string; enabledEvents: string[] }; linkedin?: { partnerId: string; enabledEvents: string[] } } = {};
  for (const pi of pixelIntegrations || []) {
    const meta = pi.metadata as Record<string, unknown> | null;
    if (pi.service === 'meta_pixel' && meta?.pixel_id) {
      pixelConfig.meta = {
        pixelId: meta.pixel_id as string,
        enabledEvents: (meta.enabled_events as string[]) || [],
      };
    }
    if (pi.service === 'linkedin_insight' && meta?.partner_id) {
      pixelConfig.linkedin = {
        partnerId: meta.partner_id as string,
        enabledEvents: (meta.enabled_events as string[]) || [],
      };
    }
  }

  return (
    <Suspense>
      <OptinPage
        funnelId={funnel.id}
        headline={funnel.optin_headline}
        subline={funnel.optin_subline}
        buttonText={funnel.optin_button_text}
        socialProof={funnel.optin_social_proof}
        username={user.username}
        slug={funnel.slug}
        theme={(funnel.theme as 'dark' | 'light') || 'dark'}
        primaryColor={funnel.primary_color || '#8b5cf6'}
        backgroundStyle={(funnel.background_style as 'solid' | 'gradient' | 'pattern') || 'solid'}
        logoUrl={funnel.logo_url}
        sections={sections}
        pixelConfig={pixelConfig}
        leadMagnetTitle={leadMagnet?.title || null}
        fontFamily={funnel.font_family}
        fontUrl={funnel.font_url}
        hideBranding={whitelabel?.hideBranding || false}
        redirectTrigger={(funnel.redirect_trigger as 'none' | 'immediate' | 'after_qualification') || 'none'}
        redirectUrl={funnel.redirect_url}
      />
    </Suspense>
  );
}
