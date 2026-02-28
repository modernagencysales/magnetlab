/**
 * External API Service
 * Service-to-service auth (userId from context). All DB via repos.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { resolveBrandKit, type BrandKit } from '@/lib/api/resolve-brand-kit';
import { logApiError } from '@/lib/api/errors';
import * as leadMagnetsRepo from '@/server/repositories/lead-magnets.repo';
import * as userRepo from '@/server/repositories/user.repo';
import * as teamRepo from '@/server/repositories/team.repo';
import * as subscriptionRepo from '@/server/repositories/subscription.repo';
import * as funnelsRepo from '@/server/repositories/funnels.repo';
import * as cpTranscriptsRepo from '@/server/repositories/cp-transcripts.repo';
import * as postsRepo from '@/server/repositories/posts.repo';
import * as knowledgeRepo from '@/server/repositories/knowledge.repo';
import { createLeadMagnetPipeline } from '@/trigger/create-lead-magnet';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';
import type { LeadMagnetArchetype } from '@/lib/types/lead-magnet';
import OpenAI from 'openai';
import { generateQuizQuestions } from '@/lib/ai/content-pipeline/quiz-generator';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';
import { reviewPosts, type ReviewablePost } from '@/lib/ai/content-pipeline/content-reviewer';
import * as qualificationFormsRepo from '@/server/repositories/qualification-forms.repo';
import * as brandKitRepo from '@/server/repositories/brand-kit.repo';
import { normalizeImageUrl } from '@/lib/utils/normalize-image-url';
import { polishLeadMagnetContent } from '@/lib/ai/lead-magnet-generator';
import { processContentExtraction, generatePostVariations, generateLeadMagnetIdeasParallel } from '@/lib/ai/lead-magnet-generator';
import type { ExtractedContent, LeadMagnetConcept, PostWriterInput } from '@/lib/types/lead-magnet';

/** List lead magnets for external API. */
export async function listLeadMagnets(
  userId: string,
  opts: { status?: string | null; limit?: number; offset?: number }
) {
  try {
    const { data, count } = await leadMagnetsRepo.findLeadMagnetsByUserId(userId, {
      status: opts.status ?? undefined,
      limit: opts.limit ?? 50,
      offset: opts.offset ?? 0,
    });
    return { success: true as const, leadMagnets: data, total: count, limit: opts.limit ?? 50, offset: opts.offset ?? 0 };
  } catch (error) {
    logApiError('external/lead-magnets/list', error, { userId });
    return { success: false as const, error: 'database' as const };
  }
}

/** Get one lead magnet by id for external API. */
export async function getLeadMagnet(userId: string, id: string) {
  try {
    const data = await leadMagnetsRepo.findLeadMagnetByIdAndUser(id, userId);
    if (!data) return { success: false as const, error: 'not_found' as const };
    return { success: true as const, leadMagnet: data };
  } catch (error) {
    logApiError('external/lead-magnets/get', error, { userId, id });
    return { success: false as const, error: 'database' as const };
  }
}

