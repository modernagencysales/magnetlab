/**
 * @jest-environment node
 */

// ============================================
// Tests for external email sequence endpoints:
// POST /api/external/email-sequence/generate
// POST /api/external/email-sequence/[leadMagnetId]/activate
// ============================================

// ---------------------------------------------------------------------------
// Mock chainable Supabase client
// ---------------------------------------------------------------------------

interface MockChainable {
  from: jest.Mock;
  select: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
  _results: Map<string, { data: unknown; error: unknown }>;
  _setTableResult: (table: string, result: { data: unknown; error: unknown }) => void;
  _reset: () => void;
}

function createMockSupabase(): MockChainable {
  // Track results per table so we can return different data for different queries
  const results = new Map<string, { data: unknown; error: unknown }>();
  let currentTable = '';
  let defaultResult: { data: unknown; error: unknown } = { data: null, error: null };

  const chainable: MockChainable = {
    from: jest.fn((table: string) => {
      currentTable = table;
      return chainable;
    }),
    select: jest.fn(() => chainable),
    update: jest.fn(() => chainable),
    upsert: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    single: jest.fn(() => {
      const result = results.get(currentTable) ?? defaultResult;
      return Promise.resolve(result);
    }),
    _results: results,
    _setTableResult: (table, result) => {
      results.set(table, result);
    },
    _reset: () => {
      results.clear();
      defaultResult = { data: null, error: null };
    },
  };

  return chainable;
}

const mockSupabaseClient = createMockSupabase();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

// Mock AI generation
const mockGenerateEmailSequence = jest.fn();
const mockGenerateDefaultEmailSequence = jest.fn();

jest.mock('@/lib/ai/email-sequence-generator', () => ({
  generateEmailSequence: (...args: unknown[]) => mockGenerateEmailSequence(...args),
  generateDefaultEmailSequence: (...args: unknown[]) => mockGenerateDefaultEmailSequence(...args),
}));

// Mock external auth
const mockAuthenticateExternalRequest = jest.fn();

jest.mock('@/lib/api/external-auth', () => ({
  authenticateExternalRequest: (req: Request) => mockAuthenticateExternalRequest(req),
}));

// Import routes AFTER mocks
import { POST as generatePOST } from '@/app/api/external/email-sequence/generate/route';
import { POST as activatePOST } from '@/app/api/external/email-sequence/[leadMagnetId]/activate/route';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_LM_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_SEQ_ID = '550e8400-e29b-41d4-a716-446655440003';

const mockEmails = [
  { day: 0, subject: 'Welcome!', body: 'Thanks for downloading.', replyTrigger: 'What made you download?' },
  { day: 1, subject: 'Quick tip', body: 'Here is a tip.', replyTrigger: 'Did you try this?' },
];

const mockLeadMagnet = {
  id: TEST_LM_ID,
  user_id: TEST_USER_ID,
  team_id: null,
  title: 'Test Lead Magnet',
  archetype: 'checklist',
  concept: { contents: 'Test contents', deliveryFormat: 'PDF' },
  extracted_content: null,
};

const mockBrandKit = {
  business_description: 'Test business',
  sender_name: 'Test Sender',
  best_video_url: null,
  best_video_title: null,
  content_links: null,
  community_url: null,
};

const mockUser = { name: 'Test User' };

