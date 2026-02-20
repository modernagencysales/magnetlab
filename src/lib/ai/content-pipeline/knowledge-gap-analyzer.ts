import type { KnowledgeType, KnowledgeGap } from '@/lib/types/content-pipeline';

const KNOWLEDGE_TYPES: KnowledgeType[] = [
  'how_to', 'insight', 'story', 'question',
  'objection', 'mistake', 'decision', 'market_intel',
];

/**
 * Analyze knowledge gaps for a single topic.
 * Returns coverage score, missing types, and detected gap patterns.
 */
export function analyzeTopicGaps(
  topicSlug: string,
  topicName: string,
  typeBreakdown: Record<string, number>,
  avgQuality: number | null,
  lastEntryDate: string | null
): KnowledgeGap {
  const entryCount = Object.values(typeBreakdown).reduce((a, b) => a + b, 0);
  const filledTypes = KNOWLEDGE_TYPES.filter(t => (typeBreakdown[t] || 0) > 0);
  const missingTypes = KNOWLEDGE_TYPES.filter(t => (typeBreakdown[t] || 0) === 0);
  const coverageScore = filledTypes.length / KNOWLEDGE_TYPES.length;

  const patterns: string[] = [];

  const questionCount = typeBreakdown['question'] || 0;
  const howToCount = typeBreakdown['how_to'] || 0;
  if (questionCount > 3 && howToCount === 0) {
    patterns.push('Asked but not answered — many questions, no how-to processes documented');
  }

  const insightCount = typeBreakdown['insight'] || 0;
  const storyCount = typeBreakdown['story'] || 0;
  if (insightCount > 3 && storyCount === 0) {
    patterns.push('Theory without proof — insights but no case studies or stories');
  }

  if (entryCount > 10 && howToCount === 0) {
    patterns.push('All talk, no process — lots of knowledge but no documented SOPs');
  }

  if (lastEntryDate) {
    const daysSince = Math.floor((Date.now() - new Date(lastEntryDate).getTime()) / 86400000);
    if (daysSince > 90) {
      patterns.push(`Stale knowledge — last entry was ${daysSince} days ago`);
    }
  }

  if (entryCount <= 5 && entryCount >= 2) {
    patterns.push('Thin but trending — a few more calls and you\'ll have enough');
  }

  return {
    topic_slug: topicSlug,
    topic_name: topicName,
    coverage_score: coverageScore,
    type_breakdown: Object.fromEntries(
      KNOWLEDGE_TYPES.map(t => [t, typeBreakdown[t] || 0])
    ) as Record<KnowledgeType, number>,
    missing_types: missingTypes,
    gap_patterns: patterns,
    entry_count: entryCount,
    avg_quality: avgQuality,
    last_entry_date: lastEntryDate,
  };
}
