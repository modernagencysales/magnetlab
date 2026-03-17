/**
 * @jest-environment node
 *
 * Tests for GET /api/leads/[id] — single lead detail
 */

import { GET } from '@/app/api/leads/[id]/route';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  eq: jest.fn(),
  maybeSingle: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn().mockResolvedValue({ type: 'user', userId: 'user-123' }),
  applyScope: jest.fn((query: unknown) => query),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(id: string) {
  return new Request(`http://localhost:3000/api/leads/${id}`, { method: 'GET' });
}

const LEAD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockLeadRow = {
  id: LEAD_ID,
  funnel_page_id: 'fp-uuid',
  lead_magnet_id: 'lm-uuid',
  user_id: 'user-123',
  team_id: null,
  email: 'test@example.com',
  name: 'Test User',
  is_qualified: true,
  qualification_answers: { q1: 'answer1' },
  utm_source: 'linkedin',
  utm_medium: 'social',
  utm_campaign: 'campaign-1',
  created_at: '2025-01-01T00:00:00.000Z',
  ip_address: '1.2.3.4',
  user_agent: 'Mozilla/5.0',
  linkedin_url: 'https://linkedin.com/in/testuser',
  heyreach_delivery_status: null,
  funnel_pages: {
    slug: 'test-slug',
    optin_headline: 'Test Headline',
    lead_magnets: { title: 'My Lead Magnet' },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/leads/[id]', () => {
  const params = Promise.resolve({ id: LEAD_ID });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
  });

  describe('authentication', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await GET(makeRequest(LEAD_ID), { params });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('happy path', () => {
    it('returns full lead detail for a valid ID', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: mockLeadRow,
        error: null,
      });

      const response = await GET(makeRequest(LEAD_ID), { params });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.id).toBe(LEAD_ID);
      expect(body.email).toBe('test@example.com');
      expect(body.name).toBe('Test User');
      expect(body.isQualified).toBe(true);
      expect(body.qualificationAnswers).toEqual({ q1: 'answer1' });
      expect(body.utmSource).toBe('linkedin');
      expect(body.utmMedium).toBe('social');
      expect(body.utmCampaign).toBe('campaign-1');
      expect(body.linkedinUrl).toBe('https://linkedin.com/in/testuser');
      expect(body.heyreachDeliveryStatus).toBeNull();
      expect(body.funnelSlug).toBe('test-slug');
      expect(body.funnelHeadline).toBe('Test Headline');
      expect(body.leadMagnetTitle).toBe('My Lead Magnet');
    });
  });

  describe('not found', () => {
    it('returns 404 when lead does not exist', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const response = await GET(makeRequest(LEAD_ID), { params });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    it('returns 404 when lead belongs to a different user (scope enforced at repo level)', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'other-user' } });
      // applyScope filters to other-user — DB returns null
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const response = await GET(makeRequest(LEAD_ID), { params });

      expect(response.status).toBe(404);
    });
  });

  describe('validation', () => {
    it('returns 400 for a non-UUID id', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      const badParams = Promise.resolve({ id: 'not-a-uuid' });

      const response = await GET(makeRequest('not-a-uuid'), { params: badParams });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected database error', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB failure' },
      });

      const response = await GET(makeRequest(LEAD_ID), { params });

      expect(response.status).toBe(500);
    });
  });
});
