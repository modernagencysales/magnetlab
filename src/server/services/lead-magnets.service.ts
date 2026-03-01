/**
 * Lead Magnets Service
 * Business logic for lead_magnets — CRUD, AI generation, polishing,
 * screenshots, background jobs, import.
 * Never imports from Next.js HTTP layer.
 */

import * as leadMagnetsRepo from '@/server/repositories/lead-magnets.repo';
import { checkResourceLimit } from '@/lib/auth/plan-limits';
import { getPostHogServerClient } from '@/lib/posthog';
import { validateBody, createLeadMagnetSchema, updateContentBodySchema, spreadsheetImportSchema } from '@/lib/validations/api';
import { tasks } from '@trigger.dev/sdk/v3';
import { logApiError } from '@/lib/api/errors';
import {
  getExtractionQuestions,
  getContextAwareExtractionQuestions,
  processContentExtraction,
  analyzeCompetitorContent,
  analyzeCallTranscript as aiAnalyzeCallTranscript,
  polishLeadMagnetContent,
} from '@/lib/ai/lead-magnet-generator';
import { generateFullContent } from '@/lib/ai/generate-lead-magnet-content';
import { getRelevantContext } from '@/lib/services/knowledge-brain';
import { captureAndClassifyEdit } from '@/lib/services/edit-capture';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateContentScreenshots, closeScreenshotBrowser } from '@/lib/services/screenshot';
import { parseSpreadsheet } from '@/lib/utils/spreadsheet-parser';
import { generateCalculatorFromSpreadsheet } from '@/lib/ai/interactive-generators';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import type { DataScope } from '@/lib/utils/team-context';
import type {
  LeadMagnetConcept,
  LeadMagnetArchetype,
  ExtractedContent,
  PolishedContent,
  PolishedSection,
  ScreenshotUrl,
  BusinessContext,
  CallTranscriptInsights,
  CompetitorAnalysis,
  PostWriterInput,
} from '@/lib/types/lead-magnet';
import type { IdeationJobInput, CreateJobResponse } from '@/lib/types/background-jobs';

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listLeadMagnets(
  scope: DataScope,
  opts: { status?: string | null; limit?: number; offset?: number },
) {
  const { data, count } = await leadMagnetsRepo.findLeadMagnets(scope, opts);
  return { leadMagnets: data, total: count, limit: opts.limit ?? 50, offset: opts.offset ?? 0 };
}

export async function getLeadMagnetById(scope: DataScope, id: string) {
  return leadMagnetsRepo.findLeadMagnetById(scope, id);
}

export async function createLeadMagnet(scope: DataScope, body: Record<string, unknown>) {
  const limitCheck = await checkResourceLimit(scope, 'lead_magnets');
  if (!limitCheck.allowed) {
    throw Object.assign(new Error('Plan limit reached'), {
      statusCode: 403,
      current: limitCheck.current,
      limit: limitCheck.limit,
    });
  }

  const validation = validateBody(body, createLeadMagnetSchema);
  if (!validation.success) {
    throw Object.assign(new Error(validation.error), { statusCode: 400, details: validation.details });
  }

  const v = validation.data;
  const data = await leadMagnetsRepo.createLeadMagnet(scope.userId, scope.teamId ?? null, {
    title: v.title,
    archetype: v.archetype,
    concept: v.concept,
    extracted_content: v.extractedContent,
    interactive_config: v.interactiveConfig,
    linkedin_post: v.linkedinPost,
    post_variations: v.postVariations,
    dm_template: v.dmTemplate,
    cta_word: v.ctaWord,
    status: 'draft',
  });

  try {
    getPostHogServerClient()?.capture({
      distinctId: scope.userId,
      event: 'lead_magnet_created',
      properties: { lead_magnet_id: data.id, title: v.title, archetype: v.archetype },
    });
  } catch {}

  return data;
}

export async function updateLeadMagnet(scope: DataScope, id: string, body: Record<string, unknown>) {
  // Strip immutable fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, user_id: _userId, team_id: _teamId, created_at: _createdAt, ...updates } = body;
  return leadMagnetsRepo.updateLeadMagnet(scope, id, updates);
}

