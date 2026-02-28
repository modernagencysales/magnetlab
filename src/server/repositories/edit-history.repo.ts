/**
 * Edit History Repository
 * ALL Supabase queries for cp_edit_history live here.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

export interface EditFeedbackUpdate {
  edit_tags?: string[];
  ceo_note?: string;
}

/** Find an edit record by id and team_id (for IDOR-safe feedback). Returns null if not found. */
export async function findEditByTeamAndId(
  teamId: string,
  editId: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_edit_history")
    .select("id")
    .eq("id", editId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) throw new Error(`edit-history.findEditByTeamAndId: ${error.message}`);
  return data;
}

/** Edit activity row for admin/learning (last N days). */
export interface EditActivityRow {
  id: string;
  profile_id: string | null;
  content_type: string | null;
  auto_classified_changes: unknown;
  ceo_note: string | null;
  created_at: string;
}

export async function findEditActivitySince(
  sinceIso: string,
): Promise<EditActivityRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_edit_history")
    .select(
      "id, profile_id, content_type, auto_classified_changes, ceo_note, created_at",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`edit-history.findEditActivitySince: ${error.message}`);
  return (data ?? []) as EditActivityRow[];
}

/** Update feedback fields on an edit record. */
export async function updateEditFeedback(
  editId: string,
  updates: EditFeedbackUpdate,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_edit_history")
    .update(updates)
    .eq("id", editId);

  if (error) throw new Error(`edit-history.updateEditFeedback: ${error.message}`);
}
