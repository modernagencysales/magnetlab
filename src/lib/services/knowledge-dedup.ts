import { logError } from '@/lib/utils/logger';
import {
  matchKnowledgeEntriesForDedup,
  supersedeKnowledgeEntry,
  upsertKnowledgeCorroboration,
} from '@/server/repositories/knowledge.repo';

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
  const matches = await matchKnowledgeEntriesForDedup(userId, embedding);

  if (!matches.length) {
    return { action: 'insert' };
  }

  const topMatch = matches[0];
  const similarity = topMatch.similarity;

  if (similarity > 0.9) {
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
  userId: string,
  oldEntryId: string,
  newEntryId: string
): Promise<void> {
  try {
    await supersedeKnowledgeEntry(userId, oldEntryId, newEntryId);
  } catch (err) {
    logError('services/knowledge-dedup', err, { oldEntryId, newEntryId });
  }
}

/**
 * Record a corroboration link between two entries.
 */
export async function recordCorroboration(
  userId: string,
  entryId: string,
  corroboratedById: string
): Promise<void> {
  try {
    await upsertKnowledgeCorroboration(userId, entryId, corroboratedById);
  } catch (err) {
    logError('services/knowledge-dedup', err, { entryId, corroboratedById });
  }
}