export async function deleteLeadMagnet(scope: DataScope, id: string): Promise<void> {
  const existing = await leadMagnetsRepo.findLeadMagnetById(scope, id);
  if (!existing) throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
  return leadMagnetsRepo.deleteLeadMagnetWithCascade(scope, id);
}

// ─── Catalog fields ──────────────────────────────────────────────────────────

export async function updateCatalogFields(
  userId: string,
  id: string,
  body: { pain_point?: string; target_audience?: string; short_description?: string },
): Promise<void> {
  const magnet = await leadMagnetsRepo.findLeadMagnetByOwner(userId, id);
  if (!magnet) throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
  if (magnet.user_id !== userId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

  const updates: Record<string, string | null> = {};
  if ('pain_point' in body) updates.pain_point = body.pain_point?.trim() || null;
  if ('target_audience' in body) updates.target_audience = body.target_audience?.trim() || null;
  if ('short_description' in body) updates.short_description = body.short_description?.trim() || null;

  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error('No fields to update'), { statusCode: 400 });
  }

  await leadMagnetsRepo.updateLeadMagnetByOwner(userId, id, updates);
}

// ─── Content update (in-place editing) ──────────────────────────────────────

export async function updatePolishedContent(
  scope: DataScope,
  id: string,
  body: Record<string, unknown>,
): Promise<{ polishedContent: unknown }> {
  const validation = validateBody(body, updateContentBodySchema);
  if (!validation.success) {
    throw Object.assign(new Error(validation.error), { statusCode: 400, details: validation.details });
  }

  const polishedContent = validation.data.polishedContent as unknown as PolishedContent;

  // Recalculate word count metadata
  let wordCount = 0;
  for (const section of polishedContent.sections) {
    wordCount += (section.introduction || '').split(/\s+/).filter(Boolean).length;
    wordCount += (section.keyTakeaway || '').split(/\s+/).filter(Boolean).length;
    for (const block of section.blocks) {
      if (block.content) wordCount += block.content.split(/\s+/).length;
    }
  }
  wordCount += (polishedContent.heroSummary || '').split(/\s+/).filter(Boolean).length;
  polishedContent.metadata = {
    wordCount,
    readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
  };

  // Fetch current content for edit diff (before update)
  const currentData = await leadMagnetsRepo.findLeadMagnetScoped(scope, id, 'polished_content');
  const oldContent = currentData?.polished_content as PolishedContent | null;

  const result = await leadMagnetsRepo.updateLeadMagnetWithSelect(
    scope,
    id,
    { polished_content: polishedContent },
    'polished_content',
  );

  // Edit capture fire-and-forget (team only)
  if (oldContent && scope.teamId) {
    const supabase = createSupabaseAdminClient();
    const teamId = scope.teamId;

    if (oldContent.heroSummary && polishedContent.heroSummary) {
      captureAndClassifyEdit(supabase, {
        teamId, profileId: null, contentType: 'lead_magnet', contentId: id,
        fieldName: 'heroSummary', originalText: oldContent.heroSummary, editedText: polishedContent.heroSummary,
      }).catch(() => {});
    }

    const oldSections = oldContent.sections || [];
    const newSections = polishedContent.sections || [];
    for (let i = 0; i < newSections.length; i++) {
      const oldSection: PolishedSection | undefined = oldSections[i];
      const newSection = newSections[i];
      if (!oldSection) continue;

      if (oldSection.introduction && newSection.introduction) {
        captureAndClassifyEdit(supabase, {
          teamId, profileId: null, contentType: 'lead_magnet', contentId: id,
          fieldName: `section_${i}_introduction`, originalText: oldSection.introduction, editedText: newSection.introduction,
        }).catch(() => {});
      }
      if (oldSection.keyTakeaway && newSection.keyTakeaway) {
        captureAndClassifyEdit(supabase, {
          teamId, profileId: null, contentType: 'lead_magnet', contentId: id,
          fieldName: `section_${i}_keyTakeaway`, originalText: oldSection.keyTakeaway, editedText: newSection.keyTakeaway,
        }).catch(() => {});
      }
      const oldBlocks = oldSection.blocks || [];
      const newBlocks = newSection.blocks || [];
      for (let j = 0; j < newBlocks.length; j++) {
        const oldBlock = oldBlocks[j];
        const newBlock = newBlocks[j];
        if (oldBlock?.content && newBlock?.content) {
          captureAndClassifyEdit(supabase, {
            teamId, profileId: null, contentType: 'lead_magnet', contentId: id,
            fieldName: `section_${i}_block_${j}_content`, originalText: oldBlock.content, editedText: newBlock.content,
          }).catch(() => {});
        }
      }
    }
  }

  return { polishedContent: result?.polished_content };
}

