import type { ContentIdea, ContentPillar } from '@/lib/types/content-pipeline';

export interface ScoringContext {
  recentPostTitles: string[];
  pillarCounts: Record<ContentPillar, number>;
}

export interface ScoreFactors {
  relevance: number;
  freshness: number;
  pillarBalance: number;
  hookStrength: number;
}

export interface IdeaScore {
  ideaId: string;
  compositeScore: number;
  factors: ScoreFactors;
  similarityHash: string;
}

export interface RankedIdea {
  idea: ContentIdea;
  score: IdeaScore;
}

const SCORE_WEIGHTS = {
  relevance: 0.35,
  freshness: 0.25,
  pillarBalance: 0.25,
  hookStrength: 0.15,
} as const;

export function generateSimilarityHash(idea: ContentIdea): string {
  const text = `${idea.title}|${idea.core_insight || ''}`.toLowerCase();
  const words = text
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .slice(0, 10)
    .join('|');
  return words;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

function calculateFreshnessScore(idea: ContentIdea, recentPostTitles: string[]): number {
  if (recentPostTitles.length === 0) return 10;

  const ideaText = `${idea.title} ${idea.core_insight || ''}`;
  let maxSimilarity = 0;

  for (const title of recentPostTitles) {
    const similarity = calculateTextSimilarity(ideaText, title);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return Math.max(0, 10 - maxSimilarity * 15);
}

function calculatePillarBalanceScore(
  idea: ContentIdea,
  pillarCounts: Record<ContentPillar, number>
): number {
  const pillar = idea.content_pillar;
  if (!pillar) return 5;

  const counts = Object.values(pillarCounts);
  const totalPosts = counts.reduce((sum, count) => sum + count, 0);

  if (totalPosts === 0) return 10;

  const pillarCount = pillarCounts[pillar] || 0;
  const avgCount = totalPosts / 4;

  if (pillarCount === 0) return 10;
  if (pillarCount < avgCount) return 8;
  if (pillarCount === avgCount) return 5;
  if (pillarCount > avgCount * 1.5) return 2;
  return 4;
}

function calculateHookStrengthScore(idea: ContentIdea): number {
  let score = 5;

  if (idea.core_insight && idea.core_insight.length > 20) {
    score += 1;
  }

  if (idea.title && /\d+/.test(idea.title)) {
    score += 1;
  }

  if (idea.content_type === 'contrarian' || idea.content_type === 'question') {
    score += 1;
  }

  if (idea.why_post_worthy && idea.why_post_worthy.length > 10) {
    score += 1;
  }

  if (idea.post_ready) {
    score += 1;
  }

  return Math.min(10, score);
}

export function scoreIdea(idea: ContentIdea, context: ScoringContext): IdeaScore {
  const factors: ScoreFactors = {
    relevance: idea.relevance_score ?? 5,
    freshness: calculateFreshnessScore(idea, context.recentPostTitles),
    pillarBalance: calculatePillarBalanceScore(idea, context.pillarCounts),
    hookStrength: calculateHookStrengthScore(idea),
  };

  const compositeScore =
    factors.relevance * SCORE_WEIGHTS.relevance +
    factors.freshness * SCORE_WEIGHTS.freshness +
    factors.pillarBalance * SCORE_WEIGHTS.pillarBalance +
    factors.hookStrength * SCORE_WEIGHTS.hookStrength;

  return {
    ideaId: idea.id,
    compositeScore: Math.min(10, Math.max(0, compositeScore)),
    factors,
    similarityHash: generateSimilarityHash(idea),
  };
}

export function rankIdeas(ideas: ContentIdea[], context: ScoringContext): RankedIdea[] {
  const scoredIdeas = ideas.map((idea) => ({
    idea,
    score: scoreIdea(idea, context),
  }));

  scoredIdeas.sort((a, b) => b.score.compositeScore - a.score.compositeScore);

  return scoredIdeas;
}

export function getTopIdeas(
  ideas: ContentIdea[],
  count: number,
  context: ScoringContext
): RankedIdea[] {
  const ranked = rankIdeas(ideas, context);
  return ranked.slice(0, count);
}

export function deduplicateIdeas(ideas: ContentIdea[]): ContentIdea[] {
  const seen = new Set<string>();
  return ideas.filter((idea) => {
    const hash = generateSimilarityHash(idea);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
}

export function getSuggestedPillar(
  pillarCounts: Record<ContentPillar, number>
): ContentPillar {
  const pillars: ContentPillar[] = [
    'moments_that_matter',
    'teaching_promotion',
    'human_personal',
    'collaboration_social_proof',
  ];

  let minCount = Infinity;
  let suggestedPillar: ContentPillar = 'teaching_promotion';

  for (const pillar of pillars) {
    const count = pillarCounts[pillar] || 0;
    if (count < minCount) {
      minCount = count;
      suggestedPillar = pillar;
    }
  }

  return suggestedPillar;
}
