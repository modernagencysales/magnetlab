/**
 * Public Service
 * Unauthenticated routes: view tracking, resource click, public page data, public questions, chat, lead.
 */

import { createHash } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logApiError } from '@/lib/api/errors';
import type { PublicFunnelPageData } from '@/lib/types/funnel';
import type { GPTConfig } from '@/lib/types/lead-magnet';
import * as publicRepo from '@/server/repositories/public.repo';
import * as interactiveChatRepo from '@/server/repositories/interactive-chat.repo';
import * as userRepo from '@/server/repositories/user.repo';
import { resolveFullQuestionsForFunnel } from '@/lib/services/qualification';
import { deliverWebhook } from '@/lib/webhooks/sender';
import { triggerEmailSequenceIfActive, triggerEmailFlowIfActive, upsertSubscriberFromLead, getSenderInfo, getUserResendConfig } from '@/lib/services/email-sequence-trigger';
import { sendResourceEmail } from '@/trigger/send-resource-email';
import { fireGtmLeadCreatedWebhook, fireGtmLeadQualifiedWebhook } from '@/lib/webhooks/gtm-system';
import { deliverConductorWebhook } from '@/lib/webhooks/conductor';
import { fireTrackingPixelLeadEvent, fireTrackingPixelQualifiedEvent } from '@/lib/services/tracking-pixels';
import { getPostHogServerClient } from '@/lib/posthog';
import { syncLeadToEmailProviders } from '@/lib/integrations/email-marketing';
import { syncLeadToGoHighLevel } from '@/lib/integrations/gohighlevel/sync';

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

// ─── Public chat (interactive GPT) ──────────────────────────────────────────

/** Get chat context for POST: config, chatId, messages. Performs rate checks and inserts user message. */
export async function getChatContext(
  leadMagnetId: string,
  sessionToken: string,
  message: string
): Promise<
  | { success: true; config: GPTConfig; chatId: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }
  | { success: false; error: 'not_found' | 'rate_limit_hourly' | 'rate_limit_daily' | 'database' }
> {
  try {
    const interactiveConfig = await interactiveChatRepo.getLeadMagnetInteractiveConfig(leadMagnetId);
    if (!interactiveConfig || (interactiveConfig.type as string) !== 'gpt') {
      return { success: false, error: 'not_found' };
    }
    const config = interactiveConfig as unknown as GPTConfig;

    let chatId: string;
    const existing = await interactiveChatRepo.findChatByLeadMagnetAndSession(leadMagnetId, sessionToken);
    if (existing) {
      chatId = existing.id;
    } else {
      const created = await interactiveChatRepo.createChat(leadMagnetId, sessionToken, message.substring(0, 100));
      chatId = created.id;
    }

    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const hourlyCount = await interactiveChatRepo.countUserMessagesSince(chatId, oneHourAgo);
    if (hourlyCount >= 50) return { success: false, error: 'rate_limit_hourly' };

    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const dailyCount = await interactiveChatRepo.countUserMessagesForLeadMagnetSince(leadMagnetId, oneDayAgo);
    if (dailyCount >= 5000) return { success: false, error: 'rate_limit_daily' };

    await interactiveChatRepo.insertMessage(chatId, 'user', message);
    const rows = await interactiveChatRepo.getMessages(chatId, 20);
    const messages = rows.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content ?? '',
    }));

    return { success: true, config, chatId, messages };
  } catch (err) {
    logApiError('public/chat/getContext', err, { leadMagnetId });
    return { success: false, error: 'database' };
  }
}

/** Save assistant message after streaming. */
export async function saveAssistantMessage(chatId: string, content: string): Promise<void> {
  await interactiveChatRepo.insertMessage(chatId, 'assistant', content);
}

/** Get chat history for GET. */
export async function getChatHistory(
  leadMagnetId: string,
  sessionToken: string
): Promise<{ messages: Array<{ role: string; content: string | null; created_at: string }>; chatId: string | null }> {
  const { chatId, messages } = await interactiveChatRepo.getChatWithMessages(leadMagnetId, sessionToken);
  return { messages, chatId };
}

// ─── Public lead capture & qualification ───────────────────────────────────

