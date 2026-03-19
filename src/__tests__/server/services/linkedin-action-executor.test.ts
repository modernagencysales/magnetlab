/**
 * @jest-environment node
 */

import { executeAction, isRateLimitError } from '@/server/services/linkedin-action-executor';
import type { QueuedAction } from '@/lib/types/linkedin-action-queue';
import type { UnipileClient } from '@/lib/integrations/unipile';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAction(overrides: Partial<QueuedAction> = {}): QueuedAction {
  return {
    id: 'action-1',
    user_id: 'user-1',
    unipile_account_id: 'acc-1',
    action_type: 'view_profile',
    target_provider_id: null,
    target_linkedin_url: null,
    payload: {},
    priority: 1,
    source_type: 'outreach_campaign',
    source_campaign_id: 'campaign-1',
    source_lead_id: 'lead-1',
    status: 'queued',
    processed: false,
    attempts: 0,
    error: null,
    result: null,
    executed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeClient(
  overrides: Partial<Record<keyof UnipileClient, jest.Mock>> = {}
): UnipileClient {
  return {
    resolveLinkedInProfile: jest
      .fn()
      .mockResolvedValue({ data: { provider_id: 'prov-123' }, error: null, status: 200 }),
    sendConnectionRequest: jest.fn().mockResolvedValue({ data: null, error: null, status: 200 }),
    sendDirectMessage: jest
      .fn()
      .mockResolvedValue({ data: { chat_id: 'chat-1' }, error: null, status: 200 }),
    listSentInvitations: jest.fn().mockResolvedValue({ data: [], error: null, status: 200 }),
    cancelInvitation: jest.fn().mockResolvedValue({ data: null, error: null, status: 200 }),
    handleInvitation: jest.fn().mockResolvedValue({ data: null, error: null, status: 200 }),
    addReaction: jest.fn().mockResolvedValue({ data: null, error: null, status: 200 }),
    addComment: jest
      .fn()
      .mockResolvedValue({ data: { id: 'comment-1' }, error: null, status: 200 }),
    ...overrides,
  } as unknown as UnipileClient;
}

// ─── Tests: view_profile ──────────────────────────────────────────────────────

describe('executeAction — view_profile', () => {
  it('calls resolveLinkedInProfile with account_id and username', async () => {
    const client = makeClient();
    const action = makeAction({ action_type: 'view_profile', payload: { username: 'johndoe' } });

    const result = await executeAction(client, action);

    expect(client.resolveLinkedInProfile).toHaveBeenCalledWith('acc-1', 'johndoe');
    expect(result).toEqual({ provider_id: 'prov-123' });
  });

  it('throws if payload.username is missing', async () => {
    const client = makeClient();
    const action = makeAction({ action_type: 'view_profile', payload: {} });

    await expect(executeAction(client, action)).rejects.toThrow(
      'view_profile requires payload.username'
    );
  });

  it('throws if Unipile returns an error', async () => {
    const client = makeClient({
      resolveLinkedInProfile: jest
        .fn()
        .mockResolvedValue({ data: null, error: 'not found', status: 404 }),
    });
    const action = makeAction({ action_type: 'view_profile', payload: { username: 'ghost' } });

    await expect(executeAction(client, action)).rejects.toThrow(
      'Profile resolution failed: not found'
    );
  });
});

// ─── Tests: connect ───────────────────────────────────────────────────────────

describe('executeAction — connect', () => {
  it('calls sendConnectionRequest with correct args', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'connect',
      target_provider_id: 'prov-456',
      payload: { message: 'Hi there!' },
    });

    await executeAction(client, action);

    expect(client.sendConnectionRequest).toHaveBeenCalledWith('acc-1', 'prov-456', 'Hi there!');
  });

  it('calls sendConnectionRequest without message when not in payload', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'connect',
      target_provider_id: 'prov-456',
      payload: {},
    });

    await executeAction(client, action);

    expect(client.sendConnectionRequest).toHaveBeenCalledWith('acc-1', 'prov-456', undefined);
  });

  it('throws if target_provider_id is null', async () => {
    const client = makeClient();
    const action = makeAction({ action_type: 'connect', target_provider_id: null, payload: {} });

    await expect(executeAction(client, action)).rejects.toThrow(
      'connect requires target_provider_id'
    );
  });

  it('throws if Unipile returns an error', async () => {
    const client = makeClient({
      sendConnectionRequest: jest
        .fn()
        .mockResolvedValue({ data: null, error: 'restricted', status: 429 }),
    });
    const action = makeAction({
      action_type: 'connect',
      target_provider_id: 'prov-456',
      payload: {},
    });

    await expect(executeAction(client, action)).rejects.toThrow(
      'Connection request failed: restricted'
    );
  });
});

