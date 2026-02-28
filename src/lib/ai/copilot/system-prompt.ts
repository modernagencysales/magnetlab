import { getPrompt } from '@/lib/services/prompt-registry';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { buildVoicePromptSection } from '@/lib/ai/content-pipeline/voice-prompt-builder';

interface PageContext {
  page: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
}

// Cache assembled prompts per user for 5 minutes
const promptCache = new Map<string, { prompt: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

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

  // 4. Page context
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