const RATE_LIMIT_WINDOW_MINUTES = 1;
const RATE_LIMIT_MAX_LEADS_PER_IP = 5;

function extractLinkedInUrl(answers: Record<string, string>): string | null {
  const linkedInRegex = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i;
  for (const value of Object.values(answers)) {
    const match = value?.match(linkedInRegex);
    if (match) return match[0];
  }
  return null;
}

export type LeadCreatedPayload = {
  lead: { id: string; email: string; name: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; created_at: string };
  funnel: { id: string; user_id: string; lead_magnet_id: string | null; slug: string; team_id: string | null; send_resource_email: boolean };
  leadMagnetTitle: string;
  resourceUrl: string | null;
  funnelPageId: string;
  ip: string;
  userAgent: string | null;
  referer?: string;
  fbc?: string | null;
  fbp?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export async function submitLead(
  funnelPageId: string,
  email: string,
  name: string | null,
  ip: string,
  userAgent: string | null,
  utmSource: string | null,
  utmMedium: string | null,
  utmCampaign: string | null,
  fbc: string | null,
  fbp: string | null
): Promise<
  | { success: true; leadId: string; payload: LeadCreatedPayload }
  | { success: false; error: 'rate_limited' | 'not_found' | 'database' }
> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const count = await publicRepo.countLeadsByIpSince(ip, windowStart);
  if (count >= RATE_LIMIT_MAX_LEADS_PER_IP) return { success: false, error: 'rate_limited' };

  const funnel = await publicRepo.findFunnelPageByIdForLead(funnelPageId);
  if (!funnel || !funnel.is_published) return { success: false, error: 'not_found' };

  const { data: lead, error: leadError } = await publicRepo.insertFunnelLead({
    funnel_page_id: funnelPageId,
    lead_magnet_id: funnel.lead_magnet_id,
    user_id: funnel.user_id,
    team_id: funnel.team_id ?? null,
    email,
    name: name ?? null,
    utm_source: utmSource ?? null,
    utm_medium: utmMedium ?? null,
    utm_campaign: utmCampaign ?? null,
    ip_address: ip !== 'unknown' ? ip : null,
    user_agent: userAgent,
  });
  if (leadError || !lead) {
    logApiError('public/lead/create', leadError, { funnelPageId, email });
    return { success: false, error: 'database' };
  }

  const leadMagnet = funnel.lead_magnet_id ? await publicRepo.findLeadMagnetForLead(funnel.lead_magnet_id) : null;
  const username = await userRepo.getUsername(funnel.user_id);
  let resourceUrl: string | null = leadMagnet?.external_url ?? null;
  if (!resourceUrl && username && (leadMagnet?.polished_content || leadMagnet?.extracted_content)) {
    resourceUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.magnetlab.app'}/p/${username}/${funnel.slug}/content`;
  }

  const payload: LeadCreatedPayload = {
    lead: {
      id: lead.id,
      email: lead.email,
      name: lead.name,
      utm_source: lead.utm_source,
      utm_medium: lead.utm_medium,
      utm_campaign: lead.utm_campaign,
      created_at: lead.created_at,
    },
    funnel: {
      id: funnel.id,
      user_id: funnel.user_id,
      lead_magnet_id: funnel.lead_magnet_id,
      slug: funnel.slug,
      team_id: funnel.team_id,
      send_resource_email: !!funnel.send_resource_email,
    },
    leadMagnetTitle: leadMagnet?.title ?? '',
    resourceUrl,
    funnelPageId,
    ip,
    userAgent,
    utmSource: utmSource ?? null,
    utmMedium: utmMedium ?? null,
    utmCampaign: utmCampaign ?? null,
    fbc: fbc ?? null,
    fbp: fbp ?? null,
  };
  return { success: true, leadId: lead.id, payload };
}

