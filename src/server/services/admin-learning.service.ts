/**
 * Admin Learning Service
 * Data for admin learning dashboard (super-admin only).
 */

import * as editHistoryRepo from "@/server/repositories/edit-history.repo";
import * as teamRepo from "@/server/repositories/team.repo";

export interface LearningData {
  editActivity: editHistoryRepo.EditActivityRow[];
  profiles: teamRepo.TeamProfileRow[];
}

export async function getLearningData(sinceIso: string): Promise<LearningData> {
  const [editActivity, profiles] = await Promise.all([
    editHistoryRepo.findEditActivitySince(sinceIso),
    teamRepo.findActiveProfilesWithVoice(),
  ]);
  return { editActivity, profiles };
}
