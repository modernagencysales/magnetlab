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

// Mock team-context (routes now use getDataScope/applyScope for multi-team scoping)
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Mock AI polish
const mockPolishResult = {
  version: 1,
  polishedAt: '2025-01-28T00:00:00Z',
  sections: [{ id: 's1', sectionName: 'S1', introduction: '', blocks: [], keyTakeaway: '' }],
  heroSummary: 'Summary',
  metadata: { readingTimeMinutes: 2, wordCount: 400 },
};

const mockPolishFn = jest.fn<Promise<typeof mockPolishResult>, [unknown, unknown]>(
  () => Promise.resolve(mockPolishResult)
);

jest.mock('@/lib/ai/lead-magnet-generator', () => ({
  polishLeadMagnetContent: (extractedContent: unknown, concept: unknown) =>
    mockPolishFn(extractedContent, concept),
}));

// Mock PostHog
jest.mock('@/lib/posthog', () => ({
  getPostHogServerClient: jest.fn(() => null),
}));

// Valid UUIDs for testing
const funnelUUID1 = '550e8400-e29b-41d4-a716-446655440001';
const funnelUUID2 = '550e8400-e29b-41d4-a716-446655440002';
const funnelUUID3 = '550e8400-e29b-41d4-a716-446655440003';
const funnelUUID4 = '550e8400-e29b-41d4-a716-446655440004';
const funnelUUID5 = '550e8400-e29b-41d4-a716-446655440005';
const lmUUID1 = '660e8400-e29b-41d4-a716-446655440001';
const lmUUID2 = '660e8400-e29b-41d4-a716-446655440002';
const lmUUID3 = '660e8400-e29b-41d4-a716-446655440003';
const nonexistentUUID = '770e8400-e29b-41d4-a716-446655440099';

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
    const { request, params } = makeRequest(funnelUUID1, { publish: true });

    const response = await POST(request, { params });
    expect(response.status).toBe(401);
  });

  it('should return 400 if publish is not boolean', async () => {
    const { request, params } = makeRequest(funnelUUID1, { publish: 'yes' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('publish');
  });

  it('should return 404 if funnel not found', async () => {
    mockSupabaseClient._setSingleResults('funnel_pages', [
      { data: null, error: { code: 'PGRST116' } },
    ]);

    const { request, params } = makeRequest(nonexistentUUID, { publish: true });

    const response = await POST(request, { params });
    expect(response.status).toBe(404);
  });

  it('should trigger auto-polish when publishing with extracted but no polished content', async () => {
    // Funnel page query
    mockSupabaseClient._setSingleResults('funnel_pages', [
      {
        data: {
          id: funnelUUID2,
          user_id: 'test-user-id',
          slug: 'test-slug',
          optin_headline: 'Get the Guide',
          published_at: null,
          lead_magnets: { id: lmUUID1 },
        },
        error: null,
      },
      // Update result
      {
        data: {
          id: funnelUUID2,
          user_id: 'test-user-id',
          lead_magnet_id: lmUUID1,
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
          target_type: 'lead_magnet',
          library_id: null,
          external_resource_id: null,
          qualification_form_id: null,
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
          id: lmUUID1,
          extracted_content: { title: 'Guide', structure: [{ sectionName: 'Intro', contents: ['Hi'] }] },
          polished_content: null,
          concept: { title: 'Guide', archetypeName: 'System', painSolved: 'Pain' },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest(funnelUUID2, { publish: true });

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
    mockSupabaseClient._setSingleResults('funnel_pages', [
      {
        data: {
          id: funnelUUID3,
          user_id: 'test-user-id',
          slug: 'test-slug',
          optin_headline: 'Get the Guide',
          published_at: null,
          lead_magnets: { id: lmUUID2 },
        },
        error: null,
      },
      {
        data: {
          id: funnelUUID3,
          user_id: 'test-user-id',
          lead_magnet_id: lmUUID2,
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
          target_type: 'lead_magnet',
          library_id: null,
          external_resource_id: null,
          qualification_form_id: null,
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
          id: lmUUID2,
          extracted_content: { title: 'Guide', structure: [] },
          polished_content: { version: 1, sections: [] }, // Already polished
          concept: { title: 'Guide' },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest(funnelUUID3, { publish: true });

    await POST(request, { params });

    // Polish should NOT be called since content already exists
    expect(mockPolishFn).not.toHaveBeenCalled();
  });

  it('should NOT auto-polish when unpublishing', async () => {
    mockSupabaseClient._setSingleResults('funnel_pages', [
      {
        data: {
          id: funnelUUID4,
          user_id: 'test-user-id',
          slug: 'test-slug',
          optin_headline: 'Guide',
          published_at: '2025-01-27T00:00:00Z',
          lead_magnets: { id: lmUUID3 },
        },
        error: null,
      },
      {
        data: {
          id: funnelUUID4,
          user_id: 'test-user-id',
          lead_magnet_id: lmUUID3,
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
          target_type: 'lead_magnet',
          library_id: null,
          external_resource_id: null,
          qualification_form_id: null,
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

    const { request, params } = makeRequest(funnelUUID4, { publish: false });

    await POST(request, { params });

    // Polish should NOT be called for unpublish
    expect(mockPolishFn).not.toHaveBeenCalled();
  });

  it('should still publish even if auto-polish fails', async () => {
    // Make polish throw an error
    mockPolishFn.mockRejectedValueOnce(new Error('AI service unavailable'));

    mockSupabaseClient._setSingleResults('funnel_pages', [
      {
        data: {
          id: funnelUUID5,
          user_id: 'test-user-id',
          slug: 'test-slug',
          optin_headline: 'Guide',
          published_at: null,
          lead_magnets: { id: lmUUID3 },
        },
        error: null,
      },
      {
        data: {
          id: funnelUUID5,
          user_id: 'test-user-id',
          lead_magnet_id: lmUUID3,
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
          target_type: 'lead_magnet',
          library_id: null,
          external_resource_id: null,
          qualification_form_id: null,
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
          id: lmUUID3,
          extracted_content: { title: 'Guide', structure: [] },
          polished_content: null,
          concept: { title: 'Guide', archetypeName: 'System', painSolved: 'Pain' },
        },
        error: null,
      },
    ]);

    const { request, params } = makeRequest(funnelUUID5, { publish: true });

    const response = await POST(request, { params });

    // Should still succeed - polish failure is non-blocking
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.funnel.isPublished).toBe(true);
  });
});