// ─── Tests: message / follow_up_message ──────────────────────────────────────

describe('executeAction — message', () => {
  it('calls sendDirectMessage with correct args for message', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'message',
      target_provider_id: 'prov-789',
      payload: { text: 'Hello!' },
    });

    const result = await executeAction(client, action);

    expect(client.sendDirectMessage).toHaveBeenCalledWith('acc-1', 'prov-789', 'Hello!');
    expect(result).toEqual({ chat_id: 'chat-1' });
  });

  it('calls sendDirectMessage for follow_up_message', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'follow_up_message',
      target_provider_id: 'prov-789',
      payload: { text: 'Following up!' },
    });

    await executeAction(client, action);

    expect(client.sendDirectMessage).toHaveBeenCalledWith('acc-1', 'prov-789', 'Following up!');
  });

  it('throws if target_provider_id is null', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'message',
      target_provider_id: null,
      payload: { text: 'Hello' },
    });

    await expect(executeAction(client, action)).rejects.toThrow(
      'message requires target_provider_id'
    );
  });

  it('throws if payload.text is missing', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'message',
      target_provider_id: 'prov-789',
      payload: {},
    });

    await expect(executeAction(client, action)).rejects.toThrow('message requires payload.text');
  });
});

// ─── Tests: withdraw ─────────────────────────────────────────────────────────

describe('executeAction — withdraw', () => {
  const sentInvitations = [
    { id: 'inv-1', sender: { provider_id: 'prov-match' }, provider_id: 'other' },
    { id: 'inv-2', sender: { provider_id: 'prov-other' }, provider_id: 'prov-other' },
  ];

  it('calls listSentInvitations then cancelInvitation on match via sender.provider_id', async () => {
    const client = makeClient({
      listSentInvitations: jest
        .fn()
        .mockResolvedValue({ data: sentInvitations, error: null, status: 200 }),
      cancelInvitation: jest.fn().mockResolvedValue({ data: null, error: null, status: 200 }),
    });
    const action = makeAction({ action_type: 'withdraw', target_provider_id: 'prov-match' });

    await executeAction(client, action);

    expect(client.listSentInvitations).toHaveBeenCalledWith('acc-1');
    expect(client.cancelInvitation).toHaveBeenCalledWith('inv-1');
  });

  it('matches invitation via top-level provider_id when sender.provider_id does not match', async () => {
    const invitations = [{ id: 'inv-3', provider_id: 'prov-top' }];
    const client = makeClient({
      listSentInvitations: jest
        .fn()
        .mockResolvedValue({ data: invitations, error: null, status: 200 }),
      cancelInvitation: jest.fn().mockResolvedValue({ data: null, error: null, status: 200 }),
    });
    const action = makeAction({ action_type: 'withdraw', target_provider_id: 'prov-top' });

    await executeAction(client, action);

    expect(client.cancelInvitation).toHaveBeenCalledWith('inv-3');
  });

  it('throws "Invitation not found for withdrawal" when no match', async () => {
    const client = makeClient({
      listSentInvitations: jest
        .fn()
        .mockResolvedValue({ data: sentInvitations, error: null, status: 200 }),
    });
    const action = makeAction({ action_type: 'withdraw', target_provider_id: 'prov-no-match' });

    await expect(executeAction(client, action)).rejects.toThrow(
      'Invitation not found for withdrawal'
    );
  });

  it('throws if listSentInvitations returns an error', async () => {
    const client = makeClient({
      listSentInvitations: jest
        .fn()
        .mockResolvedValue({ data: null, error: 'API error', status: 500 }),
    });
    const action = makeAction({ action_type: 'withdraw', target_provider_id: 'prov-x' });

    await expect(executeAction(client, action)).rejects.toThrow(
      'Failed to list sent invitations: API error'
    );
  });

  it('throws if target_provider_id is null', async () => {
    const client = makeClient();
    const action = makeAction({ action_type: 'withdraw', target_provider_id: null });

    await expect(executeAction(client, action)).rejects.toThrow(
      'withdraw requires target_provider_id'
    );
  });

  it('throws if cancelInvitation returns an error', async () => {
    const client = makeClient({
      listSentInvitations: jest.fn().mockResolvedValue({
        data: [{ id: 'inv-1', sender: { provider_id: 'prov-match' } }],
        error: null,
        status: 200,
      }),
      cancelInvitation: jest
        .fn()
        .mockResolvedValue({ data: null, error: 'cancel failed', status: 400 }),
    });
    const action = makeAction({ action_type: 'withdraw', target_provider_id: 'prov-match' });

    await expect(executeAction(client, action)).rejects.toThrow(
      'Invitation cancel failed: cancel failed'
    );
  });
});

