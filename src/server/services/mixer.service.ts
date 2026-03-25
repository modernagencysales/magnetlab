/** Mixer service. Core orchestrator for the ingredient mixer. Never imports from Next.js request/response objects. */

import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { insertRecipe } from '@/server/repositories/mix-recipes.repo';
import {
  buildMixerPrompt,
  type MixerPromptInput,
} from '@/lib/ai/content-pipeline/mixer-prompt-builder';
import { getBaseStyleGuidelines } from '@/lib/ai/content-pipeline/post-writer';
import { getGlobalStyleRules } from '@/lib/services/style-rules';
import type { MixerResult } from '@/lib/types/mixer';
import type { MixInput } from '@/lib/validations/mixer';
import type { TeamVoiceProfile, StyleProfile } from '@/lib/types/content-pipeline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escape % and _ characters in user input before use in .ilike() queries. */
function escapeIlike(str: string): string {
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ─── Column constants ─────────────────────────────────────────────────────────

const TEAM_PROFILE_COLUMNS = 'id, team_id, user_id, voice_profile' as const;

const EXPLOIT_COLUMNS = 'name, description, prompt_template, example_posts' as const;

const KNOWLEDGE_COLUMNS = 'content, context' as const;

const STYLE_COLUMNS = 'tone, vocabulary, banned_phrases, style_profile, example_posts' as const;

const TEMPLATE_COLUMNS = 'name, structure, example_posts' as const;

const CREATIVE_COLUMNS = 'content_text, image_url' as const;

const RECYCLED_POST_COLUMNS = 'final_content, draft_content, engagement_stats' as const;

const IDEA_COLUMNS = 'title, core_insight, key_points' as const;

// ─── Scope resolution ─────────────────────────────────────────────────────────

/** Resolve userId and teamId from a team_profile_id. Throws 404 if not found. */
export async function resolveScope(
  teamProfileId: string
): Promise<{ userId: string; teamId: string; teamProfileId: string }> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('team_profiles')
    .select(TEAM_PROFILE_COLUMNS)
    .eq('id', teamProfileId)
    .single();

  if (error || !data) {
    if (!error || error.code === 'PGRST116') {
      throw Object.assign(new Error('Team profile not found'), { statusCode: 404 });
    }
    logError('mixer/resolve-scope', error, { teamProfileId });
    throw Object.assign(new Error('Failed to resolve team profile'), { statusCode: 500 });
  }

  const profile = data as {
    id: string;
    team_id: string;
    user_id: string | null;
    voice_profile: TeamVoiceProfile | null;
  };

  if (!profile.user_id) {
    throw Object.assign(new Error('Team profile has no linked user'), { statusCode: 404 });
  }

  return {
    userId: profile.user_id,
    teamId: profile.team_id,
    teamProfileId: profile.id,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Verify that the calling user is an active member of the team that owns the profile.
 * Throws 403 if not authorized.
 */
export async function verifyAccess(userId: string, teamProfileId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Resolve team_id from the profile
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('team_id')
    .eq('id', teamProfileId)
    .maybeSingle();

  if (!profile) {
    throw Object.assign(new Error('Team profile not found'), { statusCode: 404 });
  }

  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', profile.team_id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
}

// ─── Mix (core generation) ────────────────────────────────────────────────────

/** Run a mix: fetch ingredients, build prompt, call Claude, persist recipe, return results. */
export async function mix(input: MixInput): Promise<MixerResult> {
  const { userId, teamId, teamProfileId } = await resolveScope(input.team_profile_id);
  const supabase = createSupabaseAdminClient();

  // ─── 1. Fetch all selected ingredients in parallel ─────────────────────────

  const [
    exploitResult,
    styleResult,
    templateResult,
    creativeResult,
    ideaResult,
    recycledResult,
    voiceProfileResult,
  ] = await Promise.all([
    // Exploit
    input.exploit_id
      ? supabase
          .from('cp_exploits')
          .select(EXPLOIT_COLUMNS)
          .eq('id', input.exploit_id)
          .or(`is_global.eq.true,user_id.eq.${userId}`)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Writing style
    input.style_id
      ? supabase
          .from('cp_writing_styles')
          .select(STYLE_COLUMNS)
          .eq('id', input.style_id)
          .eq('team_profile_id', teamProfileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Template
    input.template_id
      ? supabase
          .from('cp_post_templates')
          .select(TEMPLATE_COLUMNS)
          .eq('id', input.template_id)
          .or(`is_global.eq.true,user_id.eq.${userId},team_id.eq.${teamId}`)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Creative
    input.creative_id
      ? supabase
          .from('cp_creatives')
          .select(CREATIVE_COLUMNS)
          .eq('id', input.creative_id)
          .or(`user_id.eq.${userId},team_id.eq.${teamId}`)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Idea
    input.idea_id
      ? supabase.from('cp_content_ideas').select(IDEA_COLUMNS).eq('id', input.idea_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Recycled post
    input.recycled_post_id
      ? supabase
          .from('cp_pipeline_posts')
          .select(RECYCLED_POST_COLUMNS)
          .eq('id', input.recycled_post_id)
          .eq('team_profile_id', teamProfileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Team voice profile
    supabase.from('team_profiles').select('voice_profile').eq('id', teamProfileId).maybeSingle(),
  ]);

  // ─── 2. Fetch knowledge entries (may need RPC for semantic search) ──────────

  let knowledgeEntries: Array<{ content: string; context?: string }> = [];
  let knowledgeTopic = input.knowledge_topic ?? input.knowledge_query ?? '';

  if (input.knowledge_topic || input.knowledge_query) {
    if (input.knowledge_query) {
      // Try semantic search via RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'cp_match_team_knowledge_entries',
        {
          query_text: input.knowledge_query,
          team_profile_id_input: teamProfileId,
          match_count: 10,
          match_threshold: 0.5,
        }
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        knowledgeEntries = (rpcData as Array<{ content: string; context?: string }>).slice(0, 10);
        knowledgeTopic = input.knowledge_query;
      } else {
        // Fallback to text search
        const { data: textData } = await supabase
          .from('cp_knowledge_entries')
          .select(KNOWLEDGE_COLUMNS)
          .eq('team_profile_id', teamProfileId)
          .ilike('content', `%${escapeIlike(input.knowledge_query)}%`)
          .limit(10);
        knowledgeEntries = (textData ?? []) as Array<{ content: string; context?: string }>;
        knowledgeTopic = input.knowledge_query;
      }
    } else if (input.knowledge_topic) {
      // Topic-based search
      const { data: topicData } = await supabase
        .from('cp_knowledge_entries')
        .select(KNOWLEDGE_COLUMNS)
        .eq('team_profile_id', teamProfileId)
        .contains('topics', [input.knowledge_topic])
        .limit(10);
      knowledgeEntries = (topicData ?? []) as Array<{ content: string; context?: string }>;
      knowledgeTopic = input.knowledge_topic;
    }
  }

  // ─── 3. Build MixerPromptInput from fetched data ───────────────────────────

  type ExploitRow = {
    name: string;
    description: string | null;
    prompt_template: string | null;
    example_posts: string[] | null;
  };
  type StyleRow = {
    tone?: string;
    vocabulary?: string;
    banned_phrases?: string[];
    style_profile?: StyleProfile | null;
    example_posts?: string[] | null;
  };
  type TemplateRow = {
    name: string;
    structure: string;
    example_posts?: string[] | null;
  };
  type CreativeRow = {
    content_text: string;
    image_url?: string | null;
  };
  type IdeaRow = {
    title: string;
    core_insight?: string | null;
    key_points?: string[] | null;
  };
  type RecycledRow = {
    final_content?: string | null;
    draft_content?: string | null;
    engagement_stats?: Record<string, unknown> | null;
  };

  const exploit = exploitResult.data as ExploitRow | null;
  const style = styleResult.data as StyleRow | null;
  const template = templateResult.data as TemplateRow | null;
  const creative = creativeResult.data as CreativeRow | null;
  const idea = ideaResult.data as IdeaRow | null;
  const recycled = recycledResult.data as RecycledRow | null;
  const voiceProfileRow = voiceProfileResult.data as {
    voice_profile?: TeamVoiceProfile | null;
  } | null;
  const teamVoiceProfile = voiceProfileRow?.voice_profile ?? undefined;

  const promptInput: MixerPromptInput = {
    count: input.count ?? 3,
    output: input.output ?? 'drafts',
    hook: input.hook,
    instructions: input.instructions,
    teamVoiceProfile,
  };

  if (exploit) {
    promptInput.exploit = {
      name: exploit.name,
      description: exploit.description ?? '',
      example_posts: exploit.example_posts ?? [],
      prompt_template: exploit.prompt_template ?? undefined,
    };
  }

  if (knowledgeEntries.length > 0) {
    promptInput.knowledge = {
      topic: knowledgeTopic,
      entries: knowledgeEntries,
    };
  }

  if (style?.style_profile) {
    promptInput.style = {
      style_profile: style.style_profile,
      example_posts: style.example_posts ?? undefined,
    };
  }

  if (template) {
    promptInput.template = {
      name: template.name,
      structure: template.structure,
      example_posts: template.example_posts ?? undefined,
    };
  }

  if (creative) {
    promptInput.creative = {
      content_text: creative.content_text,
    };
  }

  if (input.trend_topic) {
    promptInput.trend = { topic: input.trend_topic };
  }

  if (recycled) {
    const content = recycled.final_content ?? recycled.draft_content ?? '';
    if (content) {
      const stats = recycled.engagement_stats;
      const engagementStr = stats
        ? `views: ${(stats.views as number) ?? 0}, likes: ${(stats.likes as number) ?? 0}, comments: ${(stats.comments as number) ?? 0}`
        : undefined;
      promptInput.recycled = {
        content,
        engagement_stats: engagementStr,
      };
    }
  }

  if (idea) {
    promptInput.idea = {
      title: idea.title,
      core_insight: idea.core_insight ?? '',
      key_points: idea.key_points ?? undefined,
    };
  }

  // ─── 4. Build prompt and call Claude ──────────────────────────────────────

  const globalRules = await getGlobalStyleRules();
  const prompt = buildMixerPrompt(promptInput, getBaseStyleGuidelines(), globalRules);

  let rawResponse: string;
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 1.0,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    rawResponse = textBlock && textBlock.type === 'text' ? textBlock.text : '';
  } catch (err) {
    logError('mixer/claude', err, { teamProfileId });
    throw Object.assign(new Error('AI generation failed'), { statusCode: 502 });
  }

  // ─── 5. Parse JSON response ───────────────────────────────────────────────

  let parsed: unknown[];
  try {
    // Strip markdown code fences if present
    const cleaned = rawResponse
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
  } catch (err) {
    logError('mixer/parse', err, { teamProfileId, rawResponse: rawResponse.slice(0, 500) });
    throw Object.assign(new Error('Failed to parse AI response'), { statusCode: 500 });
  }

  // ─── 6. Insert recipe row ─────────────────────────────────────────────────

  const recipe = await insertRecipe({
    team_profile_id: teamProfileId,
    output_type: input.output ?? 'drafts',
    exploit_id: input.exploit_id ?? null,
    knowledge_topic: input.knowledge_topic ?? null,
    knowledge_query: input.knowledge_query ?? null,
    style_id: input.style_id ?? null,
    template_id: input.template_id ?? null,
    creative_id: input.creative_id ?? null,
    trend_topic: input.trend_topic ?? null,
    recycled_post_id: input.recycled_post_id ?? null,
    idea_id: input.idea_id ?? null,
    instructions: input.instructions ?? null,
  });

  const recipeId = recipe.id;

  // ─── 7. Handle output type ────────────────────────────────────────────────

  if ((input.output ?? 'drafts') === 'ideas') {
    type RawIdea = {
      title?: string;
      core_insight?: string;
      hook?: string;
      key_points?: string[];
      content_type?: string;
      relevance_score?: number;
    };

    // Insert ideas into cp_content_ideas
    const ideaRows = (parsed as RawIdea[]).map((item) => ({
      title: item.title ?? 'Untitled',
      core_insight: item.core_insight ?? null,
      hook: item.hook ?? null,
      key_points: item.key_points ?? null,
      content_type: item.content_type ?? null,
      status: 'extracted' as const,
      team_profile_id: teamProfileId,
      exploit_id: input.exploit_id ?? null,
    }));

    const { data: insertedIdeas, error: ideasError } = await supabase
      .from('cp_content_ideas')
      .insert(ideaRows.map((r) => ({ ...r, user_id: userId, team_id: teamId })))
      .select('id');

    if (ideasError) {
      logError('mixer/insert-ideas', ideasError, { teamProfileId });
      // Non-fatal: still return the ideas even if DB insert fails
    }

    const ideas = (parsed as RawIdea[]).map((item, i) => ({
      title: item.title ?? 'Untitled',
      hook: item.hook ?? '',
      angle: item.core_insight ?? '',
      relevance_score: typeof item.relevance_score === 'number' ? item.relevance_score : 0.5,
      recipe_id: recipeId,
      ...(insertedIdeas?.[i] ? { id: insertedIdeas[i].id } : {}),
    }));

    return { type: 'ideas', ideas, recipe_id: recipeId };
  }

  // Drafts output
  type RawDraft = { content?: string; hook_type?: string; angle?: string };

  const drafts = (parsed as RawDraft[]).map((item) => ({
    content: item.content ?? '',
    hook_used: item.hook_type ?? '',
    ai_pick: false,
    recipe_id: recipeId,
  }));

  // Mark first draft as ai_pick
  if (drafts.length > 0) {
    drafts[0].ai_pick = true;
  }

  return { type: 'drafts', drafts, recipe_id: recipeId };
}

// ─── Error helper ─────────────────────────────────────────────────────────────

/** Extract HTTP status from a service error. Defaults to 500. */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

// Re-exports for API routes that import from mixer.service
export { getInventory } from './mixer-inventory.service';
export { getSuggestedRecipes, getComboPerformance } from './mixer-performance.service';
