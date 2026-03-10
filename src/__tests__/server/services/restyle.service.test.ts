/**
 * @jest-environment node
 */

// ─── Mock external deps ─────────────────────────────────────────────

const mockFindFunnelById = jest.fn();
const mockFindSections = jest.fn();
const mockUpdateFunnel = jest.fn();
const mockCreateSection = jest.fn();
const mockDeleteSection = jest.fn();
const mockUpdateSection = jest.fn();
const mockGetMaxSortOrder = jest.fn();

jest.mock('@/server/repositories/funnels.repo', () => ({
  findFunnelById: (...args: unknown[]) => mockFindFunnelById(...args),
  findSections: (...args: unknown[]) => mockFindSections(...args),
  updateFunnel: (...args: unknown[]) => mockUpdateFunnel(...args),
  createSection: (...args: unknown[]) => mockCreateSection(...args),
  deleteSection: (...args: unknown[]) => mockDeleteSection(...args),
  updateSection: (...args: unknown[]) => mockUpdateSection(...args),
  getMaxSortOrder: (...args: unknown[]) => mockGetMaxSortOrder(...args),
}));

const mockMessagesCreate = jest.fn();
jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: () => ({
    messages: { create: mockMessagesCreate },
  }),
}));

jest.mock('@/lib/ai/restyle/plan-generator', () => ({
  buildRestylePrompt: jest.fn().mockReturnValue({
    systemMessage: 'system',
    userMessage: 'user',
  }),
  buildVisionPrompt: jest.fn().mockReturnValue('analyze this'),
  parseRestylePlan: jest.fn().mockImplementation((raw: string) => JSON.parse(raw)),
}));

jest.mock('@/lib/api/errors', () => ({
  logApiError: jest.fn(),
}));

// ─── Import after mocks ─────────────────────────────────────────────

import {
  generateRestylePlan,
  applyRestylePlan,
  getStatusCode,
} from '@/server/services/restyle.service';

import type { DataScope } from '@/lib/utils/team-context';
import type { RestylePlan } from '@/lib/types/funnel';

// ─── Test data ──────────────────────────────────────────────────────

const scope: DataScope = { type: 'user', userId: 'user-1' };
const funnelId = 'funnel-1';

const mockFunnel = {
  id: funnelId,
  userId: 'user-1',
  slug: 'test-funnel',
  theme: 'dark',
  primaryColor: '#8b5cf6',
  backgroundStyle: 'solid',
  fontFamily: null,
  fontUrl: null,
  logoUrl: null,
  optinHeadline: 'Test',
  targetType: 'lead_magnet',
};

const mockSections = [
  { id: 'sec-1', sectionType: 'testimonial', pageLocation: 'optin', sortOrder: 0 },
  { id: 'sec-2', sectionType: 'steps', pageLocation: 'optin', sortOrder: 1 },
];

const mockPlan: RestylePlan = {
  styleDirection: 'Corporate Navy',
  reasoning: 'Navy conveys trust and professionalism',
  changes: [
    { field: 'primaryColor', from: '#8b5cf6', to: '#1e3a5f', reason: 'Navy conveys trust' },
    { field: 'theme', from: 'dark', to: 'light', reason: 'Lighter feel' },
  ],
  sectionChanges: [
    { action: 'add', sectionType: 'logo_bar', pageLocation: 'optin', reason: 'Adds credibility' },
  ],
};

// ─── Tests: generateRestylePlan ─────────────────────────────────────

describe('generateRestylePlan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 400 if no prompt or urls provided', async () => {
    try {
      await generateRestylePlan(scope, funnelId, {});
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('Either a style prompt or reference URLs are required');
      expect((err as { statusCode: number }).statusCode).toBe(400);
    }
  });

  it('throws 400 if urls is empty array and no prompt', async () => {
    try {
      await generateRestylePlan(scope, funnelId, { urls: [] });
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('Either a style prompt or reference URLs are required');
      expect((err as { statusCode: number }).statusCode).toBe(400);
    }
  });

  it('throws 404 if funnel not found', async () => {
    mockFindFunnelById.mockResolvedValue(null);

    try {
      await generateRestylePlan(scope, funnelId, { prompt: 'Make it blue' });
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('Funnel not found');
      expect((err as { statusCode: number }).statusCode).toBe(404);
    }
  });

  it('returns a plan when given a valid prompt', async () => {
    mockFindFunnelById.mockResolvedValue(mockFunnel);
    mockFindSections.mockResolvedValue(mockSections);
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockPlan) }],
    });

    const result = await generateRestylePlan(scope, funnelId, { prompt: 'Corporate navy feel' });

    expect(result.plan).toEqual(mockPlan);
    expect(mockFindFunnelById).toHaveBeenCalledWith(scope, funnelId);
    expect(mockFindSections).toHaveBeenCalledWith(funnelId);
  });

  it('calls vision analysis when urls are provided', async () => {
    mockFindFunnelById.mockResolvedValue(mockFunnel);
    mockFindSections.mockResolvedValue(mockSections);

    // First call = vision analysis, second call = plan generation
    mockMessagesCreate
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Dark color scheme with navy tones' }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify(mockPlan) }],
      });

    const result = await generateRestylePlan(scope, funnelId, {
      prompt: 'Match this',
      urls: ['https://example.com/screenshot.png'],
    });

    expect(result.plan).toEqual(mockPlan);
    // Vision call + plan call = 2 calls
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
  });
});

