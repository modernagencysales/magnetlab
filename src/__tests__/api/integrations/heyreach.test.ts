/**
 * @jest-environment node
 */

import { POST as connectRoute } from '@/app/api/integrations/heyreach/connect/route';
import { POST as verifyRoute } from '@/app/api/integrations/heyreach/verify/route';
import { GET as statusRoute } from '@/app/api/integrations/heyreach/status/route';
import { POST as disconnectRoute } from '@/app/api/integrations/heyreach/disconnect/route';

// ─── Mock: auth ───────────────────────────────────────────────────────────────
const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// ─── Mock: HeyReachClient ─────────────────────────────────────────────────────
const mockTestConnection = jest.fn();
jest.mock('@/lib/integrations/heyreach/client', () => ({
  HeyReachClient: jest.fn().mockImplementation(() => ({
    testConnection: mockTestConnection,
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
const TEST_API_KEY = 'hr_test_api_key_12345';

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

describe('HeyReach Integration API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up fluent chain for supabase (disconnect route)
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/integrations/heyreach/connect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/integrations/heyreach/connect', () => {
    const url = 'http://localhost:3000/api/integrations/heyreach/connect';

    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = makePostRequest(url, { api_key: TEST_API_KEY });
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when API key is missing', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());

      const request = makePostRequest(url, {});
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key is required');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when API key is invalid (testConnection returns false)', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockTestConnection.mockResolvedValueOnce(false);

      const request = makePostRequest(url, { api_key: 'bad_key' });
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toContain('Invalid API key');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 200 and saves integration on valid API key', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockTestConnection.mockResolvedValueOnce(true);

      const savedIntegration = {
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'heyreach',
        is_active: true,
        last_verified_at: null,
        metadata: {},
        created_at: '2026-02-27T00:00:00Z',
        updated_at: '2026-02-27T00:00:00Z',
      };
      mockUpsertUserIntegration.mockResolvedValueOnce(savedIntegration);

      const request = makePostRequest(url, { api_key: TEST_API_KEY });
      const response = await connectRoute(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Connected successfully');
      expect(data.integration).toEqual(savedIntegration);
      expect(mockUpsertUserIntegration).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        service: 'heyreach',
        apiKey: TEST_API_KEY,
        isActive: true,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/integrations/heyreach/verify
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/integrations/heyreach/verify', () => {
    const url = 'http://localhost:3000/api/integrations/heyreach/verify';

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

    it('returns { verified: true } when connection is valid', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'heyreach',
        api_key: TEST_API_KEY,
        is_active: true,
      });
      mockTestConnection.mockResolvedValueOnce(true);
      mockUpdateIntegrationVerified.mockResolvedValueOnce(undefined);

      const response = await verifyRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(mockUpdateIntegrationVerified).toHaveBeenCalledWith(TEST_USER_ID, 'heyreach');
    });

    it('returns { verified: false } when connection is invalid', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'heyreach',
        api_key: TEST_API_KEY,
        is_active: true,
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
  // GET /api/integrations/heyreach/status
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/integrations/heyreach/status', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await statusRoute();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns { connected: false } when no integration exists', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce(null);

      const response = await statusRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(false);
    });

    it('returns { connected: false } when integration exists but has no api_key', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'heyreach',
        api_key: null,
        is_active: true,
      });

      const response = await statusRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(false);
    });

    it('returns { connected: false } when integration exists but is_active is false', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'heyreach',
        api_key: TEST_API_KEY,
        is_active: false,
      });

      const response = await statusRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(false);
    });

    it('returns { connected: true } when integration is active with api_key', async () => {
      mockAuth.mockResolvedValueOnce(authenticatedSession());
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: TEST_USER_ID,
        service: 'heyreach',
        api_key: TEST_API_KEY,
        is_active: true,
      });

      const response = await statusRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /api/integrations/heyreach/disconnect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/integrations/heyreach/disconnect', () => {
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
      expect(data.success).toBe(true);
      expect(data.message).toBe('Disconnected successfully');

      // Verify integration was deleted
      expect(mockDeleteUserIntegration).toHaveBeenCalledWith(TEST_USER_ID, 'heyreach');

      // Verify funnel integrations were deactivated
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funnel_integrations');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({ is_active: false });
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('provider', 'heyreach');
    });
  });
});
