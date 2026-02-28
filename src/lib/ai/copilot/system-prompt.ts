import { getPrompt } from '@/lib/services/prompt-registry';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { buildVoicePromptSection } from '@/lib/ai/content-pipeline/voice-prompt-builder';

interface PageContext {
  page: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
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

// Cache assembled prompts per user for 5 minutes
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
  pageContext?: PageContext
): Promise<string> {
  const cacheKey = `${userId}:${pageContext?.page || 'none'}:${pageContext?.entityId || 'none'}`;
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return cached.prompt;
  }

  const supabase = createSupabaseAdminClient();
  const sections: string[] = [];

  // 1. Base identity (admin-editable)
  const basePrompt = await getPrompt('copilot-system');
  sections.push(basePrompt.system_prompt);

  // 2. Voice profile
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('voice_profile, full_name, title')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (profile?.voice_profile) {
    const voiceSection = buildVoicePromptSection(profile.voice_profile, 'linkedin');
    if (voiceSection) {
      sections.push(voiceSection);
    }
  }

  if (profile?.full_name) {
    sections.push(`\n## User Info\nName: ${profile.full_name}${profile.title ? `, ${profile.title}` : ''}`);
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
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: topPosts } = await supabase
    .from('cp_pipeline_posts')
    .select('draft_content, final_content, engagement_stats, published_at')
    .eq('user_id', userId)
    .eq('status', 'published')
    .not('engagement_stats', 'is', null)
    .gte('published_at', thirtyDaysAgo)
    .order('published_at', { ascending: false })
    .limit(5);

  const performanceSection = buildPerformanceSection(topPosts as TopPost[] || []);
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
      .filter(m => m.feedback?.rating === 'down' && m.feedback?.note)
      .map(m => m.feedback.note as string);

    const feedbackSection = buildFeedbackSection(negativeNotes);
    if (feedbackSection) {
      sections.push('\n' + feedbackSection);
    }
  }

  // 6. Page context
  if (pageContext) {
    sections.push(`\n## Current Page Context`);
    sections.push(`The user is on: ${pageContext.page}`);
    if (pageContext.entityType && pageContext.entityId) {
      sections.push(`Viewing ${pageContext.entityType}: ${pageContext.entityTitle || pageContext.entityId}`);
    }
  }

  const assembled = sections.join('\n\n');
  promptCache.set(cacheKey, { prompt: assembled, expires: Date.now() + CACHE_TTL });
  return assembled;
}

/** Clear system prompt cache (for tests). */
export function clearSystemPromptCache(): void {
  promptCache.clear();
}