// ─── Tests: accept_invitation ─────────────────────────────────────────────────

describe('executeAction — accept_invitation', () => {
  it('calls handleInvitation with correct invitation_id', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'accept_invitation',
      payload: { invitation_id: 'inv-abc' },
    });

    await executeAction(client, action);

    expect(client.handleInvitation).toHaveBeenCalledWith('inv-abc', 'accept');
  });

  it('throws if payload.invitation_id is missing', async () => {
    const client = makeClient();
    const action = makeAction({ action_type: 'accept_invitation', payload: {} });

    await expect(executeAction(client, action)).rejects.toThrow(
      'accept_invitation requires payload.invitation_id'
    );
  });

  it('throws if Unipile returns an error', async () => {
    const client = makeClient({
      handleInvitation: jest
        .fn()
        .mockResolvedValue({ data: null, error: 'already accepted', status: 409 }),
    });
    const action = makeAction({
      action_type: 'accept_invitation',
      payload: { invitation_id: 'inv-abc' },
    });

    await expect(executeAction(client, action)).rejects.toThrow(
      'Accept invitation failed: already accepted'
    );
  });
});

// ─── Tests: react ─────────────────────────────────────────────────────────────

describe('executeAction — react', () => {
  it('calls addReaction with post_id, account_id, and reaction_type', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'react',
      payload: { post_id: 'post-1', reaction_type: 'LIKE' },
    });

    await executeAction(client, action);

    expect(client.addReaction).toHaveBeenCalledWith('post-1', 'acc-1', 'LIKE');
  });

  it('defaults reaction_type to LIKE when not specified', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'react',
      payload: { post_id: 'post-1' },
    });

    await executeAction(client, action);

    expect(client.addReaction).toHaveBeenCalledWith('post-1', 'acc-1', 'LIKE');
  });

  it('throws if payload.post_id is missing', async () => {
    const client = makeClient();
    const action = makeAction({ action_type: 'react', payload: {} });

    await expect(executeAction(client, action)).rejects.toThrow('react requires payload.post_id');
  });

  it('throws if Unipile returns an error', async () => {
    const client = makeClient({
      addReaction: jest
        .fn()
        .mockResolvedValue({ data: null, error: 'reaction failed', status: 400 }),
    });
    const action = makeAction({ action_type: 'react', payload: { post_id: 'post-1' } });

    await expect(executeAction(client, action)).rejects.toThrow('Reaction failed: reaction failed');
  });
});

