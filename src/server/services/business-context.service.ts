/**
 * Business Context Service
 * Business logic for cp_business_context.
 * Never imports from Next.js HTTP layer.
 */

import * as businessContextRepo from "@/server/repositories/business-context.repo";
import type { BusinessContext } from "@/lib/types/content-pipeline";
import type { BusinessContextUpsertInput } from "@/server/repositories/business-context.repo";

export async function getBusinessContext(
  userId: string,
): Promise<BusinessContext | null> {
  return businessContextRepo.findBusinessContextByUserId(userId);
}

export async function upsertBusinessContext(
  userId: string,
  input: BusinessContextUpsertInput,
): Promise<BusinessContext> {
  return businessContextRepo.upsertBusinessContext(userId, input);
}
