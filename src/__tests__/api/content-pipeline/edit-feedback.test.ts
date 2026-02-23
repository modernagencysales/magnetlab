/**
 * @jest-environment node
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock team context
jest.mock('@/lib/utils/team-context', () => ({
  requireTeamScope: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { POST } from '@/app/api/content-pipeline/edit-feedback/route';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';

const mockAuth = auth as jest.Mock;
const mockCreateSupabase = createSupabaseAdminClient as jest.Mock;
const mockRequireTeamScope = requireTeamScope as jest.Mock;

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/content-pipeline/edit-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/content-pipeline/edit-feedback', () => {
  let mockMaybeSingle: jest.Mock;
  let mockSelectEq: jest.Mock;
  let mockUpdateEq: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockSelect: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth.mockResolvedValue({ user: { id: 'user-123' } });
    mockRequireTeamScope.mockResolvedValue({ type: 'team', userId: 'user-123', teamId: 'team-456' });

    // Build chainable mock — select chain: .select('id').eq('id', ...).eq('team_id', ...).maybeSingle()
    mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'edit-abc' }, error: null });
    const mockSelectTeamEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockSelectEq = jest.fn().mockReturnValue({ eq: mockSelectTeamEq });
    mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });

    mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
    mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      }),
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(createRequest({ editId: 'edit-abc', tags: ['Too formal'] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when editId is missing', async () => {
    const res = await POST(createRequest({ tags: ['Too formal'] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('editId');
  });

  it('returns 400 when tags is not an array', async () => {
    const res = await POST(createRequest({ editId: 'edit-abc', tags: 'not-an-array' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when note is not a string', async () => {
    const res = await POST(createRequest({ editId: 'edit-abc', note: 123 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when note exceeds 500 characters', async () => {
    const longNote = 'a'.repeat(501);
    const res = await POST(createRequest({ editId: 'edit-abc', note: longNote }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('500 characters');
  });

  it('returns 403 when user has no team context', async () => {
    mockRequireTeamScope.mockResolvedValue(null);
    const res = await POST(createRequest({ editId: 'edit-abc', tags: ['Too formal'] }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Team context');
  });

  it('returns 404 when edit record not found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await POST(createRequest({ editId: 'nonexistent', tags: ['Too formal'] }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when no feedback provided (empty tags and no note)', async () => {
    const res = await POST(createRequest({ editId: 'edit-abc', tags: [], note: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('No feedback');
  });

  it('saves tags successfully', async () => {
    const res = await POST(createRequest({
      editId: 'edit-abc',
      tags: ['Too formal', 'Too long'],
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ edit_tags: ['Too formal', 'Too long'] })
    );
  });

  it('saves note successfully', async () => {
    const res = await POST(createRequest({
      editId: 'edit-abc',
      note: 'Needs more personality',
    }));

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ ceo_note: 'Needs more personality' })
    );
  });

  it('saves both tags and note', async () => {
    const res = await POST(createRequest({
      editId: 'edit-abc',
      tags: ['Wrong tone'],
      note: 'Should be more casual',
    }));

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        edit_tags: ['Wrong tone'],
        ceo_note: 'Should be more casual',
      })
    );
  });

  it('returns 500 on database error during update', async () => {
    mockUpdateEq.mockResolvedValue({ error: { message: 'DB error' } });

    const res = await POST(createRequest({
      editId: 'edit-abc',
      tags: ['Too salesy'],
    }));

    expect(res.status).toBe(500);
  });
});
