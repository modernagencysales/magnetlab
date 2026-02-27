/**
 * @jest-environment node
 */

// Mock Supabase client with chained methods
interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// Mock Unipile client
const mockAddComment = jest.fn();
const mockGetUnipileClient = jest.fn(() => ({
  addComment: mockAddComment,
}));
const mockGetUserPostingAccountId = jest.fn();

jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: () => mockGetUnipileClient(),
  getUserPostingAccountId: (...args: unknown[]) => mockGetUserPostingAccountId(...args),
}));

// Mock logger to suppress test output
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

import { POST } from '@/app/api/linkedin/automations/[id]/reply/route';
import { NextRequest } from 'next/server';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';
const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const accountId = 'unipile-account-123';

function createRequest(
  id: string,
  body: Record<string, unknown>
): [NextRequest, { params: Promise<{ id: string }> }] {
  const request = new NextRequest(
    new URL(`http://localhost:3000/api/linkedin/automations/${id}/reply`),
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return [request, { params: Promise.resolve({ id }) }];
}

describe('POST /api/linkedin/automations/[id]/reply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Supabase chain methods
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
  });

  describe('authentication', () => {
    it('returns 401 without auth', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Great point!',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when session has no user id', async () => {
      mockAuth.mockResolvedValueOnce({ user: {} });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Great point!',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('validation', () => {
    it('returns 400 with invalid UUID automation ID', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      const [request, context] = createRequest('not-a-uuid', {
        commentSocialId: 'urn:li:comment:123',
        text: 'Great point!',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid automation ID');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when commentSocialId is missing', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      const [request, context] = createRequest(validUUID, {
        text: 'Great point!',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('commentSocialId and text are required');
    });

    it('returns 400 when text is missing', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('commentSocialId and text are required');
    });

    it('returns 400 when text is empty/whitespace', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: '   ',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('commentSocialId and text are required');
    });
  });

  describe('automation lookup', () => {
    it('returns 404 when automation is not found', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      // Automation not found
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Great point!',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Automation not found');
      expect(data.code).toBe('NOT_FOUND');

      // Verify it queried with correct user scoping
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('linkedin_automations');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', validUUID);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('returns 404 when Supabase returns a non-PGRST116 error', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      // DB returns a real error (e.g., permission denied)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Great point!',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Automation not found');
      expect(data.code).toBe('NOT_FOUND');
    });
});

  describe('successful reply', () => {
    const automationData = {
      id: validUUID,
      user_id: userId,
      post_social_id: 'urn:li:activity:7000000000000000000',
      unipile_account_id: accountId,
    };

    it('calls Unipile addComment and logs event on success', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      // Automation found
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: automationData,
        error: null,
      });

      // Unipile returns success
      mockAddComment.mockResolvedValueOnce({ data: { id: 'comment-456' }, error: null });

      // Event insert succeeds
      mockSupabaseClient.insert.mockResolvedValueOnce({ data: null, error: null });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Great point! Thanks for sharing.',
        commenterName: 'Jane Smith',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify Unipile was called with the automation's post_social_id (not the commentSocialId)
      expect(mockAddComment).toHaveBeenCalledWith(
        'urn:li:activity:7000000000000000000',
        accountId,
        'Great point! Thanks for sharing.'
      );

      // Verify event was logged
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('linkedin_automation_events');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        automation_id: validUUID,
        event_type: 'reply_sent',
        commenter_name: 'Jane Smith',
        commenter_provider_id: null,
        commenter_linkedin_url: null,
        comment_text: null,
        action_details: 'Manual reply: Great point! Thanks for sharing.',
        error: null,
      });
    });

    it('uses commentSocialId as postSocialId when automation has no post_social_id', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      const automationWithoutPost = {
        ...automationData,
        post_social_id: null,
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: automationWithoutPost,
        error: null,
      });

      mockAddComment.mockResolvedValueOnce({ data: { id: 'comment-789' }, error: null });
      mockSupabaseClient.insert.mockResolvedValueOnce({ data: null, error: null });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:456',
        text: 'Thanks!',
      });
      const response = await POST(request, context);

      expect(response.status).toBe(200);

      // Falls back to commentSocialId
      expect(mockAddComment).toHaveBeenCalledWith(
        'urn:li:comment:456',
        accountId,
        'Thanks!'
      );
    });

    it('falls back to getUserPostingAccountId when automation has no unipile_account_id', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      const automationWithoutAccount = {
        ...automationData,
        unipile_account_id: null,
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: automationWithoutAccount,
        error: null,
      });

      mockGetUserPostingAccountId.mockResolvedValueOnce('fallback-account-id');
      mockAddComment.mockResolvedValueOnce({ data: { id: 'comment-abc' }, error: null });
      mockSupabaseClient.insert.mockResolvedValueOnce({ data: null, error: null });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Noted!',
      });
      const response = await POST(request, context);

      expect(response.status).toBe(200);
      expect(mockGetUserPostingAccountId).toHaveBeenCalledWith(userId);
      expect(mockAddComment).toHaveBeenCalledWith(
        'urn:li:activity:7000000000000000000',
        'fallback-account-id',
        'Noted!'
      );
    });

    it('trims text before sending and in event log', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: automationData,
        error: null,
      });

      mockAddComment.mockResolvedValueOnce({ data: { id: 'comment-trim' }, error: null });
      mockSupabaseClient.insert.mockResolvedValueOnce({ data: null, error: null });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: '  Hello world!  ',
      });
      const response = await POST(request, context);

      expect(response.status).toBe(200);
      expect(mockAddComment).toHaveBeenCalledWith(
        'urn:li:activity:7000000000000000000',
        accountId,
        'Hello world!'
      );
    });

    it('logs commenter_name as null when not provided', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: automationData,
        error: null,
      });

      mockAddComment.mockResolvedValueOnce({ data: { id: 'comment-noname' }, error: null });
      mockSupabaseClient.insert.mockResolvedValueOnce({ data: null, error: null });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Reply text',
      });
      await POST(request, context);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          commenter_name: null,
        })
      );
    });
  });

  describe('account resolution', () => {
    const automationData = {
      id: validUUID,
      user_id: userId,
      post_social_id: 'urn:li:activity:7000000000000000000',
      unipile_account_id: accountId,
    };

    it('returns 400 when no LinkedIn account is connected', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      const automationWithoutAccount = {
        ...automationData,
        unipile_account_id: null,
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: automationWithoutAccount,
        error: null,
      });

      // No fallback account either
      mockGetUserPostingAccountId.mockResolvedValueOnce(null);

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Hello!',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No LinkedIn account connected');
    });
  });

  describe('error handling', () => {
    const automationData = {
      id: validUUID,
      user_id: userId,
      post_social_id: 'urn:li:activity:7000000000000000000',
      unipile_account_id: accountId,
    };

    it('returns 500 when Unipile returns an error', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: automationData,
        error: null,
      });

      mockAddComment.mockResolvedValueOnce({
        data: null,
        error: 'Rate limit exceeded',
      });

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Reply text',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to send reply');
      expect(data.code).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when Unipile throws an exception', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: userId } });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: automationData,
        error: null,
      });

      mockAddComment.mockRejectedValueOnce(new Error('Network failure'));

      const [request, context] = createRequest(validUUID, {
        commentSocialId: 'urn:li:comment:123',
        text: 'Reply text',
      });
      const response = await POST(request, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to send reply');
    });
  });
});
