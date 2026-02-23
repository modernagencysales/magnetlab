import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { MagnetDetail } from '@/components/magnets/MagnetDetail';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';
import {
  funnelPageFromRow,
  qualificationQuestionFromRow,
  type FunnelPageRow,
  type QualificationQuestionRow,
} from '@/lib/types/funnel';
import type { LeadMagnet } from '@/lib/types/lead-magnet';

export const metadata = {
  title: 'Lead Magnet | MagnetLab',
  description: 'View your lead magnet details',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MagnetDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;
  const adminClient = createSupabaseAdminClient();

  // Fetch lead magnet, funnel page, username, and connected email providers in parallel
  const [leadMagnetResult, funnelResult, userResult, emailProvidersResult] = await Promise.all([
    adminClient
      .from('lead_magnets')
      .select('id, user_id, title, archetype, concept, extracted_content, generated_content, linkedin_post, post_variations, dm_template, cta_word, thumbnail_url, scheduled_time, polished_content, polished_at, screenshot_urls, status, published_at, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single(),
    adminClient
      .from('funnel_pages')
      .select('id, lead_magnet_id, user_id, slug, target_type, library_id, external_resource_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, logo_url, qualification_form_id, is_published, published_at, created_at, updated_at, redirect_trigger, redirect_url, redirect_fail_url, homepage_url, homepage_label')
      .eq('lead_magnet_id', id)
      .eq('user_id', session.user.id)
      .eq('is_variant', false)
      .single(),
    adminClient
      .from('users')
      .select('username')
      .eq('id', session.user.id)
      .single(),
    adminClient
      .from('user_integrations')
      .select('service')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .in('service', ['kit', 'mailerlite', 'mailchimp', 'activecampaign']),
  ]);

  const { data: leadMagnetData, error } = leadMagnetResult;
  const { data: funnelData } = funnelResult;
  const { data: userData } = userResult;
  const { data: emailProvidersData } = emailProvidersResult;

  const connectedEmailProviders = (emailProvidersData || []).map((r: { service: string }) => r.service);

  if (error || !leadMagnetData) {
    notFound();
  }

  // Transform to camelCase
  const leadMagnet: LeadMagnet = {
    id: leadMagnetData.id,
    userId: leadMagnetData.user_id,
    title: leadMagnetData.title,
    archetype: leadMagnetData.archetype,
    concept: leadMagnetData.concept,
    extractedContent: leadMagnetData.extracted_content,
    generatedContent: leadMagnetData.generated_content,
    linkedinPost: leadMagnetData.linkedin_post,
    postVariations: leadMagnetData.post_variations,
    dmTemplate: leadMagnetData.dm_template,
    ctaWord: leadMagnetData.cta_word,
    thumbnailUrl: leadMagnetData.thumbnail_url,
    scheduledTime: leadMagnetData.scheduled_time,
    polishedContent: leadMagnetData.polished_content,
    polishedAt: leadMagnetData.polished_at,
    screenshotUrls: leadMagnetData.screenshot_urls || undefined,
    status: leadMagnetData.status,
    publishedAt: leadMagnetData.published_at,
    createdAt: leadMagnetData.created_at,
    updatedAt: leadMagnetData.updated_at,
  };

  const existingFunnel = funnelData
    ? funnelPageFromRow(funnelData as FunnelPageRow)
    : null;

  // Fetch questions if funnel exists
  let existingQuestions: ReturnType<typeof qualificationQuestionFromRow>[] = [];
  if (existingFunnel) {
    let questionsData;
    if (existingFunnel.qualificationFormId) {
      const { data } = await adminClient
        .from('qualification_questions')
        .select('id, funnel_page_id, form_id, question_text, question_order, answer_type, qualifying_answer, options, placeholder, is_qualifying, is_required, created_at')
        .eq('form_id', existingFunnel.qualificationFormId)
        .order('question_order', { ascending: true });
      questionsData = data;
    } else {
      const { data } = await adminClient
        .from('qualification_questions')
        .select('id, funnel_page_id, form_id, question_text, question_order, answer_type, qualifying_answer, options, placeholder, is_qualifying, is_required, created_at')
        .eq('funnel_page_id', existingFunnel.id)
        .order('question_order', { ascending: true });
      questionsData = data;
    }

    if (questionsData) {
      existingQuestions = (questionsData as QualificationQuestionRow[]).map(
        qualificationQuestionFromRow
      );
    }
  }

  const username = userData?.username || null;
  const archetypeName = ARCHETYPE_NAMES[leadMagnet.archetype as keyof typeof ARCHETYPE_NAMES] || leadMagnet.archetype;

  return (
    <Suspense>
      <MagnetDetail
        leadMagnet={leadMagnet}
        existingFunnel={existingFunnel}
        existingQuestions={existingQuestions}
        username={username}
        archetypeName={archetypeName}
        connectedEmailProviders={connectedEmailProviders}
      />
    </Suspense>
  );
}