export async function runLeadCreatedSideEffects(
  payload: LeadCreatedPayload,
  referer?: string
): Promise<void> {
  const { lead, funnel, leadMagnetTitle, resourceUrl } = payload;
  await deliverWebhook(funnel.user_id, 'lead.created', {
    leadId: lead.id,
    email: lead.email,
    name: lead.name,
    isQualified: null,
    qualificationAnswers: null,
    surveyAnswers: null,
    leadMagnetTitle,
    funnelPageSlug: funnel.slug,
    utmSource: lead.utm_source,
    utmMedium: lead.utm_medium,
    utmCampaign: lead.utm_campaign,
    createdAt: lead.created_at,
  }).catch((err) => logApiError('public/lead/webhook', err, { leadId: lead.id }));

  await fireGtmLeadCreatedWebhook(
    {
      email: lead.email,
      name: lead.name ?? '',
      leadMagnetId: funnel.lead_magnet_id ?? '',
      leadMagnetTitle,
      funnelPageId: funnel.id,
      funnelPageSlug: funnel.slug,
      resourceUrl,
      isQualified: false,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
      createdAt: lead.created_at,
    },
    funnel.user_id
  ).catch((err) => logApiError('public/lead/gtm-webhook', err, { leadId: lead.id }));

  await deliverConductorWebhook(funnel.user_id, 'lead.created', {
    email: lead.email,
    name: lead.name ?? '',
    leadMagnetTitle,
    funnelPageSlug: funnel.slug,
    utmSource: lead.utm_source,
    utmMedium: lead.utm_medium,
    utmCampaign: lead.utm_campaign,
    createdAt: lead.created_at,
  }).catch((err) => logApiError('public/lead/conductor-webhook', err, { leadId: lead.id }));

  await syncLeadToEmailProviders(payload.funnelPageId, { email: lead.email, name: lead.name ?? '' }).catch((err) =>
    console.error('[lead-capture] Email marketing sync error:', err)
  );

  if (funnel.team_id) {
    await upsertSubscriberFromLead({
      teamId: funnel.team_id,
      email: lead.email,
      name: lead.name ?? '',
      leadMagnetId: funnel.lead_magnet_id ?? '',
    }).catch(() => {});
  }

  try {
    const flowResult = await triggerEmailFlowIfActive({
      teamId: funnel.team_id ?? '',
      userId: funnel.user_id,
      email: lead.email,
      name: lead.name ?? '',
      leadMagnetId: funnel.lead_magnet_id ?? '',
    });
    if (!flowResult.triggered) {
      const seqResult = await triggerEmailSequenceIfActive({
        leadId: lead.id,
        userId: funnel.user_id,
        email: lead.email,
        name: lead.name ?? '',
        leadMagnetId: funnel.lead_magnet_id ?? '',
        leadMagnetTitle,
      });
      if (!seqResult.triggered && funnel.send_resource_email && resourceUrl) {
        const [senderInfo, resendConfig] = await Promise.all([
          getSenderInfo(funnel.user_id),
          getUserResendConfig(funnel.user_id),
        ]);
        await sendResourceEmail.trigger({
          leadEmail: lead.email,
          leadName: lead.name ?? '',
          leadMagnetTitle,
          resourceUrl,
          senderName: resendConfig?.fromName || senderInfo.senderName,
          senderEmail: resendConfig?.fromEmail || senderInfo.senderEmail,
          resendConfig,
        });
      }
    }
  } catch (err) {
    logApiError('public/lead/email', err, { leadId: lead.id });
  }

  await fireTrackingPixelLeadEvent({
    userId: funnel.user_id,
    leadId: lead.id,
    email: lead.email,
    firstName: lead.name ?? null,
    ipAddress: payload.ip !== 'unknown' ? payload.ip : null,
    userAgent: payload.userAgent,
    sourceUrl: referer,
    fbc: payload.fbc ?? null,
    fbp: payload.fbp ?? null,
    utmSource: lead.utm_source,
    utmMedium: lead.utm_medium,
    utmCampaign: lead.utm_campaign,
    leadMagnetTitle: leadMagnetTitle || null,
  }).catch((err) => logApiError('public/lead/tracking-pixels', err, { leadId: lead.id }));

  await syncLeadToGoHighLevel({
    userId: funnel.user_id,
    funnelPageId: payload.funnelPageId,
    lead: {
      email: lead.email,
      name: lead.name ?? '',
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
      isQualified: null,
      qualificationAnswers: null,
    },
    leadMagnetTitle,
    funnelSlug: funnel.slug,
  }).catch((err) => logApiError('public/lead/gohighlevel', err, { leadId: lead.id }));

  try {
    getPostHogServerClient()?.capture({
      distinctId: funnel.user_id,
      event: 'lead_captured',
      properties: {
        funnel_page_id: payload.funnelPageId,
        lead_magnet_title: leadMagnetTitle,
        utm_source: payload.utmSource ?? null,
        utm_medium: payload.utmMedium ?? null,
        utm_campaign: payload.utmCampaign ?? null,
      },
    });
  } catch {}
}

