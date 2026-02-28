/**
 * Inspiration Service
 */

import * as inspirationRepo from "@/server/repositories/inspiration.repo";
import type { InspirationPullRow, InspirationSourceRow } from "@/server/repositories/inspiration.repo";

const VALID_CONTENT_TYPES = ["post", "lead_magnet", "funnel", "article"];
const VALID_SOURCE_TYPES = ["creator", "search_term", "hashtag", "competitor"] as const;

export async function getPulls(
  userId: string,
  filters: inspirationRepo.InspirationFilters,
) {
  return inspirationRepo.findPulls(userId, filters);
}

export async function updatePull(
  userId: string,
  pullId: string,
  updates: { saved_to_swipe_file?: boolean; dismissed?: boolean },
): Promise<InspirationPullRow | null> {
  const pull = await inspirationRepo.updatePull(userId, pullId, updates);
  if (!pull) return null;

  if (updates.saved_to_swipe_file === true && pull.content_preview) {
    const ai = pull.ai_analysis as Record<string, unknown> | null;
    try {
      await inspirationRepo.insertSwipeFilePost({
        content: pull.content_preview,
        hook: pull.title || pull.content_preview.split("\n")[0]?.slice(0, 100) || null,
        post_type: (ai?.format as string) || null,
        niche: (ai?.topic as string) || null,
        source_url: pull.source_url,
        author_name: pull.author_name,
        notes: (ai?.what_makes_it_work as string) || null,
        submitted_by: userId,
        status: "approved",
      });
    } catch {
      // non-fatal
    }
  }
  return pull;
}

export function validateContentType(contentType: string): boolean {
  return VALID_CONTENT_TYPES.includes(contentType);
}

export async function getSources(
  userId: string,
  activeOnly = true,
): Promise<InspirationSourceRow[]> {
  return inspirationRepo.findSources(userId, activeOnly);
}

export async function createSource(
  userId: string,
  input: {
    source_type: string;
    source_value: string;
    priority?: number;
  },
): Promise<{ source: InspirationSourceRow; reactivated?: boolean }> {
  const cleanValue = input.source_value.trim();
  const priority = Math.max(
    1,
    Math.min(5, parseInt(String(input.priority), 10) || 3),
  );

  const existing = await inspirationRepo.findSourceByTypeAndValue(
    userId,
    input.source_type,
    cleanValue,
  );
  if (existing) {
    if (!existing.is_active) {
      const updated = await inspirationRepo.updateSource(userId, existing.id, {
        is_active: true,
        priority,
      });
      if (updated) return { source: updated, reactivated: true };
    }
    const err = Object.assign(new Error("This inspiration source already exists"), {
      statusCode: 409,
    });
    throw err;
  }

  const source = await inspirationRepo.createSource(userId, {
    source_type: input.source_type,
    source_value: cleanValue,
    priority,
  });
  return { source };
}

export async function updateSource(
  userId: string,
  sourceId: string,
  updates: { priority?: number; is_active?: boolean },
): Promise<InspirationSourceRow | null> {
  const out: Record<string, unknown> = {};
  if (updates.priority !== undefined) {
    out.priority = Math.max(1, Math.min(5, updates.priority));
  }
  if (updates.is_active !== undefined) out.is_active = updates.is_active;
  if (Object.keys(out).length === 0) return null;
  return inspirationRepo.updateSource(userId, sourceId, out);
}

export async function deleteSource(
  userId: string,
  sourceId: string,
  hardDelete: boolean,
): Promise<void> {
  if (hardDelete) {
    await inspirationRepo.deleteSource(userId, sourceId);
  } else {
    await inspirationRepo.updateSource(userId, sourceId, { is_active: false });
  }
}

export function validateSourceType(
  sourceType: string,
): sourceType is (typeof VALID_SOURCE_TYPES)[number] {
  return (VALID_SOURCE_TYPES as readonly string[]).includes(sourceType);
}
