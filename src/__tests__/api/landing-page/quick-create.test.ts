/**
 * @jest-environment node
 */

import { POST } from '@/app/api/landing-page/quick-create/route';

// Mock Supabase
interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  delete: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
};

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
const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// Mock AI content generator
const mockGenerateOptinContent = jest.fn();
jest.mock('@/lib/ai/funnel-content-generator', () => ({
  generateOptinContent: (...args: unknown[]) => mockGenerateOptinContent(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/landing-page/quick-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/landing-page/quick-create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.delete.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
  });

  it('should return 401 if not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const response = await POST(makeRequest({ title: 'Test' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if title is missing', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Title is required');
  });

  it('should return 400 if title is empty string', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    const response = await POST(makeRequest({ title: '   ' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Title is required');
  });

  it('should return 500 if lead magnet creation fails', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB error' },
    });

    const response = await POST(makeRequest({ title: 'Test Page' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create landing page');
  });

  it('should create landing page with AI-generated content', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    mockGenerateOptinContent.mockResolvedValueOnce({
      headline: 'Scale Your SaaS to $10K MRR',
      subline: 'The proven playbook used by 500+ founders to grow fast.',
      socialProof: 'Used by 500+ SaaS founders',
      buttonText: 'Get the Playbook',
    });

    mockSupabaseClient.single
      // Lead magnet created
      .mockResolvedValueOnce({
        data: { id: 'lm-new', title: 'SaaS Growth Playbook' },
        error: null,
      })
      // Slug check — no collision
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      // Funnel page created
      .mockResolvedValueOnce({
        data: { id: 'fp-new' },
        error: null,
      });

    const response = await POST(makeRequest({
      title: 'SaaS Growth Playbook',
      description: 'A guide to scaling B2B SaaS',
    }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.leadMagnetId).toBe('lm-new');
    expect(data.funnelPageId).toBe('fp-new');

    // Verify lead magnet was created with correct fields
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('lead_magnets');
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        title: 'SaaS Growth Playbook',
        archetype: 'focused-toolkit',
        status: 'draft',
      })
    );

    // Verify AI was called with title and description as credibility
    expect(mockGenerateOptinContent).toHaveBeenCalledWith({
      leadMagnetTitle: 'SaaS Growth Playbook',
      concept: null,
      extractedContent: null,
      credibility: 'A guide to scaling B2B SaaS',
    });

    // Verify funnel page was created with AI-generated content
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        optin_headline: 'Scale Your SaaS to $10K MRR',
        optin_subline: 'The proven playbook used by 500+ founders to grow fast.',
        optin_button_text: 'Get the Playbook',
        optin_social_proof: 'Used by 500+ SaaS founders',
      })
    );
  });

  it('should fall back to defaults if AI generation fails', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    mockGenerateOptinContent.mockRejectedValueOnce(new Error('AI service down'));

    mockSupabaseClient.single
      .mockResolvedValueOnce({
        data: { id: 'lm-new', title: 'My Page' },
        error: null,
      })
      // Slug — no collision
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      // Funnel page created
      .mockResolvedValueOnce({
        data: { id: 'fp-new' },
        error: null,
      });

    const response = await POST(makeRequest({ title: 'My Page' }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);

    // Verify fallback content was used
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        optin_headline: 'My Page',
        optin_button_text: 'Get Free Access',
      })
    );
  });

  it('should handle slug collision by incrementing suffix', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    mockGenerateOptinContent.mockResolvedValueOnce({
      headline: 'Test Headline',
      subline: 'Test subline',
      socialProof: 'Test proof',
      buttonText: 'Get It',
    });

    mockSupabaseClient.single
      // Lead magnet created
      .mockResolvedValueOnce({
        data: { id: 'lm-new', title: 'Test' },
        error: null,
      })
      // First slug check — collision
      .mockResolvedValueOnce({ data: { id: 'existing' }, error: null })
      // Second slug check — no collision
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      // Funnel page created
      .mockResolvedValueOnce({
        data: { id: 'fp-new' },
        error: null,
      });

    const response = await POST(makeRequest({ title: 'Test' }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });

  it('should clean up lead magnet if funnel page creation fails', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    mockGenerateOptinContent.mockResolvedValueOnce({
      headline: 'Headline',
      subline: 'Subline',
      socialProof: 'Proof',
      buttonText: 'CTA',
    });

    mockSupabaseClient.single
      // Lead magnet created
      .mockResolvedValueOnce({
        data: { id: 'lm-cleanup', title: 'Cleanup Test' },
        error: null,
      })
      // Slug — no collision
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      // Funnel page creation fails
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'FK violation' },
      });

    const response = await POST(makeRequest({ title: 'Cleanup Test' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create landing page');

    // Verify cleanup: lead magnet was deleted
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('lead_magnets');
    expect(mockSupabaseClient.delete).toHaveBeenCalled();
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'lm-cleanup');
  });

  it('should work without description (credibility is undefined)', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    mockGenerateOptinContent.mockResolvedValueOnce({
      headline: 'Title Only Headline',
      subline: 'Generated subline',
      socialProof: 'Social proof',
      buttonText: 'Download',
    });

    mockSupabaseClient.single
      .mockResolvedValueOnce({
        data: { id: 'lm-new', title: 'Title Only' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      .mockResolvedValueOnce({
        data: { id: 'fp-new' },
        error: null,
      });

    const response = await POST(makeRequest({ title: 'Title Only' }));
    await response.json();

    expect(response.status).toBe(201);
    expect(mockGenerateOptinContent).toHaveBeenCalledWith({
      leadMagnetTitle: 'Title Only',
      concept: null,
      extractedContent: null,
      credibility: undefined,
    });
  });
});
