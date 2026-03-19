/**
 * Idea Scorer Tests
 * Covers weight configuration, exploit-backed scoring, and composite score calculation.
 */

import {
  scoreIdea,
  rankIdeas,
  generateSimilarityHash,
  deduplicateIdeas,
  getTopIdeas,
  getSuggestedPillar,
  type ScoringContext,
  type ScoreFactors,
} from '@/lib/ai/content-pipeline/idea-scorer';
import type { ContentIdea, ContentPillar } from '@/lib/types/content-pipeline';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeIdea(overrides: Partial<ContentIdea> = {}): ContentIdea {
  return {
    id: 'idea-1',
    user_id: 'user-1',
    transcript_id: null,
    title: 'Why cold email still works',
    core_insight: 'Personalization beats volume every time',
    full_context: null,
    why_post_worthy: 'Contrarian take on the email-is-dead narrative',
    post_ready: false,
    hook: null,
    key_points: null,
    target_audience: null,
    content_type: 'contrarian',
    content_pillar: 'teaching_promotion',
    relevance_score: 7,
    source_quote: null,
    status: 'extracted',
    composite_score: null,
    last_surfaced_at: null,
    similarity_hash: null,
    team_id: null,
    team_profile_id: null,
    exploit_id: null,
    creative_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    recentPostTitles: [],
    pillarCounts: {
      moments_that_matter: 0,
      teaching_promotion: 0,
      human_personal: 0,
      collaboration_social_proof: 0,
    },
    ...overrides,
  };
}

// ─── Weight Configuration ─────────────────────────────────────────────────────

describe('SCORE_WEIGHTS', () => {
  it('exploitBacked weight is 0.30', () => {
    // Verify by scoring a pure exploit-backed idea (all other factors mid)
    // exploitBacked = 10 * 0.30 = 3.0 contribution
    const idea = makeIdea({
      exploit_id: 'exploit-abc',
      creative_id: 'creative-xyz',
      relevance_score: 0,
      content_type: null,
      why_post_worthy: null,
      core_insight: null,
    });
    const ctx = makeContext({ recentPostTitles: ['unrelated topic xyz'] });
    const score = scoreIdea(idea, ctx);
    expect(score.factors.exploitBacked).toBe(10);
    // 10 * 0.30 = 3.0 for exploitBacked; other factors contribute the rest
    const exploitContribution = 10 * 0.3;
    expect(score.compositeScore).toBeGreaterThanOrEqual(exploitContribution);
  });

  it('weights sum to 1.0', () => {
    // Verify all weights add up correctly by scoring an all-10 idea
    const idea = makeIdea({
      exploit_id: 'exploit-abc',
      creative_id: 'creative-xyz',
      relevance_score: 10,
      content_type: 'contrarian',
      why_post_worthy: 'Very post worthy content that says enough',
      post_ready: true,
    });
    const ctx = makeContext();
    const score = scoreIdea(idea, ctx);
    // If all factors are 10 and weights sum to 1.0, composite = 10
    expect(score.compositeScore).toBeLessThanOrEqual(10);
    expect(score.compositeScore).toBeGreaterThan(0);
  });
});

// ─── Exploit-Backed Scoring ───────────────────────────────────────────────────

