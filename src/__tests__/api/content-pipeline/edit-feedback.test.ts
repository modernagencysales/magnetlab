/**
 * @jest-environment node
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock team context
jest.mock('@/lib/utils/team-context', () => ({
  requireTeamScope: jest.fn(),
}));

// Mock repo (route → service → repo)
jest.mock('@/server/repositories/edit-history.repo', () => ({
  findEditByTeamAndId: jest.fn(),
  updateEditFeedback: jest.fn(),
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
import { requireTeamScope } from '@/lib/utils/team-context';
import * as editHistoryRepo from '@/server/repositories/edit-history.repo';

const mockAuth = auth as jest.Mock;
const mockRequireTeamScope = requireTeamScope as jest.Mock;
const mockFindEditByTeamAndId = editHistoryRepo.findEditByTeamAndId as jest.Mock;
const mockUpdateEditFeedback = editHistoryRepo.updateEditFeedback as jest.Mock;

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/content-pipeline/edit-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/content-pipeline/edit-feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth.mockResolvedValue({ user: { id: 'user-123' } });
    mockRequireTeamScope.mockResolvedValue({ type: 'team', userId: 'user-123', teamId: 'team-456' });
    mockFindEditByTeamAndId.mockResolvedValue({ id: 'edit-abc' });
    mockUpdateEditFeedback.mockResolvedValue(undefined);
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
    mockFindEditByTeamAndId.mockResolvedValue(null);

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

    expect(mockUpdateEditFeedback).toHaveBeenCalledWith(
      'edit-abc',
      expect.objectContaining({ edit_tags: ['Too formal', 'Too long'] }),
    );
  });

  it('saves note successfully', async () => {
    const res = await POST(createRequest({
      editId: 'edit-abc',
      note: 'Needs more personality',
    }));

    expect(res.status).toBe(200);
    expect(mockUpdateEditFeedback).toHaveBeenCalledWith(
      'edit-abc',
      expect.objectContaining({ ceo_note: 'Needs more personality' }),
    );
  });

  it('saves both tags and note', async () => {
    const res = await POST(createRequest({
      editId: 'edit-abc',
      tags: ['Wrong tone'],
      note: 'Should be more casual',
    }));

    expect(res.status).toBe(200);
    expect(mockUpdateEditFeedback).toHaveBeenCalledWith(
      'edit-abc',
      expect.objectContaining({
        edit_tags: ['Wrong tone'],
        ceo_note: 'Should be more casual',
      }),
    );
  });

  it('returns 500 on database error during update', async () => {
    mockUpdateEditFeedback.mockRejectedValue(new Error('DB error'));

    const res = await POST(createRequest({
      editId: 'edit-abc',
      tags: ['Too salesy'],
    }));

    expect(res.status).toBe(500);
  });
});
