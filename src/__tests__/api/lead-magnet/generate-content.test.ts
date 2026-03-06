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

// Mock the service module — this is what the route handler actually imports
const mockGenerateAndPolishContent = jest.fn();
const mockGetStatusCode = jest.fn();

jest.mock('@/server/services/lead-magnets.service', () => ({
  generateAndPolishContent: (...args: unknown[]) => mockGenerateAndPolishContent(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

// Mock api errors (imported by route)
jest.mock('@/lib/api/errors', () => ({
  ApiErrors: {
    unauthorized: jest.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  },
  logApiError: jest.fn(),
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

    // Default: service returns success
    mockGenerateAndPolishContent.mockResolvedValue({
      extractedContent: mockExtracted,
      polishedContent: mockPolished,
      polishedAt: '2026-01-01T00:00:00.000Z',
    });
    mockGetStatusCode.mockReturnValue(500);
  });

  it('returns 401 if not authenticated', async () => {
    mockSessionValue = null;
    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 if lead magnet not found', async () => {
    mockGenerateAndPolishContent.mockRejectedValue(
      Object.assign(new Error('Lead magnet not found'), { statusCode: 404 })
    );
    mockGetStatusCode.mockReturnValue(404);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns 400 if concept is null', async () => {
    mockGenerateAndPolishContent.mockRejectedValue(
      Object.assign(new Error('Lead magnet has no concept — cannot generate content'), { statusCode: 400 })
    );
    mockGetStatusCode.mockReturnValue(400);

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

  it('calls generateAndPolishContent with correct arguments', async () => {
    await POST(makeRequest(), makeParams());
    expect(mockGenerateAndPolishContent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'user', userId: 'test-user-id' }),
      TEST_LM_ID
    );
  });

  it('returns 500 when AI generation fails', async () => {
    mockGenerateAndPolishContent.mockRejectedValue(new Error('Claude timeout'));
    mockGetStatusCode.mockReturnValue(500);

    const res = await POST(makeRequest(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Claude timeout');
  });
});
