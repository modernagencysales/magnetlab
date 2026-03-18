/**
 * Template Matcher Tests — shortlist + rerank.
 * Tests the pure reranking logic and the guidance builder.
 */

import { rerankTemplates, buildTemplateGuidance } from '@/lib/ai/content-pipeline/template-matcher';
import type { RankedTemplate } from '@/lib/ai/content-pipeline/template-matcher';

// ─── Test data ──────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<{
  id: string;
  name: string;
  category: string | null;
  structure: string;
  example_posts: string[] | null;
  use_cases: string[] | null;
  avg_engagement_score: number | null;
  similarity: number;
}> = {}) {
  return {
    id: overrides.id ?? 'tpl-1',
    name: overrides.name ?? 'Test Template',
    category: overrides.category ?? 'story',
    structure: overrides.structure ?? '[HOOK]\n[BODY]\n[CTA]',
    example_posts: overrides.example_posts ?? null,
    use_cases: overrides.use_cases ?? null,
    avg_engagement_score: overrides.avg_engagement_score ?? null,
    similarity: overrides.similarity ?? 0.8,
  };
}

// ─── rerankTemplates: formula application ───────────────────────────────────

describe('rerankTemplates', () => {
  it('applies the correct rerank formula', () => {
    const candidates = [
      makeCandidate({
        id: 'a',
        similarity: 0.9,
        avg_engagement_score: 8.0,
      }),
    ];

    // All scores = [8.0] — percentile of 8.0 in [8.0] = (0 + 1*0.5)/1 = 0.5
    const allScores = [8.0];

    // Never used → freshness = 1.0
    const freshness = new Map<string, Date>();

    const result = rerankTemplates(candidates, freshness, allScores, 3);
    expect(result).toHaveLength(1);

    const t = result[0];
    // semantic: 0.9 * 0.4 = 0.36
    // performance: 0.5 * 0.35 = 0.175
    // freshness: 1.0 * 0.25 = 0.25
    // total = 0.785
    expect(t.rerank_score).toBeCloseTo(0.785, 3);
    expect(t.similarity).toBe(0.9);
    expect(t.performance_score).toBeCloseTo(0.5, 2);
    expect(t.freshness_bonus).toBe(1.0);
  });

  it('treats NULL avg_engagement_score as 0.5 (cold start)', () => {
    const candidates = [
      makeCandidate({
        id: 'cold',
        similarity: 0.7,
        avg_engagement_score: null,
      }),
    ];

    const allScores = [1.0, 2.0, 3.0, 4.0, 5.0]; // reference population
    const freshness = new Map<string, Date>();

    const result = rerankTemplates(candidates, freshness, allScores, 3);
    expect(result[0].performance_score).toBe(0.5);
  });

  it('computes freshness as min(days/14, 1.0)', () => {
    const now = new Date();

    const candidates = [
      makeCandidate({ id: 'recent', similarity: 0.8, avg_engagement_score: null }),
      makeCandidate({ id: 'week-old', similarity: 0.8, avg_engagement_score: null }),
      makeCandidate({ id: 'old', similarity: 0.8, avg_engagement_score: null }),
    ];

    const freshness = new Map<string, Date>();
    // Used today (0 days)
    freshness.set('recent', now);
    // Used 7 days ago
    freshness.set('week-old', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    // Used 28 days ago (> 14 → capped at 1.0)
    freshness.set('old', new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000));

    const result = rerankTemplates(candidates, freshness, [], 3);

    const recentT = result.find((t) => t.id === 'recent')!;
    const weekOldT = result.find((t) => t.id === 'week-old')!;
    const oldT = result.find((t) => t.id === 'old')!;

    expect(recentT.freshness_bonus).toBeCloseTo(0, 1);
    expect(weekOldT.freshness_bonus).toBeCloseTo(0.5, 1);
    expect(oldT.freshness_bonus).toBe(1.0);
  });

  it('assigns freshness 1.0 for never-used templates', () => {
    const candidates = [
      makeCandidate({ id: 'never-used', similarity: 0.6, avg_engagement_score: null }),
    ];

    // Empty freshness map → never used
    const freshness = new Map<string, Date>();

    const result = rerankTemplates(candidates, freshness, [], 3);
    expect(result[0].freshness_bonus).toBe(1.0);
  });

  it('returns top N sorted by rerank_score descending', () => {
    const candidates = [
      makeCandidate({ id: 'low', similarity: 0.3, avg_engagement_score: 1.0 }),
      makeCandidate({ id: 'high', similarity: 0.95, avg_engagement_score: 9.0 }),
      makeCandidate({ id: 'mid', similarity: 0.7, avg_engagement_score: 5.0 }),
      makeCandidate({ id: 'mid2', similarity: 0.65, avg_engagement_score: 6.0 }),
      makeCandidate({ id: 'highest', similarity: 0.99, avg_engagement_score: 10.0 }),
    ];

    const allScores = [1.0, 5.0, 6.0, 9.0, 10.0];
    const freshness = new Map<string, Date>(); // all never used

    const result = rerankTemplates(candidates, freshness, allScores, 3);

    expect(result).toHaveLength(3);
    // Should be sorted descending
    expect(result[0].rerank_score).toBeGreaterThanOrEqual(result[1].rerank_score);
    expect(result[1].rerank_score).toBeGreaterThanOrEqual(result[2].rerank_score);
    // Highest similarity + highest performance should be first
    expect(result[0].id).toBe('highest');
  });

  it('handles empty candidates array', () => {
    const result = rerankTemplates([], new Map(), [], 3);
    expect(result).toEqual([]);
  });
});