const mockSequenceRow = {
  id: TEST_SEQ_ID,
  lead_magnet_id: TEST_LM_ID,
  user_id: TEST_USER_ID,
  emails: mockEmails,
  status: 'draft',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>, includeAuth = true): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (includeAuth) {
    headers['Authorization'] = 'Bearer test-key';
  }
  return new Request('http://localhost/api/external/email-sequence/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeActivateRequest(body: Record<string, unknown>, includeAuth = true): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (includeAuth) {
    headers['Authorization'] = 'Bearer test-key';
  }
  return new Request(`http://localhost/api/external/email-sequence/${TEST_LM_ID}/activate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests: Generate endpoint
// ---------------------------------------------------------------------------

describe('POST /api/external/email-sequence/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient._reset();
    mockAuthenticateExternalRequest.mockReturnValue(true);
    mockGenerateDefaultEmailSequence.mockReturnValue(mockEmails);
    mockGenerateEmailSequence.mockResolvedValue(mockEmails);
  });

  it('returns 401 without Bearer token', async () => {
    mockAuthenticateExternalRequest.mockReturnValue(false);
    const request = makeRequest({ userId: TEST_USER_ID, leadMagnetId: TEST_LM_ID }, false);

    const response = await generatePOST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Invalid or missing API key');
  });

  it('returns 400 when userId is missing', async () => {
    const request = makeRequest({ leadMagnetId: TEST_LM_ID });

    const response = await generatePOST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('userId is required');
  });

  it('returns 400 when leadMagnetId is missing', async () => {
    const request = makeRequest({ userId: TEST_USER_ID });

    const response = await generatePOST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('leadMagnetId is required');
  });

  it('returns 404 when lead magnet not found', async () => {
    mockSupabaseClient._setTableResult('lead_magnets', {
      data: null,
      error: { message: 'not found' },
    });

    const request = makeRequest({ userId: TEST_USER_ID, leadMagnetId: TEST_LM_ID });
    const response = await generatePOST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Lead magnet not found');
  });

  it('returns generated email sequence on success', async () => {
    mockSupabaseClient._setTableResult('lead_magnets', { data: mockLeadMagnet, error: null });
    mockSupabaseClient._setTableResult('brand_kits', { data: mockBrandKit, error: null });
    mockSupabaseClient._setTableResult('users', { data: mockUser, error: null });
    mockSupabaseClient._setTableResult('email_sequences', { data: mockSequenceRow, error: null });

    const request = makeRequest({ userId: TEST_USER_ID, leadMagnetId: TEST_LM_ID });
    const response = await generatePOST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.generated).toBe(true);
    expect(json.emailSequence).toBeDefined();
    expect(json.emailSequence.leadMagnetId).toBe(TEST_LM_ID);
    expect(json.emailSequence.userId).toBe(TEST_USER_ID);
    expect(json.emailSequence.emails).toHaveLength(2);
  });

  it('falls back to default emails when AI generation fails', async () => {
    mockGenerateEmailSequence.mockRejectedValue(new Error('AI failed'));
    mockSupabaseClient._setTableResult('lead_magnets', { data: mockLeadMagnet, error: null });
    mockSupabaseClient._setTableResult('brand_kits', { data: mockBrandKit, error: null });
    mockSupabaseClient._setTableResult('users', { data: mockUser, error: null });
    mockSupabaseClient._setTableResult('email_sequences', { data: mockSequenceRow, error: null });

    const request = makeRequest({ userId: TEST_USER_ID, leadMagnetId: TEST_LM_ID });
    const response = await generatePOST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.generated).toBe(true);
    expect(mockGenerateDefaultEmailSequence).toHaveBeenCalled();
  });

  it('skips AI when useAI is false', async () => {
    mockSupabaseClient._setTableResult('lead_magnets', { data: mockLeadMagnet, error: null });
    mockSupabaseClient._setTableResult('brand_kits', { data: mockBrandKit, error: null });
    mockSupabaseClient._setTableResult('users', { data: mockUser, error: null });
    mockSupabaseClient._setTableResult('email_sequences', { data: mockSequenceRow, error: null });

    const request = makeRequest({ userId: TEST_USER_ID, leadMagnetId: TEST_LM_ID, useAI: false });
    const response = await generatePOST(request);

    expect(response.status).toBe(200);
    expect(mockGenerateEmailSequence).not.toHaveBeenCalled();
    expect(mockGenerateDefaultEmailSequence).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Activate endpoint
// ---------------------------------------------------------------------------

describe('POST /api/external/email-sequence/[leadMagnetId]/activate', () => {
  const makeParams = () => ({
    params: Promise.resolve({ leadMagnetId: TEST_LM_ID }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient._reset();
    mockAuthenticateExternalRequest.mockReturnValue(true);
  });

  it('returns 401 without Bearer token', async () => {
    mockAuthenticateExternalRequest.mockReturnValue(false);
    const request = makeActivateRequest({ userId: TEST_USER_ID }, false);

    const response = await activatePOST(request, makeParams());
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Invalid or missing API key');
  });

  it('returns 400 when userId is missing', async () => {
    const request = makeActivateRequest({});

    const response = await activatePOST(request, makeParams());
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('userId is required');
  });

  it('returns 404 when email sequence not found', async () => {
    mockSupabaseClient._setTableResult('email_sequences', {
      data: null,
      error: { message: 'not found' },
    });

    const request = makeActivateRequest({ userId: TEST_USER_ID });
    const response = await activatePOST(request, makeParams());
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Email sequence not found');
  });

  it('returns 400 when sequence has no emails', async () => {
    mockSupabaseClient._setTableResult('email_sequences', {
      data: { ...mockSequenceRow, emails: [] },
      error: null,
    });

    const request = makeActivateRequest({ userId: TEST_USER_ID });
    const response = await activatePOST(request, makeParams());
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('No emails in sequence. Generate emails first.');
  });

  it('activates sequence and returns updated data', async () => {
    const activeSequence = { ...mockSequenceRow, status: 'active' };

    // First call (select) returns draft sequence, second call (update) returns active
    // Since our mock uses table name, we need both to return from 'email_sequences'
    // The mock will return the same result for both calls to the same table,
    // so we set it to the active version (the update result)
    let callCount = 0;
    mockSupabaseClient.single.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First .single() call — fetching the sequence
        return Promise.resolve({ data: mockSequenceRow, error: null });
      }
      // Second .single() call — after update
      return Promise.resolve({ data: activeSequence, error: null });
    });

    const request = makeActivateRequest({ userId: TEST_USER_ID });
    const response = await activatePOST(request, makeParams());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe('Email sequence activated.');
    expect(json.emailSequence).toBeDefined();
    expect(json.emailSequence.status).toBe('active');
  });
});