/** Create lead magnet for external API (with usage limit check). */
export async function createLeadMagnetExternal(
  userId: string,
  body: Record<string, unknown>
) {
  try {
    const { data: canCreate, error: rpcError } = await leadMagnetsRepo.checkUsageLimitRpc(
      userId,
      'lead_magnets'
    );
    if (rpcError) {
      logApiError('external/lead-magnets/usage-check', rpcError, { userId });
    } else if (canCreate === false) {
      return { success: false as const, error: 'usage_limit' as const };
    }

    const data = await leadMagnetsRepo.createLeadMagnet(userId, null, {
      title: body.title as string,
      archetype: body.archetype as string,
      concept: body.concept,
      extracted_content: body.extractedContent,
      linkedin_post: body.linkedinPost,
      post_variations: body.postVariations,
      dm_template: body.dmTemplate,
      cta_word: body.ctaWord,
      status: 'draft',
    });

    try {
      await leadMagnetsRepo.incrementUsageRpc(userId, 'lead_magnets');
    } catch (err) {
      logApiError('external/lead-magnets/usage-increment', err, { userId });
    }

    return { success: true as const, leadMagnet: data };
  } catch (error) {
    logApiError('external/lead-magnets/create', error, { userId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── create-lead-magnet (external pipeline) ───────────────────────────────────

export interface CreateLeadMagnetPipelineInput {
  userId: string;
  archetype: LeadMagnetArchetype;
  businessContext: {
    businessDescription: string;
    credibilityMarkers?: string[];
    urgentPains?: string[];
    processes?: string[];
    tools?: string[];
    results?: string[];
    frequentQuestions?: string[];
    successExample?: string;
  };
  topic?: string;
  autoPublishFunnel?: boolean;
  autoSchedulePost?: boolean;
  scheduledTime?: string;
}

export async function createLeadMagnetPipelineRun(input: CreateLeadMagnetPipelineInput) {
  try {
    const user = await userRepo.findUserByIdForExternal(input.userId);
    if (!user) return { success: false as const, error: 'user_not_found' as const };

    const teamId = await teamRepo.getTeamIdByOwnerProfileUserId(input.userId);

    const leadMagnet = await leadMagnetsRepo.createLeadMagnet(input.userId, teamId, {
      title: `${input.archetype} lead magnet`,
      archetype: input.archetype,
      status: 'draft',
    });

    await createLeadMagnetPipeline.trigger({
      userId: input.userId,
      userName: user.name,
      username: user.username,
      archetype: input.archetype,
      businessContext: input.businessContext,
      topic: input.topic,
      autoPublishFunnel: input.autoPublishFunnel ?? true,
      autoSchedulePost: input.autoSchedulePost ?? false,
      scheduledTime: input.scheduledTime,
      leadMagnetId: leadMagnet.id,
      teamId,
    });

    return {
      success: true as const,
      leadMagnetId: leadMagnet.id,
      status: 'processing' as const,
    };
  } catch (error) {
    logApiError('external/create-lead-magnet', error, { userId: input.userId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── create-account ──────────────────────────────────────────────────────────

export interface CreateAccountInput {
  email: string;
  full_name: string;
  linkedin_url?: string;
  company?: string;
  job_title?: string;
}

export async function createAccount(input: CreateAccountInput) {
  try {
    const existing = await userRepo.findUserByEmail(input.email);
    if (existing) {
      return { success: true as const, user_id: existing.id, already_existed: true as const };
    }

    const user = await userRepo.createUser({ email: input.email, name: input.full_name });
    await subscriptionRepo.insertProSubscription(user.id);

    if (input.linkedin_url || input.company) {
      const team = await teamRepo.createTeam(user.id, {
        name: input.company || `${input.full_name}'s Team`,
      }) as { id: string };
      await teamRepo.insertOwnerProfileForExternal({
        team_id: team.id,
        user_id: user.id,
        email: input.email,
        full_name: input.full_name,
        linkedin_url: input.linkedin_url ?? null,
        title: input.job_title ?? null,
      });
    }

    return { success: true as const, user_id: user.id, already_existed: false as const };
  } catch (error) {
    logApiError('external/create-account', error, { email: input.email });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── setup-thankyou ───────────────────────────────────────────────────────────

export interface SetupThankyouInput {
  userId: string;
  funnelPageId: string;
  bookingUrl?: string;
  resourceTitle?: string;
}

export interface SetupThankyouResult {
  success: true;
  sectionsCreated: number;
  hasBookingCta: boolean;
  hasTestimonial: boolean;
  hasLogoBar: boolean;
}

export async function setupThankyou(input: SetupThankyouInput): Promise<
  | SetupThankyouResult
  | { success: false; error: 'user_not_found' | 'funnel_not_found' | 'database' }
> {
  try {
    const user = await userRepo.findUserByIdForExternal(input.userId);
    if (!user) return { success: false as const, error: 'user_not_found' as const };

    const funnel = await funnelsRepo.findFunnelPageByIdAndUserId(input.funnelPageId, input.userId);
    if (!funnel) return { success: false as const, error: 'funnel_not_found' as const };

    let brandKit: BrandKit | null = null;
    try {
      const supabase = createSupabaseAdminClient();
      brandKit = await resolveBrandKit(supabase, input.userId);
    } catch (err) {
      logApiError('external/setup-thankyou/brand-kit', err, { userId: input.userId });
    }

    await funnelsRepo.deleteSectionsByLocation(input.funnelPageId, 'thankyou');

    const sections: Array<{
      funnel_page_id: string;
      section_type: string;
      page_location: string;
      sort_order: number;
      is_visible: boolean;
      config: Record<string, unknown>;
    }> = [];
    let sortOrder = 0;
    const resolvedTitle = input.resourceTitle || 'your resource';

    sections.push({
      funnel_page_id: input.funnelPageId,
      section_type: 'section_bridge',
      page_location: 'thankyou',
      sort_order: sortOrder++,
      is_visible: true,
      config: { text: "You're in! Here's what happens next", variant: 'accent' },
    });

    const steps: Array<{ title: string; description: string }> = [
      {
        title: 'Download Your Resource',
        description: `Check your email for ${resolvedTitle}. It should arrive within a few minutes.`,
      },
      {
        title: 'Take the Quick Quiz',
        description: 'Answer a few short questions so we can personalize your experience.',
      },
    ];
    if (input.bookingUrl) {
      steps.push({
        title: 'Book a Call',
        description: 'Schedule a quick chat to discuss how we can help you get results faster.',
      });
    }
    sections.push({
      funnel_page_id: input.funnelPageId,
      section_type: 'steps',
      page_location: 'thankyou',
      sort_order: sortOrder++,
      is_visible: true,
      config: { heading: 'What Happens Next', steps },
    });

    const hasBookingCta = !!input.bookingUrl;
    if (hasBookingCta) {
      sections.push({
        funnel_page_id: input.funnelPageId,
        section_type: 'marketing_block',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: {
          blockType: 'cta',
          title: 'Ready to Take the Next Step?',
          content: 'Book a quick call and let us show you how to get results faster.',
          ctaText: 'Book Your Call',
          ctaUrl: input.bookingUrl,
        },
      });
    }

    const hasTestimonial = !!(brandKit?.default_testimonial?.quote);
    if (hasTestimonial) {
      sections.push({
        funnel_page_id: input.funnelPageId,
        section_type: 'testimonial',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: {
          quote: brandKit!.default_testimonial!.quote,
          author: brandKit!.default_testimonial!.author ?? undefined,
          role: brandKit!.default_testimonial!.role ?? undefined,
        },
      });
    }

    const hasLogoBar = !!(brandKit?.logos && brandKit.logos.length > 0);
    if (hasLogoBar) {
      sections.push({
        funnel_page_id: input.funnelPageId,
        section_type: 'logo_bar',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: { logos: brandKit!.logos },
      });
    }

    if (sections.length > 0) {
      await funnelsRepo.insertSections(sections);
    }

    const funnelUpdate: Record<string, unknown> = { send_resource_email: true };
    if (brandKit) {
      if (brandKit.default_theme) funnelUpdate.theme = brandKit.default_theme;
      if (brandKit.default_primary_color) funnelUpdate.primary_color = brandKit.default_primary_color;
      if (brandKit.default_background_style) funnelUpdate.background_style = brandKit.default_background_style;
      if (brandKit.logo_url) funnelUpdate.logo_url = brandKit.logo_url;
      if (brandKit.font_family) funnelUpdate.font_family = brandKit.font_family;
      if (brandKit.font_url) funnelUpdate.font_url = brandKit.font_url;
    }
    try {
      await funnelsRepo.updateFunnelPageByIdUnscoped(input.funnelPageId, funnelUpdate);
    } catch (err) {
      logApiError('external/setup-thankyou/update-funnel', err, { funnelPageId: input.funnelPageId });
    }

    return {
      success: true as const,
      sectionsCreated: sections.length,
      hasBookingCta,
      hasTestimonial,
      hasLogoBar,
    };
  } catch (error) {
    logApiError('external/setup-thankyou', error, { userId: input.userId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── ingest-transcript ──────────────────────────────────────────────────────

export async function ingestTranscript(input: {
  user_id: string;
  transcript: string;
  title?: string;
  source?: string;
}) {
  try {
    const team = await teamRepo.getOwnerTeamByUserId(input.user_id);
    if (!team) return { success: false as const, error: 'team_not_found' as const };

    const { data: record, error } = await cpTranscriptsRepo.insertTranscript({
      user_id: input.user_id,
      source: input.source || 'dfy_content_call',
      title: input.title || 'Content Call',
      raw_transcript: input.transcript,
      team_id: team.id,
    });

    if (error || !record) {
      logApiError('external/ingest-transcript/insert', error, { user_id: input.user_id });
      return { success: false as const, error: 'database' as const };
    }

    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId: input.user_id,
        transcriptId: record.id,
        teamId: team.id,
      });
    } catch (triggerError) {
      logApiError('external/ingest-transcript/trigger', triggerError, { transcriptId: record.id });
    }

    return { success: true as const, transcript_id: record.id };
  } catch (error) {
    logApiError('external/ingest-transcript', error, { user_id: input.user_id });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── import-posts ───────────────────────────────────────────────────────────

export async function importPosts(input: {
  user_id: string;
  team_profile_id?: string | null;
  posts: Array<{ title?: string; content: string; funnel_stage?: string; source_post_id?: string }>;
}) {
  try {
    let resolvedTeamProfileId = input.team_profile_id ?? null;
    if (!resolvedTeamProfileId) {
      resolvedTeamProfileId = await teamRepo.getOwnerProfileIdByUserId(input.user_id);
    }

    const rows = input.posts.map((post) => ({
      user_id: input.user_id,
      team_profile_id: resolvedTeamProfileId,
      status: 'reviewing' as const,
      draft_content: post.content,
      final_content: post.content,
    }));

    const data = await postsRepo.insertPipelinePostsBulk(rows);
    return {
      success: true as const,
      imported_count: data.length,
      posts: data,
    };
  } catch (error) {
    logApiError('external/import-posts', error, { user_id: input.user_id });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── ingest-knowledge ───────────────────────────────────────────────────────

const VALID_KNOWLEDGE_TYPES = [
  'how_to', 'insight', 'story', 'question',
  'objection', 'mistake', 'decision', 'market_intel',
] as const;

function getOpenAIClientForEmbeddings(): OpenAI {
  const heliconeKey = process.env.HELICONE_API_KEY;
  const config: ConstructorParameters<typeof OpenAI>[0] = {};
  if (heliconeKey) {
    config.baseURL = 'https://oai.helicone.ai/v1';
    config.defaultHeaders = {
      'Helicone-Auth': `Bearer ${heliconeKey}`,
      'Helicone-Property-Source': 'magnetlab',
      'Helicone-Property-Caller': 'ingest-knowledge',
    };
  }
  return new OpenAI(config);
}

async function generateEmbeddingForKnowledge(text: string): Promise<number[]> {
  const openai = getOpenAIClientForEmbeddings();
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

export interface IngestKnowledgeEntry {
  content: string;
  context?: string;
  knowledge_type: string;
  category?: string;
  tags?: string[];
  quality_score?: number;
  source_label?: string;
}

export async function ingestKnowledge(input: {
  user_id: string;
  entries: IngestKnowledgeEntry[];
}) {
  try {
    const BATCH_SIZE = 5;
    const embeddings: number[][] = [];

    for (let i = 0; i < input.entries.length; i += BATCH_SIZE) {
      const batch = input.entries.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await Promise.all(
        batch.map((entry) => generateEmbeddingForKnowledge(entry.content))
      );
      embeddings.push(...batchEmbeddings);
      if (i + BATCH_SIZE < input.entries.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const rows = input.entries.map((entry, idx) => ({
      user_id: input.user_id,
      content: entry.content,
      context: entry.context || null,
      knowledge_type: entry.knowledge_type,
      category: entry.category || 'insight',
      speaker: 'host',
      tags: entry.tags || [],
      quality_score: entry.quality_score ?? 3,
      specificity: true,
      actionability: 'contextual',
      embedding: JSON.stringify(embeddings[idx]),
      source_date: today,
      topics: [],
      transcript_type: entry.source_label || 'external',
    }));

    const data = await knowledgeRepo.insertKnowledgeEntriesBulk(rows);
    return {
      success: true as const,
      entries_created: data.length,
    };
  } catch (error) {
    logApiError('external/ingest-knowledge', error, { user_id: input.user_id });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── generate-quiz ─────────────────────────────────────────────────────────

export async function generateQuiz(input: {
  userId: string;
  funnelPageId: string;
  clientName?: string;
  icpData?: Record<string, unknown>;
  teamId?: string;
  profileId?: string;
}) {
  try {
    const user = await userRepo.findUserByIdForExternal(input.userId);
    if (!user) return { success: false as const, error: 'user_not_found' as const };

    const funnel = await funnelsRepo.findFunnelPageByIdAndUserId(input.funnelPageId, input.userId);
    if (!funnel) return { success: false as const, error: 'funnel_not_found' as const };

    let knowledgeContext = '';
    try {
      const categories = ['market_intel', 'objection', 'question'] as const;
      const contextParts: string[] = [];
      for (const knowledgeType of categories) {
        const result = await searchKnowledgeV2(input.userId, {
          knowledgeType,
          limit: 5,
          teamId: input.teamId || undefined,
          profileId: input.profileId || undefined,
        });
        if (result.entries.length > 0) {
          contextParts.push(`${knowledgeType}:\n- ${result.entries.map((e) => e.content).join('\n- ')}`);
        }
      }
      if (contextParts.length > 0) knowledgeContext = contextParts.join('\n\n');
    } catch (err) {
      logApiError('external/generate-quiz/knowledge', err, { userId: input.userId });
    }

    let brandContext = '';
    try {
      const supabase = createSupabaseAdminClient();
      const brandKit = await resolveBrandKit(supabase, input.userId, input.teamId);
      if (brandKit) {
        const parts: string[] = [];
        if (brandKit.urgent_pains?.length) parts.push(`Urgent pains: ${brandKit.urgent_pains.join(', ')}`);
        if (brandKit.frequent_questions?.length) parts.push(`Frequent questions: ${brandKit.frequent_questions.join(', ')}`);
        if (brandKit.credibility_markers?.length) parts.push(`Credibility markers: ${brandKit.credibility_markers.join(', ')}`);
        if (parts.length > 0) brandContext = parts.join('\n');
      }
    } catch (err) {
      logApiError('external/generate-quiz/brand-context', err, { userId: input.userId });
    }

    const resolvedClientName = input.clientName || user.name || 'the client';
    const icpJson = input.icpData ? JSON.stringify(input.icpData) : '{}';
    const questions = await generateQuizQuestions({
      clientName: resolvedClientName,
      icpJson,
      knowledgeContext,
      brandContext,
    });

    if (questions.length === 0) {
      return { success: false as const, error: 'no_questions' as const };
    }

    const form = await qualificationFormsRepo.createForm(input.userId, `Quiz for ${resolvedClientName}`) as { id: string };
    const questionRows = questions.map((q, index) => ({
      form_id: form.id,
      funnel_page_id: null,
      question_text: q.question_text,
      question_order: index,
      answer_type: q.answer_type,
      qualifying_answer: q.qualifying_answer,
      options: q.options,
      placeholder: null,
      is_qualifying: q.is_qualifying,
      is_required: q.is_required,
    }));
    await qualificationFormsRepo.insertQuestionsBulk(questionRows);
    await funnelsRepo.updateFunnelPageByIdUnscoped(input.funnelPageId, { qualification_form_id: form.id });

    return {
      success: true as const,
      formId: form.id,
      questionCount: questions.length,
    };
  } catch (error) {
    logApiError('external/generate-quiz', error, { userId: input.userId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── review-content ──────────────────────────────────────────────────────────

export async function reviewContent(input: {
  userId: string;
  teamProfileId?: string | null;
  voiceProfile?: string | Record<string, unknown>;
  icpSummary?: string;
}) {
  try {
    const user = await userRepo.findUserByIdForExternal(input.userId);
    if (!user) return { success: false as const, error: 'user_not_found' as const };

    const posts = await postsRepo.findDraftPostsForReview(input.userId, input.teamProfileId ?? undefined);
    if (posts.length === 0) {
      return {
        success: true as const,
        reviewed: 0,
        summary: { excellent: 0, good_with_edits: 0, needs_rewrite: 0, deleted: 0 },
        deletedPostIds: [] as string[],
      };
    }

    const voiceProfile =
      input.voiceProfile && typeof input.voiceProfile === 'object'
        ? JSON.stringify(input.voiceProfile, null, 2)
        : input.voiceProfile || undefined;

    const reviewablePosts: ReviewablePost[] = posts.map((p) => ({
      id: p.id,
      final_content: p.final_content,
      draft_content: p.draft_content,
      hook_score: p.hook_score,
    }));
    const reviewResults = await reviewPosts(reviewablePosts, {
      voiceProfile: voiceProfile || undefined,
      icpSummary: input.icpSummary || undefined,
    });

    const summary = { excellent: 0, good_with_edits: 0, needs_rewrite: 0, deleted: 0 };
    const deletedPostIds: string[] = [];
    const resultMap = new Map(reviewResults.map((r) => [r.post_id, r]));

    for (const post of posts) {
      const result = resultMap.get(post.id);
      if (!result) continue;

      if (result.review_category === 'delete') {
        try {
          await postsRepo.deletePost(input.userId, post.id);
          summary.deleted++;
          deletedPostIds.push(post.id);
        } catch (err) {
          logApiError('external/review-content/delete-post', err, { postId: post.id });
        }
      } else {
        const reviewData = {
          score: result.review_score,
          category: result.review_category,
          notes: result.review_notes,
          flags: result.consistency_flags,
          reviewed_at: new Date().toISOString(),
        };
        try {
          await postsRepo.updatePostReviewData(input.userId, post.id, reviewData);
          summary[result.review_category]++;
        } catch (err) {
          logApiError('external/review-content/update-post', err, { postId: post.id });
        }
      }
    }

    return {
      success: true as const,
      reviewed: summary.excellent + summary.good_with_edits + summary.needs_rewrite + summary.deleted,
      summary,
      deletedPostIds,
    };
  } catch (error) {
    logApiError('external/review-content', error, { userId: input.userId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── apply-branding ──────────────────────────────────────────────────────────

export async function applyBranding(input: {
  userId: string;
  funnelPageId: string;
  brandKit?: BrandKit | null;
}) {
  try {
    const user = await userRepo.findUserByIdForExternal(input.userId);
    if (!user) return { success: false as const, error: 'user_not_found' as const };

    const funnel = await funnelsRepo.findFunnelPageByIdAndUserId(input.funnelPageId, input.userId);
    if (!funnel) return { success: false as const, error: 'funnel_not_found' as const };

    let brandKit: BrandKit | null = input.brandKit ?? null;
    if (!brandKit) {
      const supabase = createSupabaseAdminClient();
      brandKit = await resolveBrandKit(supabase, input.userId);
    }

    if (!brandKit) {
      return {
        success: true as const,
        applied: [] as string[],
        message: 'No brand kit found; nothing to apply',
      };
    }

    const appliedFields: string[] = [];
    const funnelUpdate: Record<string, unknown> = {};
    if (brandKit.default_theme) { funnelUpdate.theme = brandKit.default_theme; appliedFields.push('theme'); }
    if (brandKit.default_primary_color) { funnelUpdate.primary_color = brandKit.default_primary_color; appliedFields.push('primary_color'); }
    if (brandKit.default_background_style) { funnelUpdate.background_style = brandKit.default_background_style; appliedFields.push('background_style'); }
    if (brandKit.logo_url) { funnelUpdate.logo_url = brandKit.logo_url; appliedFields.push('logo_url'); }
    if (brandKit.font_family) { funnelUpdate.font_family = brandKit.font_family; appliedFields.push('font_family'); }
    if (brandKit.font_url) { funnelUpdate.font_url = brandKit.font_url; appliedFields.push('font_url'); }

    if (Object.keys(funnelUpdate).length > 0) {
      await funnelsRepo.updateFunnelPageByIdUnscoped(input.funnelPageId, funnelUpdate);
    }

    const sections = await funnelsRepo.findSectionsRaw(input.funnelPageId);
    if (sections && sections.length > 0) {
      for (const section of sections) {
        let config = (section.config || {}) as Record<string, unknown>;
        let updated = false;
        if (section.section_type === 'logo_bar' && brandKit.logos?.length) {
          config = { ...config, logos: brandKit.logos };
          updated = true;
          if (!appliedFields.includes('logos')) appliedFields.push('logos');
        }
        if (section.section_type === 'testimonial' && brandKit.default_testimonial?.quote) {
          config = { ...config, ...brandKit.default_testimonial };
          updated = true;
          if (!appliedFields.includes('default_testimonial')) appliedFields.push('default_testimonial');
        }
        if (section.section_type === 'steps' && brandKit.default_steps?.steps?.length) {
          config = { ...config, ...brandKit.default_steps };
          updated = true;
          if (!appliedFields.includes('default_steps')) appliedFields.push('default_steps');
        }
        if (updated) {
          try {
            await funnelsRepo.updateSectionConfig(section.id, config);
          } catch (err) {
            logApiError('external/apply-branding/update-section', err, { sectionId: section.id });
          }
        }
      }
    }

    return { success: true as const, applied: appliedFields };
  } catch (error) {
    logApiError('external/apply-branding', error, { userId: input.userId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── external/funnels (GET, POST) ───────────────────────────────────────────

export async function getFunnelByLeadMagnet(leadMagnetId: string, userId: string) {
  try {
    const lm = await leadMagnetsRepo.findLeadMagnetByOwner(userId, leadMagnetId);
    if (!lm) return { success: false as const, error: 'lead_magnet_not_found' as const };
    const funnel = await funnelsRepo.findFunnelByLeadMagnetIdAndUserId(leadMagnetId, userId);
    return { success: true as const, funnel: funnel ?? null };
  } catch (error) {
    logApiError('external/funnels/get', error, { userId, leadMagnetId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function createFunnelExternal(input: {
  userId: string;
  leadMagnetId: string;
  slug: string;
  optinHeadline?: string;
  optinSubline?: string;
  optinButtonText?: string;
  optinSocialProof?: string;
  thankyouHeadline?: string;
  thankyouSubline?: string;
  vslUrl?: string;
  calendlyUrl?: string;
  qualificationPassMessage?: string;
  qualificationFailMessage?: string;
  theme?: string;
  primaryColor?: string;
  backgroundStyle?: string;
  logoUrl?: string;
}) {
  try {
    const lm = await leadMagnetsRepo.findLeadMagnetByIdAndUser(input.leadMagnetId, input.userId);
    if (!lm) return { success: false as const, error: 'lead_magnet_not_found' as const };
    const existing = await funnelsRepo.findFunnelByLeadMagnetIdAndUserId(input.leadMagnetId, input.userId);
    if (existing) return { success: false as const, error: 'funnel_exists' as const };

    const profile = await userRepo.getFunnelDefaults(input.userId);
    const existingSlugs = await funnelsRepo.findExistingSlug(input.userId, input.slug);
    let finalSlug = input.slug;
    let slugSuffix = 0;
    while (existingSlugs.has(finalSlug)) {
      slugSuffix++;
      finalSlug = `${input.slug}-${slugSuffix}`;
    }

    const funnelInsertData = {
      lead_magnet_id: input.leadMagnetId,
      user_id: input.userId,
      slug: finalSlug,
      optin_headline: input.optinHeadline || lm.title,
      optin_subline: input.optinSubline ?? null,
      optin_button_text: input.optinButtonText || 'Get Free Access',
      optin_social_proof: input.optinSocialProof ?? null,
      thankyou_headline: input.thankyouHeadline || 'Thanks! Check your email.',
      thankyou_subline: input.thankyouSubline ?? null,
      vsl_url: input.vslUrl ?? null,
      calendly_url: input.calendlyUrl ?? null,
      qualification_pass_message: input.qualificationPassMessage || 'Great! Book a call below.',
      qualification_fail_message: input.qualificationFailMessage || 'Thanks for your interest!',
      theme: input.theme || profile.default_theme || 'dark',
      primary_color: input.primaryColor || profile.default_primary_color || '#8b5cf6',
      background_style: input.backgroundStyle || profile.default_background_style || 'solid',
      logo_url: normalizeImageUrl(input.logoUrl || profile.default_logo_url || '') || null,
    };

    const funnel = await funnelsRepo.createFunnel(funnelInsertData);
    return { success: true as const, funnel };
  } catch (error) {
    logApiError('external/funnels/create', error, { userId: input.userId, leadMagnetId: input.leadMagnetId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── external/funnels/[id]/publish ──────────────────────────────────────────

export async function publishFunnel(id: string, userId: string, publish: boolean) {
  try {
    const funnel = await funnelsRepo.findFunnelByIdAndUserIdWithLeadMagnet(id, userId);
    if (!funnel) return { success: false as const, error: 'funnel_not_found' as const };

    if (publish) {
      const user = await userRepo.findUserByIdForExternal(userId);
      if (!user?.username) return { success: false as const, error: 'username_required' as const };
      if (!funnel.optin_headline) return { success: false as const, error: 'optin_headline_required' as const };
    }

    if (publish && funnel.lead_magnets?.id) {
      try {
        const lm = await leadMagnetsRepo.findLeadMagnetByIdAndUser(funnel.lead_magnets.id, userId);
        if (lm?.extracted_content && !lm.polished_content && lm.concept) {
          const polished = await polishLeadMagnetContent(
            lm.extracted_content as ExtractedContent,
            lm.concept as LeadMagnetConcept,
          );
          await leadMagnetsRepo.updateLeadMagnetByOwner(userId, lm.id, {
            polished_content: polished,
            polished_at: new Date().toISOString(),
          });
        }
      } catch (polishError) {
        logApiError('external/funnels/publish/auto-polish', polishError, { userId, funnelId: id });
      }
    }

    const updateData: Record<string, unknown> = { is_published: publish };
    if (publish && !funnel.published_at) updateData.published_at = new Date().toISOString();
    await funnelsRepo.updateFunnelPageByIdUnscoped(id, updateData);

    const updated = await funnelsRepo.findFunnelByLeadMagnetIdAndUserId(funnel.lead_magnet_id, userId);
    const user = await userRepo.findUserByIdForExternal(userId);
    const publicUrl = publish && user?.username
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/p/${user.username}/${funnel.slug}`
      : null;

    return {
      success: true as const,
      funnel: updated ?? null,
      publicUrl,
    };
  } catch (error) {
    logApiError('external/funnels/publish', error, { userId, funnelId: id });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── external/lead-magnets/[id]/extract, generate, write-posts ──────────────

export async function leadMagnetExtract(id: string, userId: string, archetype: LeadMagnetArchetype, concept: LeadMagnetConcept, answers: Record<string, string>) {
  try {
    const lm = await leadMagnetsRepo.findLeadMagnetByOwner(userId, id);
    if (!lm) return { success: false as const, error: 'not_found' as const };
    const extractedContent = await processContentExtraction(archetype, concept, answers);
    await leadMagnetsRepo.updateLeadMagnetByOwner(userId, id, { extracted_content: extractedContent, updated_at: new Date().toISOString() });
    return { success: true as const, data: extractedContent };
  } catch (error) {
    logApiError('external/lead-magnets/extract', error, { userId, leadMagnetId: id });
    return { success: false as const, error: 'ai' as const };
  }
}

export async function leadMagnetGenerate(id: string, userId: string, archetype: LeadMagnetArchetype, concept: LeadMagnetConcept, answers: Record<string, string>) {
  try {
    const lm = await leadMagnetsRepo.findLeadMagnetByOwner(userId, id);
    if (!lm) return { success: false as const, error: 'not_found' as const };
    const extractedContent = await processContentExtraction(archetype, concept, answers);
    await leadMagnetsRepo.updateLeadMagnetByOwner(userId, id, {
      extracted_content: extractedContent,
      status: 'draft',
      updated_at: new Date().toISOString(),
    });
    return { success: true as const, data: extractedContent };
  } catch (error) {
    logApiError('external/lead-magnets/generate', error, { userId, leadMagnetId: id });
    return { success: false as const, error: 'ai' as const };
  }
}

export async function leadMagnetWritePosts(id: string, userId: string, input: PostWriterInput) {
  try {
    const lm = await leadMagnetsRepo.findLeadMagnetByOwner(userId, id);
    if (!lm) return { success: false as const, error: 'not_found' as const };
    const result = await generatePostVariations(input);
    await leadMagnetsRepo.updateLeadMagnetByOwner(userId, id, { post_variations: result.variations, updated_at: new Date().toISOString() });
    return { success: true as const, data: result };
  } catch (error) {
    logApiError('external/lead-magnets/write-posts', error, { userId, leadMagnetId: id });
    return { success: false as const, error: 'ai' as const };
  }
}

// ─── external/lead-magnets/[id]/stats ──────────────────────────────────────

export async function leadMagnetStats(leadMagnetId: string) {
  try {
    const leadMagnet = await leadMagnetsRepo.findLeadMagnetByIdBasic(leadMagnetId);
    if (!leadMagnet) return { success: false as const, error: 'not_found' as const };
    const funnelPageId = await funnelsRepo.findFunnelPageIdByLeadMagnetId(leadMagnetId);
    let views = 0;
    if (funnelPageId) views = await funnelsRepo.getPageViewCountByFunnelPageId(funnelPageId);
    const leads = await funnelsRepo.getFunnelLeadCountByLeadMagnetId(leadMagnetId);
    const conversionRate = views > 0 ? Math.round((leads / views) * 10000) / 100 : 0;
    return {
      success: true as const,
      data: {
        leadMagnetId: leadMagnet.id,
        views,
        leads,
        conversionRate,
        createdAt: leadMagnet.created_at,
        updatedAt: leadMagnet.updated_at,
      },
    };
  } catch (error) {
    logApiError('external/lead-magnets/stats', error, { leadMagnetId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── external/lead-magnets/ideate ───────────────────────────────────────────

export async function leadMagnetIdeate(userId: string, businessContext: Record<string, unknown>, sources?: { callTranscriptInsights?: unknown; competitorAnalysis?: unknown }) {
  try {
    const { data: canCreate, error: rpcError } = await leadMagnetsRepo.checkUsageLimitRpc(userId, 'lead_magnets');
    if (rpcError) logApiError('external/lead-magnets/ideate/usage-check', rpcError, { userId });
    else if (canCreate === false) return { success: false as const, error: 'usage_limit' as const };

    const result = await generateLeadMagnetIdeasParallel(businessContext, sources, userId);
    try {
      await brandKitRepo.updateSavedIdeationByUserId(userId, {
        saved_ideation_result: result,
        ideation_generated_at: new Date().toISOString(),
      });
    } catch (saveError) {
      logApiError('external/lead-magnets/ideate/save', saveError, { userId });
    }
    return { success: true as const, data: result };
  } catch (error) {
    logApiError('external/lead-magnets/ideate', error, { userId });
    return { success: false as const, error: 'ai' as const };
  }
}
