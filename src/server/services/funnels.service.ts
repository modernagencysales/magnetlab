/**
 * Funnels Service
 * Business logic for funnel_pages, funnel_page_sections, qualification_questions, funnel_integrations.
 * Never imports from Next.js HTTP layer.
 */

import * as funnelsRepo from '@/server/repositories/funnels.repo';
import { checkResourceLimit } from '@/lib/auth/plan-limits';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '@/lib/constants/funnel-templates';
import { resolveBrandKit } from '@/lib/api/resolve-brand-kit';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  validateBody,
  createSectionSchema,
  updateSectionSchema,
  sectionConfigSchemas,
} from '@/lib/validations/api';
import { normalizeSectionConfigImageUrls } from '@/lib/utils/normalize-image-url';
import { slugify } from '@/lib/utils';
import { isEmailMarketingProvider } from '@/lib/integrations/email-marketing';
import {
  polishLeadMagnetContent,
} from '@/lib/ai/lead-magnet-generator';
import {
  generateOptinContent,
  generateDefaultOptinContent,
} from '@/lib/ai/funnel-content-generator';
import { getPostHogServerClient } from '@/lib/posthog';
import { logApiError } from '@/lib/api/errors';
import type { DataScope } from '@/lib/utils/team-context';
import type { FunnelPage, FunnelPageSection, QualificationQuestion } from '@/lib/types/funnel';
import type { ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';
import type { BulkPageItemInput } from '@/lib/validations/api';

export type { FunnelPage, FunnelPageSection, QualificationQuestion };

// ─── Validation constants ──────────────────────────────────────────────────

const VALID_FUNNEL_PROVIDERS = ['kit', 'mailerlite', 'mailchimp', 'activecampaign', 'gohighlevel'] as const;
type FunnelProvider = typeof VALID_FUNNEL_PROVIDERS[number];

function isValidFunnelProvider(s: string): s is FunnelProvider {
  return (VALID_FUNNEL_PROVIDERS as readonly string[]).includes(s);
}

// ─── Funnel CRUD ───────────────────────────────────────────────────────────

export async function getFunnelByTarget(
  scope: DataScope,
  filter: { leadMagnetId?: string; libraryId?: string; externalResourceId?: string },
): Promise<FunnelPage | null> {
  // Verify ownership of the target before querying
  if (filter.leadMagnetId) {
    const lm = await funnelsRepo.verifyLeadMagnetOwnership(scope.userId, filter.leadMagnetId);
    if (!lm) throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
  } else if (filter.libraryId) {
    const lib = await funnelsRepo.verifyLibraryOwnership(scope.userId, filter.libraryId);
    if (!lib) throw Object.assign(new Error('Library not found'), { statusCode: 404 });
  } else if (filter.externalResourceId) {
    const er = await funnelsRepo.verifyExternalResourceOwnership(scope.userId, filter.externalResourceId);
    if (!er) throw Object.assign(new Error('External resource not found'), { statusCode: 404 });
  }
  return funnelsRepo.findFunnelByTarget(scope, filter);
}

export async function getFunnelById(scope: DataScope, id: string): Promise<FunnelPage | null> {
  return funnelsRepo.findFunnelById(scope, id);
}

export async function getAllFunnels(scope: DataScope) {
  return funnelsRepo.findAllFunnels(scope);
}

export async function createFunnel(
  scope: DataScope,
  body: Record<string, unknown>,
): Promise<FunnelPage> {
  const { leadMagnetId, libraryId, externalResourceId, targetType, slug, qualificationFormId, ...funnelData } = body as {
    leadMagnetId?: string; libraryId?: string; externalResourceId?: string;
    targetType?: string; slug?: string; qualificationFormId?: string;
    [key: string]: unknown;
  };

  if (!slug) throw Object.assign(new Error('slug is required'), { statusCode: 400 });

  const resolvedTargetType = targetType || (leadMagnetId ? 'lead_magnet' : libraryId ? 'library' : 'external_resource');

  // Plan limit check
  const limitCheck = await checkResourceLimit(scope, 'funnel_pages');
  if (!limitCheck.allowed) {
    throw Object.assign(new Error('Plan limit reached'), {
      statusCode: 403,
      current: limitCheck.current,
      limit: limitCheck.limit,
    });
  }

  // Validate + verify target ownership
  let targetTitle = 'Funnel';
  if (resolvedTargetType === 'lead_magnet') {
    if (!leadMagnetId) throw Object.assign(new Error('leadMagnetId is required'), { statusCode: 400 });
    const lm = await funnelsRepo.verifyLeadMagnetOwnership(scope.userId, leadMagnetId);
    if (!lm) throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
    targetTitle = lm.title;
    const exists = await funnelsRepo.checkFunnelExistsForTarget({ leadMagnetId });
    if (exists) throw Object.assign(new Error('Funnel page already exists for this lead magnet'), { statusCode: 409 });
  } else if (resolvedTargetType === 'library') {
    if (!libraryId) throw Object.assign(new Error('libraryId is required'), { statusCode: 400 });
    const lib = await funnelsRepo.verifyLibraryOwnership(scope.userId, libraryId);
    if (!lib) throw Object.assign(new Error('Library not found'), { statusCode: 404 });
    targetTitle = lib.name;
    const exists = await funnelsRepo.checkFunnelExistsForTarget({ libraryId });
    if (exists) throw Object.assign(new Error('Funnel page already exists for this library'), { statusCode: 409 });
  } else if (resolvedTargetType === 'external_resource') {
    if (!externalResourceId) throw Object.assign(new Error('externalResourceId is required'), { statusCode: 400 });
    const er = await funnelsRepo.verifyExternalResourceOwnership(scope.userId, externalResourceId);
    if (!er) throw Object.assign(new Error('External resource not found'), { statusCode: 404 });
    targetTitle = er.title;
    const exists = await funnelsRepo.checkFunnelExistsForTarget({ externalResourceId });
    if (exists) throw Object.assign(new Error('Funnel page already exists for this external resource'), { statusCode: 409 });
  }

  // User defaults + brand kit
  const [profile, brandKit] = await Promise.all([
    funnelsRepo.getUserFunnelDefaults(scope.userId),
    funnelsRepo.getBrandKit(scope),
  ]);

  // Slug collision resolution
  const slugSet = await funnelsRepo.findExistingSlug(scope.userId, slug);
  let finalSlug = slug;
  if (slugSet.has(slug)) {
    let suffix = 1;
    while (suffix <= 100 && slugSet.has(`${slug}-${suffix}`)) suffix++;
    if (suffix > 100) throw Object.assign(new Error('Unable to generate unique slug'), { statusCode: 409 });
    finalSlug = `${slug}-${suffix}`;
  }

  const row: Record<string, unknown> = {
    user_id: scope.userId,
    team_id: scope.teamId || null,
    slug: finalSlug,
    target_type: resolvedTargetType,
    lead_magnet_id: resolvedTargetType === 'lead_magnet' ? leadMagnetId : null,
    library_id: resolvedTargetType === 'library' ? libraryId : null,
    external_resource_id: resolvedTargetType === 'external_resource' ? externalResourceId : null,
    optin_headline: funnelData.optinHeadline || targetTitle,
    optin_subline: funnelData.optinSubline || null,
    optin_button_text: funnelData.optinButtonText || 'Get Free Access',
    optin_social_proof: funnelData.optinSocialProof || null,
    thankyou_headline: funnelData.thankyouHeadline || 'Thanks! Check your email.',
    thankyou_subline: funnelData.thankyouSubline || null,
    vsl_url: funnelData.vslUrl || profile?.default_vsl_url || null,
    calendly_url: funnelData.calendlyUrl || null,
    qualification_pass_message: funnelData.qualificationPassMessage || 'Great! Book a call below.',
    qualification_fail_message: funnelData.qualificationFailMessage || 'Thanks for your interest!',
    theme: funnelData.theme || brandKit?.default_theme || profile?.default_theme || 'dark',
    primary_color: funnelData.primaryColor || brandKit?.default_primary_color || profile?.default_primary_color || '#8b5cf6',
    background_style: funnelData.backgroundStyle || brandKit?.default_background_style || profile?.default_background_style || 'solid',
    logo_url: funnelsRepo.normalizeImageUrl(String(funnelData.logoUrl || brandKit?.logo_url || profile?.default_logo_url || '')) || null,
    font_family: brandKit?.font_family || null,
    font_url: brandKit?.font_url || null,
    qualification_form_id: qualificationFormId || null,
    send_resource_email: true,
  };

  const funnel = await funnelsRepo.createFunnel(row);

  // Auto-populate sections from template
  const templateId = profile?.default_funnel_template || DEFAULT_TEMPLATE_ID;
  const template = getTemplate(templateId);
  if (template.sections.length > 0) {
    const sectionRows = template.sections.map((s) => {
      let config = { ...s.config } as Record<string, unknown>;
      if (brandKit) {
        if (s.sectionType === 'logo_bar' && (brandKit.logos as unknown[])?.length > 0) config = { ...config, logos: brandKit.logos };
        if (s.sectionType === 'testimonial' && (brandKit.default_testimonial as { quote?: string })?.quote) config = { ...config, ...brandKit.default_testimonial };
        if (s.sectionType === 'steps' && (brandKit.default_steps as { steps?: unknown[] })?.steps?.length) config = { ...config, ...brandKit.default_steps };
      }
      return { funnel_page_id: funnel.id, section_type: s.sectionType, page_location: s.pageLocation, sort_order: s.sortOrder, is_visible: true as boolean, config };
    });
    try {
      await funnelsRepo.insertSections(sectionRows);
    } catch (err) {
      logApiError('funnels.service/createFunnel/sections', err, { funnelId: funnel.id });
    }
  }

  return funnel;
}

export async function updateFunnel(
  scope: DataScope,
  id: string,
  validated: Record<string, unknown>,
): Promise<FunnelPage> {
  const { updateFunnelSchema, validateBody } = await import('@/lib/validations/api');
  const validation = validateBody(validated, updateFunnelSchema);
  if (!validation.success) {
    throw Object.assign(new Error(validation.error), { statusCode: 400, details: validation.details });
  }
  const v = validation.data;

  // Verify qualificationFormId ownership if provided
  if (v.qualificationFormId) {
    const form = await funnelsRepo.getQualificationForm(scope, v.qualificationFormId);
    if (!form) throw Object.assign(new Error('Qualification form not found'), { statusCode: 404 });
  }

  // Check slug collision
  if (v.slug) {
    const collision = await funnelsRepo.checkSlugCollision(scope, v.slug, id);
    if (collision) throw Object.assign(new Error('A funnel with this slug already exists'), { statusCode: 409 });
  }

  const { normalizeImageUrl } = funnelsRepo;
  const updates: Record<string, unknown> = {};
  if (v.slug !== undefined) updates.slug = v.slug;
  if (v.optinHeadline !== undefined) updates.optin_headline = v.optinHeadline;
  if (v.optinSubline !== undefined) updates.optin_subline = v.optinSubline;
  if (v.optinButtonText !== undefined) updates.optin_button_text = v.optinButtonText;
  if (v.optinSocialProof !== undefined) updates.optin_social_proof = v.optinSocialProof;
  if (v.thankyouHeadline !== undefined) updates.thankyou_headline = v.thankyouHeadline;
  if (v.thankyouSubline !== undefined) updates.thankyou_subline = v.thankyouSubline;
  if (v.vslUrl !== undefined) updates.vsl_url = v.vslUrl;
  if (v.calendlyUrl !== undefined) updates.calendly_url = v.calendlyUrl;
  if (v.qualificationPassMessage !== undefined) updates.qualification_pass_message = v.qualificationPassMessage;
  if (v.qualificationFailMessage !== undefined) updates.qualification_fail_message = v.qualificationFailMessage;
  if (v.theme !== undefined) updates.theme = v.theme;
  if (v.primaryColor !== undefined) updates.primary_color = v.primaryColor;
  if (v.backgroundStyle !== undefined) updates.background_style = v.backgroundStyle;
  if (v.logoUrl !== undefined) updates.logo_url = v.logoUrl ? normalizeImageUrl(v.logoUrl as string) : v.logoUrl;
  if (v.qualificationFormId !== undefined) updates.qualification_form_id = v.qualificationFormId;
  if (v.redirectTrigger !== undefined) updates.redirect_trigger = v.redirectTrigger;
  if (v.redirectUrl !== undefined) updates.redirect_url = v.redirectUrl;
  if (v.redirectFailUrl !== undefined) updates.redirect_fail_url = v.redirectFailUrl;
  if (v.homepageUrl !== undefined) updates.homepage_url = v.homepageUrl;
  if (v.homepageLabel !== undefined) updates.homepage_label = v.homepageLabel;
  if (v.sendResourceEmail !== undefined) updates.send_resource_email = v.sendResourceEmail;

  return funnelsRepo.updateFunnel(scope, id, updates);
}

export async function deleteFunnel(scope: DataScope, id: string): Promise<void> {
  const funnelId = await funnelsRepo.assertFunnelAccess(scope, id);
  if (!funnelId) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });
  return funnelsRepo.deleteFunnel(scope, id);
}

