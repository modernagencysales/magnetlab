/** Copilot API module. Client-side wrappers for copilot endpoints. Never imports server-only modules. */

import { apiClient } from './client';

// ─── Conversations ──────────────────────────────────────────────────────────

export async function getConversation(id: string) {
  return apiClient.get<{
    conversation: { id: string; title: string };
    messages: Array<Record<string, unknown>>;
  }>(`/copilot/conversations/${id}`);
}

export async function listConversations(limit = 5) {
  return apiClient.get<{
    conversations: Array<{
      id: string;
      title: string;
      entity_type: string | null;
      entity_id: string | null;
      model: string | null;
      created_at: string;
      updated_at: string;
    }>;
  }>(`/copilot/conversations?limit=${limit}`);
}

export async function deleteConversation(id: string) {
  return apiClient.delete(`/copilot/conversations/${id}`);
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export async function submitFeedback(
  conversationId: string,
  messageId: string,
  rating: 'positive' | 'negative',
  note?: string
) {
  return apiClient.post(`/copilot/conversations/${conversationId}/feedback`, {
    messageId,
    rating,
    note,
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function confirmAction(
  conversationId: string,
  toolUseId: string,
  approved: boolean,
  toolName: string,
  toolArgs: Record<string, unknown>
) {
  return apiClient.post<{
    executed?: boolean;
    result?: Record<string, unknown>;
  }>(`/copilot/confirm-action`, {
    conversationId,
    toolUseId,
    approved,
    toolName,
    toolArgs,
  });
}
