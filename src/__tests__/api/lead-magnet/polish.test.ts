/**
 * @jest-environment node
 */

import { POST } from '@/app/api/lead-magnet/[id]/polish/route';

// Create mock Supabase with table tracking
interface MockChainable {
  from: jest.Mock;
  select: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
  _setSingleResults: (table: string, results: Array<{ data: unknown; error: unknown }>) => void;
  _reset: () => void;
}

function createMockSupabase(): MockChainable {
  let currentTable = '';
  const singleCallIndex: { [key: string]: number } = {};
  const singleResults: { [key: string]: Array<{ data: unknown; error: unknown }> } = {};

  const chainable: MockChainable = {
    from: jest.fn((table: string) => {
      currentTable = table;
      return chainable;
    }),
    select: jest.fn(() => chainable),
    update: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    single: jest.fn(() => {
      const table = currentTable;
      if (singleResults[table] && singleResults[table].length > 0) {
        const idx = singleCallIndex[table] || 0;
        singleCallIndex[table] = idx + 1;
        return Promise.resolve(singleResults[table][idx] || { data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    _setSingleResults: (table: string, results: Array<{ data: unknown; error: unknown }>) => {
      singleResults[table] = results;
      singleCallIndex[table] = 0;
    },
    _reset: () => {
      Object.keys(singleCallIndex).forEach(k => delete singleCallIndex[k]);
      Object.keys(singleResults).forEach(k => delete singleResults[k]);
    },
  };

  return chainable;
}

const mockSupabaseClient = createMockSupabase();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

// Mock team-context (routes now use getDataScope/applyScope for multi-team scoping)
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  applyScope: jest.fn((query: any, scope: any) => query.eq('user_id', scope.userId)),
}));

// Mock auth
const mockSession = {
  user: { id: 'test-user-id', email: 'test@example.com', name: 'Test' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};
let currentSession: typeof mockSession | null = mockSession;

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(currentSession)),
}));

// Mock the AI polish function
const mockPolishedResult = {
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
};

jest.mock('@/lib/ai/lead-magnet-generator', () => ({
  polishLeadMagnetContent: jest.fn(() => Promise.resolve(mockPolishedResult)),
}));

function makeRequest(id: string) {
  const request = new Request(`http://localhost:3000/api/lead-magnet/${id}/polish`, {
    method: 'POST',
  });
  return { request, params: Promise.resolve({ id }) };
}

describe('POST /api/lead-magnet/[id]/polish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient._reset();
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
    mockSupabaseClient._setSingleResults('lead_magnets', [
      { data: null, error: { code: 'PGRST116' } },
    ]);

    const { request, params } = makeRequest('nonexistent');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('NOT_FOUND');
  });

  it('should return 400 if no extracted content', async () => {
    mockSupabaseClient._setSingleResults('lead_magnets', [
      {
        data: {
          id: 'lm-123',
          user_id: 'test-user-id',
          extracted_content: null,
          concept: { title: 'Test', archetypeName: 'System' },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest('lm-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('extracted content');
  });

  it('should return 400 if no concept', async () => {
    mockSupabaseClient._setSingleResults('lead_magnets', [
      {
        data: {
          id: 'lm-123',
          user_id: 'test-user-id',
          extracted_content: { title: 'Test', structure: [] },
          concept: null,
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest('lm-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('concept');
  });

  it('should polish content and return result', async () => {
    mockSupabaseClient._setSingleResults('lead_magnets', [
      {
        data: {
          id: 'lm-123',
          user_id: 'test-user-id',
          extracted_content: {
            title: 'Test Guide',
            structure: [{ sectionName: 'Intro', contents: ['Hello'] }],
          },
          concept: {
            title: 'The Test Guide',
            archetypeName: 'The Single System',
            painSolved: 'A painful problem',
          },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest('lm-123');

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.polishedContent).toBeDefined();
    expect(data.polishedContent.sections).toHaveLength(1);
    expect(data.polishedContent.heroSummary).toBe('A compelling summary.');
    expect(data.polishedContent.metadata.readingTimeMinutes).toBe(3);
    expect(data.polishedAt).toBeDefined();

    // Verify database update was called
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('lead_magnets');
    expect(mockSupabaseClient.update).toHaveBeenCalled();
  });

  it('should save polished content to database', async () => {
    mockSupabaseClient._setSingleResults('lead_magnets', [
      {
        data: {
          id: 'lm-456',
          user_id: 'test-user-id',
          extracted_content: { title: 'Guide', structure: [] },
          concept: { title: 'Guide', archetypeName: 'System', painSolved: 'Pain' },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest('lm-456');

    await POST(request, { params });

    // Verify update was called with polished content
    expect(mockSupabaseClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        polished_content: mockPolishedResult,
        polished_at: expect.any(String),
      })
    );
  });
});
