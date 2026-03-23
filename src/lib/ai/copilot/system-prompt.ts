import { getPrompt } from '@/lib/services/prompt-registry';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { buildVoicePromptSection } from '@/lib/ai/content-pipeline/voice-prompt-builder';
import { getDefaultProfile } from '@/server/repositories/team.repo';
import {
  fetchBriefingData,
  formatBriefingPrompt,
} from '@/server/services/copilot-briefing.service';
import type { DataScope } from '@/lib/utils/team-context';
import { logWarn } from '@/lib/utils/logger';

interface PageContext {
  page: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  entityContent?: string;
}

interface EngagementStats {
  impressions?: number;
  comments?: number;
  likes?: number;
  [key: string]: unknown;
}

interface TopPost {
  draft_content: string | null;
  final_content: string | null;
  engagement_stats: EngagementStats | null;
  published_at: string | null;
}

interface FeedbackPayload {
  rating?: string;
  note?: string;
}

// Cache assembled prompts per scope+page for 5 minutes
const promptCache = new Map<string, { prompt: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function buildPerformanceSection(posts: TopPost[]): string | null {
  if (!posts || posts.length === 0) return null;

  const lines: string[] = ['## Recent Performance (last 30 days)'];

  for (const post of posts) {
    const content = post.final_content || post.draft_content || '';
    const snippet = content.length > 50 ? content.slice(0, 50) + '...' : content;
    const stats = post.engagement_stats || {};
    const impressions = stats.impressions ?? 0;
    const comments = stats.comments ?? 0;
    const likes = stats.likes ?? 0;
    lines.push(`- "${snippet}" — ${impressions} impressions, ${comments} comments, ${likes} likes`);
  }

  return lines.join('\n');
}

function buildFeedbackSection(negativeNotes: string[]): string | null {
  if (!negativeNotes || negativeNotes.length === 0) return null;

  // Group notes by frequency
  const freq = new Map<string, number>();
  for (const note of negativeNotes) {
    const normalized = note.trim().toLowerCase();
    freq.set(normalized, (freq.get(normalized) || 0) + 1);
  }

  // Sort by frequency descending
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);

  const lines: string[] = ['## Feedback Patterns', 'Common corrections from user:'];
  for (const [note, count] of sorted) {
    lines.push(`- "${note}"${count > 1 ? ` (x${count})` : ''}`);
  }

  return lines.join('\n');
}

