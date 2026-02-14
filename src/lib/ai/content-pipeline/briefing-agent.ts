import { searchKnowledge } from '@/lib/services/knowledge-brain';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import type { ContentBrief, KnowledgeEntryWithSimilarity } from '@/lib/types/content-pipeline';
import { logWarn } from '@/lib/utils/logger';

export async function buildContentBrief(
  userId: string,
  topic: string,
  options: {
    maxEntries?: number;
    includeCategories?: ('insight' | 'question' | 'product_intel')[];
    teamId?: string;
    profileId?: string;
  } = {}
): Promise<ContentBrief> {
  const { maxEntries = 15, includeCategories = ['insight', 'question', 'product_intel'], teamId, profileId } = options;

  // Search knowledge base for relevant entries
  const searchResult = await searchKnowledge(userId, topic, {
    limit: maxEntries,
    threshold: 0.6,
    teamId,
    profileId,
  });

  if (searchResult.error) {
    logWarn('ai/briefing', 'Knowledge search error', { error: searchResult.error });
  }

  const allEntries = searchResult.entries;

  // Categorize entries
  const insights = allEntries.filter((e) => e.category === 'insight' && includeCategories.includes('insight'));
  const questions = allEntries.filter((e) => e.category === 'question' && includeCategories.includes('question'));
  const productIntel = allEntries.filter((e) => e.category === 'product_intel' && includeCategories.includes('product_intel'));

  // Compile context string for AI prompts
  const compiledContext = compileContext(insights, questions, productIntel);

  // Generate suggested angles if we have enough context
  let suggestedAngles: string[] = [];
  if (allEntries.length >= 3) {
    suggestedAngles = await generateSuggestedAngles(topic, compiledContext);
  }

  return {
    topic,
    relevantInsights: insights,
    relevantQuestions: questions,
    relevantProductIntel: productIntel,
    compiledContext,
    suggestedAngles,
  };
}

function compileContext(
  insights: KnowledgeEntryWithSimilarity[],
  questions: KnowledgeEntryWithSimilarity[],
  productIntel: KnowledgeEntryWithSimilarity[]
): string {
  const sections: string[] = [];

  if (insights.length > 0) {
    sections.push('VALIDATED INSIGHTS FROM YOUR CALLS:');
    for (const entry of insights.slice(0, 8)) {
      sections.push(`- ${entry.content}${entry.context ? ` (Context: ${entry.context})` : ''}`);
    }
  }

  if (questions.length > 0) {
    sections.push('\nQUESTIONS YOUR AUDIENCE ACTUALLY ASKS:');
    for (const entry of questions.slice(0, 5)) {
      sections.push(`- ${entry.content}`);
    }
  }

  if (productIntel.length > 0) {
    sections.push('\nPRODUCT/SERVICE INTEL:');
    for (const entry of productIntel.slice(0, 5)) {
      sections.push(`- ${entry.content}`);
    }
  }

  return sections.join('\n');
}

async function generateSuggestedAngles(topic: string, context: string): Promise<string[]> {
  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Given this topic and knowledge base context, suggest 3-5 unique angles for a LinkedIn post.

TOPIC: ${topic}

CONTEXT:
${context.slice(0, 3000)}

Return ONLY a JSON array of strings, each being a one-sentence angle description.
Example: ["Contrarian take on why X actually hurts more than it helps", "Step-by-step breakdown of the process that generated $Y"]`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    return parseJsonResponse<string[]>(text);
  } catch {
    return [];
  }
}

export async function buildContentBriefForIdea(
  userId: string,
  idea: { title: string; core_insight: string | null; content_type: string | null },
  options: { teamId?: string; profileId?: string } = {}
): Promise<ContentBrief> {
  const searchQuery = [
    idea.title,
    idea.core_insight,
  ].filter(Boolean).join(' ');

  return buildContentBrief(userId, searchQuery, {
    teamId: options.teamId,
    profileId: options.profileId,
  });
}