// ─── Publish ───────────────────────────────────────────────────────────────

export async function publishFunnel(
  scope: DataScope,
  id: string,
  publish: boolean,
): Promise<{ funnel: FunnelPage; publicUrl: string | null }> {
  const funnel = await funnelsRepo.findFunnelForPublish(scope, id);
  if (!funnel) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });

  let cachedUsername: string | null = null;
  if (publish) {
    const username = await funnelsRepo.getUsernameById(scope.userId);
    if (!username) {
      throw Object.assign(
        new Error('You must set a username before publishing. Go to Settings to set your username.'),
        { statusCode: 400 },
      );
    }
    cachedUsername = username;

    if (!funnel.optin_headline) {
      throw Object.assign(new Error('Opt-in headline is required before publishing'), { statusCode: 400 });
    }

    // Lead magnet content guard
    if (funnel.lead_magnets) {
      const lm = await funnelsRepo.getLeadMagnetForPublish(scope.userId, (funnel.lead_magnets as { id: string }).id);
      const polishedLen = lm?.polished_content ? JSON.stringify(lm.polished_content).length : 0;
      if (!lm?.extracted_content && polishedLen < 3000) {
        throw Object.assign(
          new Error("This lead magnet doesn't have enough content to publish. Generate content first, then try again."),
          { statusCode: 400 },
        );
      }
      // Auto-polish on first publish
      if (lm?.extracted_content && !lm.polished_content && lm.concept) {
        try {
          const polished = await polishLeadMagnetContent(
            lm.extracted_content as ExtractedContent,
            lm.concept as LeadMagnetConcept,
            { formattingOnly: true },
          );
          await funnelsRepo.updateLeadMagnetPolished(lm.id, polished);
        } catch {
          throw Object.assign(
            new Error('Failed to prepare content for publishing. Please try again.'),
            { statusCode: 400 },
          );
        }
      }
    }
  }

  const updateData: Record<string, unknown> = { is_published: publish };
  if (publish && !funnel.published_at) updateData.published_at = new Date().toISOString();

  const updated = await funnelsRepo.updateFunnel(scope, id, updateData);

  const publicUrl = publish && cachedUsername
    ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/p/${cachedUsername}/${funnel.slug}`
    : null;

  if (publish) {
    try {
      getPostHogServerClient()?.capture({
        distinctId: scope.userId,
        event: 'funnel_published',
        properties: { funnel_id: id, slug: funnel.slug, has_public_url: !!publicUrl },
      });
    } catch {}
  }

  return { funnel: updated, publicUrl };
}

// ─── Sections ──────────────────────────────────────────────────────────────

export async function getSections(scope: DataScope, funnelId: string): Promise<FunnelPageSection[]> {
  const access = await funnelsRepo.assertFunnelAccess(scope, funnelId);
  if (!access) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });
  return funnelsRepo.findSections(funnelId);
}

export async function createSection(
  scope: DataScope,
  funnelId: string,
  body: Record<string, unknown>,
): Promise<FunnelPageSection> {
  const validation = validateBody(body, createSectionSchema);
  if (!validation.success) throw Object.assign(new Error(validation.error), { statusCode: 400 });

  const { sectionType, pageLocation, sortOrder, isVisible, config: rawConfig } = validation.data;

  const configSchema = sectionConfigSchemas[sectionType as keyof typeof sectionConfigSchemas];
  if (configSchema) {
    const cv = configSchema.safeParse(rawConfig);
    if (!cv.success) {
      throw Object.assign(
        new Error(`Invalid config for ${sectionType}: ${cv.error.issues[0]?.message}`),
        { statusCode: 400 },
      );
    }
  }

  const access = await funnelsRepo.assertFunnelAccess(scope, funnelId);
  if (!access) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });

  const finalSortOrder = sortOrder !== undefined
    ? sortOrder
    : await funnelsRepo.getMaxSortOrder(funnelId, pageLocation);

  return funnelsRepo.createSection({
    funnel_page_id: funnelId,
    section_type: sectionType,
    page_location: pageLocation,
    sort_order: finalSortOrder,
    is_visible: isVisible ?? true,
    config: rawConfig as Record<string, unknown>,
  });
}

export async function updateSection(
  scope: DataScope,
  funnelId: string,
  sectionId: string,
  body: Record<string, unknown>,
): Promise<FunnelPageSection> {
  const validation = validateBody(body, updateSectionSchema);
  if (!validation.success) throw Object.assign(new Error(validation.error), { statusCode: 400 });

  const access = await funnelsRepo.assertFunnelAccess(scope, funnelId);
  if (!access) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (validation.data.sortOrder !== undefined) update.sort_order = validation.data.sortOrder;
  if (validation.data.isVisible !== undefined) update.is_visible = validation.data.isVisible;
  if (validation.data.pageLocation !== undefined) update.page_location = validation.data.pageLocation;

  if (validation.data.config !== undefined) {
    const existingType = await funnelsRepo.getSectionType(sectionId, funnelId);
    if (existingType) {
      const configSchema = sectionConfigSchemas[existingType as keyof typeof sectionConfigSchemas];
      if (configSchema) {
        const cv = configSchema.safeParse(validation.data.config);
        if (!cv.success) {
          throw Object.assign(
            new Error(`Invalid config: ${cv.error.issues[0]?.message}`),
            { statusCode: 400 },
          );
        }
      }
      update.config = normalizeSectionConfigImageUrls(existingType, validation.data.config as Record<string, unknown>);
    } else {
      update.config = validation.data.config;
    }
  }

  return funnelsRepo.updateSection(sectionId, funnelId, update);
}

export async function deleteSection(
  scope: DataScope,
  funnelId: string,
  sectionId: string,
): Promise<void> {
  const access = await funnelsRepo.assertFunnelAccess(scope, funnelId);
  if (!access) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });
  return funnelsRepo.deleteSection(sectionId, funnelId);
}

export async function resetSections(
  scope: DataScope,
  funnelId: string,
  pageLocation: string,
): Promise<FunnelPageSection[]> {
  const access = await funnelsRepo.assertFunnelAccess(scope, funnelId);
  if (!access) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });

  const profile = await funnelsRepo.getUserFunnelDefaults(scope.userId);
  const template = getTemplate(profile?.default_funnel_template || DEFAULT_TEMPLATE_ID);

  await funnelsRepo.deleteSectionsByLocation(funnelId, pageLocation);

  const templateSections = template.sections.filter((s) => s.pageLocation === pageLocation);
  if (templateSections.length === 0) return [];

  const sectionRows = templateSections.map((s) => ({
    funnel_page_id: funnelId,
    section_type: s.sectionType,
    page_location: s.pageLocation,
    sort_order: s.sortOrder,
    is_visible: true as boolean,
    config: s.config as Record<string, unknown>,
  }));

  return funnelsRepo.insertSections(sectionRows);
}

// ─── Brand kit ─────────────────────────────────────────────────────────────

export async function reapplyBrandKit(userId: string, funnelPageId: string) {
  const supabase = createSupabaseAdminClient();

  // Verify user owns this funnel
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('id, user_id')
    .eq('id', funnelPageId)
    .eq('user_id', userId)
    .single();
  if (!funnel) throw Object.assign(new Error('Funnel not found'), { statusCode: 404 });

  const brandKit = await resolveBrandKit(supabase, userId);
  if (!brandKit) return { applied: [], values: {}, message: 'No brand kit found' };

  const applied: string[] = [];
  const funnelUpdate: Record<string, unknown> = {};
  const values: Record<string, unknown> = {};

  if (brandKit.default_theme) { funnelUpdate.theme = brandKit.default_theme; values.theme = brandKit.default_theme; applied.push('theme'); }
  if (brandKit.default_primary_color) { funnelUpdate.primary_color = brandKit.default_primary_color; values.primaryColor = brandKit.default_primary_color; applied.push('primary_color'); }
  if (brandKit.default_background_style) { funnelUpdate.background_style = brandKit.default_background_style; values.backgroundStyle = brandKit.default_background_style; applied.push('background_style'); }
  if (brandKit.logo_url) { funnelUpdate.logo_url = brandKit.logo_url; values.logoUrl = brandKit.logo_url; applied.push('logo_url'); }
  if (brandKit.font_family) { funnelUpdate.font_family = brandKit.font_family; applied.push('font_family'); }
  if (brandKit.font_url) { funnelUpdate.font_url = brandKit.font_url; applied.push('font_url'); }

  if (Object.keys(funnelUpdate).length > 0) {
    await supabase.from('funnel_pages').update(funnelUpdate).eq('id', funnelPageId);
  }

  const sections = await funnelsRepo.findSectionsRaw(funnelPageId);
  for (const section of sections) {
    let config = (section.config || {}) as Record<string, unknown>;
    let updated = false;

    if (section.section_type === 'logo_bar' && (brandKit.logos as unknown[])?.length > 0) { config = { ...config, logos: brandKit.logos }; updated = true; if (!applied.includes('logos')) applied.push('logos'); }
    if (section.section_type === 'testimonial' && (brandKit.default_testimonial as { quote?: string })?.quote) { config = { ...config, ...brandKit.default_testimonial }; updated = true; if (!applied.includes('testimonial')) applied.push('testimonial'); }
    if (section.section_type === 'steps' && (brandKit.default_steps as { steps?: unknown[] })?.steps?.length) { config = { ...config, ...brandKit.default_steps }; updated = true; if (!applied.includes('steps')) applied.push('steps'); }

    if (updated) await funnelsRepo.updateSectionConfig(section.id, config);
  }

  return { applied, values };
}

// ─── Questions ─────────────────────────────────────────────────────────────

export async function getQuestions(scope: DataScope, funnelId: string) {
  const funnel = await funnelsRepo.findFunnelFormId(scope, funnelId);
  if (!funnel) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });
  return funnelsRepo.findQuestionsForFunnel(funnelId, funnel.qualification_form_id ?? null);
}

const VALID_ANSWER_TYPES = ['yes_no', 'text', 'textarea', 'multiple_choice'] as const;
type AnswerType = typeof VALID_ANSWER_TYPES[number];

export async function createQuestion(
  scope: DataScope,
  funnelId: string,
  body: Record<string, unknown>,
): Promise<QualificationQuestion> {
  if (!body.questionText) throw Object.assign(new Error('questionText is required'), { statusCode: 400 });

  const answerType = (body.answerType || 'yes_no') as AnswerType;
  if (!VALID_ANSWER_TYPES.includes(answerType)) {
    throw Object.assign(new Error('answerType must be one of: yes_no, text, textarea, multiple_choice'), { statusCode: 400 });
  }
  if (answerType === 'multiple_choice' && (!Array.isArray(body.options) || (body.options as unknown[]).length < 2)) {
    throw Object.assign(new Error('multiple_choice questions require at least 2 options'), { statusCode: 400 });
  }

  const isQualifying = body.isQualifying ?? (answerType === 'yes_no');
  let qualifyingAnswer = null;
  if (isQualifying) {
    if (answerType === 'yes_no') {
      qualifyingAnswer = body.qualifyingAnswer || 'yes';
      if (qualifyingAnswer !== 'yes' && qualifyingAnswer !== 'no') {
        throw Object.assign(new Error('qualifyingAnswer must be "yes" or "no" for yes_no questions'), { statusCode: 400 });
      }
    } else if (answerType === 'multiple_choice') {
      qualifyingAnswer = body.qualifyingAnswer || null;
      if (qualifyingAnswer && !Array.isArray(qualifyingAnswer)) {
        throw Object.assign(new Error('qualifyingAnswer must be an array for multiple_choice questions'), { statusCode: 400 });
      }
    }
  }

  const access = await funnelsRepo.assertFunnelAccess(scope, funnelId);
  if (!access) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });

  const nextOrder = body.questionOrder !== undefined
    ? (body.questionOrder as number)
    : await funnelsRepo.getMaxQuestionOrder(funnelId);

  return funnelsRepo.createQuestion({
    funnel_page_id: funnelId,
    question_text: body.questionText,
    question_order: nextOrder,
    answer_type: answerType,
    qualifying_answer: qualifyingAnswer,
    options: answerType === 'multiple_choice' ? body.options : null,
    placeholder: body.placeholder || null,
    is_qualifying: isQualifying,
    is_required: body.isRequired ?? true,
  });
}

export async function updateQuestion(
  scope: DataScope,
  funnelId: string,
  questionId: string,
  body: Record<string, unknown>,
): Promise<QualificationQuestion> {
  const funnel = await funnelsRepo.findFunnelFormId(scope, funnelId);
  if (!funnel) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.questionText !== undefined) updateData.question_text = body.questionText;
  if (body.questionOrder !== undefined) updateData.question_order = body.questionOrder;
  if (body.answerType !== undefined) {
    if (!VALID_ANSWER_TYPES.includes(body.answerType as AnswerType)) {
      throw Object.assign(new Error('answerType must be one of: yes_no, text, textarea, multiple_choice'), { statusCode: 400 });
    }
    updateData.answer_type = body.answerType;
  }
  if (body.qualifyingAnswer !== undefined) updateData.qualifying_answer = body.qualifyingAnswer;
  if (body.options !== undefined) updateData.options = body.options;
  if (body.placeholder !== undefined) updateData.placeholder = body.placeholder;
  if (body.isQualifying !== undefined) updateData.is_qualifying = body.isQualifying;
  if (body.isRequired !== undefined) updateData.is_required = body.isRequired;

  if (Object.keys(updateData).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), { statusCode: 400 });
  }

  return funnelsRepo.updateQuestion(questionId, funnelId, funnel.qualification_form_id ?? null, updateData);
}

export async function deleteQuestion(
  scope: DataScope,
  funnelId: string,
  questionId: string,
): Promise<void> {
  const funnel = await funnelsRepo.findFunnelFormId(scope, funnelId);
  if (!funnel) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });
  return funnelsRepo.deleteQuestion(questionId, funnelId, funnel.qualification_form_id ?? null);
}

export async function reorderQuestions(
  scope: DataScope,
  funnelId: string,
  questionIds: string[],
): Promise<void> {
  const access = await funnelsRepo.assertFunnelAccess(scope, funnelId);
  if (!access) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });
  return funnelsRepo.reorderQuestions(questionIds, funnelId);
}

// ─── Stats ─────────────────────────────────────────────────────────────────

interface FunnelStats {
  total: number; qualified: number; unqualified: number; views: number; conversionRate: number; qualificationRate: number;
}

export async function getFunnelStats(scope: DataScope, userId: string): Promise<Record<string, FunnelStats>> {
  const funnelIds = await funnelsRepo.getFunnelIds(scope);
  if (funnelIds.length === 0) return {};

  const [leadsResult, viewsResult] = await Promise.all([
    funnelsRepo.getFunnelLeads(userId, funnelIds),
    funnelsRepo.getPageViews(funnelIds),
  ]);

  if (leadsResult.error) throw new Error(`Failed to fetch stats: ${leadsResult.error.message}`);

  const leadCounts = new Map<string, { total: number; qualified: number; unqualified: number }>();
  const viewCounts = new Map<string, number>();
  for (const id of funnelIds) { leadCounts.set(id, { total: 0, qualified: 0, unqualified: 0 }); viewCounts.set(id, 0); }

  for (const lead of leadsResult.data) {
    const c = leadCounts.get(lead.funnel_page_id);
    if (c) { c.total++; if (lead.is_qualified === true) c.qualified++; else if (lead.is_qualified === false) c.unqualified++; }
  }
  for (const view of viewsResult.data) {
    const c = viewCounts.get(view.funnel_page_id);
    if (c !== undefined) viewCounts.set(view.funnel_page_id, c + 1);
  }

  const stats: Record<string, FunnelStats> = {};
  for (const id of funnelIds) {
    const l = leadCounts.get(id)!;
    const v = viewCounts.get(id) || 0;
    stats[id] = {
      total: l.total, qualified: l.qualified, unqualified: l.unqualified, views: v,
      conversionRate: v > 0 ? Math.round((l.total / v) * 100) : 0,
      qualificationRate: l.total > 0 ? Math.round((l.qualified / l.total) * 100) : 0,
    };
  }
  return stats;
}

// ─── Generate content ──────────────────────────────────────────────────────

export async function generateFunnelContent(scope: DataScope, leadMagnetId: string, useAI = true) {
  const leadMagnet = await funnelsRepo.getLeadMagnetForContentGen(scope, leadMagnetId);
  if (!leadMagnet) throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });

  const brandKit = await funnelsRepo.getBrandKitForContentGen(scope);
  const credibility = (brandKit?.credibility_markers as string[] | null)?.join('. ') || undefined;

  if (useAI) {
    try {
      return await generateOptinContent({
        leadMagnetTitle: leadMagnet.title,
        concept: leadMagnet.concept as LeadMagnetConcept | null,
        extractedContent: leadMagnet.extracted_content as ExtractedContent | null,
        credibility,
      });
    } catch {
      return generateDefaultOptinContent(leadMagnet.title, leadMagnet.concept as LeadMagnetConcept | null);
    }
  }

  return generateDefaultOptinContent(leadMagnet.title, leadMagnet.concept as LeadMagnetConcept | null);
}

// ─── Integrations ──────────────────────────────────────────────────────────

export async function getFunnelIntegrations(userId: string, funnelPageId: string) {
  return funnelsRepo.findFunnelIntegrations(userId, funnelPageId);
}

export async function upsertFunnelIntegration(
  userId: string,
  funnelPageId: string,
  body: Record<string, unknown>,
) {
  const { provider, list_id, list_name, tag_id, tag_name, is_active, settings } = body;

  if (!provider || typeof provider !== 'string') {
    throw Object.assign(new Error('Provider is required'), { statusCode: 400 });
  }
  if (!isValidFunnelProvider(provider)) {
    throw Object.assign(new Error(`Invalid provider: ${provider}`), { statusCode: 400 });
  }
  if (isEmailMarketingProvider(provider) && (!list_id || typeof list_id !== 'string')) {
    throw Object.assign(new Error('List ID is required'), { statusCode: 400 });
  }

  // Verify funnel ownership
  const supabase = createSupabaseAdminClient();
  const { data: fp } = await supabase
    .from('funnel_pages')
    .select('id')
    .eq('id', funnelPageId)
    .eq('user_id', userId)
    .single();
  if (!fp) throw Object.assign(new Error('Funnel page not found'), { statusCode: 404 });

  return funnelsRepo.upsertFunnelIntegration({
    funnel_page_id: funnelPageId,
    user_id: userId,
    provider,
    list_id: (list_id as string) || 'n/a',
    list_name: (list_name as string) ?? null,
    tag_id: (tag_id as string) ?? null,
    tag_name: (tag_name as string) ?? null,
    is_active: (is_active as boolean) ?? true,
    settings: settings ?? null,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteFunnelIntegration(
  userId: string,
  funnelPageId: string,
  provider: string,
): Promise<void> {
  if (!isEmailMarketingProvider(provider)) {
    throw Object.assign(new Error(`Invalid provider: ${provider}`), { statusCode: 400 });
  }
  return funnelsRepo.deleteFunnelIntegration(userId, funnelPageId, provider);
}

// ─── Bulk creation ─────────────────────────────────────────────────────────

interface BulkResult {
  index: number; status: 'created' | 'failed'; id?: string; slug?: string; error?: string;
}

export async function bulkCreateFunnels(
  userId: string,
  pages: BulkPageItemInput[],
): Promise<{ created: number; failed: number; results: BulkResult[] }> {
  const profile = await funnelsRepo.getUserProfileForBulk(userId);
  if (!profile) throw new Error('Failed to load user profile');

  const results: BulkResult[] = [];
  let created = 0; let failed = 0;

  for (let i = 0; i < pages.length; i++) {
    try {
      const page = pages[i];
      const slug = page.slug || slugify(page.title).slice(0, 50);

      const { data: slugExists } = await (async () => {
        const supabase = createSupabaseAdminClient();
        return supabase.from('funnel_pages').select('id').eq('user_id', userId).eq('slug', slug).single();
      })();
      if (slugExists) { results.push({ index: i, status: 'failed', error: `Slug "${slug}" already exists` }); failed++; continue; }

      const lm = await funnelsRepo.createLeadMagnet({ user_id: userId, title: page.title, external_url: page.leadMagnetUrl, archetype: 'resource-list', status: 'published' });
      if (!lm) { results.push({ index: i, status: 'failed', error: 'Failed to create lead magnet' }); failed++; continue; }

      try {
        const supabase = createSupabaseAdminClient();
        const { data: fp } = await supabase.from('funnel_pages').insert({
          lead_magnet_id: lm.id, user_id: userId, slug,
          optin_headline: page.optinHeadline, optin_subline: page.optinSubline || null,
          optin_button_text: page.optinButtonText || 'Get It Now',
          thankyou_headline: page.thankyouHeadline || 'Thanks! Check your email.',
          thankyou_subline: page.thankyouSubline || null,
          vsl_url: profile.default_vsl_url || null,
          qualification_pass_message: 'Great! Book a call below.',
          qualification_fail_message: 'Thanks for your interest!',
          theme: profile.default_theme || 'dark',
          primary_color: profile.default_primary_color || '#8b5cf6',
          background_style: profile.default_background_style || 'solid',
          logo_url: profile.default_logo_url || null,
          is_published: page.autoPublish === true,
          published_at: page.autoPublish === true ? new Date().toISOString() : null,
        }).select('id, slug').single();
        if (!fp) { await funnelsRepo.deleteLeadMagnet(lm.id); results.push({ index: i, status: 'failed', error: 'Failed to create funnel page' }); failed++; continue; }
        results.push({ index: i, status: 'created', id: fp.id, slug: fp.slug });
        created++;
      } catch {
        await funnelsRepo.deleteLeadMagnet(lm.id);
        results.push({ index: i, status: 'failed', error: 'Unexpected error' }); failed++;
      }
    } catch {
      results.push({ index: i, status: 'failed', error: 'Unexpected error' }); failed++;
    }
  }

  return { created, failed, results };
}

// ─── Error helper ──────────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) return (err as { statusCode: number }).statusCode;
  return 500;
}
