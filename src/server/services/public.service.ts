/**
 * Public Service
 * Unauthenticated routes: view tracking, resource click, public page data, public questions.
 */

import { createHash } from 'crypto';
import { logApiError } from '@/lib/api/errors';
import type { PublicFunnelPageData } from '@/lib/types/funnel';
import * as publicRepo from '@/server/repositories/public.repo';

const VALID_PAGE_TYPES = ['optin', 'thankyou'];

/** Track page view. */
export async function trackView(
  funnelPageId: string,
  pageType: string | undefined,
  ip: string,
  userAgent: string
) {
  const resolvedPageType = pageType && VALID_PAGE_TYPES.includes(pageType) ? pageType : 'optin';
  const visitorHash = createHash('sha256')
    .update(`${ip}-${userAgent}`)
    .digest('hex')
    .substring(0, 32);
  const viewDate = new Date().toISOString().split('T')[0];

  const { error } = await publicRepo.upsertPageView(
    funnelPageId,
    visitorHash,
    viewDate,
    resolvedPageType
  );
  if (error && error.code !== '23505') {
    logApiError('public/view', error, { funnelPageId });
  }
  return { success: true };
}

/** Track resource click. */
export async function trackResourceClick(
  resourceId: string,
  funnelPageId: string | null
): Promise<{ success: boolean }> {
  let libraryId: string | null = null;
  if (funnelPageId) {
    libraryId = await publicRepo.findFunnelPageLibraryId(funnelPageId);
  }
  const { error } = await publicRepo.insertExternalResourceClick(
    resourceId,
    funnelPageId,
    libraryId
  );
  if (error) {
    logApiError('public/resource-click', error, { resourceId, funnelPageId });
  }
  return { success: true };
}

/** Get public page data by username and slug. */
export async function getPublicPageData(
  username: string,
  slug: string
): Promise<{ data: PublicFunnelPageData | null; error: string | null }> {
  const user = await publicRepo.findUserByUsername(username);
  if (!user) return { data: null, error: 'Page not found' };

  const funnel = await publicRepo.findPublishedFunnelByUserAndSlug(user.id, slug);
  if (!funnel || !funnel.is_published) return { data: null, error: 'Page not found' };

  const leadMagnetTitle = await publicRepo.findLeadMagnetTitle(funnel.lead_magnet_id) ?? 'Free Resource';

  const { questions } = await publicRepo.getPublicQuestionsForFunnelPage(
    funnel.id,
    funnel.qualification_form_id ?? null
  );

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
    leadMagnetTitle,
    username: user.username,
    userName: user.name,
    userAvatar: user.avatar_url,
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      questionText: q.question_text,
      questionOrder: q.question_order,
      answerType: (q.answer_type || 'yes_no') as import('@/lib/types/funnel').AnswerType,
      options: q.options ?? null,
      placeholder: q.placeholder ?? null,
      isRequired: q.is_required ?? true,
    })),
  };
  return { data: pageData, error: null };
}

/** Get public questions for a funnel page. */
export async function getPublicQuestions(funnelPageId: string) {
  const funnel = await publicRepo.findFunnelPageForPublicQuestions(funnelPageId);
  if (!funnel || !funnel.is_published) {
    return { questions: null, error: 'Page not found' };
  }
  const result = await publicRepo.getPublicQuestionsForFunnelPage(
    funnelPageId,
    funnel.qualification_form_id
  );
  if (result.error) return { questions: null, error: result.error };
  return {
    questions: result.questions!.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      question_order: q.question_order,
      answer_type: q.answer_type,
      options: q.options,
      placeholder: q.placeholder,
      is_required: q.is_required,
    })),
    error: null,
  };
}
