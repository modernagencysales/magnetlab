/**
 * @jest-environment node
 *
 * Tests for PATCH /api/lead-magnet/[id] — Deep-merge content update
 * with content_version optimistic locking.
 */

// ─── Mock setup ──────────────────────────────────────────────────────────────

jest.mock('@/server/repositories/lead-magnets.repo', () => ({
  findLeadMagnetById: jest.fn(),
  updateLeadMagnetContent: jest.fn(),
  findLeadMagnets: jest.fn(),
  findLeadMagnetScoped: jest.fn(),
  findLeadMagnetByOwner: jest.fn(),
  updateLeadMagnet: jest.fn(),
  updateLeadMagnetNoReturn: jest.fn(),
  updateLeadMagnetWithSelect: jest.fn(),
  createLeadMagnet: jest.fn(),
  createLeadMagnetSelect: jest.fn(),
  deleteLeadMagnetWithCascade: jest.fn(),
  deleteLeadMagnetById: jest.fn(),
  getBrandKitByUserId: jest.fn(),
  upsertBrandKit: jest.fn(),
  createBackgroundJob: jest.fn(),
  updateJobTriggerId: jest.fn(),
  findPublishedFunnelPage: jest.fn(),
  getUsernameByUserId: jest.fn(),
  checkSlugExists: jest.fn(),
  createFunnelPageWithRetry: jest.fn(),
  uploadScreenshotToStorage: jest.fn(),
}));

jest.mock('@/lib/auth/plan-limits', () => ({
  checkResourceLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));

jest.mock('@/lib/posthog', () => ({
  getPostHogServerClient: jest.fn(() => null),
}));

jest.mock('@/lib/validations/api', () => ({
  validateBody: jest.fn(),
  createLeadMagnetSchema: {},
  updateContentBodySchema: {},
  spreadsheetImportSchema: {},
}));

jest.mock('@/lib/ai/lead-magnet-generator', () => ({
  getExtractionQuestions: jest.fn(),
  getContextAwareExtractionQuestions: jest.fn(),
  processContentExtraction: jest.fn(),
  analyzeCompetitorContent: jest.fn(),
  analyzeCallTranscript: jest.fn(),
  polishLeadMagnetContent: jest.fn(),
}));

jest.mock('@/lib/ai/generate-lead-magnet-content', () => ({
  generateFullContent: jest.fn(),
}));

jest.mock('@/lib/services/knowledge-brain', () => ({
  getRelevantContext: jest.fn(),
}));

jest.mock('@/lib/services/edit-capture', () => ({
  captureAndClassifyEdit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({})),
}));

jest.mock('@/lib/services/screenshot', () => ({
  generateContentScreenshots: jest.fn(),
  closeScreenshotBrowser: jest.fn(),
}));

jest.mock('@/lib/utils/spreadsheet-parser', () => ({
  parseSpreadsheet: jest.fn(),
}));

jest.mock('@/lib/ai/interactive-generators', () => ({
  generateCalculatorFromSpreadsheet: jest.fn(),
}));

jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  applyScope: jest.fn((query: unknown) => query),
}));

let currentSession: { user: { id: string; email: string } } | null = {
  user: { id: 'test-user-id', email: 'test@example.com' },
};

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(currentSession)),
}));