// ─── Tests: comment ───────────────────────────────────────────────────────────

describe('executeAction — comment', () => {
  it('calls addComment with post_id, account_id, and text', async () => {
    const client = makeClient();
    const action = makeAction({
      action_type: 'comment',
      payload: { post_id: 'post-1', text: 'Great post!' },
    });

    const result = await executeAction(client, action);

    expect(client.addComment).toHaveBeenCalledWith('post-1', 'acc-1', 'Great post!', undefined);
    expect(result).toEqual({ id: 'comment-1' });
  });

  it('passes options (commentId, mentions) when provided', async () => {
    const client = makeClient();
    const options = {
      commentId: 'parent-comment-1',
      mentions: [{ name: 'Jane Doe', profile_id: 'jane-123' }],
    };
    const action = makeAction({
      action_type: 'comment',
      payload: { post_id: 'post-1', text: 'Reply!', options },
    });

    await executeAction(client, action);

    expect(client.addComment).toHaveBeenCalledWith('post-1', 'acc-1', 'Reply!', options);
  });

  it('throws if payload.post_id is missing', async () => {
    const client = makeClient();
    const action = makeAction({ action_type: 'comment', payload: { text: 'Hi' } });

    await expect(executeAction(client, action)).rejects.toThrow('comment requires payload.post_id');
  });

  it('throws if payload.text is missing', async () => {
    const client = makeClient();
    const action = makeAction({ action_type: 'comment', payload: { post_id: 'post-1' } });

    await expect(executeAction(client, action)).rejects.toThrow('comment requires payload.text');
  });

  it('throws if Unipile returns an error', async () => {
    const client = makeClient({
      addComment: jest.fn().mockResolvedValue({ data: null, error: 'comment failed', status: 400 }),
    });
    const action = makeAction({
      action_type: 'comment',
      payload: { post_id: 'post-1', text: 'Great!' },
    });

    await expect(executeAction(client, action)).rejects.toThrow('Comment failed: comment failed');
  });
});

// ─── Tests: unknown action type ───────────────────────────────────────────────

describe('executeAction — unknown action type', () => {
  it('throws for unknown action type', async () => {
    const client = makeClient();
    // Cast to bypass TS exhaustive check
    const action = makeAction({ action_type: 'unknown_type' as QueuedAction['action_type'] });

    await expect(executeAction(client, action)).rejects.toThrow(
      'Unknown action type: unknown_type'
    );
  });
});

// ─── Tests: isRateLimitError ──────────────────────────────────────────────────

describe('isRateLimitError', () => {
  it('returns true for errors containing "429"', () => {
    expect(isRateLimitError(new Error('HTTP 429 Too Many Requests'))).toBe(true);
  });

  it('returns true for errors containing "restricted"', () => {
    expect(isRateLimitError(new Error('Account is restricted'))).toBe(true);
  });

  it('returns true for errors containing "temporarily unavailable"', () => {
    expect(isRateLimitError(new Error('Service is temporarily unavailable'))).toBe(true);
  });

  it('returns true for errors containing "challenge"', () => {
    expect(isRateLimitError(new Error('LinkedIn challenge required'))).toBe(true);
  });

  it('returns true for errors containing "rate limit"', () => {
    expect(isRateLimitError(new Error('You have hit the rate limit'))).toBe(true);
  });

  it('returns true for string errors matching patterns', () => {
    expect(isRateLimitError('429 error occurred')).toBe(true);
    expect(isRateLimitError('account restricted by platform')).toBe(true);
  });

  it('returns false for normal unrelated errors', () => {
    expect(isRateLimitError(new Error('Not found'))).toBe(false);
    expect(isRateLimitError(new Error('Invalid payload'))).toBe(false);
    expect(isRateLimitError(new Error('DB connection failed'))).toBe(false);
  });

  it('returns false for non-string non-Error values', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError(500)).toBe(false);
  });
});
