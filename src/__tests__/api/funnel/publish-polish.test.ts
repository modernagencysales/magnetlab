/**
 * @jest-environment node
 */

import { POST } from '@/app/api/funnel/[id]/publish/route';

// Create mock Supabase
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

// Mock auth
const mockSession = {
  user: { id: 'test-user-id', email: 'test@example.com', name: 'Test' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};
let currentSession: typeof mockSession | null = mockSession;

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(currentSession)),
}));

// Mock AI polish
const mockPolishResult = {
  version: 1,
  polishedAt: '2025-01-28T00:00:00Z',
  sections: [{ id: 's1', sectionName: 'S1', introduction: '', blocks: [], keyTakeaway: '' }],
  heroSummary: 'Summary',
  metadata: { readingTimeMinutes: 2, wordCount: 400 },
};

const mockPolishFn = jest.fn(() => Promise.resolve(mockPolishResult));

jest.mock('@/lib/ai/lead-magnet-generator', () => ({
  polishLeadMagnetContent: (...args: unknown[]) => mockPolishFn.apply(null, args),
}));

function makeRequest(id: string, body: unknown) {
  const request = new Request(`http://localhost:3000/api/funnel/${id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { request, params: Promise.resolve({ id }) };
}

describe('POST /api/funnel/[id]/publish - Auto-polish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient._reset();
    currentSession = mockSession;
    mockPolishFn.mockClear();
  });

  it('should return 401 if not authenticated', async () => {
    currentSession = null;
    const { request, params } = makeRequest('funnel-1', { publish: true });

    const response = await POST(request, { params });
    expect(response.status).toBe(401);
  });

  it('should return 400 if publish is not boolean', async () => {
    const { request, params } = makeRequest('funnel-1', { publish: 'yes' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('publish');
  });

  it('should return 404 if funnel not found', async () => {
    mockSupabaseClient._setSingleResults('funnel_pages', [
      { data: null, error: { code: 'PGRST116' } },
    ]);

    const { request, params } = makeRequest('nonexistent', { publish: true });

    const response = await POST(request, { params });
    expect(response.status).toBe(404);
  });

  it('should trigger auto-polish when publishing with extracted but no polished content', async () => {
    const funnelId = 'funnel-auto-polish';
    const lmId = 'lm-needs-polish';

    // Funnel page query
    mockSupabaseClient._setSingleResults('funnel_pages', [
      {
        data: {
          id: funnelId,
          user_id: 'test-user-id',
          slug: 'test-slug',
          optin_headline: 'Get the Guide',
          published_at: null,
          lead_magnets: { id: lmId },
        },
        error: null,
      },
      // Update result
      {
        data: {
          id: funnelId,
          user_id: 'test-user-id',
          lead_magnet_id: lmId,
          slug: 'test-slug',
          optin_headline: 'Get the Guide',
          optin_subline: null,
          optin_button_text: 'Get Access',
          optin_social_proof: null,
          thankyou_headline: 'Thanks!',
          thankyou_subline: null,
          vsl_url: null,
          calendly_url: null,
          qualification_pass_message: 'Great!',
          qualification_fail_message: 'Sorry',
          theme: 'dark',
          primary_color: '#8b5cf6',
          background_style: 'solid',
          logo_url: null,
          is_published: true,
          published_at: '2025-01-28T00:00:00Z',
          created_at: '2025-01-27T00:00:00Z',
          updated_at: '2025-01-28T00:00:00Z',
        },
        error: null,
      },
    ]);

    // User query (for username check + URL generation)
    mockSupabaseClient._setSingleResults('users', [
      { data: { username: 'testuser' }, error: null },
      { data: { username: 'testuser' }, error: null },
    ]);

    // Lead magnet query (for auto-polish check)
    mockSupabaseClient._setSingleResults('lead_magnets', [
      {
        data: {
          id: lmId,
          extracted_content: { title: 'Guide', structure: [{ sectionName: 'Intro', contents: ['Hi'] }] },
          polished_content: null,
          concept: { title: 'Guide', archetypeName: 'System', painSolved: 'Pain' },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest(funnelId, { publish: true });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    // Verify polish was triggered
    expect(mockPolishFn).toHaveBeenCalledTimes(1);
    expect(mockPolishFn).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Guide' }),
      expect.objectContaining({ title: 'Guide', archetypeName: 'System' })
    );
  });

  it('should NOT auto-polish when content is already polished', async () => {
    const funnelId = 'funnel-already-polished';
    const lmId = 'lm-already-polished';

    mockSupabaseClient._setSingleResults('funnel_pages', [
      {
        data: {
          id: funnelId,
          user_id: 'test-user-id',
          slug: 'test-slug',
          optin_headline: 'Get the Guide',
          published_at: null,
          lead_magnets: { id: lmId },
        },
        error: null,
      },
      {
        data: {
          id: funnelId,
          user_id: 'test-user-id',
          lead_magnet_id: lmId,
          slug: 'test-slug',
          optin_headline: 'Get the Guide',
          optin_subline: null,
          optin_button_text: 'Get Access',
          optin_social_proof: null,
          thankyou_headline: 'Thanks!',
          thankyou_subline: null,
          vsl_url: null,
          calendly_url: null,
          qualification_pass_message: 'Great!',
          qualification_fail_message: 'Sorry',
          theme: 'dark',
          primary_color: '#8b5cf6',
          background_style: 'solid',
          logo_url: null,
          is_published: true,
          published_at: '2025-01-28T00:00:00Z',
          created_at: '2025-01-27T00:00:00Z',
          updated_at: '2025-01-28T00:00:00Z',
        },
        error: null,
      },
    ]);

    mockSupabaseClient._setSingleResults('users', [
      { data: { username: 'testuser' }, error: null },
      { data: { username: 'testuser' }, error: null },
    ]);

    mockSupabaseClient._setSingleResults('lead_magnets', [
      {
        data: {
          id: lmId,
          extracted_content: { title: 'Guide', structure: [] },
          polished_content: { version: 1, sections: [] }, // Already polished
          concept: { title: 'Guide' },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest(funnelId, { publish: true });

    await POST(request, { params });

    // Polish should NOT be called since content already exists
    expect(mockPolishFn).not.toHaveBeenCalled();
  });

  it('should NOT auto-polish when unpublishing', async () => {
    const funnelId = 'funnel-unpublish';

    mockSupabaseClient._setSingleResults('funnel_pages', [
      {
        data: {
          id: funnelId,
          user_id: 'test-user-id',
          slug: 'test-slug',
          optin_headline: 'Guide',
          published_at: '2025-01-27T00:00:00Z',
          lead_magnets: { id: 'lm-1' },
        },
        error: null,
      },
      {
        data: {
          id: funnelId,
          user_id: 'test-user-id',
          lead_magnet_id: 'lm-1',
          slug: 'test-slug',
          optin_headline: 'Guide',
          optin_subline: null,
          optin_button_text: 'Get',
          optin_social_proof: null,
          thankyou_headline: 'Thanks',
          thankyou_subline: null,
          vsl_url: null,
          calendly_url: null,
          qualification_pass_message: 'OK',
          qualification_fail_message: 'No',
          theme: 'dark',
          primary_color: '#8b5cf6',
          background_style: 'solid',
          logo_url: null,
          is_published: false,
          published_at: '2025-01-27T00:00:00Z',
          created_at: '2025-01-27T00:00:00Z',
          updated_at: '2025-01-28T00:00:00Z',
        },
        error: null,
      },
    ]);

    mockSupabaseClient._setSingleResults('users', [
      { data: { username: 'testuser' }, error: null },
    ]);

    const { request, params } = makeRequest(funnelId, { publish: false });

    await POST(request, { params });

    // Polish should NOT be called for unpublish
    expect(mockPolishFn).not.toHaveBeenCalled();
  });

  it('should still publish even if auto-polish fails', async () => {
    const funnelId = 'funnel-polish-fail';
    const lmId = 'lm-polish-fail';

    // Make polish throw an error
    mockPolishFn.mockRejectedValueOnce(new Error('AI service unavailable'));

    mockSupabaseClient._setSingleResults('funnel_pages', [
      {
        data: {
          id: funnelId,
          user_id: 'test-user-id',
          slug: 'test-slug',
          optin_headline: 'Guide',
          published_at: null,
          lead_magnets: { id: lmId },
        },
        error: null,
      },
      {
        data: {
          id: funnelId,
          user_id: 'test-user-id',
          lead_magnet_id: lmId,
          slug: 'test-slug',
          optin_headline: 'Guide',
          optin_subline: null,
          optin_button_text: 'Get',
          optin_social_proof: null,
          thankyou_headline: 'Thanks',
          thankyou_subline: null,
          vsl_url: null,
          calendly_url: null,
          qualification_pass_message: 'OK',
          qualification_fail_message: 'No',
          theme: 'dark',
          primary_color: '#8b5cf6',
          background_style: 'solid',
          logo_url: null,
          is_published: true,
          published_at: '2025-01-28T00:00:00Z',
          created_at: '2025-01-27T00:00:00Z',
          updated_at: '2025-01-28T00:00:00Z',
        },
        error: null,
      },
    ]);

    mockSupabaseClient._setSingleResults('users', [
      { data: { username: 'testuser' }, error: null },
      { data: { username: 'testuser' }, error: null },
    ]);

    mockSupabaseClient._setSingleResults('lead_magnets', [
      {
        data: {
          id: lmId,
          extracted_content: { title: 'Guide', structure: [] },
          polished_content: null,
          concept: { title: 'Guide', archetypeName: 'System', painSolved: 'Pain' },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest(funnelId, { publish: true });

    const response = await POST(request, { params });

    // Should still succeed - polish failure is non-blocking
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.funnel.isPublished).toBe(true);
  });
});
