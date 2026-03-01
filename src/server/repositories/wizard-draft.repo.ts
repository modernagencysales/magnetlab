/**
 * Wizard Draft Repository (extraction_sessions as drafts)
 * ALL Supabase for wizard draft list/create/update/delete.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

export interface DraftRow {
  id: string;
  wizard_state: unknown;
  current_step: number | null;
  draft_title: string | null;
  updated_at: string;
}

export async function listDrafts(scope: DataScope): Promise<DraftRow[]> {
  const supabase = createSupabaseAdminClient();
  const query = applyScope(
    supabase
      .from('extraction_sessions')
      .select('id, wizard_state, current_step, draft_title, updated_at')
      .or('expires_at.is.null,expires_at.gt.now()')
      .not('wizard_state', 'eq', '{}'),
    scope,
  );
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw new Error(`wizard-draft.listDrafts: ${error.message}`);
  return (data ?? []) as DraftRow[];
}

export async function updateDraft(
  draftId: string,
  userId: string,
  payload: {
    wizard_state: unknown;
    current_step: number | null;
    draft_title: string;
    extraction_answers?: Record<string, unknown>;
    selected_concept_index?: number | null;
  },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('extraction_sessions')
    .update({
      wizard_state: payload.wizard_state,
      current_step: payload.current_step,
      draft_title: payload.draft_title,
      extraction_answers: payload.extraction_answers ?? {},
      selected_concept_index: payload.selected_concept_index,
    })
    .eq('id', draftId)
    .eq('user_id', userId);
  if (error) throw new Error(`wizard-draft.updateDraft: ${error.message}`);
}

export async function createDraft(
  userId: string,
  teamId: string | null,
  payload: {
    wizard_state: unknown;
    current_step: number | null;
    draft_title: string;
    extraction_answers?: Record<string, unknown>;
    selected_concept_index?: number | null;
  },
): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('extraction_sessions')
    .insert({
      user_id: userId,
      team_id: teamId,
      wizard_state: payload.wizard_state,
      current_step: payload.current_step,
      draft_title: payload.draft_title,
      extraction_answers: payload.extraction_answers ?? {},
      selected_concept_index: payload.selected_concept_index,
      expires_at: null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`wizard-draft.createDraft: ${error.message}`);
  return data as { id: string };
}

export async function deleteDraft(draftId: string, userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('extraction_sessions')
    .delete()
    .eq('id', draftId)
    .eq('user_id', userId);
  if (error) throw new Error(`wizard-draft.deleteDraft: ${error.message}`);
}
