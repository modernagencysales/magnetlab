/**
 * Creators Service (tracked LinkedIn creators)
 * Business logic for cp_tracked_creators.
 * Never imports from Next.js HTTP layer.
 */

import * as creatorsRepo from "@/server/repositories/creators.repo";
import type { TrackedCreator, CreateCreatorInput } from "@/server/repositories/creators.repo";

export async function getCreators(userId: string): Promise<TrackedCreator[]> {
  return creatorsRepo.findCreatorsByUserId(userId);
}

export interface AddCreatorResult {
  creator: TrackedCreator;
  message?: string;
}

export async function addCreator(
  userId: string,
  input: CreateCreatorInput,
): Promise<AddCreatorResult> {
  const existing = await creatorsRepo.findCreatorByLinkedInUrl(input.linkedin_url);
  if (existing) {
    return { creator: existing, message: "Creator already exists" };
  }

  const creator = await creatorsRepo.createCreator(userId, input);
  return { creator };
}

export async function deleteCreator(
  userId: string,
  creatorId: string,
): Promise<void> {
  const existing = await creatorsRepo.findCreatorById(creatorId);
  if (!existing) {
    const err = Object.assign(new Error("Creator not found"), { statusCode: 404 });
    throw err;
  }
  if (existing.added_by_user_id !== userId) {
    const err = Object.assign(
      new Error("Forbidden: you can only delete creators you added"),
      { statusCode: 403 },
    );
    throw err;
  }
  await creatorsRepo.deleteCreator(creatorId, userId);
}

export function getStatusCode(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
