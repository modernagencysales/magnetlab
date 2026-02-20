/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// Mock knowledge-brain service
const mockListKnowledgeTopics = jest.fn();
const mockGetTopicDetail = jest.fn();
const mockGenerateAndCacheTopicSummary = jest.fn();
const mockGetRecentKnowledgeDigest = jest.fn();
const mockExportTopicKnowledge = jest.fn();

jest.mock('@/lib/services/knowledge-brain', () => ({
  listKnowledgeTopics: (...args: unknown[]) => mockListKnowledgeTopics(...args),
  getTopicDetail: (...args: unknown[]) => mockGetTopicDetail(...args),
  generateAndCacheTopicSummary: (...args: unknown[]) => mockGenerateAndCacheTopicSummary(...args),
  getRecentKnowledgeDigest: (...args: unknown[]) => mockGetRecentKnowledgeDigest(...args),
  exportTopicKnowledge: (...args: unknown[]) => mockExportTopicKnowledge(...args),
  searchKnowledgeV2: jest.fn(),
}));

// Mock knowledge-readiness
const mockAssessReadiness = jest.fn();
jest.mock('@/lib/ai/content-pipeline/knowledge-readiness', () => ({
  assessReadiness: (...args: unknown[]) => mockAssessReadiness(...args),
}));

// Mock knowledge-gap-analyzer
const mockAnalyzeTopicGaps = jest.fn();
jest.mock('@/lib/ai/content-pipeline/knowledge-gap-analyzer', () => ({
  analyzeTopicGaps: (...args: unknown[]) => mockAnalyzeTopicGaps(...args),
}));

import { auth } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as never);
}

function mockAuthenticated(userId = 'user-123') {
  (auth as jest.Mock).mockResolvedValue({ user: { id: userId } });
}

function mockUnauthenticated() {
  (auth as jest.Mock).mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Topics list — GET /api/content-pipeline/knowledge/topics
// ---------------------------------------------------------------------------
describe('Knowledge API — Topics list', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/content-pipeline/knowledge/topics/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/topics'));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns topics with default limit of 50', async () => {
    mockAuthenticated();
    const topics = [
      { slug: 'sales', display_name: 'Sales', entry_count: 12, avg_quality: 4.1 },
      { slug: 'ai', display_name: 'AI', entry_count: 8, avg_quality: 3.8 },
    ];
    mockListKnowledgeTopics.mockResolvedValue(topics);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/topics'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.topics).toHaveLength(2);
    expect(data.topics[0].slug).toBe('sales');

    // Verify default limit passed
    expect(mockListKnowledgeTopics).toHaveBeenCalledWith('user-123', { teamId: undefined, limit: 50 });
  });

  it('passes team_id to service when provided', async () => {
    mockAuthenticated();
    mockListKnowledgeTopics.mockResolvedValue([]);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/topics?team_id=team-abc'));
    expect(res.status).toBe(200);

    expect(mockListKnowledgeTopics).toHaveBeenCalledWith('user-123', { teamId: 'team-abc', limit: 50 });
  });

  it('passes custom limit when provided', async () => {
    mockAuthenticated();
    mockListKnowledgeTopics.mockResolvedValue([]);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/topics?limit=10'));
    expect(res.status).toBe(200);

    expect(mockListKnowledgeTopics).toHaveBeenCalledWith('user-123', { teamId: undefined, limit: 10 });
  });

  it('returns 500 when service throws', async () => {
    mockAuthenticated();
    mockListKnowledgeTopics.mockRejectedValue(new Error('DB timeout'));

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/topics'));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Topic detail — GET /api/content-pipeline/knowledge/topics/[slug]
// ---------------------------------------------------------------------------
describe('Knowledge API — Topic detail', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/content-pipeline/knowledge/topics/[slug]/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function callGET(slug: string, query = '') {
    return GET(
      makeRequest(`/api/content-pipeline/knowledge/topics/${slug}${query}`),
      { params: Promise.resolve({ slug }) }
    );
  }

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated();
    const res = await callGET('sales');
    expect(res.status).toBe(401);
  });

  it('returns topic detail for valid slug', async () => {
    mockAuthenticated();
    const detail = {
      topic: { slug: 'sales', display_name: 'Sales', entry_count: 12 },
      type_breakdown: { how_to: 5, insight: 3 },
      top_entries: {},
      corroboration_count: 2,
    };
    mockGetTopicDetail.mockResolvedValue(detail);

    const res = await callGET('sales');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.topic.slug).toBe('sales');
    expect(data.type_breakdown).toEqual({ how_to: 5, insight: 3 });
    expect(mockGetTopicDetail).toHaveBeenCalledWith('user-123', 'sales');
  });

  it('returns 404 when topic not found', async () => {
    mockAuthenticated();
    mockGetTopicDetail.mockResolvedValue({
      topic: null,
      type_breakdown: {},
      top_entries: {},
      corroboration_count: 0,
    });

    const res = await callGET('nonexistent');
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Topic not found');
  });
});

