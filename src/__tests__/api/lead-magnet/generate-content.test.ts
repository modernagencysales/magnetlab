/**
 * @jest-environment node
 */

// Mock auth
let mockSessionValue: { user: { id: string } } | null = { user: { id: 'test-user-id' } };
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(mockSessionValue)),
}));

// Mock team context
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn(() => Promise.resolve({ type: 'user', userId: 'test-user-id' })),
  applyScope: jest.fn((query: unknown) => query),
}));

// Mock Supabase
const mockSingle = jest.fn();
const mockEq = jest.fn().mockReturnThis();
const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
const mockFrom = jest.fn().mockReturnValue({
  select: mockSelect,
  update: mockUpdate,
});

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

// Mock AI modules
const mockGenerateFullContent = jest.fn();
jest.mock('@/lib/ai/generate-lead-magnet-content', () => ({
  generateFullContent: (...args: unknown[]) => mockGenerateFullContent(...args),
}));

const mockPolishLeadMagnetContent = jest.fn();
jest.mock('@/lib/ai/lead-magnet-generator', () => ({
  polishLeadMagnetContent: (...args: unknown[]) => mockPolishLeadMagnetContent(...args),
}));

// Mock knowledge brain
const mockGetRelevantContext = jest.fn();
jest.mock('@/lib/services/knowledge-brain', () => ({
  getRelevantContext: (...args: unknown[]) => mockGetRelevantContext(...args),
}));

// Mock PostHog
jest.mock('@/lib/posthog', () => ({
  getPostHogServerClient: () => ({ capture: jest.fn() }),
}));

import { POST } from '@/app/api/lead-magnet/[id]/generate-content/route';

const TEST_LM_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeRequest(): Request {
  return new Request(`http://localhost/api/lead-magnet/${TEST_LM_ID}/generate-content`, {
    method: 'POST',
  });
}

function makeParams(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: TEST_LM_ID }) };
}

const mockExtracted = {
  title: 'Test Guide',
  format: 'Digital Guide',
  structure: [{ sectionName: 'Intro', contents: ['Content here'] }],
  nonObviousInsight: 'insight',
  personalExperience: 'experience',
  proof: 'proof',
  commonMistakes: ['mistake 1'],
  differentiation: 'diff',
};

const mockPolished = {
  version: 1,
  polishedAt: '2026-01-01T00:00:00.000Z',
  title: 'Test Guide',
  heroSummary: 'Summary',
  sections: [{ id: 's1', sectionName: 'Intro', introduction: '', keyTakeaway: '', blocks: [] }],
  metadata: { wordCount: 500, readingTimeMinutes: 2 },
};

describe('POST /api/lead-magnet/[id]/generate-content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionValue = { user: { id: 'test-user-id' } };

    // Default: lead magnet exists with concept but no extracted content
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({
      data: {
        id: TEST_LM_ID,
        title: 'Test Guide',
        concept: { painSolved: 'Pain', contents: 'Contents', deliveryFormat: 'Digital Guide' },
        user_id: 'test-user-id',
      },
      error: null,
    });
    // Chain: from().select().eq() returns { eq: mockEq } which has .single()
    mockSelect.mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockSingle }) });
    // Chain: from().update().eq() returns { eq: mockEq } which resolves
    mockUpdate.mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) });

    mockGetRelevantContext.mockResolvedValue({ entries: [] });
    mockGenerateFullContent.mockResolvedValue(mockExtracted);
    mockPolishLeadMagnetContent.mockResolvedValue(mockPolished);
  });

  it('returns 401 if not authenticated', async () => {
    mockSessionValue = null;
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 if lead magnet not found', async () => {
    mockSelect.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found', code: 'PGRST116' } }),
      }),
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns 400 if concept is null', async () => {
    mockSelect.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: TEST_LM_ID, title: 'Test', concept: null, user_id: 'test-user-id' },
          error: null,
        }),
      }),
    });

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no concept/i);
  });

  it('returns 200 with extractedContent and polishedContent on success', async () => {
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.extractedContent).toEqual(mockExtracted);
    expect(body.polishedContent).toEqual(mockPolished);
    expect(body.polishedAt).toBeDefined();
  });

  it('calls generateFullContent with correct arguments', async () => {
    await POST(makeRequest(), makeParams());
    expect(mockGenerateFullContent).toHaveBeenCalledWith(
      'Test Guide',
      expect.objectContaining({ painSolved: 'Pain' }),
      '' // no knowledge context since entries is empty
    );
  });

  it('continues when knowledge context fetch fails', async () => {
    mockGetRelevantContext.mockRejectedValue(new Error('Knowledge DB down'));

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(mockGenerateFullContent).toHaveBeenCalledWith('Test Guide', expect.any(Object), '');
  });

  it('returns 500 when AI generation fails', async () => {
    mockGenerateFullContent.mockRejectedValue(new Error('Claude timeout'));

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to generate/i);
  });
});