// ─── Generate content (concept → extracted → polished) ──────────────────────

export async function generateAndPolishContent(scope: DataScope, id: string) {
  const leadMagnet = await leadMagnetsRepo.findLeadMagnetScoped(scope, id, 'id, title, concept, user_id');
  if (!leadMagnet) throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
  if (!leadMagnet.concept) {
    throw Object.assign(new Error('Lead magnet has no concept — cannot generate content'), { statusCode: 400 });
  }

  const concept = leadMagnet.concept as LeadMagnetConcept;

  let knowledgeContext = '';
  try {
    const searchQuery = `${leadMagnet.title} ${concept.painSolved || ''} ${concept.contents || ''}`;
    const knowledge = await getRelevantContext(leadMagnet.user_id, searchQuery, 15);
    if (knowledge.entries.length > 0) {
      knowledgeContext = knowledge.entries.map((e) => `[${e.category}] ${e.content}`).join('\n\n');
    }
  } catch {}

  const extractedContent = await generateFullContent(leadMagnet.title, concept, knowledgeContext);

  await leadMagnetsRepo.updateLeadMagnetNoReturn(scope, id, { extracted_content: extractedContent });

  const polishedContent = await polishLeadMagnetContent(extractedContent, concept);
  const polishedAt = new Date().toISOString();

  try {
    await leadMagnetsRepo.updateLeadMagnetNoReturn(scope, id, { polished_content: polishedContent, polished_at: polishedAt });
  } catch (err) {
    logApiError('lead-magnets.service/generateAndPolishContent/savePolished', err, { id });
    // extractedContent was already saved — partial success is OK
  }

  try {
    getPostHogServerClient()?.capture({
      distinctId: scope.userId,
      event: 'content_generated_and_polished',
      properties: { lead_magnet_id: id },
    });
  } catch {}

  return { extractedContent, polishedContent, polishedAt };
}

// ─── Polish content (extracted → polished) ──────────────────────────────────

export async function polishContent(scope: DataScope, id: string) {
  const leadMagnet = await leadMagnetsRepo.findLeadMagnetScoped(scope, id, 'id, extracted_content, concept, user_id');
  if (!leadMagnet) throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
  if (!leadMagnet.extracted_content) {
    throw Object.assign(new Error('Lead magnet has no extracted content to polish'), { statusCode: 400 });
  }
  if (!leadMagnet.concept) {
    throw Object.assign(new Error('Lead magnet has no concept'), { statusCode: 400 });
  }

  const extractedContent = leadMagnet.extracted_content as ExtractedContent;
  const concept = leadMagnet.concept as LeadMagnetConcept;

  const polishedContent = await polishLeadMagnetContent(extractedContent, concept);
  const polishedAt = new Date().toISOString();

  await leadMagnetsRepo.updateLeadMagnetNoReturn(scope, id, {
    polished_content: polishedContent,
    polished_at: polishedAt,
  });

  try {
    getPostHogServerClient()?.capture({
      distinctId: scope.userId,
      event: 'content_polished',
      properties: { lead_magnet_id: id },
    });
  } catch {}

  return { polishedContent, polishedAt };
}

// ─── Screenshots ─────────────────────────────────────────────────────────────