// ---------------------------------------------------------------------------
// Topic summary — POST /api/content-pipeline/knowledge/topics/[slug]/summary
// ---------------------------------------------------------------------------
describe('Knowledge API — Topic summary', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/content-pipeline/knowledge/topics/[slug]/summary/route');
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function callPOST(slug: string, query = '') {
    return POST(
      makeRequest(`/api/content-pipeline/knowledge/topics/${slug}/summary${query}`, { method: 'POST' }),
      { params: Promise.resolve({ slug }) }
    );
  }

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated();
    const res = await callPOST('sales');
    expect(res.status).toBe(401);
  });

  it('returns summary from service', async () => {
    mockAuthenticated();
    mockGenerateAndCacheTopicSummary.mockResolvedValue({
      summary: 'Sales is about closing deals.',
      cached: false,
    });

    const res = await callPOST('sales');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.summary).toBe('Sales is about closing deals.');
    expect(data.cached).toBe(false);
    expect(mockGenerateAndCacheTopicSummary).toHaveBeenCalledWith('user-123', 'sales', false);
  });

  it('passes force=true when query param set', async () => {
    mockAuthenticated();
    mockGenerateAndCacheTopicSummary.mockResolvedValue({
      summary: 'Refreshed summary.',
      cached: false,
    });

    const res = await callPOST('sales', '?force=true');
    expect(res.status).toBe(200);

    expect(mockGenerateAndCacheTopicSummary).toHaveBeenCalledWith('user-123', 'sales', true);
  });

  it('returns 404 when topic not found', async () => {
    mockAuthenticated();
    mockGenerateAndCacheTopicSummary.mockRejectedValue(new Error('Topic not found: bogus'));

    const res = await callPOST('bogus');
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Topic not found');
  });
});

// ---------------------------------------------------------------------------
// Recent digest — GET /api/content-pipeline/knowledge/recent
// ---------------------------------------------------------------------------
describe('Knowledge API — Recent digest', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/content-pipeline/knowledge/recent/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/recent'));
    expect(res.status).toBe(401);
  });

  it('returns digest with default 7 days', async () => {
    mockAuthenticated();
    const digest = {
      entries_added: 15,
      new_topics: ['AI Agents'],
      most_active_topics: [{ slug: 'ai', display_name: 'AI', count: 8 }],
      highlights: [],
    };
    mockGetRecentKnowledgeDigest.mockResolvedValue(digest);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/recent'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.entries_added).toBe(15);
    expect(data.new_topics).toEqual(['AI Agents']);

    // Default 7 days, clamped to min(7, 90) = 7
    expect(mockGetRecentKnowledgeDigest).toHaveBeenCalledWith('user-123', 7);
  });

  it('respects custom days param clamped to 90', async () => {
    mockAuthenticated();
    mockGetRecentKnowledgeDigest.mockResolvedValue({
      entries_added: 0,
      new_topics: [],
      most_active_topics: [],
      highlights: [],
    });

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/recent?days=120'));
    expect(res.status).toBe(200);

    // 120 clamped to 90
    expect(mockGetRecentKnowledgeDigest).toHaveBeenCalledWith('user-123', 90);
  });
});

// ---------------------------------------------------------------------------
// Readiness — GET /api/content-pipeline/knowledge/readiness
// ---------------------------------------------------------------------------
describe('Knowledge API — Readiness', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/content-pipeline/knowledge/readiness/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/readiness?topic=sales&goal=lead_magnet'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when topic missing', async () => {
    mockAuthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/readiness?goal=lead_magnet'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('topic parameter is required');
  });

  it('returns 400 for missing goal', async () => {
    mockAuthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/readiness?topic=sales'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('goal must be one of');
  });

  it('returns 400 for invalid goal value', async () => {
    mockAuthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/readiness?topic=sales&goal=invalid_goal'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('goal must be one of');
  });

  it('returns readiness result for valid params', async () => {
    mockAuthenticated();
    const readiness = {
      ready: true,
      score: 82,
      total_entries: 15,
      types_present: 5,
      avg_quality: 4.2,
      verdict: 'Ready to create a lead magnet',
      suggestions: [],
    };
    mockAssessReadiness.mockResolvedValue(readiness);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/readiness?topic=sales&goal=lead_magnet'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.readiness.ready).toBe(true);
    expect(data.readiness.score).toBe(82);

    expect(mockAssessReadiness).toHaveBeenCalledWith('user-123', 'sales', 'lead_magnet');
  });

  it('accepts all valid goal values', async () => {
    mockAuthenticated();
    mockAssessReadiness.mockResolvedValue({ ready: false, score: 20, suggestions: [] });

    const goals = ['lead_magnet', 'blog_post', 'course', 'sop', 'content_week'];
    for (const goal of goals) {
      const res = await GET(makeRequest(`/api/content-pipeline/knowledge/readiness?topic=t&goal=${goal}`));
      expect(res.status).toBe(200);
    }
    expect(mockAssessReadiness).toHaveBeenCalledTimes(goals.length);
  });
});