jest.mock('@/lib/api/errors', () => ({
  ApiErrors: {
    unauthorized: jest.fn(
      () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    ),
    notFound: jest.fn(
      (r: string) => new Response(JSON.stringify({ error: `${r} not found` }), { status: 404 })
    ),
    validationError: jest.fn(
      (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 })
    ),
  },
  logApiError: jest.fn(),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import * as leadMagnetsRepo from '@/server/repositories/lead-magnets.repo';
import { applyContentPatch } from '@/server/services/lead-magnets.service';

const mockFindLeadMagnetById = leadMagnetsRepo.findLeadMagnetById as jest.Mock;
const mockUpdateLeadMagnetContent = leadMagnetsRepo.updateLeadMagnetContent as jest.Mock;

// ─── Test constants ──────────────────────────────────────────────────────────

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

const makeParams = (id: string) => ({
  params: Promise.resolve({ id }),
});

// ─── Unit tests: applyContentPatch ───────────────────────────────────────────

describe('applyContentPatch', () => {
  it('adds new keys to empty content', () => {
    const result = applyContentPatch(null, { headline: 'New headline' });
    expect(result).toEqual({ headline: 'New headline' });
  });

  it('adds new keys to existing content', () => {
    const current = { headline: 'Old headline' };
    const result = applyContentPatch(current, { subline: 'A subline' });
    expect(result).toEqual({ headline: 'Old headline', subline: 'A subline' });
  });

  it('updates existing keys without touching others', () => {
    const current = { headline: 'Old', sections: ['a', 'b'], meta: 42 };
    const result = applyContentPatch(current, { headline: 'New' });
    expect(result).toEqual({ headline: 'New', sections: ['a', 'b'], meta: 42 });
  });

  it('replaces arrays entirely (not appended)', () => {
    const current = { sections: ['a', 'b', 'c'] };
    const result = applyContentPatch(current, { sections: ['x'] });
    expect(result).toEqual({ sections: ['x'] });
  });

  it('removes keys when value is explicit null', () => {
    const current = { headline: 'Keep', obsoleteField: 'remove me' };
    const result = applyContentPatch(current, { obsoleteField: null });
    expect(result).toEqual({ headline: 'Keep' });
    expect('obsoleteField' in result).toBe(false);
  });

  it('returns copy of current when patch is empty', () => {
    const current = { headline: 'Hello', sections: [1, 2] };
    const result = applyContentPatch(current, {});
    expect(result).toEqual(current);
    // Must be a new object, not mutated original
    expect(result).not.toBe(current);
  });

  it('handles nested objects as opaque replacement (shallow merge)', () => {
    const current = { settings: { color: 'red', size: 'large' } };
    const result = applyContentPatch(current, { settings: { color: 'blue' } });
    // Shallow merge: entire settings object replaced, not deep merged
    expect(result).toEqual({ settings: { color: 'blue' } });
  });

  it('handles multiple operations in one patch', () => {
    const current = { a: 1, b: 2, c: 3 };
    const result = applyContentPatch(current, { a: 10, b: null, d: 4 });
    expect(result).toEqual({ a: 10, c: 3, d: 4 });
  });
});

// ─── Unit tests: updateLeadMagnetContent service ────────────────────────────

describe('updateLeadMagnetContent service', () => {
  let updateLeadMagnetContent: typeof import('@/server/services/lead-magnets.service').updateLeadMagnetContent;

  beforeAll(async () => {
    const service = await import('@/server/services/lead-magnets.service');
    updateLeadMagnetContent = service.updateLeadMagnetContent;
  });

  const scope = { type: 'user' as const, userId: 'test-user-id' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 404 when lead magnet not found', async () => {
    mockFindLeadMagnetById.mockResolvedValue(null);

    await expect(
      updateLeadMagnetContent(scope, validUUID, { headline: 'New' })
    ).rejects.toMatchObject({ message: 'Lead magnet not found', statusCode: 404 });
  });

  it('throws 409 when expected_version does not match current', async () => {
    mockFindLeadMagnetById.mockResolvedValue({
      id: validUUID,
      content: { headline: 'Old' },
      content_version: 5,
    });

    await expect(
      updateLeadMagnetContent(scope, validUUID, { headline: 'New' }, 3)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('applies patch and increments version on success', async () => {
    mockFindLeadMagnetById.mockResolvedValue({
      id: validUUID,
      content: { headline: 'Old', sections: ['a'] },
      content_version: 2,
    });
    mockUpdateLeadMagnetContent.mockResolvedValue({
      id: validUUID,
      content: { headline: 'New', sections: ['a'] },
      content_version: 3,
    });

    const result = await updateLeadMagnetContent(scope, validUUID, { headline: 'New' });

    expect(mockUpdateLeadMagnetContent).toHaveBeenCalledWith(
      scope,
      validUUID,
      { headline: 'New', sections: ['a'] }, // merged content
      3 // incremented version
    );
    expect(result.content_version).toBe(3);
  });

  it('passes expected_version match and succeeds', async () => {
    mockFindLeadMagnetById.mockResolvedValue({
      id: validUUID,
      content: { headline: 'Old' },
      content_version: 5,
    });
    mockUpdateLeadMagnetContent.mockResolvedValue({
      id: validUUID,
      content: { headline: 'New' },
      content_version: 6,
    });

    const result = await updateLeadMagnetContent(scope, validUUID, { headline: 'New' }, 5);
    expect(result.content_version).toBe(6);
  });

  it('handles null current content gracefully', async () => {
    mockFindLeadMagnetById.mockResolvedValue({
      id: validUUID,
      content: null,
      content_version: 1,
    });
    mockUpdateLeadMagnetContent.mockResolvedValue({
      id: validUUID,
      content: { headline: 'First content' },
      content_version: 2,
    });

    await updateLeadMagnetContent(scope, validUUID, { headline: 'First content' });

    expect(mockUpdateLeadMagnetContent).toHaveBeenCalledWith(
      scope,
      validUUID,
      { headline: 'First content' },
      2
    );
  });

  it('handles missing content_version (defaults to 1)', async () => {
    mockFindLeadMagnetById.mockResolvedValue({
      id: validUUID,
      content: { headline: 'Old' },
      content_version: null,
    });
    mockUpdateLeadMagnetContent.mockResolvedValue({
      id: validUUID,
      content: { headline: 'New' },
      content_version: 2,
    });

    await updateLeadMagnetContent(scope, validUUID, { headline: 'New' });

    // (null ?? 1) + 1 = 2
    expect(mockUpdateLeadMagnetContent).toHaveBeenCalledWith(
      scope,
      validUUID,
      { headline: 'New' },
      2
    );
  });
});

// ─── Integration tests: PATCH route handler ──────────────────────────────────

describe('PATCH /api/lead-magnet/[id]', () => {
  let PATCH: typeof import('@/app/api/lead-magnet/[id]/route').PATCH;

  beforeAll(async () => {
    const route = await import('@/app/api/lead-magnet/[id]/route');
    PATCH = route.PATCH;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentSession = { user: { id: 'test-user-id', email: 'test@example.com' } };
  });

  it('returns 401 when not authenticated', async () => {
    currentSession = null;

    const request = new Request(`http://localhost:3000/api/lead-magnet/${validUUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { headline: 'Test' } }),
    });

    const response = await PATCH(request, makeParams(validUUID));
    expect(response.status).toBe(401);
  });

  it('returns 400 when content field is missing', async () => {
    const request = new Request(`http://localhost:3000/api/lead-magnet/${validUUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: 1 }),
    });

    const response = await PATCH(request, makeParams(validUUID));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('content');
  });

  it('returns 400 when content is not an object', async () => {
    const request = new Request(`http://localhost:3000/api/lead-magnet/${validUUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'a string' }),
    });

    const response = await PATCH(request, makeParams(validUUID));
    expect(response.status).toBe(400);
  });

  it('returns 400 when content is an array', async () => {
    const request = new Request(`http://localhost:3000/api/lead-magnet/${validUUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [1, 2, 3] }),
    });

    const response = await PATCH(request, makeParams(validUUID));
    expect(response.status).toBe(400);
  });

  it('returns 404 when lead magnet not found', async () => {
    mockFindLeadMagnetById.mockResolvedValue(null);

    const request = new Request(`http://localhost:3000/api/lead-magnet/${validUUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { headline: 'Test' } }),
    });

    const response = await PATCH(request, makeParams(validUUID));
    expect(response.status).toBe(404);
  });

  it('returns 409 on version conflict', async () => {
    mockFindLeadMagnetById.mockResolvedValue({
      id: validUUID,
      content: { headline: 'Old' },
      content_version: 5,
    });

    const request = new Request(`http://localhost:3000/api/lead-magnet/${validUUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { headline: 'New' }, expected_version: 3 }),
    });

    const response = await PATCH(request, makeParams(validUUID));
    expect(response.status).toBe(409);
  });

  it('returns 200 with updated data on success', async () => {
    const updatedData = {
      id: validUUID,
      content: { headline: 'New', sections: ['a'] },
      content_version: 3,
    };
    mockFindLeadMagnetById.mockResolvedValue({
      id: validUUID,
      content: { headline: 'Old', sections: ['a'] },
      content_version: 2,
    });
    mockUpdateLeadMagnetContent.mockResolvedValue(updatedData);

    const request = new Request(`http://localhost:3000/api/lead-magnet/${validUUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { headline: 'New' } }),
    });

    const response = await PATCH(request, makeParams(validUUID));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.content.headline).toBe('New');
    expect(data.content_version).toBe(3);
  });
});
