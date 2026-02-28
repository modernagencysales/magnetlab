import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createHash } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getWhitelabelConfig } from '@/lib/utils/whitelabel';
import { ThankyouPage } from '@/components/funnel/public';
import { funnelPageSectionFromRow, type FunnelPageSectionRow } from '@/lib/types/funnel';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ leadId?: string }>;
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

  // Find funnel page (exclude variants)
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('thankyou_headline, team_id')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('is_variant', false)
    .single();

  if (!funnel) {
    return { title: 'Page Not Found' };
  }

  const whitelabel = await getWhitelabelConfig(funnel.team_id);
  const siteName = whitelabel?.customSiteName || 'MagnetLab';

  return {
    title: `${funnel.thankyou_headline} | ${siteName}`,
    robots: { index: false, follow: false },
    ...(whitelabel?.customFaviconUrl ? { icons: { icon: whitelabel.customFaviconUrl } } : {}),
  };
}

export default async function PublicThankyouPage({ params, searchParams }: PageProps) {
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

  // Find published funnel page (control only — variants have is_variant=true)
  const { data: funnel, error: funnelError } = await supabase
    .from('funnel_pages')
    .select(`
      id,
      lead_magnet_id,
      thankyou_headline,
      thankyou_subline,
      vsl_url,
      calendly_url,
      qualification_pass_message,
      qualification_fail_message,
      is_published,
      is_variant,
      theme,
      primary_color,
      background_style,
      logo_url,
      qualification_form_id,
      font_family,
      font_url,
      team_id,
      redirect_trigger,
      redirect_url,
      redirect_fail_url,
      homepage_url,
      homepage_label,
      send_resource_email,
      thankyou_layout
    `)
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_variant', false)
    .single();

  if (funnelError || !funnel || !funnel.is_published) {
    notFound();
  }

  const whitelabel = await getWhitelabelConfig(funnel.team_id);

  // Fetch brand kit website_url for homepage link fallback
  let brandWebsiteUrl: string | null = null;
  if (funnel.team_id) {
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('website_url')
      .eq('team_id', funnel.team_id)
      .maybeSingle();
    brandWebsiteUrl = brandKit?.website_url || null;
  }
  if (!brandWebsiteUrl) {
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('website_url')
      .eq('user_id', user.id)
      .maybeSingle();
    brandWebsiteUrl = brandKit?.website_url || null;
  }

  // A/B experiment bucketing
  let activeFunnel = funnel;
  const { data: activeExperiment } = await supabase
    .from('ab_experiments')
    .select('id, test_field')
    .eq('funnel_page_id', funnel.id)
    .eq('status', 'running')
    .limit(1)
    .maybeSingle();

  if (activeExperiment) {
    // Get all variants including control
    const { data: variants } = await supabase
      .from('funnel_pages')
      .select('id, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message, is_variant, qualification_form_id, thankyou_layout')
      .or(`id.eq.${funnel.id},experiment_id.eq.${activeExperiment.id}`)
      .eq('is_published', true);

    if (variants && variants.length > 1) {
      // Deterministic bucketing: hash(IP + UA + experiment_id)
      const headersList = await headers();
      const forwarded = headersList.get('x-forwarded-for');
      const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
      const ua = headersList.get('user-agent') || 'unknown';
      const hash = createHash('sha256').update(`${ip}${ua}${activeExperiment.id}`).digest();
      const bucketIndex = hash.readUInt32BE(0) % variants.length;
      const selected = variants[bucketIndex];

      // Override the thank-you fields with the selected variant
      activeFunnel = {
        ...funnel,
        id: selected.id,
        thankyou_headline: selected.thankyou_headline,
        thankyou_subline: selected.thankyou_subline,
        vsl_url: selected.vsl_url,
        qualification_pass_message: selected.qualification_pass_message,
        qualification_form_id: selected.qualification_form_id,
        thankyou_layout: selected.thankyou_layout,
      };
    }
  }

  // Get lead magnet info for content page link
  const { data: leadMagnet } = await supabase
    .from('lead_magnets')
    .select('title, polished_content, extracted_content')
    .eq('id', funnel.lead_magnet_id)
    .single();

  // Fetch lead email for redirect URL params
  let leadEmail: string | null = null;
  if (leadId) {
    const { data: lead } = await supabase
      .from('funnel_leads')
      .select('email')
      .eq('id', leadId)
      .single();
    leadEmail = lead?.email || null;
  }

  // Check if an active email sequence exists for this lead magnet
  const { data: activeSequence } = await supabase
    .from('email_sequences')
    .select('id')
    .eq('lead_magnet_id', funnel.lead_magnet_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  const hasActiveSequence = !!activeSequence;

  // Show resource on page when: no email being sent (toggle off AND no sequence)
  const showResourceOnPage = !funnel.send_resource_email && !hasActiveSequence;

  const hasContent = !!(leadMagnet?.polished_content || leadMagnet?.extracted_content);
  const contentPageUrl = hasContent ? `/p/${username}/${slug}/content` : null;

  // Get qualification/survey questions (form-aware, uses activeFunnel for variant support)
  let questions;
  if (activeFunnel.qualification_form_id) {
    const { data } = await supabase
      .from('qualification_questions')
      .select('id, question_text, question_order, answer_type, options, placeholder, is_required')
      .eq('form_id', activeFunnel.qualification_form_id)
      .order('question_order', { ascending: true });
    questions = data;
  } else {
    const { data } = await supabase
      .from('qualification_questions')
      .select('id, question_text, question_order, answer_type, options, placeholder, is_required')
      .eq('funnel_page_id', activeFunnel.id)
      .order('question_order', { ascending: true });
    questions = data;
  }

  // Fetch page sections for thankyou (uses control funnel — variants share sections)
  const { data: sectionRows } = await supabase
    .from('funnel_page_sections')
    .select('id, funnel_page_id, section_type, page_location, sort_order, is_visible, config, created_at, updated_at')
    .eq('funnel_page_id', funnel.id)
    .eq('page_location', 'thankyou')
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
    <ThankyouPage
      leadId={leadId || null}
      headline={activeFunnel.thankyou_headline}
      subline={activeFunnel.thankyou_subline}
      vslUrl={activeFunnel.vsl_url}
      calendlyUrl={funnel.calendly_url}
      passMessage={activeFunnel.qualification_pass_message}
      failMessage={funnel.qualification_fail_message}
      questions={(questions || []).map((q) => ({
        id: q.id,
        questionText: q.question_text,
        questionOrder: q.question_order,
        answerType: (q.answer_type || 'yes_no') as 'yes_no' | 'text' | 'textarea' | 'multiple_choice',
        options: q.options || null,
        placeholder: q.placeholder || null,
        isRequired: q.is_required ?? true,
      }))}
      theme={(funnel.theme as 'dark' | 'light') || 'dark'}
      primaryColor={funnel.primary_color || '#8b5cf6'}
      backgroundStyle={(funnel.background_style as 'solid' | 'gradient' | 'pattern') || 'solid'}
      logoUrl={funnel.logo_url}
      contentPageUrl={contentPageUrl}
      leadMagnetTitle={leadMagnet?.title || null}
      sections={sections}
      pixelConfig={pixelConfig}
      funnelPageId={activeFunnel.id}
      fontFamily={funnel.font_family}
      fontUrl={funnel.font_url}
      hideBranding={whitelabel?.hideBranding || false}
      redirectTrigger={(funnel.redirect_trigger as 'none' | 'immediate' | 'after_qualification') || 'none'}
      redirectUrl={funnel.redirect_url}
      redirectFailUrl={funnel.redirect_fail_url}
      email={leadEmail}
      homepageUrl={funnel.homepage_url || brandWebsiteUrl}
      homepageLabel={funnel.homepage_label}
      showResourceOnPage={showResourceOnPage}
      layout={(activeFunnel.thankyou_layout as 'survey_first' | 'video_first' | 'side_by_side') || 'survey_first'}
    />
  );
}