export async function buildCopilotSystemPrompt(
  userId: string,
  pageContext?: PageContext,
  scope?: DataScope,
  briefing?: boolean,
  sourceContext?: PageContext
): Promise<string> {
  const scopeKey = scope?.type === 'team' ? `team:${scope.teamId}` : `user:${userId}`;
  const effectiveContext = sourceContext ?? pageContext;
  const cacheKey = `${scopeKey}:${effectiveContext?.page || 'none'}:${effectiveContext?.entityId || 'none'}:${briefing ? 'briefed' : 'standard'}`;
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return cached.prompt;
  }

  const supabase = createSupabaseAdminClient();
  const sections: string[] = [];

  // 1. Base identity (admin-editable)
  const basePrompt = await getPrompt('copilot-system');
  sections.push(basePrompt.system_prompt);

  // 2. Voice profile — team mode uses default team profile, personal mode uses user's linked profile
  let profile: { voice_profile: unknown; full_name: string | null; title: string | null } | null =
    null;

  if (scope?.type === 'team' && scope.teamId) {
    // Team mode: use the team's default profile (the "post as" identity for the whole team)
    const defaultProfile = await getDefaultProfile(scope.teamId);
    if (defaultProfile) {
      profile = {
        voice_profile: defaultProfile.voice_profile,
        full_name: defaultProfile.full_name,
        title: defaultProfile.title,
      };
    }
  } else {
    // Personal mode: find the user's own linked team profile
    const { data } = await supabase
      .from('team_profiles')
      .select('voice_profile, full_name, title')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    profile = data as typeof profile;
  }

  if (profile?.voice_profile) {
    const voiceSection = buildVoicePromptSection(profile.voice_profile, 'linkedin');
    if (voiceSection) {
      sections.push(voiceSection);
    }
  }

  if (profile?.full_name) {
    sections.push(
      `\n## User Info\nName: ${profile.full_name}${profile.title ? `, ${profile.title}` : ''}`
    );
  }

  // 2b. Briefing — live dashboard metrics (optional, homepage only)
  if (briefing && scope) {
    try {
      const briefingData = await fetchBriefingData(supabase, scope);
      const briefingSection = formatBriefingPrompt(briefingData);
      sections.push('\n' + briefingSection);
    } catch (err) {
      // Briefing is non-critical — log and continue without it
      logWarn('buildCopilotSystemPrompt', 'Briefing data fetch failed, skipping', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Active memories
  const { data: memories } = await supabase
    .from('copilot_memories')
    .select('rule, category')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (memories?.length) {
    sections.push('\n## Learned Preferences');
    for (const m of memories) {
      sections.push(`- [${m.category}] ${m.rule}`);
    }
  }

  // 4. Recent post performance (last 30 days)
  // cp_pipeline_posts uses team_profile_id, not team_id — can't use applyScope directly
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  let postsQuery = supabase
    .from('cp_pipeline_posts')
    .select('draft_content, final_content, engagement_stats, published_at');

  if (scope?.type === 'team' && scope.teamId) {
    // Team mode: scope by active profile IDs for the team
    const { data: teamProfiles } = await supabase
      .from('team_profiles')
      .select('id')
      .eq('team_id', scope.teamId)
      .eq('status', 'active');
    const profileIds = (teamProfiles ?? []).map((p: { id: string }) => p.id);
    if (profileIds.length > 0) {
      postsQuery = postsQuery.in('team_profile_id', profileIds);
    } else {
      postsQuery = postsQuery.eq('user_id', userId);
    }
  } else {
    postsQuery = postsQuery.eq('user_id', userId);
  }

  const { data: topPosts } = await postsQuery
    .eq('status', 'published')
    .not('engagement_stats', 'is', null)
    .gte('published_at', thirtyDaysAgo)
    .order('published_at', { ascending: false })
    .limit(5);

  const performanceSection = buildPerformanceSection((topPosts as TopPost[]) || []);
  if (performanceSection) {
    sections.push('\n' + performanceSection);
  }

  // 5. Negative feedback patterns (last 30 days)
  const { data: userConvs } = await supabase
    .from('copilot_conversations')
    .select('id')
    .eq('user_id', userId);

  const convIds = (userConvs || []).map((c: { id: string }) => c.id);

  if (convIds.length > 0) {
    const { data: negFeedback } = await supabase
      .from('copilot_messages')
      .select('feedback')
      .in('conversation_id', convIds)
      .not('feedback', 'is', null)
      .gte('created_at', thirtyDaysAgo);

    const negativeNotes = ((negFeedback as { feedback: FeedbackPayload }[]) || [])
      .filter((m) => m.feedback?.rating === 'down' && m.feedback?.note)
      .map((m) => m.feedback.note as string);

    const feedbackSection = buildFeedbackSection(negativeNotes);
    if (feedbackSection) {
      sections.push('\n' + feedbackSection);
    }
  }

  // 6. Page context — sourceContext (Cmd+K originating page) takes precedence over pageContext
  const effectivePageContext = sourceContext ?? pageContext;
  if (effectivePageContext) {
    sections.push(`\n## Current Page Context`);
    sections.push(`The user is on: ${effectivePageContext.page}`);
    if (effectivePageContext.entityType && effectivePageContext.entityId) {
      sections.push(
        `Viewing ${effectivePageContext.entityType}: ${effectivePageContext.entityTitle || effectivePageContext.entityId}`
      );
    }
  }

  // 7. Content queue inline editing context
  if (effectivePageContext?.page === 'content-queue' && effectivePageContext.entityContent) {
    sections.push(`\n## Content Queue — Inline Post Editing

You are embedded in the content queue editor. The user is editing a LinkedIn post for a team member.

### Current Post Content
\`\`\`
${effectivePageContext.entityContent}
\`\`\`

### Instructions
- Use the \`update_queue_post_content\` tool to modify this post. Do NOT use \`update_post_content\`.
- Make targeted changes — preserve the author's voice and style.
- Explain what you changed and why in your response.
- If the user asks for a full rewrite, confirm the direction before replacing everything.`);
  }

  // 8. Lead magnet creation guidance
  sections.push(`
## Lead Magnet Creation

You can create lead magnets through conversation. When a user wants to create one:

1. Call start_lead_magnet_creation with their topic (and archetype if they specified one)
2. You'll receive gap-filling questions — the Brain has already answered some questions automatically
3. Ask the remaining questions conversationally — one at a time or in natural groups of 2-3
4. After collecting answers, call submit_extraction_answers
5. The content review panel will open automatically for them to review and edit
6. After they approve, call save_lead_magnet to save as a draft
7. Offer next steps: generate posts, set up funnel, or they can find it in their library

KEY BEHAVIORS:
- Always let the user know how many questions the Brain pre-answered ("I found X relevant insights from your calls, so I only need to ask Y questions")
- If they paste content (transcript, blog post), pass it as pasted_content — this reduces questions further
- If they mention a specific archetype/format, use it. If not, recommend one based on their topic.
- Never skip the extraction questions — they're what makes the content high-quality and unique
- After saving, offer to generate LinkedIn posts (separate step, not forced)`);

  const assembled = sections.join('\n\n');
  promptCache.set(cacheKey, { prompt: assembled, expires: Date.now() + CACHE_TTL });
  return assembled;
}

/** Clear system prompt cache (for tests). */
export function clearSystemPromptCache(): void {
  promptCache.clear();
}
