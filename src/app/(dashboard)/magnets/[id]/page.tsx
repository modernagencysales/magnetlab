import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { checkTeamRole } from '@/lib/auth/rbac';
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
  const scope = await getDataScope(session.user.id);

  // Fetch lead magnet by ID first, then verify access.
  // This avoids 404s when the team-context cookie is stale or not set.
  const { data: leadMagnetData, error } = await adminClient
    .from('lead_magnets')
    .select('id, user_id, team_id, title, archetype, concept, extracted_content, generated_content, linkedin_post, post_variations, dm_template, cta_word, thumbnail_url, scheduled_time, polished_content, polished_at, screenshot_urls, status, published_at, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !leadMagnetData) {
    notFound();
  }

  // Verify the user has access: owns it, or is in the same team
  const isOwner = leadMagnetData.user_id === session.user.id;
  const isScopeMatch = scope.type === 'team' && scope.teamId === leadMagnetData.team_id;
  let isTeamMember = false;
  if (!isOwner && !isScopeMatch && leadMagnetData.team_id) {
    const role = await checkTeamRole(session.user.id, leadMagnetData.team_id);
    isTeamMember = !!role;
  }

  if (!isOwner && !isScopeMatch && !isTeamMember) {
    notFound();
  }

  // Resolve the team context for downstream queries
  const effectiveTeamId = leadMagnetData.team_id;
  const effectiveOwnerId = scope.type === 'team' ? scope.ownerId : null;

  // Resolve the username for public URLs — use team owner if available
  let usernameUserId = session.user.id;
  if (effectiveTeamId) {
    const { data: team } = await adminClient
      .from('teams')
      .select('owner_id')
      .eq('id', effectiveTeamId)
      .single();
    if (team) usernameUserId = team.owner_id;
  } else if (effectiveOwnerId) {
    usernameUserId = effectiveOwnerId;
  }

  // Fetch funnel page, username, and connected email providers in parallel
  const [funnelResult, userResult, emailProvidersResult] = await Promise.all([
    adminClient
      .from('funnel_pages')
      .select('id, lead_magnet_id, user_id, slug, target_type, library_id, external_resource_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, logo_url, qualification_form_id, is_published, published_at, created_at, updated_at, redirect_trigger, redirect_url, redirect_fail_url, homepage_url, homepage_label')
      .eq('lead_magnet_id', id)
      .eq('is_variant', false)
      .maybeSingle(),
    adminClient
      .from('users')
      .select('username')
      .eq('id', usernameUserId)
      .single(),
    adminClient
      .from('user_integrations')
      .select('service')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .in('service', ['kit', 'mailerlite', 'mailchimp', 'activecampaign']),
  ]);

  const { data: funnelData } = funnelResult;
  const { data: userData } = userResult;
  const { data: emailProvidersData } = emailProvidersResult;

  const connectedEmailProviders = (emailProvidersData || []).map((r: { service: string }) => r.service);

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
