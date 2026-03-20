/** DM Coach Service. Business logic for DM coaching contacts, messages, and suggestions.
 * Never imports from the route layer. Side effects must not block core returns. */

import { logError } from '@/lib/utils/logger';
import * as repo from '@/server/repositories/dm-coach.repo';
import {
  CreateContactSchema,
  UpdateContactSchema,
  AddMessagesSchema,
} from '@/lib/validations/dm-coach';
import { buildDmCoachPrompt } from '@/lib/ai/dm-coach/prompt-builder';
import { parseCoachResponse } from '@/lib/ai/dm-coach/response-parser';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import type {
  DmcContact,
  DmcMessage,
  DmcSuggestion,
  ContactStatus,
  ConversationGoal,
  QualificationStage,
} from '@/lib/types/dm-coach';

// ─── Result Types ────────────────────────────────────────────────────────────

type ServiceSuccess<T> = { success: true; data: T };
type ServiceError = {
  success: false;
  error: 'validation' | 'not_found' | 'database';
  message?: string;
};
type ServiceResult<T> = ServiceSuccess<T> | ServiceError;

// ─── Contact CRUD ────────────────────────────────────────────────────────────

export async function createContact(
  userId: string,
  teamId: string | null,
  input: unknown
): Promise<ServiceResult<DmcContact>> {
  const parsed = CreateContactSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'validation', message: parsed.error.issues[0]?.message };
  }

  const { data, error } = await repo.createContact(userId, teamId, parsed.data);
  if (error) {
    logError('dm-coach/createContact', error, { userId });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'database', message: 'Failed to create contact' };
  }
  return { success: true, data };
}

export async function getContactWithMessages(
  userId: string,
  contactId: string
): Promise<
  ServiceResult<DmcContact & { messages: DmcMessage[]; latest_suggestion: DmcSuggestion | null }>
> {
  const { data: contact, error: contactError } = await repo.getContact(userId, contactId);
  if (contactError) {
    if (contactError.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Contact not found' };
    }
    logError('dm-coach/getContactWithMessages', contactError, { userId, contactId });
    return { success: false, error: 'database', message: contactError.message };
  }
  if (!contact) {
    return { success: false, error: 'not_found', message: 'Contact not found' };
  }

  const [messagesResult, suggestionsResult] = await Promise.all([
    repo.listMessages(contactId),
    repo.listSuggestions(contactId, { limit: 1 }),
  ]);

  if (messagesResult.error) {
    logError('dm-coach/getContactWithMessages/messages', messagesResult.error, { contactId });
  }
  if (suggestionsResult.error) {
    logError('dm-coach/getContactWithMessages/suggestions', suggestionsResult.error, {
      contactId,
    });
  }

  return {
    success: true,
    data: {
      ...contact,
      messages: (messagesResult.data as DmcMessage[]) ?? [],
      latest_suggestion: (suggestionsResult.data?.[0] as DmcSuggestion) ?? null,
    },
  };
}

export async function listContacts(
  userId: string,
  filters?: { status?: ContactStatus; goal?: ConversationGoal; search?: string }
): Promise<ServiceResult<DmcContact[]>> {
  const { data, error } = await repo.listContacts(userId, filters);
  if (error) {
    logError('dm-coach/listContacts', error, { userId });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: (data as DmcContact[]) ?? [] };
}

export async function updateContact(
  userId: string,
  contactId: string,
  input: unknown
): Promise<ServiceResult<DmcContact>> {
  const parsed = UpdateContactSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'validation', message: parsed.error.issues[0]?.message };
  }

  const { data, error } = await repo.updateContact(userId, contactId, parsed.data);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Contact not found' };
    }
    logError('dm-coach/updateContact', error, { userId, contactId });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Contact not found' };
  }
  return { success: true, data };
}

