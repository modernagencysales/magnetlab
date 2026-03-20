/** DM Coach Repository. All Supabase access for dmc_contacts, dmc_messages, dmc_suggestions.
 * Admin client only — no user JWT. Never imports route-layer modules. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  DMC_CONTACT_COLUMNS,
  DMC_MESSAGE_COLUMNS,
  DMC_SUGGESTION_COLUMNS,
  ALLOWED_CONTACT_UPDATE_FIELDS,
} from '@/lib/types/dm-coach';
import type {
  CreateContactInput,
  UpdateContactInput,
  AddMessageInput,
  ContactStatus,
  ConversationGoal,
  CoachReasoning,
} from '@/lib/types/dm-coach';

// ─── Contacts ───────────────────────────────────────────────────────────────

export async function createContact(
  userId: string,
  teamId: string | null,
  input: CreateContactInput
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('dmc_contacts')
    .insert({
      user_id: userId,
      team_id: teamId,
      name: input.name,
      linkedin_url: input.linkedin_url ?? null,
      headline: input.headline ?? null,
      company: input.company ?? null,
      location: input.location ?? null,
      conversation_goal: input.conversation_goal ?? 'book_meeting',
      notes: input.notes ?? null,
      status: 'active',
    })
    .select(DMC_CONTACT_COLUMNS)
    .single();

  return { data, error };
}

export async function getContact(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('dmc_contacts')
    .select(DMC_CONTACT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function listContacts(
  userId: string,
  opts?: { status?: ContactStatus; goal?: ConversationGoal; search?: string }
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('dmc_contacts')
    .select(DMC_CONTACT_COLUMNS)
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (opts?.status) query = query.eq('status', opts.status);
  if (opts?.goal) query = query.eq('conversation_goal', opts.goal);
  if (opts?.search) query = query.ilike('name', `%${opts.search}%`);

  const { data, error } = await query;
  return { data, error };
}

export async function updateContact(userId: string, id: string, input: UpdateContactInput) {
  const supabase = createSupabaseAdminClient();

  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_CONTACT_UPDATE_FIELDS) {
    if (key in input) {
      filtered[key] = (input as Record<string, unknown>)[key];
    }
  }
  filtered.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('dmc_contacts')
    .update(filtered)
    .eq('id', id)
    .eq('user_id', userId)
    .select(DMC_CONTACT_COLUMNS)
    .single();
  return { data, error };
}

export async function deleteContact(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('dmc_contacts').delete().eq('id', id).eq('user_id', userId);
  return { error };
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function addMessages(userId: string, contactId: string, messages: AddMessageInput[]) {
  if (messages.length === 0) return { data: [], error: null };

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const rows = messages.map((m) => ({
    contact_id: contactId,
    user_id: userId,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp ?? now,
  }));

  const { data, error } = await supabase
    .from('dmc_messages')
    .insert(rows)
    .select(DMC_MESSAGE_COLUMNS);

  if (error) return { data: null, error };

  // Update contact's last_message_at to the max timestamp in this batch
  const timestamps = rows.map((r) => r.timestamp);
  const maxTimestamp = timestamps.sort().pop() ?? now;

  await supabase
    .from('dmc_contacts')
    .update({ last_message_at: maxTimestamp, updated_at: new Date().toISOString() })
    .eq('id', contactId)
    .eq('user_id', userId);

  return { data, error: null };
}

export async function listMessages(contactId: string, opts?: { limit?: number }) {
  const supabase = createSupabaseAdminClient();
  const limit = opts?.limit ?? 100;

  const { data, error } = await supabase
    .from('dmc_messages')
    .select(DMC_MESSAGE_COLUMNS)
    .eq('contact_id', contactId)
    .order('timestamp', { ascending: true })
    .limit(limit);

  return { data, error };
}

// ─── Suggestions ────────────────────────────────────────────────────────────

export async function saveSuggestion(
  userId: string,
  contactId: string,
  suggestion: {
    suggested_response: string;
    reasoning: CoachReasoning;
    conversation_goal: ConversationGoal;
    stage_before: string;
    stage_after: string;
  }
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('dmc_suggestions')
    .insert({
      contact_id: contactId,
      user_id: userId,
      suggested_response: suggestion.suggested_response,
      reasoning: suggestion.reasoning,
      conversation_goal: suggestion.conversation_goal,
      stage_before: suggestion.stage_before,
      stage_after: suggestion.stage_after,
    })
    .select(DMC_SUGGESTION_COLUMNS)
    .single();

  return { data, error };
}

export async function listSuggestions(contactId: string, opts?: { limit?: number }) {
  const supabase = createSupabaseAdminClient();
  const limit = opts?.limit ?? 10;

  const { data, error } = await supabase
    .from('dmc_suggestions')
    .select(DMC_SUGGESTION_COLUMNS)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

export async function markSuggestionUsed(
  userId: string,
  suggestionId: string,
  editedResponse?: string
) {
  const supabase = createSupabaseAdminClient();

  const updates: Record<string, unknown> = { was_used: true };
  if (editedResponse !== undefined) {
    updates.user_edited_response = editedResponse;
  }

  const { data, error } = await supabase
    .from('dmc_suggestions')
    .update(updates)
    .eq('id', suggestionId)
    .eq('user_id', userId)
    .select(DMC_SUGGESTION_COLUMNS)
    .single();

  return { data, error };
}
