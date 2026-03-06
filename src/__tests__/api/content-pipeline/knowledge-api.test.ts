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

// Mock next/headers cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(undefined),
  }),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// Mock knowledge service
const mockGetTopics = jest.fn();
const mockGetTopicBySlug = jest.fn();
const mockGetTopicSummary = jest.fn();
const mockGetKnowledgeDigest = jest.fn();
const mockExportKnowledge = jest.fn();
const mockGetKnowledgeGaps = jest.fn();
const mockAssessKnowledgeReadiness = jest.fn();
const mockAssertTeamMembership = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);

jest.mock('@/server/services/knowledge.service', () => ({
  getTopics: (...args: unknown[]) => mockGetTopics(...args),
  getTopicBySlug: (...args: unknown[]) => mockGetTopicBySlug(...args),
  getTopicSummary: (...args: unknown[]) => mockGetTopicSummary(...args),
  getKnowledgeDigest: (...args: unknown[]) => mockGetKnowledgeDigest(...args),
  exportKnowledge: (...args: unknown[]) => mockExportKnowledge(...args),
  getKnowledgeGaps: (...args: unknown[]) => mockGetKnowledgeGaps(...args),
  assessKnowledgeReadiness: (...args: unknown[]) => mockAssessKnowledgeReadiness(...args),
  assertTeamMembership: (...args: unknown[]) => mockAssertTeamMembership(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
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
  mockAssertTeamMembership.mockResolvedValue(undefined);
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
    mockGetTopics.mockResolvedValue(topics);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/topics'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.topics).toHaveLength(2);
    expect(data.topics[0].slug).toBe('sales');

    // Service is called with userId, teamId, limit
    expect(mockGetTopics).toHaveBeenCalledWith('user-123', undefined, 50);
  });

  it('passes team_id to service when provided', async () => {
    mockAuthenticated();
    mockGetTopics.mockResolvedValue([]);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/topics?team_id=team-abc'));
    expect(res.status).toBe(200);

    expect(mockGetTopics).toHaveBeenCalledWith('user-123', 'team-abc', 50);
  });

  it('passes custom limit when provided', async () => {
    mockAuthenticated();
    mockGetTopics.mockResolvedValue([]);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/topics?limit=10'));
    expect(res.status).toBe(200);

    expect(mockGetTopics).toHaveBeenCalledWith('user-123', undefined, 10);
  });

  it('returns 500 when service throws', async () => {
    mockAuthenticated();
    mockGetTopics.mockRejectedValue(new Error('DB timeout'));
    mockGetStatusCode.mockReturnValue(500);

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
    mockGetTopicBySlug.mockResolvedValue(detail);

    const res = await callGET('sales');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.topic.slug).toBe('sales');
    expect(data.type_breakdown).toEqual({ how_to: 5, insight: 3 });
    expect(mockGetTopicBySlug).toHaveBeenCalledWith('user-123', 'sales', undefined);
  });

  it('returns 404 when topic not found', async () => {
    mockAuthenticated();
    mockGetTopicBySlug.mockResolvedValue({
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
    mockGetTopicSummary.mockResolvedValue({
      summary: 'Sales is about closing deals.',
      cached: false,
    });

    const res = await callPOST('sales');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.summary).toBe('Sales is about closing deals.');
    expect(data.cached).toBe(false);
    expect(mockGetTopicSummary).toHaveBeenCalledWith('user-123', 'sales', false, undefined);
  });

  it('passes force=true when query param set', async () => {
    mockAuthenticated();
    mockGetTopicSummary.mockResolvedValue({
      summary: 'Refreshed summary.',
      cached: false,
    });

    const res = await callPOST('sales', '?force=true');
    expect(res.status).toBe(200);

    expect(mockGetTopicSummary).toHaveBeenCalledWith('user-123', 'sales', true, undefined);
  });

  it('returns 404 when topic not found', async () => {
    mockAuthenticated();
    mockGetTopicSummary.mockRejectedValue(new Error('Topic not found: bogus'));
    mockGetStatusCode.mockReturnValue(500);

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
    mockGetKnowledgeDigest.mockResolvedValue(digest);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/recent'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.entries_added).toBe(15);
    expect(data.new_topics).toEqual(['AI Agents']);

    expect(mockGetKnowledgeDigest).toHaveBeenCalledWith('user-123', 7, undefined);
  });

  it('respects custom days param', async () => {
    mockAuthenticated();
    mockGetKnowledgeDigest.mockResolvedValue({
      entries_added: 0,
      new_topics: [],
      most_active_topics: [],
      highlights: [],
    });

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/recent?days=120'));
    expect(res.status).toBe(200);

    // Days passed as 120, clamping happens inside the service
    expect(mockGetKnowledgeDigest).toHaveBeenCalledWith('user-123', 120, undefined);
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
    const err = Object.assign(
      new Error('goal must be one of: lead_magnet, blog_post, course, sop, content_week'),
      { statusCode: 400 },
    );
    mockAssessKnowledgeReadiness.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(400);

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
    mockAssessKnowledgeReadiness.mockResolvedValue(readiness);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/readiness?topic=sales&goal=lead_magnet'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.readiness.ready).toBe(true);
    expect(data.readiness.score).toBe(82);

    expect(mockAssessKnowledgeReadiness).toHaveBeenCalledWith('user-123', 'sales', 'lead_magnet', undefined);
  });

  it('accepts all valid goal values', async () => {
    mockAuthenticated();
    mockAssessKnowledgeReadiness.mockResolvedValue({ ready: false, score: 20, suggestions: [] });

    const goals = ['lead_magnet', 'blog_post', 'course', 'sop', 'content_week'];
    for (const goal of goals) {
      const res = await GET(makeRequest(`/api/content-pipeline/knowledge/readiness?topic=t&goal=${goal}`));
      expect(res.status).toBe(200);
    }
    expect(mockAssessKnowledgeReadiness).toHaveBeenCalledTimes(goals.length);
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

  it('returns gaps from service', async () => {
    mockAuthenticated();

    const gapsResult = {
      gaps: [
        { topic_slug: 'ai', topic_name: 'AI', coverage_score: 0.25, missing_types: ['how_to'], patterns: [] },
        { topic_slug: 'sales', topic_name: 'Sales', coverage_score: 0.75, missing_types: ['story'], patterns: [] },
      ],
      total_topics: 2,
    };
    mockGetKnowledgeGaps.mockResolvedValue(gapsResult);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/gaps'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.total_topics).toBe(2);
    expect(data.gaps).toHaveLength(2);
    expect(data.gaps[0].topic_slug).toBe('ai');
    expect(data.gaps[0].coverage_score).toBe(0.25);
    expect(data.gaps[1].topic_slug).toBe('sales');

    expect(mockGetKnowledgeGaps).toHaveBeenCalledWith('user-123', undefined, 20);
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
    const err = Object.assign(new Error('Topic not found'), { statusCode: 404 });
    mockExportKnowledge.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(404);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/export?topic=bogus'));
    expect(res.status).toBe(404);
  });

  it('returns structured format by default', async () => {
    mockAuthenticated();
    const exportData = {
      export: {
        topic: { slug: 'sales', display_name: 'Sales' },
        entries_by_type: {
          how_to: [{ content: 'Step 1: Qualify the lead' }],
          insight: [{ content: 'Buyers care about ROI' }],
        },
        total_count: 2,
      },
      format: 'structured',
    };
    mockExportKnowledge.mockResolvedValue(exportData);

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
      export: '# Sales\n\n## how_to (1)\n\n- Step 1: Qualify the lead\n',
      format: 'markdown',
      total_count: 1,
    };
    mockExportKnowledge.mockResolvedValue(exportData);

    const res = await GET(makeRequest('/api/content-pipeline/knowledge/export?topic=sales&format=markdown'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.format).toBe('markdown');
    expect(data.export).toContain('# Sales');
    expect(data.export).toContain('Step 1: Qualify the lead');
    expect(data.total_count).toBe(1);
  });
});
