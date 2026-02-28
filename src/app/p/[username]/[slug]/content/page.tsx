import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getWhitelabelConfig } from '@/lib/utils/whitelabel';
import { checkTeamRole } from '@/lib/auth/rbac';
import { ContentPageClient } from '@/components/content/ContentPageClient';
import { funnelPageSectionFromRow, type FunnelPageSectionRow } from '@/lib/types/funnel';
import type { Metadata } from 'next';
import type { PolishedContent, ExtractedContent, LeadMagnetConcept, InteractiveConfig } from '@/lib/types/lead-magnet';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ leadId?: string; edit?: string }>;
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
    .select('lead_magnet_id, optin_headline, team_id')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!funnel) {
    return { title: 'Page Not Found' };
  }

  const whitelabel = await getWhitelabelConfig(funnel.team_id);
  const siteName = whitelabel?.customSiteName || 'MagnetLab';

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
    title: `${leadMagnet.title} | ${siteName}`,
    description,
    openGraph: {
      title: leadMagnet.title,
      description,
      ...(leadMagnet.thumbnail_url ? { images: [leadMagnet.thumbnail_url] } : {}),
    },
    ...(whitelabel?.customFaviconUrl ? { icons: { icon: whitelabel.customFaviconUrl } } : {}),
  };
}

export default async function PublicContentPage({ params, searchParams }: PageProps) {
  const { username, slug } = await params;
  const { leadId, edit } = await searchParams;
  const supabase = createSupabaseAdminClient();

  // Get session (may be null for anonymous visitors)
  let sessionUserId: string | null = null;
  try {
    const session = await auth();
    sessionUserId = session?.user?.id ?? null;
  } catch {
    // Not logged in — that's fine
  }

  // Find user by username
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (userError || !user) {
    notFound();
  }

  // Fetch funnel page (no is_published filter — we check access after)
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
      font_family,
      font_url,
      vsl_url,
      calendly_url,
      team_id
    `)
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single();

  if (funnelError || !funnel) {
    notFound();
  }

  const whitelabel = await getWhitelabelConfig(funnel.team_id);

  // Get lead magnet with content
  const { data: leadMagnet, error: lmError } = await supabase
    .from('lead_magnets')
    .select('id, title, extracted_content, polished_content, concept, thumbnail_url, interactive_config, team_id')
    .eq('id', funnel.lead_magnet_id)
    .single();

  if (lmError || !leadMagnet) {
    notFound();
  }

  // Determine edit access: page owner OR same-team member
  let canEdit = false;
  if (sessionUserId) {
    const isOwner = sessionUserId === user.id;
    if (isOwner) {
      canEdit = true;
    } else {
      // Check team membership via funnel or lead magnet team_id (fallback)
      const teamId = funnel.team_id || leadMagnet.team_id;
      if (teamId) {
        const role = await checkTeamRole(sessionUserId, teamId as string);
        canEdit = role !== null;
      }
    }
  }

  // Non-team visitors can only see published pages
  if (!canEdit && !funnel.is_published) {
    notFound();
  }

  if (!leadMagnet.extracted_content && !leadMagnet.polished_content && !leadMagnet.interactive_config) {
    notFound();
  }

  // Check lead qualification status and whether questions exist
  let isQualified: boolean | null = null;
  if (leadId) {
    const { data: lead } = await supabase
      .from('funnel_leads')
      .select('is_qualified')
      .eq('id', leadId)
      .eq('funnel_page_id', funnel.id)
      .single();
    isQualified = lead?.is_qualified ?? null;
  }

  // Check if funnel has qualification questions
  let hasQuestions = false;
  if (funnel.calendly_url) {
    const { count } = await supabase
      .from('qualification_questions')
      .select('*', { count: 'exact', head: true })
      .eq('funnel_page_id', funnel.id);
    hasQuestions = (count ?? 0) > 0;
  }

  // Fetch page sections for content
  const { data: sectionRows } = await supabase
    .from('funnel_page_sections')
    .select('id, funnel_page_id, section_type, page_location, sort_order, is_visible, config, created_at, updated_at')
    .eq('funnel_page_id', funnel.id)
    .eq('page_location', 'content')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });

  const sections = (sectionRows as FunnelPageSectionRow[] || []).map(funnelPageSectionFromRow);

  // Fetch iClosed widget integration for the page owner
  let iClosedWidgetId: string | null = null;
  const { data: iClosedIntegration } = await supabase
    .from('user_integrations')
    .select('metadata')
    .eq('user_id', user.id)
    .eq('service', 'iclosed_widget')
    .eq('is_active', true)
    .single();
  if (iClosedIntegration?.metadata) {
    const meta = iClosedIntegration.metadata as { widget_id?: string };
    if (meta.widget_id) {
      iClosedWidgetId = meta.widget_id;
    }
  }

  // Track page view (fire-and-forget, not for team members)
  if (!canEdit) {
    supabase
      .from('page_views')
      .insert({ funnel_page_id: funnel.id, page_type: 'content' })
      .then(() => {});
  }

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
      fontFamily={funnel.font_family}
      fontUrl={funnel.font_url}
      vslUrl={funnel.vsl_url}
      calendlyUrl={funnel.calendly_url}
      isOwner={canEdit}
      interactiveConfig={leadMagnet.interactive_config as InteractiveConfig | null}
      leadMagnetId={leadMagnet.id}
      funnelPageId={funnel.id}
      leadId={leadId || null}
      isQualified={isQualified}
      hasQuestions={hasQuestions}
      sections={sections}
      hideBranding={whitelabel?.hideBranding || false}
      autoEdit={edit === 'true'}
      iClosedWidgetId={iClosedWidgetId}
    />
  );
}
