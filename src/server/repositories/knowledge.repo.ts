/**
 * Knowledge Repository
 * ALL direct Supabase queries for cp_knowledge_entries live here.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, isEmbeddingsConfigured } from '@/lib/ai/embeddings';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string;
  user_id: string;
  transcript_id: string | null;
  category: string;
  speaker: string | null;
  content: string;
  context: string | null;
  tags: string[];
  transcript_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntrySnapshot {
  id: string;
  user_id: string;
  content: string;
  context: string | null;
  tags: string[];
}

export interface KnowledgeUpdateInput {
  content?: string;
  category?: string;
  speaker?: string;
  context?: string;
  tags?: string[];
}

// ─── Team owner resolution ──────────────────────────────────────────────────

/**
 * Knowledge entries are scoped by user_id (not team_profile_id).
 * For team context, we use the team owner's user_id.
 */
export async function resolveEffectiveUserId(
  sessionUserId: string,
  teamId?: string,
): Promise<string> {
  if (!teamId) return sessionUserId;

  const supabase = createSupabaseAdminClient();
  const { data: ownerProfile } = await supabase
    .from('team_profiles')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  return ownerProfile?.user_id ?? sessionUserId;
}

// ─── Single-item queries ───────────────────────────────────────────────────

export async function findKnowledgeEntrySnapshot(
  userId: string,
  id: string,
): Promise<KnowledgeEntrySnapshot | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_knowledge_entries')
    .select('id, user_id, content, context, tags')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as KnowledgeEntrySnapshot;
}

// ─── Write operations ──────────────────────────────────────────────────────

const ENTRY_RETURN_COLUMNS =
  'id, user_id, transcript_id, category, speaker, content, context, tags, transcript_type, created_at, updated_at';

export async function updateKnowledgeEntry(
  userId: string,
  id: string,
  updates: Record<string, unknown>,
): Promise<KnowledgeEntry> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_knowledge_entries')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select(ENTRY_RETURN_COLUMNS)
    .single();
  if (error) throw new Error(`knowledge.updateKnowledgeEntry: ${error.message}`);
  return data as KnowledgeEntry;
}

export async function deleteKnowledgeEntry(userId: string, id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_knowledge_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`knowledge.deleteKnowledgeEntry: ${error.message}`);
}

// ─── Tag count management ──────────────────────────────────────────────────

export async function incrementTagCount(userId: string, tag: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('cp_increment_tag_count', { p_user_id: userId, p_tag_name: tag });
}

export async function decrementTagCount(userId: string, tag: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('cp_decrement_tag_count', { p_user_id: userId, p_tag_name: tag });
}

// ─── Embedding helpers ─────────────────────────────────────────────────────

export async function buildEmbeddingUpdate(
  content: string,
  context: string | null,
): Promise<string | null> {
  if (!isEmbeddingsConfigured()) return null;
  const embeddingText = context ? `${content}\n\n${context}` : content;
  try {
    const embedding = await generateEmbedding(embeddingText);
    return JSON.stringify(embedding);
  } catch {
    return null; // Non-fatal
  }
}
