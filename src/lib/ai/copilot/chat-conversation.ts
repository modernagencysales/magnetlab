/** Chat Conversation Service.
 *  Manages copilot conversation lifecycle: lookup, create, save messages.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Types ───────────────────────────────────────────────

export interface ConversationContext {
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
}

export type GetOrCreateResult = { conversationId: string } | { error: string; status: number };

// ─── Conversation CRUD ───────────────────────────────────

/**
 * Verify an existing conversation belongs to the user, or create a new one.
 */
export async function getOrCreateConversation(
  userId: string,
  existingId: string | undefined,
  message: string,
  context?: ConversationContext
): Promise<GetOrCreateResult> {
  const supabase = createSupabaseAdminClient();

  if (existingId) {
    const { data: existing } = await supabase
      .from('copilot_conversations')
      .select('id')
      .eq('id', existingId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return { error: 'Conversation not found', status: 404 };
    }
    return { conversationId: existingId };
  }

  const { data: conv, error: convError } = await supabase
    .from('copilot_conversations')
    .insert({
      user_id: userId,
      entity_type: context?.entityType || null,
      entity_id: context?.entityId || null,
      title: message.slice(0, 100),
    })
    .select('id')
    .single();

  if (convError || !conv) {
    return { error: 'Failed to create conversation', status: 500 };
  }

  return { conversationId: conv.id };
}

/**
 * Save a user message to the conversation.
 */
export async function saveUserMessage(conversationId: string, content: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('copilot_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content,
  });
}

/**
 * Update conversation timestamp after agent loop completes.
 */
export async function touchConversation(conversationId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('copilot_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}