export type LeadQualifiedPayload = {
  lead: { id: string; user_id: string; funnel_page_id: string; email: string; name: string | null };
  updatedLead: { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; created_at: string };
  funnelSlug: string;
  leadMagnetTitle: string;
  isQualified: boolean;
  answers: Record<string, string>;
  surveyAnswers: Record<string, string> | null;
  ip: string;
  userAgent: string | null;
  referer?: string;
};

export async function submitQualification(
  leadId: string,
  answers: Record<string, string>,
  ip: string,
  userAgent: string | null
): Promise<
  | { success: true; leadId: string; isQualified: boolean; payload: LeadQualifiedPayload }
  | { success: false; error: 'not_found' | 'validation' | 'database'; validationError?: string }
> {
  const lead = await publicRepo.findLeadById(leadId);
  if (!lead) return { success: false, error: 'not_found' };

  const qualificationFormId = await publicRepo.findFunnelPageQualificationFormId(lead.funnel_page_id);
  const supabase = createSupabaseAdminClient();
  const { questions } = await resolveFullQuestionsForFunnel(
    supabase,
    lead.funnel_page_id,
    qualificationFormId ?? null
  );

  if (questions && questions.length > 0) {
    const questionIds = new Set(questions.map((q) => q.id));
    const answerKeys = Object.keys(answers);
    for (const key of answerKeys) {
      if (!questionIds.has(key)) {
        return { success: false, error: 'validation', validationError: 'Invalid question ID in answers' };
      }
    }
    for (const q of questions) {
      if (q.is_required && !(q.id in answers)) {
        return { success: false, error: 'validation', validationError: 'All required questions must be answered' };
      }
    }
    for (const q of questions) {
      if (q.answer_type === 'yes_no' && q.id in answers) {
        const val = answers[q.id];
        if (val !== 'yes' && val !== 'no') {
          return { success: false, error: 'validation', validationError: 'Yes/No answer values must be "yes" or "no"' };
        }
      }
    }
  }

  let isQualified = true;
  if (questions && questions.length > 0) {
    const qualifyingQuestions = questions.filter((q) => q.is_qualifying);
    for (const q of qualifyingQuestions) {
      const userAnswer = answers[q.id];
      if (!userAnswer) {
        isQualified = false;
        break;
      }
      const qualAnswer = q.qualifying_answer;
      if (q.answer_type === 'yes_no') {
        if (userAnswer !== qualAnswer) {
          isQualified = false;
          break;
        }
      } else if (q.answer_type === 'multiple_choice') {
        const acceptableOptions = Array.isArray(qualAnswer) ? qualAnswer : [];
        if (!acceptableOptions.includes(userAnswer)) {
          isQualified = false;
          break;
        }
      }
    }
  }

  const { data: updatedLead, error: updateError } = await publicRepo.updateFunnelLeadQualification(leadId, {
    qualification_answers: answers,
    is_qualified: isQualified,
  });
  if (updateError || !updatedLead) {
    logApiError('public/lead/qualification', updateError, { leadId });
    return { success: false, error: 'database' };
  }

  const funnelData = await publicRepo.findFunnelSlugAndLeadMagnetTitle(lead.funnel_page_id);
  const funnelSlug = funnelData?.slug ?? '';
  const leadMagnetTitle = funnelData?.leadMagnetTitle ?? '';

  let surveyAnswers: Record<string, string> | null = null;
  if (questions && questions.length > 0) {
    surveyAnswers = {};
    for (const q of questions) {
      if (q.id in answers) {
        const key = q.question_text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 60);
        surveyAnswers[key] = answers[q.id];
      }
    }
  }

  const payload: LeadQualifiedPayload = {
    lead: { id: lead.id, user_id: lead.user_id, funnel_page_id: lead.funnel_page_id, email: lead.email, name: lead.name },
    updatedLead: {
      utm_source: updatedLead.utm_source,
      utm_medium: updatedLead.utm_medium,
      utm_campaign: updatedLead.utm_campaign,
      created_at: updatedLead.created_at,
    },
    funnelSlug,
    leadMagnetTitle,
    isQualified,
    answers,
    surveyAnswers,
    ip,
    userAgent,
  };
  return { success: true, leadId: lead.id, isQualified, payload };
}

