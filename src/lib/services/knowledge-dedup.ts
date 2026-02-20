import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

interface DedupResult {
  action: 'insert' | 'supersede' | 'corroborate';
  existingEntryId?: string;
}

/**
 * Check if a new entry is a duplicate of an existing one.
 * Uses embedding similarity via the existing cp_match_knowledge_entries RPC.
 * > 0.90 from same speaker = true duplicate or refinement → supersede
 * > 0.90 from different speaker = corroboration → link
 * 0.85-0.90 = possible refinement, insert and let weekly consolidation handle
 */
export async function checkForDuplicate(
  userId: string,
  embedding: number[],
  speaker: string
): Promise<DedupResult> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc('cp_match_knowledge_entries', {
    query_embedding: JSON.stringify(embedding),
    p_user_id: userId,
    threshold: 0.85,
    match_count: 5,
  });

  if (error || !data?.length) {
    return { action: 'insert' };
  }

  const topMatch = data[0];
  const similarity = topMatch.similarity;

  if (similarity > 0.90) {
    if (topMatch.speaker === speaker) {
      return { action: 'supersede', existingEntryId: topMatch.id };
    }
    return { action: 'corroborate', existingEntryId: topMatch.id };
  }

  return { action: 'insert' };
}

/**
 * Supersede an existing entry with a new one.
 * Old entry gets superseded_by pointer to new entry.
 */
export async function supersedeEntry(
  oldEntryId: string,
  newEntryId: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_knowledge_entries')
    .update({ superseded_by: newEntryId })
    .eq('id', oldEntryId);

  if (error) {
    logError('services/knowledge-dedup', new Error('Failed to supersede'), { oldEntryId, newEntryId });
  }
}

/**
 * Record a corroboration link between two entries.
 */
export async function recordCorroboration(
  entryId: string,
  corroboratedById: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_knowledge_corroborations')
    .upsert(
      { entry_id: entryId, corroborated_by: corroboratedById },
      { onConflict: 'entry_id,corroborated_by' }
    );

  if (error) {
    logError('services/knowledge-dedup', new Error('Failed to record corroboration'), { entryId, corroboratedById });
  }
}
