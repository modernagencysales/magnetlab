/**
 * @jest-environment node
 */

import { POST as restyleHandler } from '@/app/api/funnel/[id]/restyle/route';
import { POST as applyRestyleHandler } from '@/app/api/funnel/[id]/apply-restyle/route';

// ─── Mocks ──────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

const mockGetFunnelTeamId = jest.fn();
jest.mock('@/server/repositories/funnels.repo', () => ({
  getFunnelTeamId: (...args: unknown[]) => mockGetFunnelTeamId(...args),
}));

const mockGetScopeForResource = jest.fn();
jest.mock('@/lib/utils/team-context', () => ({
  getScopeForResource: (...args: unknown[]) => mockGetScopeForResource(...args),
}));

const mockGenerateRestylePlan = jest.fn();
const mockApplyRestylePlan = jest.fn();
jest.mock('@/server/services/restyle.service', () => ({
  generateRestylePlan: (...args: unknown[]) => mockGenerateRestylePlan(...args),
  applyRestylePlan: (...args: unknown[]) => mockApplyRestylePlan(...args),
  getStatusCode: (err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      return (err as { statusCode: number }).statusCode;
    }
    return 500;
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const mockScope = { type: 'user' as const, userId: 'user-123' };

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('POST /api/funnel/[id]/restyle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFunnelTeamId.mockResolvedValue('team-abc');
    mockGetScopeForResource.mockResolvedValue(mockScope);
  });

  it('returns 401 if not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const request = makeRequest(`http://localhost:3000/api/funnel/${validUUID}/restyle`, {
      prompt: 'Make it blue',
    });
    const response = await restyleHandler(request, makeParams(validUUID));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid UUID', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    const request = makeRequest('http://localhost:3000/api/funnel/not-a-uuid/restyle', {
      prompt: 'Make it blue',
    });
    const response = await restyleHandler(request, makeParams('not-a-uuid'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid funnel page ID');
  });

  it('returns plan on successful restyle', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    const mockPlan = {
      plan: {
        summary: 'Switching to blue theme',
        changes: [
          { field: 'primaryColor', from: '#8b5cf6', to: '#3b82f6', reason: 'Match blue branding' },
        ],
        sectionChanges: [],
      },
    };
    mockGenerateRestylePlan.mockResolvedValueOnce(mockPlan);

    const request = makeRequest(`http://localhost:3000/api/funnel/${validUUID}/restyle`, {
      prompt: 'Make it blue',
    });
    const response = await restyleHandler(request, makeParams(validUUID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.plan).toBeDefined();
    expect(data.plan.summary).toBe('Switching to blue theme');
    expect(mockGenerateRestylePlan).toHaveBeenCalledWith(mockScope, validUUID, {
      prompt: 'Make it blue',
    });
  });

  it('returns service error status on failure', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    const err = Object.assign(new Error('Funnel not found'), { statusCode: 404 });
    mockGenerateRestylePlan.mockRejectedValueOnce(err);

    const request = makeRequest(`http://localhost:3000/api/funnel/${validUUID}/restyle`, {
      prompt: 'Make it blue',
    });
    const response = await restyleHandler(request, makeParams(validUUID));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Funnel not found');
  });
});

describe('POST /api/funnel/[id]/apply-restyle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFunnelTeamId.mockResolvedValue('team-abc');
    mockGetScopeForResource.mockResolvedValue(mockScope);
  });

  it('returns 401 if not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const request = makeRequest(`http://localhost:3000/api/funnel/${validUUID}/apply-restyle`, {
      plan: {},
    });
    const response = await applyRestyleHandler(request, makeParams(validUUID));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 for missing plan', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    const request = makeRequest(`http://localhost:3000/api/funnel/${validUUID}/apply-restyle`, {});
    const response = await applyRestyleHandler(request, makeParams(validUUID));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('plan is required');
  });

  it('returns applied counts on successful apply', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    const mockResult = {
      success: true,
      applied: { fieldChanges: 2, sectionChanges: 1 },
    };
    mockApplyRestylePlan.mockResolvedValueOnce(mockResult);

    const plan = {
      summary: 'Blue theme',
      changes: [
        { field: 'primaryColor', from: '#8b5cf6', to: '#3b82f6', reason: 'Blue' },
        { field: 'theme', from: 'dark', to: 'light', reason: 'Lighter' },
      ],
      sectionChanges: [
        { action: 'add', sectionType: 'logo_bar', pageLocation: 'optin', reason: 'Add logos' },
      ],
    };

    const request = makeRequest(`http://localhost:3000/api/funnel/${validUUID}/apply-restyle`, {
      plan,
    });
    const response = await applyRestyleHandler(request, makeParams(validUUID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.applied.fieldChanges).toBe(2);
    expect(data.applied.sectionChanges).toBe(1);
    expect(mockApplyRestylePlan).toHaveBeenCalledWith(mockScope, validUUID, { plan });
  });

  it('returns service error status on failure', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

    const err = Object.assign(new Error('Funnel not found'), { statusCode: 404 });
    mockApplyRestylePlan.mockRejectedValueOnce(err);

    const plan = { summary: 'Test', changes: [], sectionChanges: [] };
    const request = makeRequest(`http://localhost:3000/api/funnel/${validUUID}/apply-restyle`, {
      plan,
    });
    const response = await applyRestyleHandler(request, makeParams(validUUID));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Funnel not found');
  });
});