// ─── buildTemplateGuidance ──────────────────────────────────────────────────

describe('buildTemplateGuidance', () => {
  it('formats an array of templates into the menu format', () => {
    const templates: RankedTemplate[] = [
      {
        id: '1',
        name: 'Before/After Transformation',
        category: 'story',
        structure: '[BOLD RESULT]  ->  [BEFORE]  ->  [TURNING POINT]  ->  [AFTER]  ->  [TAKEAWAY]',
        example_posts: null,
        use_cases: ['Case studies', 'Client wins'],
        similarity: 0.9,
        performance_score: 0.82,
        freshness_bonus: 1.0,
        rerank_score: 0.897,
      },
      {
        id: '2',
        name: 'Quick Tip',
        category: 'educational',
        structure: '[ONE-LINE TIP]\n[WHY IT WORKS]\n[EXAMPLE]',
        example_posts: null,
        use_cases: ['Daily tips'],
        similarity: 0.8,
        performance_score: 0.5,
        freshness_bonus: 0.7,
        rerank_score: 0.67,
      },
    ];

    const guidance = buildTemplateGuidance(templates);

    expect(guidance).toContain('STRUCTURAL INSPIRATION (2 proven formats');
    expect(guidance).toContain('1. "Before/After Transformation" (story)');
    expect(guidance).toContain('8.2 avg engagement');
    expect(guidance).toContain('2. "Quick Tip" (educational)');
    expect(guidance).toContain('Best for: Case studies; Client wins');
    expect(guidance).toContain('Best for: Daily tips');
    expect(guidance).toContain('Use these as structural inspiration');
  });

  it('returns empty string for empty array', () => {
    expect(buildTemplateGuidance([])).toBe('');
  });

  it('omits engagement label when performance_score is 0.5 (cold start)', () => {
    const templates: RankedTemplate[] = [
      {
        id: '1',
        name: 'Cold Template',
        category: null,
        structure: '[HOOK]\n[BODY]',
        example_posts: null,
        use_cases: null,
        similarity: 0.7,
        performance_score: 0.5,
        freshness_bonus: 1.0,
        rerank_score: 0.705,
      },
    ];

    const guidance = buildTemplateGuidance(templates);

    expect(guidance).toContain('1. "Cold Template"');
    // Should NOT contain an engagement label
    expect(guidance).not.toContain('avg engagement');
  });

  it('includes category when present and omits when null', () => {
    const templates: RankedTemplate[] = [
      {
        id: '1',
        name: 'With Category',
        category: 'framework',
        structure: '[STEPS]',
        example_posts: null,
        use_cases: null,
        similarity: 0.8,
        performance_score: 0.7,
        freshness_bonus: 1.0,
        rerank_score: 0.815,
      },
      {
        id: '2',
        name: 'No Category',
        category: null,
        structure: '[BODY]',
        example_posts: null,
        use_cases: null,
        similarity: 0.6,
        performance_score: 0.5,
        freshness_bonus: 1.0,
        rerank_score: 0.665,
      },
    ];

    const guidance = buildTemplateGuidance(templates);

    expect(guidance).toContain('(framework)');
    // "No Category" line should not have parenthetical category
    const noCatLine = guidance.split('\n').find((l) => l.includes('No Category'));
    expect(noCatLine).not.toContain('(null)');
  });
});
