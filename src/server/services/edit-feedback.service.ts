/**
 * Edit Feedback Service
 * Business logic for CEO feedback on edit history.
 * Never imports from Next.js HTTP layer.
 */

import * as editHistoryRepo from "@/server/repositories/edit-history.repo";
import type { DataScope } from "@/lib/utils/team-context";

export interface SubmitFeedbackInput {
  tags?: string[];
  note?: string;
}

/**
 * Submit feedback (tags and/or note) for an edit record.
 * Requires team scope; edit must belong to that team.
 */
export async function submitEditFeedback(
  scope: DataScope,
  editId: string,
  input: SubmitFeedbackInput,
): Promise<void> {
  if (scope.type !== "team" || !scope.teamId) {
    const err = Object.assign(new Error("Team context required"), { statusCode: 403 });
    throw err;
  }

  const editRecord = await editHistoryRepo.findEditByTeamAndId(scope.teamId, editId);
  if (!editRecord) {
    const err = Object.assign(new Error("Edit record not found"), { statusCode: 404 });
    throw err;
  }

  const updates: editHistoryRepo.EditFeedbackUpdate = {};
  if (input.tags && input.tags.length > 0) {
    updates.edit_tags = input.tags;
  }
  if (input.note) {
    updates.ceo_note = input.note;
  }

  if (Object.keys(updates).length === 0) {
    const err = Object.assign(new Error("No feedback provided"), { statusCode: 400 });
    throw err;
  }

  await editHistoryRepo.updateEditFeedback(editId, updates);
}

/** Extract HTTP status from a service error (defaults to 500). */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
