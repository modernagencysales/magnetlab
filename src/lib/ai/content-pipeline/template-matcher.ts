/**
 * Template Matcher — Shortlist + Rerank.
 * Retrieves top 10 templates via pgvector semantic search, then reranks using
 * three signals: semantic similarity, performance score, and freshness bonus.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { generateEmbedding, isEmbeddingsConfigured } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';
import * as cpTemplatesRepo from '@/server/repositories/cp-templates.repo';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RankedTemplate {
  id: string;
  name: string;
  category: string | null;
  structure: string;
  example_posts: string[] | null;
  use_cases: string[] | null;
  similarity: number;
  performance_score: number;
  freshness_bonus: number;
  rerank_score: number;
}

// ─── Rerank scoring ─────────────────────────────────────────────────────────

const WEIGHT_SEMANTIC = 0.4;
const WEIGHT_PERFORMANCE = 0.35;
const WEIGHT_FRESHNESS = 0.25;
const FRESHNESS_WINDOW_DAYS = 14;
const SHORTLIST_COUNT = 10;

/**
 * Compute percentile rank of a value within a sorted (ascending) array.
 * Returns 0-1. NULL values (represented as null in the input) are excluded
 * from the reference array but map to 0.5 when scored (cold start).
 */
function percentileRank(value: number | null, allScores: (number | null)[]): number {
  if (value === null || value === undefined) return 0.5;

  const validScores = allScores.filter((s): s is number => s !== null && s !== undefined);
  if (validScores.length === 0) return 0.5;

  const sorted = [...validScores].sort((a, b) => a - b);
  const below = sorted.filter((s) => s < value).length;
  const equal = sorted.filter((s) => s === value).length;

  return (below + equal * 0.5) / sorted.length;
}

/**
 * Compute freshness bonus based on days since last use.
 * Never used = 1.0 (maximum freshness).
 * Used today = 0. Used 7 days ago = 0.5. Used 14+ days ago = 1.0.
 */
function computeFreshnessBonus(lastUsedAt: Date | null): number {
  if (!lastUsedAt) return 1.0;

  const now = new Date();
  const diffMs = now.getTime() - lastUsedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return Math.min(diffDays / FRESHNESS_WINDOW_DAYS, 1.0);
}

/**
 * Pure reranking function. Takes shortlisted candidates + freshness data +
 * all engagement scores (for percentile computation) and returns sorted
 * RankedTemplate[].
 *
 * Exported for testability — the integration function is matchAndRerankTemplates.
 */
export function rerankTemplates(
  candidates: Array<{
    id: string;
    name: string;
    category: string | null;
    structure: string;
    example_posts: string[] | null;
    use_cases: string[] | null;
    avg_engagement_score: number | null;
    similarity: number;
  }>,
  freshnessByTemplateId: Map<string, Date>,
  allEngagementScores: (number | null)[],
  count: number
): RankedTemplate[] {
  const ranked = candidates.map((c) => {
    const performanceScore = percentileRank(c.avg_engagement_score, allEngagementScores);
    const lastUsedAt = freshnessByTemplateId.get(c.id) ?? null;
    const freshnessBonus = computeFreshnessBonus(lastUsedAt);

    const rerankScore =
      c.similarity * WEIGHT_SEMANTIC +
      performanceScore * WEIGHT_PERFORMANCE +
      freshnessBonus * WEIGHT_FRESHNESS;

    return {
      id: c.id,
      name: c.name,
      category: c.category,
      structure: c.structure,
      example_posts: c.example_posts,
      use_cases: c.use_cases,
      similarity: c.similarity,
      performance_score: performanceScore,
      freshness_bonus: freshnessBonus,
      rerank_score: rerankScore,
    };
  });

  ranked.sort((a, b) => b.rerank_score - a.rerank_score);
  return ranked.slice(0, count);
}

// ─── Integration ────────────────────────────────────────────────────────────

/**
 * Full shortlist+rerank pipeline:
 * 1. Generate embedding for topicText
 * 2. Retrieve top 10 candidates via cp_match_templates RPC (team-scoped)
 * 3. Fetch freshness data per-profile and all engagement scores
 * 4. Rerank and return top `count` templates
 *
 * Returns empty array on error or when embeddings are not configured.
 */
export async function matchAndRerankTemplates(
  topicText: string,
  teamId: string,
  profileId: string,
  count: number = 3
): Promise<RankedTemplate[]> {
  try {
    if (!isEmbeddingsConfigured()) {
      return [];
    }

    const embedding = await generateEmbedding(topicText);
    const embeddingJson = JSON.stringify(embedding);

    // Step 1: Retrieve shortlist from pgvector
    const { data: candidates, error } = await cpTemplatesRepo.matchTemplatesRpc(
      teamId,
      embeddingJson,
      SHORTLIST_COUNT,
      0.3
    );

    if (error) {
      logError('ai/template-matcher', new Error('cp_match_templates RPC failed'), {
        detail: error.message,
        teamId,
      });
      return [];
    }

    if (!candidates || candidates.length === 0) {
      return [];
    }

    // Step 2: Fetch freshness data (last use per profile)
    const candidateIds = candidates.map((c: { id: string }) => c.id);
    const freshnessByTemplateId = await cpTemplatesRepo.getTemplateUsageByProfile(
      candidateIds,
      profileId
    );

    // Step 3: Fetch all engagement scores for percentile ranking
    const allEngagementScores = await cpTemplatesRepo.getAllEngagementScores(teamId);

    // Step 4: Rerank and return top N
    return rerankTemplates(candidates, freshnessByTemplateId, allEngagementScores, count);
  } catch (err) {
    logError('ai/template-matcher', err, { teamId, profileId, topicText: topicText.slice(0, 200) });
    return [];
  }
}

// ─── Guidance builder ───────────────────────────────────────────────────────

/**
 * Builds a text block from ranked templates that can be injected into a
 * post-writer prompt as soft structural inspiration.
 */
export function buildTemplateGuidance(templates: RankedTemplate[]): string {
  if (templates.length === 0) return '';

  const lines: string[] = [];
  lines.push(
    `STRUCTURAL INSPIRATION (${templates.length} proven formats — use elements freely, blend, or ignore):`
  );
  lines.push('');

  templates.forEach((t, i) => {
    const engagementLabel =
      t.performance_score !== 0.5
        ? ` — ${(t.performance_score * 10).toFixed(1)} avg engagement`
        : '';
    const categoryLabel = t.category ? ` (${t.category})` : '';

    lines.push(`${i + 1}. "${t.name}"${categoryLabel}${engagementLabel}`);
    lines.push(`   ${t.structure}`);

    if (t.use_cases && t.use_cases.length > 0) {
      lines.push(`   Best for: ${t.use_cases.join('; ')}`);
    }

    lines.push('');
  });

  lines.push(
    'Use these as structural inspiration. Adapt freely to fit the topic and voice. Do not force content into placeholders that don\'t apply.'
  );

  return lines.join('\n');
}