export async function deleteContact(
  userId: string,
  contactId: string
): Promise<ServiceResult<{ id: string }>> {
  const { error } = await repo.deleteContact(userId, contactId);
  if (error) {
    logError('dm-coach/deleteContact', error, { userId, contactId });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: { id: contactId } };
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function addMessages(
  userId: string,
  contactId: string,
  input: unknown
): Promise<ServiceResult<DmcMessage[]>> {
  const parsed = AddMessagesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'validation', message: parsed.error.issues[0]?.message };
  }

  const { data, error } = await repo.addMessages(userId, contactId, parsed.data.messages);
  if (error) {
    logError('dm-coach/addMessages', error, { userId, contactId });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: (data as DmcMessage[]) ?? [] };
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export async function getSuggestion(
  userId: string,
  contactId: string
): Promise<ServiceResult<DmcSuggestion>> {
  // 1. Verify the contact exists and belongs to this user
  const { data: contact, error: contactError } = await repo.getContact(userId, contactId);
  if (contactError) {
    if (contactError.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Contact not found' };
    }
    logError('dm-coach/getSuggestion', contactError, { userId, contactId });
    return { success: false, error: 'database', message: contactError.message };
  }
  if (!contact) {
    return { success: false, error: 'not_found', message: 'Contact not found' };
  }

  // 2. Fetch conversation messages (last 20)
  const { data: messages, error: messagesError } = await repo.listMessages(contactId, {
    limit: 20,
  });
  if (messagesError) {
    logError('dm-coach/getSuggestion/messages', messagesError, { contactId });
    return { success: false, error: 'database', message: messagesError.message };
  }

  if (!messages || messages.length === 0) {
    return {
      success: false,
      error: 'validation',
      message: 'No messages to generate a suggestion from. Add messages first.',
    };
  }

  // 3. Build the AI prompt
  const typedContact = contact as DmcContact;
  const typedMessages = messages as DmcMessage[];

  const prompt = buildDmCoachPrompt({
    contactName: typedContact.name,
    contactHeadline: typedContact.headline || '',
    contactCompany: typedContact.company || '',
    contactLocation: typedContact.location || '',
    conversationHistory: typedMessages.map((m) => ({
      role: m.role as 'them' | 'me',
      content: m.content,
      timestamp: m.timestamp,
    })),
    conversationGoal: typedContact.conversation_goal,
    currentStage: typedContact.qualification_stage,
  });

  // 4. Call Claude
  let rawResponse: string;
  try {
    const anthropic = createAnthropicClient('dm-coach');
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = completion.content.find((b: { type: string }) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    rawResponse = textBlock?.text || '';

    if (!rawResponse) {
      logError('dm-coach/getSuggestion', new Error('Empty AI response'), { contactId });
      return { success: false, error: 'database', message: 'AI returned an empty response' };
    }
  } catch (aiError) {
    logError('dm-coach/getSuggestion/ai', aiError, { userId, contactId });
    return { success: false, error: 'database', message: 'Failed to generate AI suggestion' };
  }

  // 5. Parse the response
  const parsed = parseCoachResponse(rawResponse);

  // 6. Save the suggestion
  const { data: saved, error: saveError } = await repo.saveSuggestion(userId, contactId, {
    suggested_response: parsed.suggestedResponse,
    reasoning: parsed.reasoning,
    conversation_goal: typedContact.conversation_goal,
    stage_before: parsed.qualificationStageBefore,
    stage_after: parsed.qualificationStageAfter,
  });

  if (saveError) {
    logError('dm-coach/getSuggestion/save', saveError, { contactId });
    return { success: false, error: 'database', message: saveError.message };
  }
  if (!saved) {
    return { success: false, error: 'database', message: 'Failed to save suggestion' };
  }

  // 7. Auto-advance qualification stage if the AI suggests progression
  // Side effect — must not block the core return
  if (
    parsed.qualificationStageAfter !== 'unknown' &&
    parsed.qualificationStageAfter !== typedContact.qualification_stage
  ) {
    try {
      await repo.updateContact(userId, contactId, {
        qualification_stage: parsed.qualificationStageAfter as QualificationStage,
      });
    } catch (stageError) {
      logError('dm-coach/getSuggestion/stageAdvance', stageError, {
        contactId,
        from: typedContact.qualification_stage,
        to: parsed.qualificationStageAfter,
      });
      // Stage update failure must never affect the suggestion return
    }
  }

  return { success: true, data: saved as DmcSuggestion };
}

export async function markSuggestionUsed(
  userId: string,
  suggestionId: string,
  editedResponse?: string
): Promise<ServiceResult<DmcSuggestion>> {
  const { data, error } = await repo.markSuggestionUsed(userId, suggestionId, editedResponse);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Suggestion not found' };
    }
    logError('dm-coach/markSuggestionUsed', error, { userId, suggestionId });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Suggestion not found' };
  }
  return { success: true, data: data as DmcSuggestion };
}

// ─── Error Helper ────────────────────────────────────────────────────────────

/** Extract statusCode from a service error, defaulting to 500. */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