// ---------------------------------------------------------------------------
// Gaps — GET /api/content-pipeline/knowledge/gaps
// ---------------------------------------------------------------------------
describe('Knowledge API — Gaps', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/content-pipeline/knowledge/gaps/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/gaps'));
    expect(res.status).toBe(401);
  });

  it('returns gaps sorted by coverage score ascending', async () => {
    mockAuthenticated();

    const topics = [
      { slug: 'sales', display_name: 'Sales', avg_quality: 4.0, last_seen: '2026-02-19' },
      { slug: 'ai', display_name: 'AI', avg_quality: 3.5, last_seen: '2026-02-18' },
    ];
    mockListKnowledgeTopics.mockResolvedValue(topics);

    mockGetTopicDetail
      .mockResolvedValueOnce({ type_breakdown: { how_to: 5, insight: 3 } })
      .mockResolvedValueOnce({ type_breakdown: { insight: 2 } });

    // Sales has better coverage than AI
    mockAnalyzeTopicGaps
      .mockReturnValueOnce({
        topic_slug: 'sales',
        topic_name: 'Sales',
        coverage_score: 0.75,
        missing_types: ['story'],
        patterns: [],
      })
      .mockReturnValueOnce({
        topic_slug: 'ai',
        topic_name: 'AI',
        coverage_score: 0.25,
        missing_types: ['how_to', 'story', 'question'],
        patterns: ['Thin but trending'],
      });

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/gaps'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.total_topics).toBe(2);
    expect(data.gaps).toHaveLength(2);

    // Worst coverage first
    expect(data.gaps[0].topic_slug).toBe('ai');
    expect(data.gaps[0].coverage_score).toBe(0.25);
    expect(data.gaps[1].topic_slug).toBe('sales');
    expect(data.gaps[1].coverage_score).toBe(0.75);
  });

  it('calls analyzeTopicGaps with correct params from topic + detail', async () => {
    mockAuthenticated();

    const topics = [
      { slug: 'marketing', display_name: 'Marketing', avg_quality: 3.2, last_seen: '2026-01-15' },
    ];
    mockListKnowledgeTopics.mockResolvedValue(topics);
    mockGetTopicDetail.mockResolvedValue({ type_breakdown: { insight: 4, story: 1 } });
    mockAnalyzeTopicGaps.mockReturnValue({
      topic_slug: 'marketing',
      topic_name: 'Marketing',
      coverage_score: 0.5,
      missing_types: [],
      patterns: [],
    });

    await GET(makeRequest('/api/content-pipeline/knowledge/gaps'));

    expect(mockAnalyzeTopicGaps).toHaveBeenCalledWith(
      'marketing',
      'Marketing',
      { insight: 4, story: 1 },
      3.2,
      '2026-01-15'
    );
  });
});

// ---------------------------------------------------------------------------
// Export — GET /api/content-pipeline/knowledge/export
// ---------------------------------------------------------------------------
describe('Knowledge API — Export', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/content-pipeline/knowledge/export/route');
    GET = mod.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/export?topic=sales'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when topic param missing', async () => {
    mockAuthenticated();
    const res = await GET(makeRequest('/api/content-pipeline/knowledge/export'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('topic parameter is required');
  });

  it('returns 404 when topic not found', async () => {
    mockAuthenticated();
    mockExportTopicKnowledge.mockResolvedValue({ topic: null, entries_by_type: {}, total_count: 0 });

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/export?topic=bogus'));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Topic not found');
  });

  it('returns structured format by default', async () => {
    mockAuthenticated();
    const exportData = {
      topic: { slug: 'sales', display_name: 'Sales' },
      entries_by_type: {
        how_to: [{ content: 'Step 1: Qualify the lead' }],
        insight: [{ content: 'Buyers care about ROI' }],
      },
      total_count: 2,
    };
    mockExportTopicKnowledge.mockResolvedValue(exportData);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/export?topic=sales'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.format).toBe('structured');
    expect(data.export.topic.slug).toBe('sales');
    expect(data.export.entries_by_type.how_to).toHaveLength(1);
  });

  it('returns markdown format when requested', async () => {
    mockAuthenticated();
    const exportData = {
      topic: { slug: 'sales', display_name: 'Sales' },
      entries_by_type: {
        how_to: [{ content: 'Step 1: Qualify the lead' }],
      },
      total_count: 1,
    };
    mockExportTopicKnowledge.mockResolvedValue(exportData);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/export?topic=sales&format=markdown'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.format).toBe('markdown');
    expect(data.export).toContain('# Sales');
    expect(data.export).toContain('Step 1: Qualify the lead');
    expect(data.total_count).toBe(1);
  });
});
