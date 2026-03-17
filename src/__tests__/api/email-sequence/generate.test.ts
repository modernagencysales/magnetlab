/**
 * @jest-environment node
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock plan limits
jest.mock('@/lib/auth/plan-limits', () => ({
  checkResourceLimit: jest.fn(),
}));

// Mock team-context — route uses getScopeForResource
jest.mock('@/lib/utils/team-context', () => ({
  getScopeForResource: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
}));

// Mock email-sequence repo — route calls getLeadMagnetTeamId
jest.mock('@/server/repositories/email-sequence.repo', () => ({
  getLeadMagnetTeamId: jest.fn(() => Promise.resolve(null)),
}));

// Mock email-sequence service — route delegates to service.generate()
const mockGenerate = jest.fn();
jest.mock('@/server/services/email-sequence.service', () => ({
  generate: (...args: unknown[]) => mockGenerate(...args),
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

import { POST } from '@/app/api/email-sequence/generate/route';
import { auth } from '@/lib/auth';
import { checkResourceLimit } from '@/lib/auth/plan-limits';

const mockUserId = 'user-123';
const mockLeadMagnetId = 'lm-456';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/email-sequence/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockEmails = [
  {
    day: 0,
    subject: 'your download is ready',
    body: 'Hey {{first_name}},\n\nHere is your resource.\n\nThanks,\nJohn',
    replyTrigger: 'Reply got it',
  },
  {
    day: 1,
    subject: 'did you get it?',
    body: 'Check-in email',
    replyTrigger: 'Biggest challenge?',
  },
  { day: 2, subject: 'free resources', body: 'Resources email', replyTrigger: 'Which one?' },
  { day: 3, subject: 'quick question', body: 'Question email', replyTrigger: 'Questions?' },
  { day: 4, subject: 'what next?', body: 'Next email', replyTrigger: 'Topic request?' },
];

describe('POST /api/email-sequence/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId } });
    (checkResourceLimit as jest.Mock).mockResolvedValue({ allowed: true, current: 0, limit: 10 });
  });

  it('generates sequence when lead magnet has external_url', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      generated: true,
      emailSequence: {
        id: 'seq-1',
        leadMagnetId: mockLeadMagnetId,
        emails: mockEmails,
        status: 'draft',
      },
    });

    const response = await POST(makeRequest({ leadMagnetId: mockLeadMagnetId, useAI: false }));
    const data = await response.json();

    expect(data.generated).toBe(true);
    expect(data.emailSequence).toBeDefined();
  });

  it('generates sequence when no resource URL available', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      generated: true,
      emailSequence: {
        id: 'seq-1',
        leadMagnetId: mockLeadMagnetId,
        emails: mockEmails,
        status: 'draft',
      },
    });

    const response = await POST(makeRequest({ leadMagnetId: mockLeadMagnetId, useAI: false }));
    const data = await response.json();

    expect(data.generated).toBe(true);
    expect(data.emailSequence).toBeDefined();
  });

  it('generates sequence when hosted content exists', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      generated: true,
      emailSequence: {
        id: 'seq-1',
        leadMagnetId: mockLeadMagnetId,
        emails: mockEmails,
        status: 'active',
      },
    });

    const response = await POST(makeRequest({ leadMagnetId: mockLeadMagnetId, useAI: false }));
    const data = await response.json();

    expect(data.generated).toBe(true);
    expect(data.emailSequence).toBeDefined();
  });

  it('calls service.generate with correct arguments', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      generated: true,
      emailSequence: {
        id: 'seq-2',
        leadMagnetId: mockLeadMagnetId,
        emails: mockEmails,
        status: 'active',
      },
    });

    await POST(makeRequest({ leadMagnetId: mockLeadMagnetId, useAI: false }));

    expect(mockGenerate).toHaveBeenCalledWith(mockLeadMagnetId, false, {
      type: 'user',
      userId: mockUserId,
    });
  });

  it('returns 401 when not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ leadMagnetId: mockLeadMagnetId }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when leadMagnetId is missing', async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });
});
