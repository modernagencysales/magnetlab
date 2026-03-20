/** DM Coach API module. Client-side wrappers for dm-coach endpoints. Never imports server-only modules. */

import { apiClient } from './client';
import type {
  DmcContact,
  DmcMessage,
  DmcSuggestion,
  CreateContactInput,
  UpdateContactInput,
  AddMessageInput,
} from '@/lib/types/dm-coach';

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listContacts(opts?: { status?: string; goal?: string; search?: string }) {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.goal) params.set('goal', opts.goal);
  if (opts?.search) params.set('search', opts.search);
  const qs = params.toString();
  return apiClient.get<{ contacts: DmcContact[] }>(`/dm-coach${qs ? `?${qs}` : ''}`);
}

export async function getContact(contactId: string) {
  return apiClient.get<{
    contact: DmcContact;
    messages: DmcMessage[];
    latest_suggestion: DmcSuggestion | null;
  }>(`/dm-coach/${contactId}`);
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function createContact(input: CreateContactInput) {
  return apiClient.post<{ contact: DmcContact }>('/dm-coach', input);
}

export async function updateContact(contactId: string, input: UpdateContactInput) {
  return apiClient.patch<{ contact: DmcContact }>(`/dm-coach/${contactId}`, input);
}

export async function deleteContact(contactId: string) {
  return apiClient.delete<{ success: boolean }>(`/dm-coach/${contactId}`);
}

export async function addMessages(contactId: string, messages: AddMessageInput[]) {
  return apiClient.post<{ messages: DmcMessage[] }>(`/dm-coach/${contactId}/messages`, {
    messages,
  });
}

export async function getSuggestion(contactId: string) {
  return apiClient.post<{ suggestion: DmcSuggestion }>(`/dm-coach/${contactId}/suggest`);
}

export async function markSuggestionUsed(
  contactId: string,
  suggestionId: string,
  editedResponse?: string
) {
  return apiClient.post<{ suggestion: DmcSuggestion }>(
    `/dm-coach/${contactId}/suggestions/${suggestionId}/use`,
    editedResponse !== undefined ? { edited_response: editedResponse } : undefined
  );
}
