// Edit capture service for style learning
// Captures every meaningful content edit across posts, emails, lead magnets, sequences

import { classifyEditPatterns } from '@/lib/ai/content-pipeline/edit-classifier';

export interface EditDiff {
  added: string[];
  removed: string[];
  changeRatio: number;
  wordCountBefore: number;
  wordCountAfter: number;
}

export interface EditRecordInput {
  teamId: string;
  profileId: string | null;
  contentType: 'post' | 'email' | 'lead_magnet' | 'sequence';
  contentId: string;
  fieldName: string;
  originalText: string;
  editedText: string;
  editTags?: string[];
  ceoNote?: string;
}

export interface EditRecord {
  team_id: string;
  profile_id: string | null;
  content_type: string;
  content_id: string;
  field_name: string;
  original_text: string;
  edited_text: string;
  edit_diff: EditDiff;
  edit_tags: string[];
  ceo_note: string | null;
}

const SIGNIFICANCE_THRESHOLD = 0.05;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalizeWhitespace(text).split(' ').filter(Boolean);
}

/**
 * Determines if an edit is significant enough to capture.
 * Returns false for identical text, whitespace-only changes, or edits below 5% change ratio.
 */
export function isSignificantEdit(original: string, edited: string): boolean {
  const normOriginal = normalizeWhitespace(original);
  const normEdited = normalizeWhitespace(edited);

  if (normOriginal === normEdited) return false;

  const diff = computeEditDiff(original, edited);
  return diff.changeRatio >= SIGNIFICANCE_THRESHOLD;
}

/**
 * Computes a word-level diff between original and edited text.
 * Returns added words, removed words, change ratio, and word counts.
 */
export function computeEditDiff(original: string, edited: string): EditDiff {
  const originalWords = tokenize(original);
  const editedWords = tokenize(edited);

  const originalSet = new Set(originalWords);
  const editedSet = new Set(editedWords);

  const removed = originalWords.filter((w) => !editedSet.has(w));
  const added = editedWords.filter((w) => !originalSet.has(w));

  const totalWords = Math.max(originalWords.length, editedWords.length, 1);
  const changedWords = new Set([...removed, ...added]).size;
  const changeRatio = changedWords / totalWords;

  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
    changeRatio,
    wordCountBefore: originalWords.length,
    wordCountAfter: editedWords.length,
  };
}

/**
 * Builds a DB-ready edit record, or returns null if the edit is insignificant.
 */
export function buildEditRecord(input: EditRecordInput): EditRecord | null {
  if (!isSignificantEdit(input.originalText, input.editedText)) return null;

  const editDiff = computeEditDiff(input.originalText, input.editedText);

  return {
    team_id: input.teamId,
    profile_id: input.profileId,
    content_type: input.contentType,
    content_id: input.contentId,
    field_name: input.fieldName,
    original_text: input.originalText,
    edited_text: input.editedText,
    edit_diff: editDiff,
    edit_tags: input.editTags || [],
    ceo_note: input.ceoNote || null,
  };
}

/**
 * Fire-and-forget insert into cp_edit_history.
 * Silently logs errors -- never throws.
 */
export async function captureEdit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  input: EditRecordInput
): Promise<void> {
  const record = buildEditRecord(input);
  if (!record) return;

  const { error } = await supabase
    .from('cp_edit_history')
    .insert(record as unknown as Record<string, unknown>);

  if (error) {
    console.error('[edit-capture] Failed to save edit:', error);
  }
}

/**
 * Insert edit record AND kick off async AI classification.
 * Returns the inserted record's ID (or null if edit was insignificant / insert failed).
 * Classification runs fire-and-forget — never blocks the caller.
 */
export async function captureAndClassifyEdit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  input: EditRecordInput
): Promise<string | null> {
  const record = buildEditRecord(input);
  if (!record) return null;

  const { data, error } = await supabase
    .from('cp_edit_history')
    .insert(record as unknown as Record<string, unknown>)
    .select('id')
    .single();

  if (error || !data) {
    console.error('[edit-capture] Failed to save edit:', error);
    return null;
  }

  // Async classification (fire-and-forget)
  classifyEditPatterns({
    originalText: input.originalText,
    editedText: input.editedText,
    contentType: input.contentType,
    fieldName: input.fieldName,
  }).then(result => {
    if (result.patterns.length > 0) {
      supabase
        .from('cp_edit_history')
        .update({ auto_classified_changes: result })
        .eq('id', data.id)
        .then(({ error: updateError }: { error: { message: string } | null }) => {
          if (updateError) console.error('[edit-capture] Classification save failed:', updateError);
        });
    }
  }).catch((err: unknown) => {
    console.error('[edit-capture] Classification failed:', err);
  });

  return data.id;
}
