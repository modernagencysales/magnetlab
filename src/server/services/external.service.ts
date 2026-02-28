/**
 * External API Service
 * Service-to-service auth (userId from context). All DB via repos.
 */

import { logApiError } from '@/lib/api/errors';
import * as leadMagnetsRepo from '@/server/repositories/lead-magnets.repo';

/** List lead magnets for external API. */
export async function listLeadMagnets(
  userId: string,
  opts: { status?: string | null; limit?: number; offset?: number }
) {
  try {
    const { data, count } = await leadMagnetsRepo.findLeadMagnetsByUserId(userId, {
      status: opts.status ?? undefined,
      limit: opts.limit ?? 50,
      offset: opts.offset ?? 0,
    });
    return { success: true as const, leadMagnets: data, total: count, limit: opts.limit ?? 50, offset: opts.offset ?? 0 };
  } catch (error) {
    logApiError('external/lead-magnets/list', error, { userId });
    return { success: false as const, error: 'database' as const };
  }
}

/** Get one lead magnet by id for external API. */
export async function getLeadMagnet(userId: string, id: string) {
  try {
    const data = await leadMagnetsRepo.findLeadMagnetByIdAndUser(id, userId);
    if (!data) return { success: false as const, error: 'not_found' as const };
    return { success: true as const, leadMagnet: data };
  } catch (error) {
    logApiError('external/lead-magnets/get', error, { userId, id });
    return { success: false as const, error: 'database' as const };
  }
}

/** Create lead magnet for external API (with usage limit check). */
export async function createLeadMagnetExternal(
  userId: string,
  body: Record<string, unknown>
) {
  try {
    const { data: canCreate, error: rpcError } = await leadMagnetsRepo.checkUsageLimitRpc(
      userId,
      'lead_magnets'
    );
    if (rpcError) {
      logApiError('external/lead-magnets/usage-check', rpcError, { userId });
    } else if (canCreate === false) {
      return { success: false as const, error: 'usage_limit' as const };
    }

    const data = await leadMagnetsRepo.createLeadMagnet(userId, null, {
      title: body.title as string,
      archetype: body.archetype as string,
      concept: body.concept,
      extracted_content: body.extractedContent,
      linkedin_post: body.linkedinPost,
      post_variations: body.postVariations,
      dm_template: body.dmTemplate,
      cta_word: body.ctaWord,
      status: 'draft',
    });

    try {
      await leadMagnetsRepo.incrementUsageRpc(userId, 'lead_magnets');
    } catch (err) {
      logApiError('external/lead-magnets/usage-increment', err, { userId });
    }

    return { success: true as const, leadMagnet: data };
  } catch (error) {
    logApiError('external/lead-magnets/create', error, { userId });
    return { success: false as const, error: 'database' as const };
  }
}