export async function generateScreenshots(scope: DataScope, userId: string, id: string) {
  const leadMagnet = await leadMagnetsRepo.findLeadMagnetScoped(
    scope,
    id,
    'id, user_id, polished_content, interactive_config, extracted_content',
  );
  if (!leadMagnet) throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });

  const polishedContent = leadMagnet.polished_content as PolishedContent | null;
  const hasPolished = !!polishedContent?.sections?.length;
  const hasInteractive = !!leadMagnet.interactive_config;
  const hasExtracted = !!leadMagnet.extracted_content;

  if (!hasPolished && !hasInteractive && !hasExtracted) {
    throw Object.assign(
      new Error('No content available to screenshot. Create content or an interactive tool first.'),
      { statusCode: 400 },
    );
  }

  const funnelPage = await leadMagnetsRepo.findPublishedFunnelPage(id);
  if (!funnelPage) {
    throw Object.assign(
      new Error('No published funnel page found for this lead magnet. Publish a funnel page first.'),
      { statusCode: 400 },
    );
  }

  const username = await leadMagnetsRepo.getUsernameByUserId(funnelPage.user_id);
  if (!username) {
    throw Object.assign(
      new Error('Username not set. Go to Settings to set your username before generating screenshots.'),
      { statusCode: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://magnetlab.ai';
  const pageUrl = `${appUrl}/p/${username}/${funnelPage.slug}/content`;
  const sectionCount = hasPolished ? polishedContent!.sections.length : 0;

  let screenshotResults;
  try {
    screenshotResults = await generateContentScreenshots({ pageUrl, sectionCount });
  } finally {
    await closeScreenshotBrowser();
  }

  const screenshotUrls: ScreenshotUrl[] = [];
  for (const result of screenshotResults) {
    const prefix = result.type === 'hero' ? 'hero' : `section-${result.sectionIndex}`;
    const [url1200, url1080] = await Promise.all([
      leadMagnetsRepo.uploadScreenshotToStorage(userId, id, prefix, '1200x627', result.buffer1200x627),
      leadMagnetsRepo.uploadScreenshotToStorage(userId, id, prefix, '1080x1080', result.buffer1080x1080),
    ]);
    screenshotUrls.push({
      type: result.type,
      sectionIndex: result.sectionIndex,
      sectionName: result.sectionName,
      url1200x627: url1200,
      url1080x1080: url1080,
    });
  }

  await leadMagnetsRepo.updateLeadMagnetNoReturn(scope, id, { screenshot_urls: screenshotUrls });
  return { screenshotUrls };
}

// ─── AI helpers (minimal DB) ─────────────────────────────────────────────────

export async function analyzeCompetitor(userId: string, content: string) {
  let businessContext: BusinessContext | undefined;
  try {
    const brandKit = await leadMagnetsRepo.getBrandKitByUserId(userId);
    if (brandKit) {
      businessContext = {
        businessDescription: brandKit.business_description || '',
        businessType: brandKit.business_type || 'coach-consultant',
        credibilityMarkers: brandKit.credibility_markers || [],
        urgentPains: brandKit.urgent_pains || [],
        templates: brandKit.templates || [],
        processes: brandKit.processes || [],
        tools: brandKit.tools || [],
        frequentQuestions: brandKit.frequent_questions || [],
        results: brandKit.results || [],
        successExample: brandKit.success_example,
      };
    }
  } catch {}
  const analysis = await analyzeCompetitorContent(content, businessContext);
  return { analysis };
}

export async function analyzeTranscript(transcript: string) {
  const insights = await aiAnalyzeCallTranscript(transcript);
  return { insights };
}

// ─── Extraction ──────────────────────────────────────────────────────────────

export function getExtractionQuestionsForArchetype(archetype: LeadMagnetArchetype) {
  return { questions: getExtractionQuestions(archetype) };
}

export async function getContextualQuestions(
  archetype: LeadMagnetArchetype,
  concept: LeadMagnetConcept,
  businessContext: BusinessContext,
) {
  const questions = await getContextAwareExtractionQuestions(archetype, concept, businessContext);
  return { questions };
}

export async function startExtraction(
  userId: string,
  body: Record<string, unknown>,
): Promise<CreateJobResponse> {
  const { archetype, concept, answers, transcriptInsights, businessContext, leadMagnetId } = body;

  if (!archetype || !concept || !answers) {
    throw Object.assign(new Error('Missing required fields: archetype, concept, answers'), { statusCode: 400 });
  }

  if (leadMagnetId) {
    const valid = await leadMagnetsRepo.findLeadMagnetByOwner(userId, leadMagnetId as string);
    if (!valid || valid.user_id !== userId) {
      throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
    }
  }

  const jobInput = {
    archetype,
    concept,
    answers,
    transcriptInsights,
    ...(body.action === 'generate-interactive' ? { action: 'generate-interactive' as const, businessContext } : {}),
  };

  const job = await leadMagnetsRepo.createBackgroundJob(userId, 'extraction', jobInput);

  const handle = await tasks.trigger('extract-content', {
    jobId: job.id,
    userId,
    leadMagnetId: (leadMagnetId as string) || null,
    input: jobInput,
  });

  await leadMagnetsRepo.updateJobTriggerId(job.id, handle.id);

  return { jobId: job.id, status: 'pending' };
}

export async function generateFromExtraction(
  userId: string,
  body: {
    archetype: LeadMagnetArchetype;
    concept: LeadMagnetConcept;
    answers: Record<string, string>;
    leadMagnetId?: string;
  },
) {
  const { archetype, concept, answers, leadMagnetId } = body;
  if (!archetype || !concept || !answers) {
    throw Object.assign(new Error('Missing required fields: archetype, concept, and answers'), { statusCode: 400 });
  }
  const extractedContent = await processContentExtraction(archetype, concept, answers);

  if (leadMagnetId) {
    await leadMagnetsRepo.updateLeadMagnetByOwner(userId, leadMagnetId, {
      generated_content: extractedContent,
      updated_at: new Date().toISOString(),
    });
  }

  return extractedContent;
}

// ─── Ideation ────────────────────────────────────────────────────────────────

interface IdeateRequestBody extends BusinessContext {
  sources?: {
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  };
}

export async function startIdeation(userId: string, body: IdeateRequestBody): Promise<CreateJobResponse> {
  const { sources, ...context } = body;

  if (!context.businessDescription || !context.businessType) {
    throw Object.assign(new Error('Missing required fields: businessDescription and businessType'), { statusCode: 400 });
  }

  // Check usage limits
  try {
    const supabase = createSupabaseAdminClient();
    const { data: canCreate, error: rpcError } = await supabase.rpc('check_usage_limit', {
      p_user_id: userId,
      p_limit_type: 'lead_magnets',
    });
    if (rpcError) {
      logApiError('lead-magnets.service/startIdeation/usage-check', rpcError, { userId });
    } else if (canCreate === false) {
      throw Object.assign(
        new Error('Monthly lead magnet limit reached. Upgrade your plan for more.'),
        { statusCode: 429 },
      );
    }
  } catch (err) {
    // If it's our own statusCode error, rethrow
    if (err && typeof err === 'object' && 'statusCode' in err) throw err;
    logApiError('lead-magnets.service/startIdeation/usage-check', err, { userId, note: 'RPC unavailable' });
  }

  // Save business context to brand_kit (non-critical)
  try {
    await leadMagnetsRepo.upsertBrandKit(userId, {
      business_description: context.businessDescription,
      business_type: context.businessType,
      credibility_markers: context.credibilityMarkers,
      urgent_pains: context.urgentPains,
      templates: context.templates,
      processes: context.processes,
      tools: context.tools,
      frequent_questions: context.frequentQuestions,
      results: context.results,
      success_example: context.successExample,
    });
  } catch (saveError) {
    logApiError('lead-magnets.service/startIdeation/save-brand-kit', saveError, { userId });
  }

  const jobInput: IdeationJobInput = {
    businessContext: {
      businessDescription: context.businessDescription,
      businessType: context.businessType,
      credibilityMarkers: context.credibilityMarkers || [],
      urgentPains: context.urgentPains || [],
      templates: context.templates || [],
      processes: context.processes || [],
      tools: context.tools || [],
      frequentQuestions: context.frequentQuestions || [],
      results: context.results || [],
      successExample: context.successExample,
    },
    sources: sources ? {
      callTranscriptInsights: sources.callTranscriptInsights,
      competitorAnalysis: sources.competitorAnalysis,
    } : undefined,
  };

  const job = await leadMagnetsRepo.createBackgroundJob(userId, 'ideation', jobInput);
  const handle = await tasks.trigger('ideate-lead-magnet', { jobId: job.id, userId, input: jobInput });
  await leadMagnetsRepo.updateJobTriggerId(job.id, handle.id);

  return { jobId: job.id, status: 'pending' };
}

// ─── Write post ──────────────────────────────────────────────────────────────

export async function startWritePost(
  userId: string,
  input: PostWriterInput,
  leadMagnetId?: string,
): Promise<CreateJobResponse> {
  if (!input.leadMagnetTitle || !input.contents || !input.problemSolved) {
    throw Object.assign(
      new Error('Missing required fields: leadMagnetTitle, contents, problemSolved'),
      { statusCode: 400 },
    );
  }

  if (leadMagnetId) {
    const lm = await leadMagnetsRepo.findLeadMagnetByOwner(userId, leadMagnetId);
    if (!lm || lm.user_id !== userId) {
      throw Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
    }
  }

  const job = await leadMagnetsRepo.createBackgroundJob(userId, 'posts', input);
  const handle = await tasks.trigger('write-posts', {
    jobId: job.id,
    userId,
    leadMagnetId: leadMagnetId || null,
    input,
  });
  await leadMagnetsRepo.updateJobTriggerId(job.id, handle.id);

  return { jobId: job.id, status: 'pending' };
}

// ─── Import ───────────────────────────────────────────────────────────────────

interface ImportedContent {
  title: string;
  headline: string;
  subline: string;
  socialProof: string;
  painSolved: string;
  format: string;
}

async function extractFromContent(content: string, url?: string): Promise<ImportedContent> {
  const client = createAnthropicClient('lead-magnet-import', { timeout: 30_000 });
  const prompt = `You are analyzing a lead magnet or offer description to extract key marketing elements.

${url ? `URL provided: ${url}` : ''}

CONTENT TO ANALYZE:
${content}

Extract the following and return as JSON:
1. title: The name/title of the lead magnet (concise, catchy)
2. headline: A compelling opt-in page headline that makes people want to download (focus on the outcome/benefit)
3. subline: A supporting line that adds specificity or urgency (1-2 sentences)
4. socialProof: A line about who this is for or social proof element (e.g., "Join 500+ marketers" or "Perfect for coaches who...")
5. painSolved: The main pain point or problem this solves (1 sentence)
6. format: The format of the lead magnet (PDF, Checklist, Template, Guide, Video, etc.)

If any element isn't clear from the content, make a reasonable inference based on the context.

Return ONLY valid JSON in this exact format:
{
  "title": "...",
  "headline": "...",
  "subline": "...",
  "socialProof": "...",
  "painSolved": "...",
  "format": "..."
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });
  const textContent = response.content.find((b) => b.type === 'text');
  if (!textContent || textContent.type !== 'text') throw new Error('No text response from Claude');
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]) as ImportedContent;
  return JSON.parse(textContent.text) as ImportedContent;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

async function buildFunnelPage(
  scope: DataScope,
  userId: string,
  leadMagnetId: string,
  title: string,
  headline: string,
  subline: string,
  socialProof: string,
  format: string,
): Promise<{ id: string }> {
  let slug = generateSlug(title);
  let suffix = 0;
  while (await leadMagnetsRepo.checkSlugExists(scope, slug)) {
    suffix++;
    slug = `${generateSlug(title)}-${suffix}`;
  }

  try {
    return await leadMagnetsRepo.createFunnelPageWithRetry({
      lead_magnet_id: leadMagnetId,
      user_id: userId,
      team_id: scope.teamId ?? null,
      slug,
      optin_headline: headline,
      optin_subline: subline,
      optin_button_text: 'Get Free Access',
      optin_social_proof: socialProof,
      thankyou_headline: 'Thanks! Check your email.',
      thankyou_subline: `Your ${format || 'calculator'} is ready.`,
      qualification_pass_message: 'Great! Book a call below.',
      qualification_fail_message: 'Thanks for your interest!',
      theme: 'dark',
      primary_color: '#8b5cf6',
      background_style: 'solid',
    });
  } catch (err) {
    // Roll back LM creation on failure
    await leadMagnetsRepo.deleteLeadMagnetById(leadMagnetId).catch(() => {});
    throw err;
  }
}

export async function importLeadMagnet(scope: DataScope, userId: string, body: Record<string, unknown>) {
  // Spreadsheet import path
  if (body.importType === 'spreadsheet') {
    const validation = validateBody(body, spreadsheetImportSchema);
    if (!validation.success) {
      throw Object.assign(new Error(validation.error), { statusCode: 400, details: validation.details });
    }

    let parsed;
    try {
      parsed = parseSpreadsheet(validation.data.spreadsheetData);
    } catch (parseError) {
      throw Object.assign(
        new Error(parseError instanceof Error ? parseError.message : 'Failed to parse spreadsheet data'),
        { statusCode: 400 },
      );
    }

    let interactiveConfig;
    try {
      interactiveConfig = await generateCalculatorFromSpreadsheet(parsed, {
        title: validation.data.title,
        description: validation.data.description,
      });
    } catch {
      throw Object.assign(new Error('Failed to generate calculator from spreadsheet'), { statusCode: 502 });
    }

    const calcTitle = interactiveConfig.headline || validation.data.title || 'Imported Calculator';
    const leadMagnet = await leadMagnetsRepo.createLeadMagnetSelect(
      userId,
      scope.teamId ?? null,
      {
        title: calcTitle,
        archetype: 'single-calculator',
        status: 'draft',
        concept: {
          title: calcTitle,
          archetypeName: 'The Single Calculator',
          painSolved: interactiveConfig.description || 'Calculate your key metrics',
          deliveryFormat: 'Calculator',
          contents: interactiveConfig.description || '',
          isImported: true,
        },
        interactive_config: interactiveConfig,
      },
      'id, title',
    );

    const funnelPage = await buildFunnelPage(
      scope,
      userId,
      leadMagnet.id,
      calcTitle,
      interactiveConfig.headline || 'Try Our Calculator',
      interactiveConfig.description || 'Get instant results',
      'Built from real spreadsheet calculations',
      'Calculator',
    );

    return {
      success: true,
      leadMagnetId: leadMagnet.id,
      funnelPageId: funnelPage.id,
      archetype: 'single-calculator',
      interactiveConfig,
    };
  }

  // Text/URL import path
  const { url, content } = body as { url?: string; content?: string };
  if (!url && !content) {
    throw Object.assign(new Error('Please provide either a URL or content to import'), { statusCode: 400 });
  }

  let analysisContent = '';
  if (url) analysisContent += `URL: ${url}\n\n`;
  if (content) analysisContent += content;

  const extracted = await extractFromContent(analysisContent.trim(), url);

  const leadMagnet = await leadMagnetsRepo.createLeadMagnetSelect(
    userId,
    scope.teamId ?? null,
    {
      title: extracted.title,
      archetype: 'focused-toolkit',
      status: 'draft',
      concept: {
        title: extracted.title,
        painSolved: extracted.painSolved,
        deliveryFormat: extracted.format,
        isImported: true,
      },
    },
    'id, title',
  );

  const funnelPage = await buildFunnelPage(
    scope,
    userId,
    leadMagnet.id,
    extracted.title,
    extracted.headline,
    extracted.subline,
    extracted.socialProof,
    extracted.format,
  );

  return { success: true, leadMagnetId: leadMagnet.id, funnelPageId: funnelPage.id, extracted };
}

// ─── Error helper ─────────────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) return (err as { statusCode: number }).statusCode;
  return 500;
}
