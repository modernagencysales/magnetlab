import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';
import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { buildVoicePromptSection } from './voice-prompt-builder';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
import type { ContentBrief, KnowledgeEntryWithSimilarity, KnowledgeType, TeamVoiceProfile } from '@/lib/types/content-pipeline';
import { logWarn } from '@/lib/utils/logger';

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  how_to: 'STEP-BY-STEP PROCESSES',
  insight: 'KEY INSIGHTS',
  story: 'REAL STORIES FROM YOUR EXPERIENCE',
  question: 'QUESTIONS YOUR AUDIENCE ASKS',
  objection: 'OBJECTIONS YOUR AUDIENCE HAS',
  mistake: 'MISTAKES TO WARN ABOUT',
  decision: 'DECISIONS & FRAMEWORKS',
  market_intel: 'MARKET INTELLIGENCE',
};

export async function buildContentBrief(
  userId: string,
  topic: string,
  options: {
    maxEntries?: number;
    includeCategories?: ('insight' | 'question' | 'product_intel')[];
    teamId?: string;
    profileId?: string;
    voiceProfile?: TeamVoiceProfile;
  } = {}
): Promise<ContentBrief> {
  const { maxEntries = 15, teamId, profileId, voiceProfile } = options;

  // Search knowledge base using V2 with quality filtering
  const searchResult = await searchKnowledgeV2(userId, {
    query: topic,
    limit: maxEntries,
    threshold: 0.5,
    minQuality: 2,
    teamId,
    profileId,
  });

  if (searchResult.error) {
    logWarn('ai/briefing', 'Knowledge search error', { error: searchResult.error });
  }

  // Sort all entries by quality_score descending
  const allEntries = [...searchResult.entries].sort(
    (a, b) => (b.quality_score || 0) - (a.quality_score || 0)
  );

  // Backward-compatible categorization by old category field
  const insights = allEntries.filter((e) => e.category === 'insight');
  const questions = allEntries.filter((e) => e.category === 'question');
  const productIntel = allEntries.filter((e) => e.category === 'product_intel');

  // Compile context using V2 grouping by knowledge_type
  const compiledContext = compileContextV2(allEntries);

  // Compute topic readiness score
  const uniqueTypes = new Set(
    allEntries.map((e) => e.knowledge_type || e.category).filter(Boolean)
  );
  const avgQuality =
    allEntries.length > 0
      ? allEntries.reduce((sum, e) => sum + (e.quality_score || 0), 0) / allEntries.length
      : 0;
  const topicReadiness = Math.min(
    1,
    (allEntries.length / 15) * 0.5 + (uniqueTypes.size / 5) * 0.3 + (avgQuality / 5) * 0.2
  );

  // Track top knowledge types from entries
  const topKnowledgeTypes = [...uniqueTypes].filter(
    (t): t is KnowledgeType =>
      ['how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'].includes(t)
  );

  // Generate suggested angles if we have enough context
  let suggestedAngles: string[] = [];
  if (allEntries.length >= 3) {
    suggestedAngles = await generateSuggestedAngles(topic, compiledContext, voiceProfile);
  }

  return {
    topic,
    relevantInsights: insights,
    relevantQuestions: questions,
    relevantProductIntel: productIntel,
    compiledContext,
    suggestedAngles,
    topicReadiness,
    topKnowledgeTypes,
  };
}

function compileContextV2(entries: KnowledgeEntryWithSimilarity[]): string {
  const grouped: Record<string, KnowledgeEntryWithSimilarity[]> = {};
  for (const entry of entries) {
    const kt = entry.knowledge_type || entry.category;
    if (!grouped[kt]) grouped[kt] = [];
    grouped[kt].push(entry);
  }

  const sections: string[] = [];
  for (const [type, typeEntries] of Object.entries(grouped)) {
    const label = KNOWLEDGE_TYPE_LABELS[type] || type.toUpperCase();
    sections.push(label + ':');
    for (const entry of typeEntries.slice(0, 8)) {
      const qualityTag = (entry.quality_score || 0) >= 4 ? ' [HIGH QUALITY]' : '';
      sections.push(`- ${entry.content}${entry.context ? ` (Context: ${entry.context})` : ''}${qualityTag}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

async function generateSuggestedAngles(topic: string, context: string, voiceProfile?: TeamVoiceProfile): Promise<string[]> {
  try {
    const client = getAnthropicClient();

    const styleSection = buildVoicePromptSection(voiceProfile, 'linkedin');
    const styleInstruction = styleSection
      ? `\nAUTHOR STYLE PREFERENCES:\n${styleSection}\n\nSuggest angles that align with this author's voice and preferences.\n`
      : '';

    const template = await getPrompt('content-brief-angles');
    const prompt = interpolatePrompt(template.user_prompt, {
      topic,
      compiled_context: context.slice(0, 3000),
      voice_style_section: styleInstruction,
    });

    const response = await client.messages.create({
      model: template.model,
      max_tokens: template.max_tokens,
      messages: [
        {
          role: 'user',
          content: prompt,
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
  options: { teamId?: string; profileId?: string; voiceProfile?: TeamVoiceProfile } = {}
): Promise<ContentBrief> {
  const searchQuery = [
    idea.title,
    idea.core_insight,
  ].filter(Boolean).join(' ');

  return buildContentBrief(userId, searchQuery, {
    teamId: options.teamId,
    profileId: options.profileId,
    voiceProfile: options.voiceProfile,
  });
}
