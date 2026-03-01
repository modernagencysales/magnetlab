/**
 * Posts Service
 * Business logic for cp_pipeline_posts.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import * as postsRepo from '@/server/repositories/posts.repo';
import { polishPost as aiPolishPost } from '@/lib/ai/content-pipeline/post-polish';
import { getUserLinkedInPublisher } from '@/lib/integrations/linkedin-publisher';
import { captureAndClassifyEdit } from '@/lib/services/edit-capture';
import { requireTeamScope } from '@/lib/utils/team-context';
import { logError } from '@/lib/utils/logger';
import type { DataScope } from '@/lib/utils/team-context';
import type { PipelinePost, PostStatus, TeamVoiceProfile } from '@/lib/types/content-pipeline';
import type {
  PostFilters,
  PostUpdateInput,
  EngagementConfigUpdate,
  PostEngagementData,
} from '@/server/repositories/posts.repo';

// ─── Response types ────────────────────────────────────────────────────────

export interface PostWithProfile extends PipelinePost {
  profile_name: string | null;
}

export interface PolishResult {
  aiPatternsFound: string[];
  hookScore: { score: number };
  changes: string[];
}

export interface PublishResult {
  success: true;
  linkedin_post_id: string | null;
  provider: string;
}

const ALLOWED_UPDATE_FIELDS: (keyof PostUpdateInput)[] = [
  'draft_content',
  'final_content',
  'dm_template',
  'cta_word',
  'status',
  'scheduled_time',
  'is_buffer',
  'buffer_position',
  'scrape_engagement',
  'heyreach_campaign_id',
];

const VALID_POST_STATUSES: PostStatus[] = [
  'draft', 'reviewing', 'approved', 'scheduled', 'published', 'failed', 'publish_failed',
];

// ─── Read operations ───────────────────────────────────────────────────────

export async function getPosts(
  scope: DataScope,
  filters: PostFilters = {},
): Promise<PostWithProfile[]> {
  const posts = await postsRepo.findPosts(scope, filters);

  // Enrich with profile display names for team mode
  const profileIds = [
    ...new Set(posts.map((p) => p.team_profile_id).filter(Boolean)),
  ] as string[];

  const profileMap =
    profileIds.length > 0 ? await postsRepo.getProfileNameMap(profileIds) : {};

  return posts.map((p) => ({
    ...p,
    profile_name: p.team_profile_id
      ? (profileMap[p.team_profile_id]?.full_name ?? null)
      : null,
  }));
}

export async function getPostsByDateRange(
  scope: DataScope,
  start: string,
  end: string,
): Promise<PipelinePost[]> {
  return postsRepo.findPostsByDateRange(scope, start, end);
}

export async function getPostById(
  userId: string,
  id: string,
): Promise<PipelinePost | null> {
  return postsRepo.findPostById(userId, id);
}

export async function getPostEngagement(
  userId: string,
  postId: string,
): Promise<PostEngagementData> {
  const config = await postsRepo.findPostEngagementConfig(userId, postId);
  if (!config) throw new Error('Post not found');

  const { stats, engagements } = await postsRepo.getPostEngagementData(postId);

  return { config, stats, engagements };
}

// ─── Write operations ──────────────────────────────────────────────────────

export async function updatePost(
  userId: string,
  postId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>,
): Promise<{ post: PipelinePost; editId: string | null }> {
  // Filter to only allowed fields
  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) {
      if (field === 'status' && !VALID_POST_STATUSES.includes(body[field])) {
        throw Object.assign(new Error('Invalid status value'), { statusCode: 400 });
      }
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), { statusCode: 400 });
  }

  // Read snapshot before update if text content is changing (for edit diff)
  const hasTextChanges = 'draft_content' in updates || 'final_content' in updates;
  const snapshot = hasTextChanges
    ? await postsRepo.findPostSnapshot(userId, postId)
    : null;

  const post = await postsRepo.updatePost(userId, postId, updates);

  // Capture edit patterns for style learning — never blocks the response
  let editId: string | null = null;
  if (snapshot && hasTextChanges) {
    try {
      const scope = await requireTeamScope(userId);
      if (scope?.teamId) {
        // TODO: Remove supabase param after edit-capture.ts is migrated to its own DB client
        const { createSupabaseAdminClient } = await import('@/lib/utils/supabase-server');
        const supabase = createSupabaseAdminClient();

        const editField = updates.final_content ? 'final_content' : 'draft_content';
        const originalText = updates.final_content
          ? snapshot.final_content
          : snapshot.draft_content;
        const editedText = updates[editField] as string;

        if (originalText && editedText) {
          editId = await captureAndClassifyEdit(supabase, {
            teamId: scope.teamId,
            profileId: snapshot.team_profile_id ?? null,
            contentType: 'post',
            contentId: postId,
            fieldName: editField,
            originalText,
            editedText,
          });
        }
      }
    } catch {
      // Edit capture must never affect the save flow
    }
  }

  return { post, editId };
}

export async function deletePost(userId: string, postId: string): Promise<void> {
  await postsRepo.deletePost(userId, postId);
}

export async function schedulePost(
  userId: string,
  postId: string,
  scheduledTime?: string,
): Promise<void> {
  const post = await postsRepo.findPostForSchedule(userId, postId);
  if (!post) throw Object.assign(new Error('Post not found'), { statusCode: 404 });

  const content = post.final_content || post.draft_content;
  if (!content) {
    throw Object.assign(new Error('Post has no content to schedule'), { statusCode: 400 });
  }

  const scheduleTime = scheduledTime || post.scheduled_time || new Date().toISOString();

  await postsRepo.updatePost(userId, postId, {
    status: 'scheduled',
    scheduled_time: scheduleTime,
  });
}

export async function polishPost(
  userId: string,
  postId: string,
): Promise<PolishResult> {
  const post = await postsRepo.findPostForPolish(userId, postId);
  if (!post) throw Object.assign(new Error('Post not found'), { statusCode: 404 });

  const content = post.final_content || post.draft_content;
  if (!content) {
    throw Object.assign(new Error('No content to polish'), { statusCode: 400 });
  }

  // Fetch voice profile if associated with a team profile
  let voiceProfile: TeamVoiceProfile | undefined;
  if (post.team_profile_id) {
    const raw = await postsRepo.getTeamProfileVoice(post.team_profile_id);
    if (raw) voiceProfile = raw as TeamVoiceProfile;
  }

  const result = await aiPolishPost(content, { voiceProfile });

  const updated = await postsRepo.updatePost(userId, postId, {
    final_content: result.polished,
    hook_score: result.hookScore.score,
    polish_status: result.changes.length > 0 ? 'polished' : 'skipped',
    polish_notes:
      result.changes.length > 0 ? result.changes.join('; ') : 'No changes needed',
  });

  if (!updated) {
    throw Object.assign(new Error('Post not found or not updated'), { statusCode: 404 });
  }

  return {
    aiPatternsFound: result.aiPatternsFound,
    hookScore: result.hookScore,
    changes: result.changes,
  };
}

export async function publishPost(
  userId: string,
  postId: string,
): Promise<PublishResult> {
  const post = await postsRepo.findPostForPublish(userId, postId);
  if (!post) throw Object.assign(new Error('Post not found'), { statusCode: 404 });

  const content = post.final_content || post.draft_content;
  if (!content) {
    throw Object.assign(new Error('No content to publish'), { statusCode: 400 });
  }

  const publisher = await getUserLinkedInPublisher(userId);
  if (!publisher) {
    throw Object.assign(
      new Error('No LinkedIn publisher configured. Go to Settings → Integrations to connect your account.'),
      { statusCode: 400 },
    );
  }

  const result = await publisher.publishNow(content);
  const publishedAt = new Date().toISOString();

  await postsRepo.updatePost(userId, postId, {
    status: 'published',
    linkedin_post_id: result.postId ?? null,
    publish_provider: result.provider,
    published_at: publishedAt,
  });

  // If the post is linked to a lead magnet, update that too
  if (post.lead_magnet_id) {
    await postsRepo.updateLeadMagnetPublishState(userId, post.lead_magnet_id, {
      linkedin_post_id: result.postId ?? null,
      publish_provider: result.provider,
      status: 'published',
    });
  }

  return {
    success: true,
    linkedin_post_id: result.postId ?? null,
    provider: result.provider,
  };
}

export async function retryPost(userId: string, postId: string): Promise<void> {
  const post = await postsRepo.findPostForRetry(userId, postId);
  if (!post) throw Object.assign(new Error('Post not found'), { statusCode: 404 });

  if (post.status !== 'publish_failed') {
    throw Object.assign(
      new Error('Only failed posts can be retried'),
      { statusCode: 400 },
    );
  }

  await postsRepo.updatePost(userId, postId, {
    status: 'scheduled',
    error_log: null,
    scheduled_time: new Date().toISOString(),
  });
}

export async function updatePostEngagementConfig(
  userId: string,
  postId: string,
  body: Record<string, unknown>,
): Promise<{ id: string; scrape_engagement: boolean; heyreach_campaign_id: string | null }> {
  const updates: EngagementConfigUpdate = {};

  if ('scrape_engagement' in body && typeof body.scrape_engagement === 'boolean') {
    updates.scrape_engagement = body.scrape_engagement;
  }
  if ('heyreach_campaign_id' in body) {
    const val = body.heyreach_campaign_id;
    if (val && (typeof val !== 'string' || !/^\d+$/.test(val as string))) {
      throw Object.assign(
        new Error('heyreach_campaign_id must be a numeric string'),
        { statusCode: 400 },
      );
    }
    updates.heyreach_campaign_id = (val as string) || null;
  }

  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), { statusCode: 400 });
  }

  // Verify post ownership before updating
  const config = await postsRepo.findPostEngagementConfig(userId, postId);
  if (!config) throw Object.assign(new Error('Post not found'), { statusCode: 404 });

  return postsRepo.updateEngagementConfig(userId, postId, updates);
}

// ─── Error helper used by routes ───────────────────────────────────────────

/** Extract HTTP status from a service error (defaults to 500). */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