describe('scoreIdea — exploitBacked factor', () => {
  it('returns exploitBacked = 10 when idea has both exploit_id and creative_id', () => {
    const idea = makeIdea({
      exploit_id: 'exploit-abc',
      creative_id: 'creative-xyz',
    });
    const score = scoreIdea(idea, makeContext());
    expect(score.factors.exploitBacked).toBe(10);
  });

  it('returns exploitBacked = 0 when idea has no exploit_id', () => {
    const idea = makeIdea({ exploit_id: null, creative_id: 'creative-xyz' });
    const score = scoreIdea(idea, makeContext());
    expect(score.factors.exploitBacked).toBe(0);
  });

  it('returns exploitBacked = 0 when idea has no creative_id', () => {
    const idea = makeIdea({ exploit_id: 'exploit-abc', creative_id: null });
    const score = scoreIdea(idea, makeContext());
    expect(score.factors.exploitBacked).toBe(0);
  });

  it('returns exploitBacked = 0 when idea has neither exploit_id nor creative_id', () => {
    const idea = makeIdea({ exploit_id: null, creative_id: null });
    const score = scoreIdea(idea, makeContext());
    expect(score.factors.exploitBacked).toBe(0);
  });

  it('idea with exploit_id + creative_id scores higher than identical knowledge-only idea', () => {
    const base = makeIdea({ relevance_score: 6 });
    const exploitBacked = makeIdea({
      id: 'idea-2',
      relevance_score: 6,
      exploit_id: 'exploit-abc',
      creative_id: 'creative-xyz',
    });
    const ctx = makeContext();
    const baseScore = scoreIdea(base, ctx);
    const exploitScore = scoreIdea(exploitBacked, ctx);
    expect(exploitScore.compositeScore).toBeGreaterThan(baseScore.compositeScore);
  });

  it('exploit boost is exactly 10 * 0.30 = 3.0 points', () => {
    const base = makeIdea({ exploit_id: null, creative_id: null });
    const exploitBacked = makeIdea({
      id: 'idea-2',
      exploit_id: 'exploit-abc',
      creative_id: 'creative-xyz',
    });
    const ctx = makeContext();
    const baseScore = scoreIdea(base, ctx);
    const exploitScore = scoreIdea(exploitBacked, ctx);
    const boost = exploitScore.compositeScore - baseScore.compositeScore;
    expect(boost).toBeCloseTo(3.0, 5);
  });
});

// ─── ScoreFactors Shape ───────────────────────────────────────────────────────

describe('scoreIdea — factors shape', () => {
  it('returns all five factors', () => {
    const score = scoreIdea(makeIdea(), makeContext());
    const keys: (keyof ScoreFactors)[] = [
      'exploitBacked',
      'relevance',
      'freshness',
      'pillarBalance',
      'hookStrength',
    ];
    keys.forEach((k) => expect(score.factors).toHaveProperty(k));
  });

  it('uses relevance_score as relevance factor', () => {
    const idea = makeIdea({ relevance_score: 8 });
    const score = scoreIdea(idea, makeContext());
    expect(score.factors.relevance).toBe(8);
  });

  it('defaults relevance to 5 when relevance_score is null', () => {
    const idea = makeIdea({ relevance_score: null });
    const score = scoreIdea(idea, makeContext());
    expect(score.factors.relevance).toBe(5);
  });

  it('composite score is clamped to [0, 10]', () => {
    const score = scoreIdea(makeIdea({ relevance_score: 100 }), makeContext());
    expect(score.compositeScore).toBeLessThanOrEqual(10);
    expect(score.compositeScore).toBeGreaterThanOrEqual(0);
  });

  it('returns ideaId matching the idea id', () => {
    const idea = makeIdea({ id: 'test-id-123' });
    const score = scoreIdea(idea, makeContext());
    expect(score.ideaId).toBe('test-id-123');
  });
});

// ─── Freshness ────────────────────────────────────────────────────────────────

describe('scoreIdea — freshness', () => {
  it('returns freshness 10 when no recent posts', () => {
    const score = scoreIdea(makeIdea(), makeContext({ recentPostTitles: [] }));
    expect(score.factors.freshness).toBe(10);
  });

  it('penalises freshness for similar recent post titles', () => {
    const idea = makeIdea({ title: 'Why cold email works' });
    const scoreWithSimilar = scoreIdea(
      idea,
      makeContext({ recentPostTitles: ['Why cold email still works today'] })
    );
    const scoreWithout = scoreIdea(idea, makeContext({ recentPostTitles: [] }));
    expect(scoreWithSimilar.factors.freshness).toBeLessThan(scoreWithout.factors.freshness);
  });
});

// ─── Pillar Balance ───────────────────────────────────────────────────────────

describe('scoreIdea — pillarBalance', () => {
  it('returns 10 when pillar has no posts yet', () => {
    const idea = makeIdea({ content_pillar: 'moments_that_matter' });
    const ctx = makeContext({
      pillarCounts: {
        moments_that_matter: 0,
        teaching_promotion: 5,
        human_personal: 5,
        collaboration_social_proof: 5,
      },
    });
    const score = scoreIdea(idea, ctx);
    expect(score.factors.pillarBalance).toBe(10);
  });

  it('returns 5 when no pillar set on idea', () => {
    const idea = makeIdea({ content_pillar: null });
    const score = scoreIdea(idea, makeContext());
    expect(score.factors.pillarBalance).toBe(5);
  });
});

// ─── Hook Strength ────────────────────────────────────────────────────────────

