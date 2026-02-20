import { getAnthropicClient } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';
import { logError } from '@/lib/utils/logger';

interface SummaryEntry {
  content: string;
  quality_score?: number | null;
}

/**
 * Generate a synthesized summary of all knowledge entries for a topic.
 * Groups entries by knowledge type and produces a coherent 200-400 word briefing.
 */
export async function generateTopicSummary(
  topicName: string,
  entriesByType: Record<string, SummaryEntry[]>
): Promise<string> {
  const totalEntries = Object.values(entriesByType).reduce((sum, entries) => sum + entries.length, 0);

  if (totalEntries === 0) {
    return `${topicName} has no knowledge entries yet. Process more transcripts to build knowledge on this topic.`;
  }

  // Build context from entries, prioritizing higher quality
  const sections: string[] = [];
  for (const [type, entries] of Object.entries(entriesByType)) {
    if (entries.length === 0) continue;
    const sorted = [...entries].sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
    const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    sections.push(`## ${label} (${entries.length})`);
    for (const entry of sorted.slice(0, 10)) {
      sections.push(`- ${entry.content}`);
    }
  }

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Synthesize these knowledge entries about "${topicName}" into a concise briefing (200-400 words).

Organize by THEME (not by knowledge type). Include:
- Key insights and patterns
- Actionable takeaways
- Open questions or gaps
- Notable stories or examples

Do NOT use headers or bullet points — write flowing paragraphs. Reference specific knowledge when possible.

KNOWLEDGE ENTRIES:
${sections.join('\n')}`,
      }],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : `Summary generation failed for ${topicName}.`;
  } catch (error) {
    logError('ai/topic-summarizer', error);
    // Fallback: simple count summary
    const typeCounts = Object.entries(entriesByType)
      .filter(([, entries]) => entries.length > 0)
      .map(([type, entries]) => `${entries.length} ${type.replace(/_/g, ' ')}${entries.length > 1 ? 's' : ''}`)
      .join(', ');
    return `${topicName} contains ${totalEntries} knowledge entries: ${typeCounts}. AI summary generation is temporarily unavailable.`;
  }
}
