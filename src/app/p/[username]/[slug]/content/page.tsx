import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ContentPageClient } from '@/components/content/ContentPageClient';
import type { Metadata } from 'next';
import type { PolishedContent, ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ leadId?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (!user) {
    return { title: 'Page Not Found' };
  }

  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('lead_magnet_id, optin_headline')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!funnel) {
    return { title: 'Page Not Found' };
  }

  const { data: leadMagnet } = await supabase
    .from('lead_magnets')
    .select('title, thumbnail_url, polished_content')
    .eq('id', funnel.lead_magnet_id)
    .single();

  if (!leadMagnet) {
    return { title: 'Page Not Found' };
  }

  const polished = leadMagnet.polished_content as PolishedContent | null;
  const description = polished?.heroSummary || funnel.optin_headline;

  return {
    title: leadMagnet.title,
    description,
    openGraph: {
      title: leadMagnet.title,
      description,
      ...(leadMagnet.thumbnail_url ? { images: [leadMagnet.thumbnail_url] } : {}),
    },
  };
}

export default async function PublicContentPage({ params, searchParams }: PageProps) {
  const { username, slug } = await params;
  const { leadId } = await searchParams;
  const supabase = createSupabaseAdminClient();

  // Find user by username
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
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
      lead_magnet_id,
      slug,
      is_published,
      theme,
      primary_color,
      background_style,
      logo_url,
      vsl_url,
      calendly_url
    `)
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single();

  if (funnelError || !funnel || !funnel.is_published) {
    notFound();
  }

  // Get lead magnet with content
  const { data: leadMagnet, error: lmError } = await supabase
    .from('lead_magnets')
    .select('id, title, extracted_content, polished_content, concept, thumbnail_url')
    .eq('id', funnel.lead_magnet_id)
    .single();

  if (lmError || !leadMagnet) {
    notFound();
  }

  // Must have at least extracted content
  if (!leadMagnet.extracted_content && !leadMagnet.polished_content) {
    notFound();
  }

  // Check if lead is qualified (for gating Calendly)
  let showCalendly = false;
  if (funnel.calendly_url && leadId) {
    const { data: lead } = await supabase
      .from('funnel_leads')
      .select('is_qualified')
      .eq('id', leadId)
      .eq('funnel_page_id', funnel.id)
      .single();

    showCalendly = lead?.is_qualified === true;
  }

  // Track page view (fire-and-forget)
  supabase
    .from('page_views')
    .insert({
      funnel_page_id: funnel.id,
      page_type: 'content',
    })
    .then(() => {});

  return (
    <ContentPageClient
      title={leadMagnet.title}
      polishedContent={leadMagnet.polished_content as PolishedContent | null}
      extractedContent={leadMagnet.extracted_content as ExtractedContent | null}
      concept={leadMagnet.concept as LeadMagnetConcept | null}
      thumbnailUrl={leadMagnet.thumbnail_url}
      theme={(funnel.theme as 'dark' | 'light') || 'dark'}
      primaryColor={funnel.primary_color || '#8b5cf6'}
      logoUrl={funnel.logo_url}
      vslUrl={funnel.vsl_url}
      calendlyUrl={showCalendly ? funnel.calendly_url : null}
    />
  );
}
