/**
 * @jest-environment node
 */

import { POST } from '@/app/api/email-sequence/generate/route';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock AI generator
jest.mock('@/lib/ai/email-sequence-generator', () => ({
  generateEmailSequence: jest.fn(),
  generateDefaultEmailSequence: jest.fn(),
}));

// Mock plan limits
jest.mock('@/lib/auth/plan-limits', () => ({
  checkResourceLimit: jest.fn(),
}));

// Mock errors
jest.mock('@/lib/api/errors', () => ({
  ApiErrors: {
    unauthorized: jest.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
    validationError: jest.fn((msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 })),
    notFound: jest.fn((msg: string) => new Response(JSON.stringify({ error: `${msg} not found` }), { status: 404 })),
    databaseError: jest.fn((msg: string) => new Response(JSON.stringify({ error: msg }), { status: 500 })),
    internalError: jest.fn((msg: string) => new Response(JSON.stringify({ error: msg }), { status: 500 })),
  },
  logApiError: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';
import { checkResourceLimit } from '@/lib/auth/plan-limits';

// Helper to create chainable Supabase mock
function createMockSupabase() {
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};
    chain.select = jest.fn(() => chain);
    chain.insert = jest.fn(() => chain);
    chain.upsert = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.single = jest.fn(() => {
      const result = tableResults[tableName] || { data: null, error: null };
      return Promise.resolve(result);
    });
    return chain;
  }

  const mock = {
    from: jest.fn((table: string) => createChain(table)),
    setResult: (table: string, data: unknown, error: unknown = null) => {
      tableResults[table] = { data, error };
    },
  };

  return mock;
}

const mockUserId = 'user-123';
const mockLeadMagnetId = 'lm-456';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/email-sequence/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockEmails = [
  { day: 0, subject: 'your download is ready', body: 'Hey {{first_name}},\n\nHere is your resource:\n\nhttps://www.magnetlab.app/p/testuser/test-slug/content\n\nThanks,\nJohn', replyTrigger: 'Reply got it' },
  { day: 1, subject: 'did you get it?', body: 'Check-in email', replyTrigger: 'Biggest challenge?' },
  { day: 2, subject: 'free resources', body: 'Resources email', replyTrigger: 'Which one?' },
  { day: 3, subject: 'quick question', body: 'Question email', replyTrigger: 'Questions?' },
  { day: 4, subject: 'what next?', body: 'Next email', replyTrigger: 'Topic request?' },
];

describe('POST /api/email-sequence/generate', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId } });
    (checkResourceLimit as jest.Mock).mockResolvedValue({ allowed: true, current: 0, limit: 10 });

    mockSupabase = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('auto-activates when lead magnet has external_url', async () => {
    mockSupabase.setResult('lead_magnets', {
      id: mockLeadMagnetId,
      user_id: mockUserId,
      team_id: null,
      title: 'Test Lead Magnet',
      archetype: 'checklist',
      concept: null,
      extracted_content: null,
      external_url: 'https://notion.so/my-resource',
      polished_content: null,
    });
    mockSupabase.setResult('brand_kits', { sender_name: 'John', business_description: 'Agency' });
    mockSupabase.setResult('users', { name: 'John Doe', username: 'johndoe' });
    mockSupabase.setResult('email_sequences', {
      id: 'seq-1',
      lead_magnet_id: mockLeadMagnetId,
      user_id: mockUserId,
      emails: mockEmails,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    (generateDefaultEmailSequence as jest.Mock).mockReturnValue(mockEmails);

    const response = await POST(makeRequest({ leadMagnetId: mockLeadMagnetId, useAI: false }));
    const data = await response.json();

    expect(data.autoActivated).toBe(true);
    expect(data.generated).toBe(true);
  });

  it('stays draft when no resource URL available', async () => {
    mockSupabase.setResult('lead_magnets', {
      id: mockLeadMagnetId,
      user_id: mockUserId,
      team_id: null,
      title: 'Test Lead Magnet',
      archetype: 'checklist',
      concept: null,
      extracted_content: null,
      external_url: null,
      polished_content: null,
    });
    mockSupabase.setResult('brand_kits', { sender_name: 'John', business_description: 'Agency' });
    mockSupabase.setResult('users', { name: 'John Doe', username: 'johndoe' });
    mockSupabase.setResult('email_sequences', {
      id: 'seq-1',
      lead_magnet_id: mockLeadMagnetId,
      user_id: mockUserId,
      emails: mockEmails,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const emailsNoUrl = mockEmails.map((e) => ({ ...e }));
    emailsNoUrl[0].body = 'Hey {{first_name}},\n\n[DOWNLOAD LINK]\n\nJohn';
    (generateDefaultEmailSequence as jest.Mock).mockReturnValue(emailsNoUrl);

    const response = await POST(makeRequest({ leadMagnetId: mockLeadMagnetId, useAI: false }));
    const data = await response.json();

    expect(data.autoActivated).toBe(false);
  });

  it('auto-activates with hosted content URL when content exists', async () => {
    mockSupabase.setResult('lead_magnets', {
      id: mockLeadMagnetId,
      user_id: mockUserId,
      team_id: null,
      title: 'Test Lead Magnet',
      archetype: 'checklist',
      concept: null,
      extracted_content: { title: 'Some content', format: 'checklist' },
      external_url: null,
      polished_content: null,
    });
    mockSupabase.setResult('brand_kits', { sender_name: 'John', business_description: 'Agency' });
    mockSupabase.setResult('users', { name: 'John Doe', username: 'johndoe' });
    mockSupabase.setResult('funnel_pages', { slug: 'test-slug' });
    mockSupabase.setResult('email_sequences', {
      id: 'seq-1',
      lead_magnet_id: mockLeadMagnetId,
      user_id: mockUserId,
      emails: mockEmails,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    (generateDefaultEmailSequence as jest.Mock).mockReturnValue(mockEmails);

    const response = await POST(makeRequest({ leadMagnetId: mockLeadMagnetId, useAI: false }));
    const data = await response.json();

    expect(data.autoActivated).toBe(true);
    // Verify resourceUrl was passed to the default generator
    expect(generateDefaultEmailSequence).toHaveBeenCalledWith(
      'Test Lead Magnet',
      'John',
      expect.stringContaining('/p/johndoe/test-slug/content')
    );
  });

  it('passes resourceUrl to generateDefaultEmailSequence', async () => {
    mockSupabase.setResult('lead_magnets', {
      id: mockLeadMagnetId,
      user_id: mockUserId,
      team_id: null,
      title: 'My Audit',
      archetype: 'guide',
      concept: null,
      extracted_content: null,
      external_url: 'https://example.com/resource.pdf',
      polished_content: null,
    });
    mockSupabase.setResult('brand_kits', null);
    mockSupabase.setResult('users', { name: 'Jane', username: 'jane' });
    mockSupabase.setResult('email_sequences', {
      id: 'seq-2',
      lead_magnet_id: mockLeadMagnetId,
      user_id: mockUserId,
      emails: mockEmails,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    (generateDefaultEmailSequence as jest.Mock).mockReturnValue(mockEmails);

    await POST(makeRequest({ leadMagnetId: mockLeadMagnetId, useAI: false }));

    expect(generateDefaultEmailSequence).toHaveBeenCalledWith(
      'My Audit',
      expect.any(String),
      'https://example.com/resource.pdf'
    );
  });

  it('returns 401 when not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ leadMagnetId: mockLeadMagnetId }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when leadMagnetId is missing', async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });
});
