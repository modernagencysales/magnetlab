/**
 * LinkedIn Action Executor
 * Maps queue action_type to Unipile API calls. Pure dispatch — no safety logic, no queue management.
 * Never imports route-layer modules. Only called by execute-linkedin-actions task.
 */

import type { UnipileClient } from '@/lib/integrations/unipile';
import type { QueuedAction } from '@/lib/types/linkedin-action-queue';

// ─── Action Dispatch ────────────────────────────────────────────────────

export async function executeAction(client: UnipileClient, action: QueuedAction): Promise<unknown> {
  switch (action.action_type) {
    case 'view_profile':
      return executeViewProfile(client, action);
    case 'connect':
      return executeConnect(client, action);
    case 'message':
    case 'follow_up_message':
      return executeMessage(client, action);
    case 'withdraw':
      return executeWithdrawal(client, action);
    case 'accept_invitation':
      return executeAcceptInvitation(client, action);
    case 'react':
      return executeReact(client, action);
    case 'comment':
      return executeComment(client, action);
    default:
      throw new Error(`Unknown action type: ${action.action_type}`);
  }
}

// ─── Action Implementations ─────────────────────────────────────────────

async function executeViewProfile(client: UnipileClient, action: QueuedAction) {
  const username = action.payload.username as string;
  if (!username) throw new Error('view_profile requires payload.username');
  const result = await client.resolveLinkedInProfile(action.unipile_account_id, username);
  if (result.error) throw new Error(`Profile resolution failed: ${result.error}`);
  return result.data;
}

async function executeConnect(client: UnipileClient, action: QueuedAction) {
  if (!action.target_provider_id) throw new Error('connect requires target_provider_id');
  const message = action.payload.message as string | undefined;
  const result = await client.sendConnectionRequest(
    action.unipile_account_id,
    action.target_provider_id,
    message
  );
  if (result.error) throw new Error(`Connection request failed: ${result.error}`);
  return result.data;
}

async function executeMessage(client: UnipileClient, action: QueuedAction) {
  if (!action.target_provider_id) throw new Error('message requires target_provider_id');
  const text = action.payload.text as string;
  if (!text) throw new Error('message requires payload.text');
  const result = await client.sendDirectMessage(
    action.unipile_account_id,
    action.target_provider_id,
    text
  );
  if (result.error) throw new Error(`DM failed: ${result.error}`);
  return result.data;
}

async function executeWithdrawal(client: UnipileClient, action: QueuedAction) {
  if (!action.target_provider_id) throw new Error('withdraw requires target_provider_id');

  // Find the invitation ID by listing sent invitations and matching provider_id
  const invResult = await client.listSentInvitations(action.unipile_account_id);
  if (invResult.error || !invResult.data) {
    throw new Error(`Failed to list sent invitations: ${invResult.error ?? 'no data'}`);
  }

  const invitation = invResult.data.find(
    (inv) =>
      inv.sender?.provider_id === action.target_provider_id ||
      inv.provider_id === action.target_provider_id
  );

  if (!invitation) {
    throw new Error('Invitation not found for withdrawal');
  }

  const cancelResult = await client.cancelInvitation(invitation.id);
  if (cancelResult.error) throw new Error(`Invitation cancel failed: ${cancelResult.error}`);
  return cancelResult.data;
}

async function executeAcceptInvitation(client: UnipileClient, action: QueuedAction) {
  const invitationId = action.payload.invitation_id as string;
  if (!invitationId) throw new Error('accept_invitation requires payload.invitation_id');
  const result = await client.handleInvitation(invitationId, 'accept');
  if (result.error) throw new Error(`Accept invitation failed: ${result.error}`);
  return result.data;
}

async function executeReact(client: UnipileClient, action: QueuedAction) {
  const postId = action.payload.post_id as string;
  if (!postId) throw new Error('react requires payload.post_id');
  const reactionType = (action.payload.reaction_type as string) ?? 'LIKE';
  const result = await client.addReaction(postId, action.unipile_account_id, reactionType);
  if (result.error) throw new Error(`Reaction failed: ${result.error}`);
  return result.data;
}

async function executeComment(client: UnipileClient, action: QueuedAction) {
  const postId = action.payload.post_id as string;
  if (!postId) throw new Error('comment requires payload.post_id');
  const text = action.payload.text as string;
  if (!text) throw new Error('comment requires payload.text');
  const options = action.payload.options as
    | { commentId?: string; mentions?: Array<{ name: string; profile_id: string }> }
    | undefined;
  const result = await client.addComment(postId, action.unipile_account_id, text, options);
  if (result.error) throw new Error(`Comment failed: ${result.error}`);
  return result.data;
}

// ─── Rate Limit Detection ───────────────────────────────────────────────

const RATE_LIMIT_PATTERNS = [
  '429',
  'restricted',
  'temporarily unavailable',
  'challenge',
  'rate limit',
];

export function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return RATE_LIMIT_PATTERNS.some((pattern) => message.includes(pattern));
}
