/**
 * Interactive Chats Repository (interactive_chats, interactive_chat_messages)
 * For public chat API. ALL Supabase for interactive GPT chats here.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/** Get lead magnet interactive_config by id (for public chat). */
export async function getLeadMagnetInteractiveConfig(leadMagnetId: string): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('lead_magnets')
    .select('interactive_config')
    .eq('id', leadMagnetId)
    .single();
  return (data?.interactive_config as Record<string, unknown>) ?? null;
}

/** Find chat by lead_magnet_id and session_token. */
export async function findChatByLeadMagnetAndSession(
  leadMagnetId: string,
  sessionToken: string
): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('interactive_chats')
    .select('id')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('session_token', sessionToken)
    .single();
  return data ?? null;
}

/** Create a new chat and return id. */
export async function createChat(leadMagnetId: string, sessionToken: string, title: string): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('interactive_chats')
    .insert({ lead_magnet_id: leadMagnetId, session_token: sessionToken, title })
    .select('id')
    .single();
  if (error) throw new Error(`interactive-chat.createChat: ${error.message}`);
  return data as { id: string };
}

/** Count user messages in chat since timestamp (for rate limit). */
export async function countUserMessagesSince(chatId: string, since: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('interactive_chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId)
    .eq('role', 'user')
    .gte('created_at', since);
  return count ?? 0;
}

/** Count user messages for lead magnet since timestamp (daily limit). */
export async function countUserMessagesForLeadMagnetSince(leadMagnetId: string, since: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('interactive_chat_messages')
    .select('id, interactive_chats!inner(lead_magnet_id)', { count: 'exact', head: true })
    .eq('interactive_chats.lead_magnet_id', leadMagnetId)
    .eq('role', 'user')
    .gte('created_at', since);
  return count ?? 0;
}

/** Insert a message. */
export async function insertMessage(chatId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('interactive_chat_messages')
    .insert({ chat_id: chatId, role, content });
  if (error) throw new Error(`interactive-chat.insertMessage: ${error.message}`);
}

/** Get last N messages for a chat. */
export async function getMessages(chatId: string, limit: number): Promise<Array<{ role: string; content: string | null }>> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('interactive_chat_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data ?? []) as Array<{ role: string; content: string | null }>;
}

/** Get chat id and messages for GET history. */
export async function getChatWithMessages(
  leadMagnetId: string,
  sessionToken: string
): Promise<{ chatId: string | null; messages: Array<{ role: string; content: string | null; created_at: string }> }> {
  const supabase = createSupabaseAdminClient();
  const { data: chat } = await supabase
    .from('interactive_chats')
    .select('id')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('session_token', sessionToken)
    .single();
  if (!chat) return { chatId: null, messages: [] };
  const { data: messages } = await supabase
    .from('interactive_chat_messages')
    .select('role, content, created_at')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: true });
  return { chatId: chat.id, messages: (messages ?? []) as Array<{ role: string; content: string | null; created_at: string }> };
}
