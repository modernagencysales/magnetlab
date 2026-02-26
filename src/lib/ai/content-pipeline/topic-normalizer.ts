import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

interface NormalizedTopic {
  slug: string;
  display_name: string;
  description: string;
  is_new: boolean;
}

/**
 * Given raw topic suggestions from the AI extractor, normalize them
 * against the user's existing topic vocabulary. Returns normalized topics.
 */
export async function normalizeTopics(
  userId: string,
  suggestedTopics: string[],
  entryContent: string
): Promise<NormalizedTopic[]> {
  if (suggestedTopics.length === 0) return [];

  const supabase = createSupabaseAdminClient();

  // Fetch existing topic vocabulary
  const { data: existingTopics } = await supabase
    .from('cp_knowledge_topics')
    .select('slug, display_name, description')
    .eq('user_id', userId)
    .order('entry_count', { ascending: false })
    .limit(100);

  const vocabulary = (existingTopics || [])
    .map(
      (t) =>
        `${t.slug} (${t.display_name}${t.description ? ': ' + t.description : ''})`
    )
    .join('\n');

  const client = getAnthropicClient('topic-normalizer');
  const response = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Map these suggested topics to the user's existing vocabulary, or create new topics if none match.

SUGGESTED TOPICS: ${suggestedTopics.join(', ')}

ENTRY CONTENT (for context): ${entryContent.slice(0, 500)}

EXISTING VOCABULARY:
${vocabulary || '(empty — all topics will be new)'}

RULES:
- Map to existing slugs when the meaning is the same (e.g., "cold email" matches "cold-email")
- Create new slugs only for genuinely new subjects
- Slugs: lowercase, hyphens, no spaces (e.g., "cold-email", "linkedin-outreach")
- Return 1-3 topics max
- Display names: Title Case
- Description: 1 short sentence

Return JSON array:
[{"slug": "cold-email", "display_name": "Cold Email", "description": "Cold email strategy and execution", "is_new": false}]`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

  try {
    const normalized = parseJsonResponse<NormalizedTopic[]>(text);
    return normalized.slice(0, 3);
  } catch (error) {
    logError('ai/topic-normalizer', error);
    // Fallback: create slugs from raw suggestions
    return suggestedTopics.slice(0, 3).map((t) => ({
      slug: t
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      display_name: t
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      description: '',
      is_new: true,
    }));
  }
}

/**
 * Ensure topics exist in cp_knowledge_topics, creating new ones as needed.
 * Returns the slugs.
 */
export async function upsertTopics(
  userId: string,
  topics: NormalizedTopic[]
): Promise<string[]> {
  const supabase = createSupabaseAdminClient();

  for (const topic of topics) {
    if (topic.is_new) {
      await supabase.from('cp_knowledge_topics').upsert(
        {
          user_id: userId,
          slug: topic.slug,
          display_name: topic.display_name,
          description: topic.description || null,
          entry_count: 0,
        },
        { onConflict: 'user_id,slug' }
      );
    }
  }

  return topics.map((t) => t.slug);
}
