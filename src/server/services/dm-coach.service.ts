/** DM Coach Service. Business logic for DM coaching contacts, messages, and suggestions.
 * Never imports from the route layer. Side effects must not block core returns.
 * Errors: throw Object.assign(new Error(msg), { statusCode }). */

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
import type { DmCoachPromptParams } from '@/lib/ai/dm-coach/prompt-builder';
import type {
  DmcContact,
  DmcMessage,
  DmcSuggestion,
  CoachSuggestion,
  ContactStatus,
  ConversationGoal,
  QualificationStage,
} from '@/lib/types/dm-coach';

// ─── Error Helpers ───────────────────────────────────────────────────────────

function serviceError(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode });
}

/** Extract statusCode from a service error, defaulting to 500. */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}

// ─── Contact CRUD ────────────────────────────────────────────────────────────

export async function createContact(
  userId: string,
  teamId: string | null,
  input: unknown
): Promise<DmcContact> {
  const parsed = CreateContactSchema.safeParse(input);
  if (!parsed.success) {
    serviceError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  }

  const { data, error } = await repo.createContact(userId, teamId, parsed.data);
  if (error) {
    logError('dm-coach/createContact', error, { userId });
    serviceError(error.message, 500);
  }
  if (!data) {
    serviceError('Failed to create contact', 500);
  }
  return data as DmcContact;
}

export async function getContactWithMessages(
  userId: string,
  contactId: string
): Promise<DmcContact & { messages: DmcMessage[]; latest_suggestion: DmcSuggestion | null }> {
  const { data: contact, error: contactError } = await repo.getContact(userId, contactId);
  if (contactError) {
    if (contactError.code === 'PGRST116') serviceError('Contact not found', 404);
    logError('dm-coach/getContactWithMessages', contactError, { userId, contactId });
    serviceError(contactError.message, 500);
  }
  if (!contact) {
    serviceError('Contact not found', 404);
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
    ...(contact as DmcContact),
    messages: (messagesResult.data as DmcMessage[]) ?? [],
    latest_suggestion: (suggestionsResult.data?.[0] as DmcSuggestion) ?? null,
  };
}

export async function listContacts(
  userId: string,
  filters?: { status?: ContactStatus; goal?: ConversationGoal; search?: string }
): Promise<DmcContact[]> {
  const { data, error } = await repo.listContacts(userId, filters);
  if (error) {
    logError('dm-coach/listContacts', error, { userId });
    serviceError(error.message, 500);
  }
  return (data as DmcContact[]) ?? [];
}

export async function updateContact(
  userId: string,
  contactId: string,
  input: unknown
): Promise<DmcContact> {
  const parsed = UpdateContactSchema.safeParse(input);
  if (!parsed.success) {
    serviceError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  }

  const { data, error } = await repo.updateContact(userId, contactId, parsed.data);
  if (error) {
    if (error.code === 'PGRST116') serviceError('Contact not found', 404);
    logError('dm-coach/updateContact', error, { userId, contactId });
    serviceError(error.message, 500);
  }
  if (!data) {
    serviceError('Contact not found', 404);
  }
  return data as DmcContact;
}

export async function deleteContact(userId: string, contactId: string): Promise<{ id: string }> {
  const { error } = await repo.deleteContact(userId, contactId);
  if (error) {
    logError('dm-coach/deleteContact', error, { userId, contactId });
    serviceError(error.message, 500);
  }
  return { id: contactId };
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function addMessages(
  userId: string,
  contactId: string,
  input: unknown
): Promise<DmcMessage[]> {
  const parsed = AddMessagesSchema.safeParse(input);
  if (!parsed.success) {
    serviceError(parsed.error.issues[0]?.message || 'Invalid input', 400);
  }

  // Verify contact belongs to this user before inserting
  const { data: contact, error: contactError } = await repo.getContact(userId, contactId);
  if (contactError || !contact) {
    serviceError('Contact not found', 404);
  }

  const { data, error } = await repo.addMessages(userId, contactId, parsed.data.messages);
  if (error) {
    logError('dm-coach/addMessages', error, { userId, contactId });
    serviceError(error.message, 500);
  }
  return (data as DmcMessage[]) ?? [];
}

// ─── AI Coaching ─────────────────────────────────────────────────────────────

/**
 * Generate a coaching suggestion from a prompt. No persistence — pure AI call + parse.
 * Used by both getSuggestion (tracked) and actions (one-off).
 */
export async function generateCoaching(input: DmCoachPromptParams): Promise<CoachSuggestion> {
  const prompt = buildDmCoachPrompt(input);

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
  } catch (aiError) {
    logError('dm-coach/generateCoaching/ai', aiError);
    serviceError('Failed to generate AI suggestion', 500);
  }

  if (!rawResponse) {
    logError('dm-coach/generateCoaching', new Error('Empty AI response'));
    serviceError('AI returned an empty response', 500);
  }

  return parseCoachResponse(rawResponse);
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export async function getSuggestion(userId: string, contactId: string): Promise<DmcSuggestion> {
  // 1. Verify the contact exists and belongs to this user
  const { data: contact, error: contactError } = await repo.getContact(userId, contactId);
  if (contactError) {
    if (contactError.code === 'PGRST116') serviceError('Contact not found', 404);
    logError('dm-coach/getSuggestion', contactError, { userId, contactId });
    serviceError(contactError.message, 500);
  }
  if (!contact) {
    serviceError('Contact not found', 404);
  }

  // 2. Fetch conversation messages (last 20)
  const { data: messages, error: messagesError } = await repo.listMessages(contactId, {
    limit: 20,
  });
  if (messagesError) {
    logError('dm-coach/getSuggestion/messages', messagesError, { contactId });
    serviceError(messagesError.message, 500);
  }

  if (!messages || messages.length === 0) {
    serviceError('No messages to generate a suggestion from. Add messages first.', 400);
  }

  // 3. Generate coaching via shared AI method
  const typedContact = contact as DmcContact;
  const typedMessages = messages as DmcMessage[];

  const parsed = await generateCoaching({
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

  // 4. Save the suggestion
  const { data: saved, error: saveError } = await repo.saveSuggestion(userId, contactId, {
    suggested_response: parsed.suggestedResponse,
    reasoning: parsed.reasoning,
    conversation_goal: typedContact.conversation_goal,
    stage_before: parsed.qualificationStageBefore,
    stage_after: parsed.qualificationStageAfter,
  });

  if (saveError) {
    logError('dm-coach/getSuggestion/save', saveError, { contactId });
    serviceError(saveError.message, 500);
  }
  if (!saved) {
    serviceError('Failed to save suggestion', 500);
  }

  // 5. Auto-advance qualification stage if the AI suggests progression
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

  return saved as DmcSuggestion;
}

export async function markSuggestionUsed(
  userId: string,
  suggestionId: string,
  editedResponse?: string
): Promise<DmcSuggestion> {
  const { data, error } = await repo.markSuggestionUsed(userId, suggestionId, editedResponse);
  if (error) {
    if (error.code === 'PGRST116') serviceError('Suggestion not found', 404);
    logError('dm-coach/markSuggestionUsed', error, { userId, suggestionId });
    serviceError(error.message, 500);
  }
  if (!data) {
    serviceError('Suggestion not found', 404);
  }
  return data as DmcSuggestion;
}