// ─── Tests: applyRestylePlan ────────────────────────────────────────

describe('applyRestylePlan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 404 if funnel not found', async () => {
    mockFindFunnelById.mockResolvedValue(null);

    try {
      await applyRestylePlan(scope, funnelId, { plan: mockPlan });
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('Funnel not found');
      expect((err as { statusCode: number }).statusCode).toBe(404);
    }
  });

  it('applies field changes and returns correct counts', async () => {
    mockFindFunnelById.mockResolvedValue(mockFunnel);
    mockUpdateFunnel.mockResolvedValue(mockFunnel);
    mockGetMaxSortOrder.mockResolvedValue(2);
    mockCreateSection.mockResolvedValue({ id: 'sec-new' });

    const result = await applyRestylePlan(scope, funnelId, { plan: mockPlan });

    expect(result.success).toBe(true);
    expect(result.applied.fieldChanges).toBe(2);
    expect(result.applied.sectionChanges).toBe(1);

    // Verify updateFunnel was called with correct DB column names
    expect(mockUpdateFunnel).toHaveBeenCalledWith(scope, funnelId, {
      primary_color: '#1e3a5f',
      theme: 'light',
    });
  });

  it('applies remove section change', async () => {
    mockFindFunnelById.mockResolvedValue(mockFunnel);
    mockUpdateFunnel.mockResolvedValue(mockFunnel);
    mockFindSections.mockResolvedValue(mockSections);
    mockDeleteSection.mockResolvedValue(undefined);

    const plan: RestylePlan = {
      styleDirection: 'Minimal',
      reasoning: 'Simplify',
      changes: [],
      sectionChanges: [
        { action: 'remove', sectionType: 'testimonial', reason: 'Clean look' },
      ],
    };

    const result = await applyRestylePlan(scope, funnelId, { plan });

    expect(result.applied.fieldChanges).toBe(0);
    expect(result.applied.sectionChanges).toBe(1);
    expect(mockDeleteSection).toHaveBeenCalledWith('sec-1', funnelId);
  });

  it('applies reorder section change', async () => {
    mockFindFunnelById.mockResolvedValue(mockFunnel);
    mockFindSections.mockResolvedValue(mockSections);
    mockUpdateSection.mockResolvedValue({ ...mockSections[1], sortOrder: 5 });

    const plan: RestylePlan = {
      styleDirection: 'Reordered',
      reasoning: 'Better flow',
      changes: [],
      sectionChanges: [
        { action: 'reorder', sectionType: 'steps', position: 5, reason: 'Move down' },
      ],
    };

    const result = await applyRestylePlan(scope, funnelId, { plan });

    expect(result.applied.sectionChanges).toBe(1);
    expect(mockUpdateSection).toHaveBeenCalledWith('sec-2', funnelId, expect.objectContaining({
      sort_order: 5,
    }));
  });

  it('does not block on individual section change failures', async () => {
    mockFindFunnelById.mockResolvedValue(mockFunnel);
    mockUpdateFunnel.mockResolvedValue(mockFunnel);
    mockGetMaxSortOrder.mockResolvedValue(0);
    // createSection throws an error
    mockCreateSection.mockRejectedValue(new Error('DB error'));

    const plan: RestylePlan = {
      styleDirection: 'Mixed',
      reasoning: 'Test resilience',
      changes: [
        { field: 'theme', from: 'dark', to: 'light', reason: 'Lighter' },
      ],
      sectionChanges: [
        { action: 'add', sectionType: 'logo_bar', pageLocation: 'optin', reason: 'Add' },
      ],
    };

    const result = await applyRestylePlan(scope, funnelId, { plan });

    // Field change succeeds, section change fails silently
    expect(result.success).toBe(true);
    expect(result.applied.fieldChanges).toBe(1);
    expect(result.applied.sectionChanges).toBe(0);
  });

  it('only applies whitelisted fields', async () => {
    mockFindFunnelById.mockResolvedValue(mockFunnel);
    mockUpdateFunnel.mockResolvedValue(mockFunnel);

    const plan: RestylePlan = {
      styleDirection: 'Test',
      reasoning: 'Test whitelist',
      changes: [
        { field: 'primaryColor', from: '#000', to: '#fff', reason: 'Change' },
        // A field that's not in the whitelist (casting to bypass TS)
        { field: 'slug' as 'primaryColor', from: 'old', to: 'hacked', reason: 'Bypass' },
      ],
      sectionChanges: [],
    };

    const result = await applyRestylePlan(scope, funnelId, { plan });

    expect(result.applied.fieldChanges).toBe(1);
    expect(mockUpdateFunnel).toHaveBeenCalledWith(scope, funnelId, {
      primary_color: '#fff',
    });
  });
});

// ─── Tests: getStatusCode ───────────────────────────────────────────

describe('getStatusCode', () => {
  it('returns statusCode from error object', () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    expect(getStatusCode(err)).toBe(404);
  });

  it('returns 500 for errors without statusCode', () => {
    expect(getStatusCode(new Error('generic'))).toBe(500);
  });

  it('returns 500 for non-object errors', () => {
    expect(getStatusCode('string error')).toBe(500);
    expect(getStatusCode(null)).toBe(500);
    expect(getStatusCode(undefined)).toBe(500);
  });
});
