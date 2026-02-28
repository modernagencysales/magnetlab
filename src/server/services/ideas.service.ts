/**
 * Ideas Service
 * Business logic for cp_content_ideas.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import { tasks } from '@trigger.dev/sdk/v3';
import type { writePostFromIdea } from '@/trigger/write-post-from-idea';
import * as ideasRepo from '@/server/repositories/ideas.repo';
import { logError } from '@/lib/utils/logger';
import type { DataScope } from '@/lib/utils/team-context';
import type { ContentIdea, IdeaStatus } from '@/lib/types/content-pipeline';
import type { IdeaFilters, IdeaUpdateInput } from '@/server/repositories/ideas.repo';

// ─── Response types ────────────────────────────────────────────────────────

export interface IdeaWithProfile extends ContentIdea {
  profile_name: string | null;
}

// ─── Validation constants ──────────────────────────────────────────────────

const VALID_STATUSES: IdeaStatus[] = [
  'extracted', 'selected', 'writing', 'written', 'scheduled', 'published', 'archived',
];

const VALID_PILLARS = [
  'moments_that_matter', 'teaching_promotion', 'human_personal', 'collaboration_social_proof',
];

const VALID_CONTENT_TYPES = [
  'story', 'insight', 'tip', 'framework', 'case_study', 'question', 'listicle', 'contrarian',
];

const ALLOWED_UPDATE_FIELDS: (keyof IdeaUpdateInput)[] = [
  'status', 'title', 'content_pillar', 'content_type', 'core_insight', 'why_post_worthy', 'full_context',
];

// ─── Read operations ───────────────────────────────────────────────────────

export async function getIdeas(
  scope: DataScope,
  filters: IdeaFilters = {},
): Promise<IdeaWithProfile[]> {
  const { status, pillar, contentType } = filters;

  if (status && !VALID_STATUSES.includes(status as IdeaStatus)) {
    throw Object.assign(new Error('Invalid status value'), { statusCode: 400 });
  }
  if (pillar && !VALID_PILLARS.includes(pillar)) {
    throw Object.assign(new Error('Invalid pillar value'), { statusCode: 400 });
  }
  if (contentType && !VALID_CONTENT_TYPES.includes(contentType)) {
    throw Object.assign(new Error('Invalid content_type value'), { statusCode: 400 });
  }

  const ideas = await ideasRepo.findIdeas(scope, filters);

  const profileIds = [
    ...new Set(ideas.map((i) => i.team_profile_id).filter(Boolean)),
  ] as string[];

  const profileMap =
    profileIds.length > 0 ? await ideasRepo.getProfileNameMapForIdeas(profileIds) : {};

  return ideas.map((i) => ({
    ...i,
    profile_name: i.team_profile_id ? (profileMap[i.team_profile_id] ?? null) : null,
  }));
}

export async function getIdeaById(
  scope: DataScope,
  id: string,
): Promise<ContentIdea | null> {
  return ideasRepo.findIdeaById(scope, id);
}

// ─── Write operations ──────────────────────────────────────────────────────

export async function updateIdea(
  scope: DataScope,
  id: string,
  body: Record<string, unknown>,
): Promise<ContentIdea> {
  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) {
      if (field === 'status' && !VALID_STATUSES.includes(body[field] as IdeaStatus)) {
        throw Object.assign(new Error('Invalid status value'), { statusCode: 400 });
      }
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error('No valid fields provided'), { statusCode: 400 });
  }

  return ideasRepo.updateIdea(scope, id, updates);
}

export async function deleteIdea(scope: DataScope, id: string): Promise<void> {
  return ideasRepo.deleteIdea(scope, id);
}

/**
 * Trigger the write-post-from-idea background task.
 * Sets status to 'writing' immediately, then fires the Trigger.dev task.
 * Reverts to 'extracted' if the task dispatch fails.
 */
export async function triggerWritePost(
  scope: DataScope,
  ideaId: string,
  profileId?: string,
): Promise<void> {
  const idea = await ideasRepo.findIdeaForWrite(scope, ideaId);
  if (!idea) throw Object.assign(new Error('Idea not found'), { statusCode: 404 });

  await ideasRepo.updateIdeaStatus(ideaId, 'writing');

  try {
    const resolvedProfileId = profileId || idea.team_profile_id || undefined;
    let teamId: string | undefined;
    if (resolvedProfileId) {
      teamId = (await ideasRepo.getTeamIdForProfile(resolvedProfileId)) ?? undefined;
    }

    await tasks.trigger<typeof writePostFromIdea>('write-post-from-idea', {
      userId: idea.user_id,
      ideaId,
      teamId,
      profileId: resolvedProfileId,
    });
  } catch (err) {
    logError('ideas.service/triggerWritePost', err, { ideaId });
    await ideasRepo.updateIdeaStatus(ideaId, 'extracted');
    throw Object.assign(new Error('Failed to start writing'), { statusCode: 500 });
  }
}

// ─── Error helper used by routes ───────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