export async function runLeadQualifiedSideEffects(
  payload: LeadQualifiedPayload,
  referer?: string
): Promise<void> {
  const { lead, updatedLead, funnelSlug, leadMagnetTitle, isQualified, answers, surveyAnswers } = payload;
  await deliverWebhook(lead.user_id, 'lead.created', {
    leadId: lead.id,
    email: lead.email,
    name: lead.name,
    isQualified,
    qualificationAnswers: answers,
    surveyAnswers,
    leadMagnetTitle,
    funnelPageSlug: funnelSlug,
    utmSource: updatedLead.utm_source,
    utmMedium: updatedLead.utm_medium,
    utmCampaign: updatedLead.utm_campaign,
    createdAt: updatedLead.created_at,
  }).catch((err) => logApiError('public/lead/webhook', err, { leadId: lead.id }));

  await fireTrackingPixelQualifiedEvent({
    userId: lead.user_id,
    leadId: lead.id,
    email: lead.email,
    firstName: lead.name ?? null,
    ipAddress: payload.ip !== 'unknown' ? payload.ip : null,
    userAgent: payload.userAgent,
    sourceUrl: referer,
    utmSource: updatedLead.utm_source,
    utmMedium: updatedLead.utm_medium,
    utmCampaign: updatedLead.utm_campaign,
    leadMagnetTitle: leadMagnetTitle || null,
    isQualified,
    qualificationAnswers: answers,
  }).catch((err) => logApiError('public/lead/tracking-pixels-qualified', err, { leadId: lead.id }));

  await fireGtmLeadQualifiedWebhook(
    {
      email: lead.email,
      name: lead.name,
      leadMagnetTitle: leadMagnetTitle || null,
      funnelPageSlug: funnelSlug,
      isQualified,
      qualificationAnswers: answers,
      utmSource: updatedLead.utm_source,
      utmMedium: updatedLead.utm_medium,
      utmCampaign: updatedLead.utm_campaign,
    },
    lead.user_id
  ).catch((err) => logApiError('public/lead/gtm-webhook-qualified', err, { leadId: lead.id }));

  await deliverConductorWebhook(lead.user_id, 'lead.qualified', {
    email: lead.email,
    name: lead.name,
    funnelLeadId: lead.id,
    leadMagnetTitle: leadMagnetTitle || null,
    funnelPageSlug: funnelSlug,
    isQualified,
    qualificationAnswers: answers,
    surveyAnswers,
    linkedinUrl: extractLinkedInUrl(answers),
    utmSource: updatedLead.utm_source,
    utmMedium: updatedLead.utm_medium,
    utmCampaign: updatedLead.utm_campaign,
  }).catch((err) => logApiError('public/lead/conductor-webhook-qualified', err, { leadId: lead.id }));

  await syncLeadToGoHighLevel({
    userId: lead.user_id,
    funnelPageId: lead.funnel_page_id,
    lead: {
      email: lead.email,
      name: lead.name ?? '',
      utmSource: updatedLead.utm_source,
      utmMedium: updatedLead.utm_medium,
      utmCampaign: updatedLead.utm_campaign,
      isQualified,
      qualificationAnswers: answers,
    },
    leadMagnetTitle,
    funnelSlug,
  }).catch((err) => logApiError('public/lead/gohighlevel-qualified', err, { leadId: lead.id }));

  try {
    getPostHogServerClient()?.capture({
      distinctId: lead.user_id,
      event: 'lead_qualified',
      properties: { is_qualified: isQualified, question_count: Object.keys(answers).length },
    });
  } catch {}
}
