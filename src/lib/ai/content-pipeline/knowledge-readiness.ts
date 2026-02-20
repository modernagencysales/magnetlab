import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';
import type { KnowledgeReadiness } from '@/lib/types/content-pipeline';
import { logError } from '@/lib/utils/logger';

export type ReadinessGoal = 'lead_magnet' | 'blog_post' | 'course' | 'sop' | 'content_week';

const GOAL_THRESHOLDS: Record<ReadinessGoal, { minEntries: number; minTypes: number; minAvgQuality: number }> = {
  lead_magnet: { minEntries: 8, minTypes: 3, minAvgQuality: 3.5 },
  blog_post: { minEntries: 5, minTypes: 2, minAvgQuality: 3.0 },
  course: { minEntries: 20, minTypes: 5, minAvgQuality: 3.5 },
  sop: { minEntries: 5, minTypes: 2, minAvgQuality: 3.0 },
  content_week: { minEntries: 10, minTypes: 3, minAvgQuality: 3.0 },
};

/**
 * Assess whether the user has enough knowledge on a topic for a given goal.
 */
export async function assessReadiness(
  userId: string,
  topic: string,
  goal: ReadinessGoal
): Promise<KnowledgeReadiness> {
  const result = await searchKnowledgeV2(userId, {
    query: topic,
    limit: 50,
    threshold: 0.5,
    minQuality: 2,
  });

  const entries = result.entries;
  const typeCount: Record<string, number> = {};
  for (const e of entries) {
    const kt = (e as Record<string, unknown>).knowledge_type as string || e.category;
    typeCount[kt] = (typeCount[kt] || 0) + 1;
  }

  const totalEntries = entries.length;
  const avgQuality = entries.reduce((sum, e) => {
    const qs = (e as Record<string, unknown>).quality_score as number | null;
    return sum + (qs || 3);
  }, 0) / Math.max(totalEntries, 1);
  const highQualityCount = entries.filter(e => {
    const qs = (e as Record<string, unknown>).quality_score as number | null;
    return (qs || 3) >= 4;
  }).length;

  const threshold = GOAL_THRESHOLDS[goal] || GOAL_THRESHOLDS.lead_magnet;
  const typesPresent = Object.keys(typeCount).length;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Assess knowledge readiness. Topic: "${topic}", Goal: "${goal}".

Stats: ${totalEntries} entries, ${typesPresent} types, avg quality ${avgQuality.toFixed(1)}/5, ${highQualityCount} high-quality entries.

Type breakdown: ${JSON.stringify(typeCount)}

Sample high-quality entries:
${entries.slice(0, 5).map(e => `- [${(e as Record<string, unknown>).knowledge_type || e.category}] ${e.content.slice(0, 150)}`).join('\n')}

Return JSON: {"ready": bool, "confidence": 0-1, "reasoning": "1-2 sentences", "gaps_that_would_improve": ["..."], "suggested_archetypes": ["..."]}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const assessment = parseJsonResponse<Omit<KnowledgeReadiness, 'topic_coverage'>>(text);

    return { ...assessment, topic_coverage: typeCount };
  } catch (error) {
    logError('ai/knowledge-readiness', error);
    const ready = totalEntries >= threshold.minEntries
      && typesPresent >= threshold.minTypes
      && avgQuality >= threshold.minAvgQuality;

    return {
      ready,
      confidence: ready ? 0.7 : 0.4,
      reasoning: ready
        ? `You have ${totalEntries} entries across ${typesPresent} types with ${avgQuality.toFixed(1)} avg quality.`
        : `Need more knowledge: ${totalEntries}/${threshold.minEntries} entries, ${typesPresent}/${threshold.minTypes} types.`,
      gaps_that_would_improve: [],
      suggested_archetypes: [],
      topic_coverage: typeCount,
    };
  }
}
