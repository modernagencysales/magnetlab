/**
 * @jest-environment node
 */

import { PUT } from '@/app/api/lead-magnet/[id]/content/route';

// Mock chainable Supabase client
interface MockChainable {
  from: jest.Mock;
  select: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
  _setSingleResult: (result: { data: unknown; error: unknown }) => void;
  _reset: () => void;
}

function createMockSupabase(): MockChainable {
  let singleResult: { data: unknown; error: unknown } = { data: null, error: null };

  const chainable: MockChainable = {
    from: jest.fn(() => chainable),
    select: jest.fn(() => chainable),
    update: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    single: jest.fn(() => Promise.resolve(singleResult)),
    _setSingleResult: (result) => {
      singleResult = result;
    },
    _reset: () => {
      singleResult = { data: null, error: null };
    },
  };

  return chainable;
}

const mockSupabaseClient = createMockSupabase();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock auth
let currentSession: { user: { id: string; email: string } } | null = {
  user: { id: 'test-user-id', email: 'test@example.com' },
};

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(currentSession)),
}));

const makeParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

const validContent = {
  version: 1,
  polishedAt: '2026-01-29T00:00:00Z',
  heroSummary: 'A compelling summary about the topic',
  sections: [
    {
      id: 'section-1',
      sectionName: 'Introduction',
      introduction: 'This section introduces the main concepts',
      blocks: [
        { type: 'paragraph' as const, content: 'This is a paragraph with some words in it for testing' },
        { type: 'list' as const, content: 'Item one\nItem two\nItem three' },
      ],
      keyTakeaway: 'The key point to remember',
    },
  ],
  metadata: { wordCount: 100, readingTimeMinutes: 1 },
};

describe('PUT /api/lead-magnet/[id]/content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient._reset();
    currentSession = { user: { id: 'test-user-id', email: 'test@example.com' } };
  });

  it('should return 401 if not authenticated', async () => {
    currentSession = null;

    const request = new Request('http://localhost:3000/api/lead-magnet/abc/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polishedContent: validContent }),
    });

    const response = await PUT(request, makeParams('abc'));
    expect(response.status).toBe(401);
  });

  it('should return 400 if polishedContent is missing', async () => {
    const request = new Request('http://localhost:3000/api/lead-magnet/abc/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await PUT(request, makeParams('abc'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid content');
  });

  it('should return 400 if sections are missing', async () => {
    const request = new Request('http://localhost:3000/api/lead-magnet/abc/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polishedContent: { heroSummary: 'test' } }),
    });

    const response = await PUT(request, makeParams('abc'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid content');
  });

  it('should update content and recalculate metadata on success', async () => {
    const updatedContent = { ...validContent };
    mockSupabaseClient._setSingleResult({
      data: { polished_content: updatedContent },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/lead-magnet/lm-123/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polishedContent: validContent }),
    });

    const response = await PUT(request, makeParams('lm-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify Supabase was called correctly
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('lead_magnets');
    expect(mockSupabaseClient.update).toHaveBeenCalled();
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'lm-123');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
  });

  it('should return 500 if database update fails', async () => {
    mockSupabaseClient._setSingleResult({
      data: null,
      error: { message: 'DB error', code: 'PGRST116' },
    });

    const request = new Request('http://localhost:3000/api/lead-magnet/lm-123/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polishedContent: validContent }),
    });

    const response = await PUT(request, makeParams('lm-123'));
    expect(response.status).toBe(500);
  });

  it('should recalculate word count from content', async () => {
    const content = {
      ...validContent,
      heroSummary: 'one two three',
      sections: [
        {
          id: 's1',
          sectionName: 'Test',
          introduction: 'four five',
          blocks: [
            { type: 'paragraph' as const, content: 'six seven eight' },
          ],
          keyTakeaway: 'nine ten',
        },
      ],
    };

    mockSupabaseClient._setSingleResult({
      data: { polished_content: content },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/lead-magnet/lm-123/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polishedContent: content }),
    });

    const response = await PUT(request, makeParams('lm-123'));
    expect(response.status).toBe(200);

    // The update call should have been made with recalculated metadata
    const updateCall = mockSupabaseClient.update.mock.calls[0][0];
    expect(updateCall.polished_content.metadata.wordCount).toBe(10);
    expect(updateCall.polished_content.metadata.readingTimeMinutes).toBe(1); // 10/200 rounds to 1 (min 1)
  });
});