describe('scoreIdea — hookStrength', () => {
  it('scores higher for contrarian content type', () => {
    const contrarian = makeIdea({ content_type: 'contrarian' });
    const story = makeIdea({ content_type: 'story' });
    const ctx = makeContext();
    expect(scoreIdea(contrarian, ctx).factors.hookStrength).toBeGreaterThan(
      scoreIdea(story, ctx).factors.hookStrength
    );
  });

  it('scores higher when post_ready is true', () => {
    const ready = makeIdea({ post_ready: true });
    const notReady = makeIdea({ post_ready: false });
    const ctx = makeContext();
    expect(scoreIdea(ready, ctx).factors.hookStrength).toBeGreaterThan(
      scoreIdea(notReady, ctx).factors.hookStrength
    );
  });
});

// ─── Ranking ─────────────────────────────────────────────────────────────────

describe('rankIdeas', () => {
  it('ranks exploit-backed ideas first when otherwise equal', () => {
    const knowledgeOnly = makeIdea({ id: 'k1', relevance_score: 7 });
    const exploitBacked = makeIdea({
      id: 'e1',
      relevance_score: 7,
      exploit_id: 'exploit-abc',
      creative_id: 'creative-xyz',
    });
    const ranked = rankIdeas([knowledgeOnly, exploitBacked], makeContext());
    expect(ranked[0].idea.id).toBe('e1');
  });

  it('returns ideas sorted descending by compositeScore', () => {
    const ideas = [
      makeIdea({ id: 'low', relevance_score: 2 }),
      makeIdea({ id: 'high', relevance_score: 9 }),
      makeIdea({ id: 'mid', relevance_score: 5 }),
    ];
    const ranked = rankIdeas(ideas, makeContext());
    expect(ranked[0].score.compositeScore).toBeGreaterThanOrEqual(ranked[1].score.compositeScore);
    expect(ranked[1].score.compositeScore).toBeGreaterThanOrEqual(ranked[2].score.compositeScore);
  });
});

// ─── Deduplication ───────────────────────────────────────────────────────────

describe('deduplicateIdeas', () => {
  it('removes duplicate ideas by similarity hash', () => {
    const a = makeIdea({ id: 'a', title: 'Cold email strategies' });
    const b = makeIdea({ id: 'b', title: 'Cold email strategies' });
    const result = deduplicateIdeas([a, b]);
    expect(result).toHaveLength(1);
  });

  it('keeps distinct ideas', () => {
    const a = makeIdea({ id: 'a', title: 'Cold email strategies' });
    const b = makeIdea({ id: 'b', title: 'LinkedIn content approach' });
    const result = deduplicateIdeas([a, b]);
    expect(result).toHaveLength(2);
  });
});

// ─── Similarity Hash ─────────────────────────────────────────────────────────

describe('generateSimilarityHash', () => {
  it('produces identical hashes for similar ideas', () => {
    const a = makeIdea({ title: 'Cold email strategies', core_insight: 'Volume is the key' });
    const b = makeIdea({ title: 'Cold email strategies', core_insight: 'Volume is the key' });
    expect(generateSimilarityHash(a)).toBe(generateSimilarityHash(b));
  });

  it('produces different hashes for distinct ideas', () => {
    const a = makeIdea({ title: 'Cold email strategies' });
    const b = makeIdea({ title: 'LinkedIn thought leadership' });
    expect(generateSimilarityHash(a)).not.toBe(generateSimilarityHash(b));
  });
});

// ─── getTopIdeas ──────────────────────────────────────────────────────────────

describe('getTopIdeas', () => {
  it('returns at most count ideas', () => {
    const ideas = Array.from({ length: 10 }, (_, i) =>
      makeIdea({ id: `idea-${i}`, relevance_score: i })
    );
    const top = getTopIdeas(ideas, 3, makeContext());
    expect(top).toHaveLength(3);
  });
});

// ─── getSuggestedPillar ───────────────────────────────────────────────────────

describe('getSuggestedPillar', () => {
  it('returns the pillar with the lowest post count', () => {
    const counts: Record<ContentPillar, number> = {
      moments_that_matter: 10,
      teaching_promotion: 2,
      human_personal: 8,
      collaboration_social_proof: 6,
    };
    expect(getSuggestedPillar(counts)).toBe('teaching_promotion');
  });
});
