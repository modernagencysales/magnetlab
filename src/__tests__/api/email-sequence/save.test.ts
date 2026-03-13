/**
 * @jest-environment node
 *
 * Tests for PUT /api/email-sequence/[leadMagnetId]
 * Full-replace semantics: old emails removed, new ones saved.
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock email sequence service
jest.mock('@/server/services/email-sequence.service', () => ({
  getByLeadMagnetId: jest.fn(),
  update: jest.fn(),
}));

// Mock team context
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn(),
}));

// Mock errors
jest.mock('@/lib/api/errors', () => ({
  ApiErrors: {
    unauthorized: jest.fn(
      () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    ),
    validationError: jest.fn(
      (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 })
    ),
    notFound: jest.fn(
      (msg: string) => new Response(JSON.stringify({ error: `${msg} not found` }), { status: 404 })
    ),
    databaseError: jest.fn(
      (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 500 })
    ),
    internalError: jest.fn(
      (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 500 })
    ),
  },
  logApiError: jest.fn(),
}));

import { PUT } from '@/app/api/email-sequence/[leadMagnetId]/route';
import { auth } from '@/lib/auth';
import * as emailSequenceService from '@/server/services/email-sequence.service';
import { getDataScope } from '@/lib/utils/team-context';

// ─── Constants ──────────────────────────────────────────────────────────────

const mockUserId = 'user-123';
const mockLeadMagnetId = 'lm-456';
const mockScope = { userId: mockUserId, teamId: null };

const mockEmailSequence = {
  id: 'seq-1',
  leadMagnetId: mockLeadMagnetId,
  userId: mockUserId,
  emails: [
    { day: 0, subject: 'Welcome', body: 'Thanks for downloading...', replyTrigger: 'Got it' },
  ],
  status: 'draft' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePutRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/email-sequence/${mockLeadMagnetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockParams = { params: Promise.resolve({ leadMagnetId: mockLeadMagnetId }) };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PUT /api/email-sequence/[leadMagnetId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId } });
    (getDataScope as jest.Mock).mockResolvedValue(mockScope);
    (emailSequenceService.update as jest.Mock).mockResolvedValue({
      success: true,
      emailSequence: mockEmailSequence,
    });
  });

  // ─── MCP body shape (full-replace) ───────────────────────────────────────

  it('accepts MCP body shape with delay_days and replaces sequence', async () => {
    const mcpBody = {
      subject_lines: ['Welcome', 'Follow up'],
      emails: [
        { subject: 'Welcome', body: 'Thanks for downloading...', delay_days: 0 },
        { subject: 'Follow up', body: 'Did you get a chance...', delay_days: 3 },
      ],
      from_name: 'Tim',
      reply_to: 'tim@example.com',
    };

    const response = await PUT(makePutRequest(mcpBody), mockParams);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.emailSequence).toBeDefined();

    // Service called with mapped emails (delay_days → day)
    expect(emailSequenceService.update).toHaveBeenCalledWith(
      mockScope,
      mockLeadMagnetId,
      expect.objectContaining({
        emails: expect.arrayContaining([
          expect.objectContaining({
            day: 0,
            subject: 'Welcome',
            body: 'Thanks for downloading...',
          }),
          expect.objectContaining({
            day: 3,
            subject: 'Follow up',
            body: 'Did you get a chance...',
          }),
        ]),
      })
    );
  });

  it('replaces all emails — old emails removed, new ones saved', async () => {
    const newEmails = [
      { day: 0, subject: 'New Email 1', body: 'Body 1', replyTrigger: 'Got it' },
      { day: 2, subject: 'New Email 2', body: 'Body 2', replyTrigger: 'Interesting' },
    ];

    const response = await PUT(makePutRequest({ emails: newEmails }), mockParams);
    expect(response.status).toBe(200);

    expect(emailSequenceService.update).toHaveBeenCalledWith(
      mockScope,
      mockLeadMagnetId,
      expect.objectContaining({ emails: newEmails })
    );
  });

  it('accepts empty emails array and clears the sequence', async () => {
    (emailSequenceService.update as jest.Mock).mockResolvedValue({
      success: true,
      emailSequence: { ...mockEmailSequence, emails: [] },
    });

    const response = await PUT(makePutRequest({ emails: [] }), mockParams);
    expect(response.status).toBe(200);

    expect(emailSequenceService.update).toHaveBeenCalledWith(
      mockScope,
      mockLeadMagnetId,
      expect.objectContaining({ emails: [] })
    );
  });

  it('returns the saved sequence in the response', async () => {
    const response = await PUT(
      makePutRequest({
        emails: [{ day: 0, subject: 'Welcome', body: 'Hello', replyTrigger: 'Reply' }],
      }),
      mockParams
    );
    const data = await response.json();
    expect(data.emailSequence).toMatchObject({
      id: 'seq-1',
      leadMagnetId: mockLeadMagnetId,
    });
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await PUT(makePutRequest({ emails: [] }), mockParams);
    expect(response.status).toBe(401);
    expect(emailSequenceService.update).not.toHaveBeenCalled();
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  it('returns 400 when body has neither emails nor status', async () => {
    const response = await PUT(makePutRequest({ from_name: 'Tim' }), mockParams);
    expect(response.status).toBe(400);
    expect(emailSequenceService.update).not.toHaveBeenCalled();
  });

  it('returns 400 when emails is not an array', async () => {
    const response = await PUT(makePutRequest({ emails: 'not-an-array' }), mockParams);
    expect(response.status).toBe(400);
  });

  it('returns 400 when legacy emails have invalid shape (missing required fields)', async () => {
    const response = await PUT(
      makePutRequest({
        emails: [{ subject: 'Missing day and body' }],
      }),
      mockParams
    );
    expect(response.status).toBe(400);
  });

  it('accepts status-only update (no emails)', async () => {
    const response = await PUT(makePutRequest({ status: 'active' }), mockParams);
    expect(response.status).toBe(200);
    expect(emailSequenceService.update).toHaveBeenCalledWith(
      mockScope,
      mockLeadMagnetId,
      expect.objectContaining({ status: 'active' })
    );
  });

  it('returns 400 for invalid status value', async () => {
    const response = await PUT(makePutRequest({ status: 'published' }), mockParams);
    expect(response.status).toBe(400);
  });

  // ─── Service error handling ───────────────────────────────────────────────

  it('returns 404 when service returns not_found', async () => {
    (emailSequenceService.update as jest.Mock).mockResolvedValue({
      success: false,
      error: 'not_found',
      message: 'Email sequence not found',
    });

    const response = await PUT(makePutRequest({ emails: [] }), mockParams);
    expect(response.status).toBe(404);
  });

  it('returns 500 when service returns database error', async () => {
    (emailSequenceService.update as jest.Mock).mockResolvedValue({
      success: false,
      error: 'database',
      message: 'DB write failed',
    });

    const response = await PUT(makePutRequest({ emails: [] }), mockParams);
    expect(response.status).toBe(500);
  });

  // ─── MCP field normalization ───────────────────────────────────────────────

  it('normalizes delay_days to day when using MCP body shape', async () => {
    const response = await PUT(
      makePutRequest({
        emails: [{ subject: 'Test', body: 'Body', delay_days: 7 }],
      }),
      mockParams
    );
    expect(response.status).toBe(200);

    expect(emailSequenceService.update).toHaveBeenCalledWith(
      mockScope,
      mockLeadMagnetId,
      expect.objectContaining({
        emails: [expect.objectContaining({ day: 7 })],
      })
    );
  });

  it('ignores from_name and reply_to (not stored in email_sequences table)', async () => {
    const response = await PUT(
      makePutRequest({
        emails: [{ subject: 'Test', body: 'Body', delay_days: 0 }],
        from_name: 'Tim',
        reply_to: 'tim@example.com',
      }),
      mockParams
    );
    expect(response.status).toBe(200);
    // Service should be called without from_name/reply_to
    const callArgs = (emailSequenceService.update as jest.Mock).mock.calls[0][2];
    expect(callArgs).not.toHaveProperty('from_name');
    expect(callArgs).not.toHaveProperty('reply_to');
  });

  it('sets empty replyTrigger when not provided in MCP shape', async () => {
    const response = await PUT(
      makePutRequest({
        emails: [{ subject: 'Test', body: 'Body', delay_days: 0 }],
      }),
      mockParams
    );
    expect(response.status).toBe(200);

    expect(emailSequenceService.update).toHaveBeenCalledWith(
      mockScope,
      mockLeadMagnetId,
      expect.objectContaining({
        emails: [expect.objectContaining({ replyTrigger: '' })],
      })
    );
  });
});
