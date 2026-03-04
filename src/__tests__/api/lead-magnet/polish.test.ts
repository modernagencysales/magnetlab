/**
 * @jest-environment node
 */

// Mock auth
const mockSession = {
  user: { id: 'test-user-id', email: 'test@example.com', name: 'Test' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};
let currentSession: typeof mockSession | null = mockSession;

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(currentSession)),
}));

// Mock team-context
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  applyScope: jest.fn(),
}));

// Mock lead-magnets service
const mockPolishContent = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);

jest.mock('@/server/services/lead-magnets.service', () => ({
  polishContent: (...args: unknown[]) => mockPolishContent(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

import { POST } from '@/app/api/lead-magnet/[id]/polish/route';

function makeRequest(id: string) {
  const request = new Request(`http://localhost:3000/api/lead-magnet/${id}/polish`, {
    method: 'POST',
  });
  return { request, params: Promise.resolve({ id }) };
}

describe('POST /api/lead-magnet/[id]/polish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSession = mockSession;
  });

  it('should return 401 if not authenticated', async () => {
    currentSession = null;
    const { request, params } = makeRequest('lm-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 404 if lead magnet not found', async () => {
    const err = Object.assign(new Error('Lead magnet not found'), { statusCode: 404 });
    mockPolishContent.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(404);

    const { request, params } = makeRequest('nonexistent');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should return 400 if no extracted content', async () => {
    const err = Object.assign(new Error('No extracted content available'), { statusCode: 400 });
    mockPolishContent.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(400);

    const { request, params } = makeRequest('lm-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('extracted content');
  });

  it('should return 400 if no concept', async () => {
    const err = Object.assign(new Error('No concept available'), { statusCode: 400 });
    mockPolishContent.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(400);

    const { request, params } = makeRequest('lm-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('concept');
  });

  it('should polish content and return result', async () => {
    const polishedResult = {
      polishedContent: {
        version: 1,
        polishedAt: '2025-01-28T00:00:00Z',
        sections: [
          {
            id: 'section-1',
            sectionName: 'Getting Started',
            introduction: 'An intro paragraph.',
            blocks: [{ type: 'paragraph', content: 'Polished content here.' }],
            keyTakeaway: 'Key takeaway.',
          },
        ],
        heroSummary: 'A compelling summary.',
        metadata: { readingTimeMinutes: 3, wordCount: 600 },
      },
      polishedAt: '2025-01-28T00:00:00Z',
    };

    mockPolishContent.mockResolvedValue(polishedResult);

    const { request, params } = makeRequest('lm-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.polishedContent).toBeDefined();
    expect(data.polishedContent.sections).toHaveLength(1);
    expect(data.polishedContent.heroSummary).toBe('A compelling summary.');
    expect(data.polishedContent.metadata.readingTimeMinutes).toBe(3);
    expect(data.polishedAt).toBeDefined();
  });

  it('should call service with correct scope and id', async () => {
    mockPolishContent.mockResolvedValue({
      polishedContent: { version: 1, sections: [] },
      polishedAt: '2025-01-28T00:00:00Z',
    });

    const { request, params } = makeRequest('lm-456');

    await POST(request, { params });

    expect(mockPolishContent).toHaveBeenCalledWith(
      { type: 'user', userId: 'test-user-id' },
      'lm-456'
    );
  });
});
