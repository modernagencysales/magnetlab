/**
 * @jest-environment node
 */

import { POST as connectRoute } from '@/app/api/integrations/kajabi/connect/route';
import { POST as verifyRoute } from '@/app/api/integrations/kajabi/verify/route';
import { POST as disconnectRoute } from '@/app/api/integrations/kajabi/disconnect/route';
import { GET as tagsRoute } from '@/app/api/integrations/kajabi/tags/route';

// ─── Mock: auth ───────────────────────────────────────────────────────────────
const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// ─── Mock: KajabiClient ──────────────────────────────────────────────────────
const mockTestConnection = jest.fn();
const mockListTags = jest.fn();
jest.mock('@/lib/integrations/kajabi/client', () => ({
  KajabiClient: jest.fn().mockImplementation(() => ({
    testConnection: mockTestConnection,
    listTags: mockListTags,
  })),
}));

// ─── Mock: encrypted-storage ──────────────────────────────────────────────────
const mockUpsertUserIntegration = jest.fn();
const mockGetUserIntegration = jest.fn();
const mockUpdateIntegrationVerified = jest.fn();
const mockDeleteUserIntegration = jest.fn();

jest.mock('@/lib/utils/encrypted-storage', () => ({
  upsertUserIntegration: (...args: unknown[]) => mockUpsertUserIntegration(...args),
  getUserIntegration: (...args: unknown[]) => mockGetUserIntegration(...args),
  updateIntegrationVerified: (...args: unknown[]) => mockUpdateIntegrationVerified(...args),
  deleteUserIntegration: (...args: unknown[]) => mockDeleteUserIntegration(...args),
}));

// ─── Mock: supabase-server (fluent chain for disconnect) ──────────────────────
interface MockSupabaseClient {
  from: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  update: jest.fn(),
  eq: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_USER_ID = 'user-abc-123';
const TEST_API_KEY = 'kaj_test_api_key_12345';
const TEST_SITE_ID = 'site-123';

function authenticatedSession() {
  return { user: { id: TEST_USER_ID } };
}

function makePostRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Kajabi Integration API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up fluent chain for supabase (disconnect route)
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/integrations/kajabi/connect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/integrations/kajabi/connect', () => {
    const url = 'http://localhost:3000/api/integrations/kajabi/connect';

    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = makePostRequest(url, { api_key: TEST_API_KEY, site_id: TEST_SITE_ID });
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when API key is missing', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());

      const request = makePostRequest(url, { site_id: TEST_SITE_ID });
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key is required');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when site_id is missing', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());

      const request = makePostRequest(url, { api_key: TEST_API_KEY });
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Site ID is required');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when credentials are invalid (testConnection returns false)', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockTestConnection.mockResolvedValueOnce(false);

      const request = makePostRequest(url, { api_key: 'bad_key', site_id: TEST_SITE_ID });
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toContain('Invalid credentials');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 200 and saves integration on valid credentials', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockTestConnection.mockResolvedValueOnce(true);

      const savedIntegration = {
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'kajabi',
        is_active: true,
        last_verified_at: null,
        metadata: { site_id: TEST_SITE_ID },
        created_at: '2026-03-02T00:00:00Z',
        updated_at: '2026-03-02T00:00:00Z',
      };
      mockUpsertUserIntegration.mockResolvedValueOnce(savedIntegration);

      const request = makePostRequest(url, { api_key: TEST_API_KEY, site_id: TEST_SITE_ID });
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Connected successfully');
      expect(data.integration).toEqual(savedIntegration);
      expect(mockUpsertUserIntegration).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        service: 'kajabi',
        apiKey: TEST_API_KEY,
        isActive: true,
        metadata: { site_id: TEST_SITE_ID },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/integrations/kajabi/verify
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/integrations/kajabi/verify', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await verifyRoute();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when no integration is stored', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce(null);

      const response = await verifyRoute();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Integration not found');
      expect(data.code).toBe('NOT_FOUND');
    });

    it('returns 404 when integration has no site_id in metadata', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'kajabi',
        api_key: TEST_API_KEY,
        is_active: true,
        metadata: {},
      });

      const response = await verifyRoute();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Integration not found');
    });

    it('returns { verified: true } when connection is valid', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'kajabi',
        api_key: TEST_API_KEY,
        is_active: true,
        metadata: { site_id: TEST_SITE_ID },
      });
      mockTestConnection.mockResolvedValueOnce(true);
      mockUpdateIntegrationVerified.mockResolvedValueOnce(undefined);

      const response = await verifyRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(mockUpdateIntegrationVerified).toHaveBeenCalledWith(TEST_USER_ID, 'kajabi');
    });

    it('returns { verified: false } when connection is invalid', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'kajabi',
        api_key: TEST_API_KEY,
        is_active: true,
        metadata: { site_id: TEST_SITE_ID },
      });
      mockTestConnection.mockResolvedValueOnce(false);

      const response = await verifyRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(false);
      expect(mockUpdateIntegrationVerified).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/integrations/kajabi/disconnect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/integrations/kajabi/disconnect', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await disconnectRoute();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('deletes integration and deactivates funnel mappings', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockDeleteUserIntegration.mockResolvedValueOnce(undefined);

      const response = await disconnectRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Disconnected successfully');

      // Verify integration was deleted
      expect(mockDeleteUserIntegration).toHaveBeenCalledWith(TEST_USER_ID, 'kajabi');

      // Verify funnel integrations were deactivated
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funnel_integrations');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({ is_active: false });
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('provider', 'kajabi');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/integrations/kajabi/tags
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/integrations/kajabi/tags', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await tagsRoute();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when no integration is stored', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce(null);

      const response = await tagsRoute();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Integration not found');
    });

    it('returns 404 when integration is inactive', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'kajabi',
        api_key: TEST_API_KEY,
        is_active: false,
        metadata: { site_id: TEST_SITE_ID },
      });

      const response = await tagsRoute();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Integration not found');
    });

    it('returns 404 when integration has no site_id in metadata', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'kajabi',
        api_key: TEST_API_KEY,
        is_active: true,
        metadata: {},
      });

      const response = await tagsRoute();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Integration not found');
    });

    it('returns tags list on success', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'kajabi',
        api_key: TEST_API_KEY,
        is_active: true,
        metadata: { site_id: TEST_SITE_ID },
      });
      mockListTags.mockResolvedValueOnce([
        { id: 'tag-1', name: 'VIP' },
        { id: 'tag-2', name: 'Lead' },
      ]);

      const response = await tagsRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tags).toEqual([
        { id: 'tag-1', name: 'VIP' },
        { id: 'tag-2', name: 'Lead' },
      ]);
    });
  });
});
