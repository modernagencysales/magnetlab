/**
 * Thumbnail Service
 * Generate branded thumbnail, upload to storage, update lead magnet.
 */

import { generateBrandedThumbnail } from "@/lib/services/thumbnail";
import * as storageRepo from "@/server/repositories/storage.repo";
import * as leadMagnetsRepo from "@/server/repositories/lead-magnets.repo";
import type { DataScope } from "@/lib/utils/team-context";

export async function generateAndSaveThumbnail(
  scope: DataScope,
  userId: string,
  leadMagnetId: string,
  title: string,
  subtitle?: string,
): Promise<string> {
  const thumbnailBuffer = await generateBrandedThumbnail(title, subtitle);
  const thumbnailUrl = await storageRepo.uploadThumbnail(
    userId,
    leadMagnetId,
    thumbnailBuffer,
  );
  await leadMagnetsRepo.updateLeadMagnetNoReturn(scope, leadMagnetId, {
    thumbnail_url: thumbnailUrl,
  });
  return thumbnailUrl;
}
