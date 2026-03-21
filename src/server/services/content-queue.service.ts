/**
 * Content Queue Service.
 * Business logic for the cross-team content editing queue.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import crypto from 'crypto';
import * as teamRepo from '@/server/repositories/team.repo';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError, logInfo } from '@/lib/utils/logger';
import { captureAndClassifyEdit } from '@/lib/services/edit-capture';
import * as queueRepo from '@/server/repositories/content-queue.repo';
import type { ContentQueueUpdateInput } from '@/lib/validations/content-queue';

// ─── Image Upload Constants ──────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const STORAGE_BUCKET = 'post-images';

// ─── Types ────────────────────────────────────────────────────────────────

export interface QueueTeamWritingStyle {
  name: string;
  description: string | null;
  tone_keywords: string[] | null;
  writing_rules: string[] | null;
}

export interface QueuePostReviewData {
  score: number;
  category: 'excellent' | 'good_with_edits' | 'needs_rewrite' | 'delete';
  notes: string[];
  flags: string[];
  reviewed_at: string;
}

export interface QueueTeamLeadMagnet {
  id: string;
  title: string;
  archetype: string;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  funnels: Array<{
    id: string;
    slug: string;
    is_published: boolean;
    reviewed_at: string | null;
  }>;
}

export interface QueueTeam {
  team_id: string;
  team_name: string;
  profile_name: string;
  profile_company: string;
  owner_id: string;
  writing_style: QueueTeamWritingStyle | null;
  posts: Array<{
    id: string;
    draft_content: string | null;
    idea_id: string | null;
    idea_title: string | null;
    idea_content_type: string | null;
    edited_at: string | null;
    created_at: string;
    review_data: QueuePostReviewData | null;
    image_storage_path: string | null;
  }>;
  edited_count: number;
  total_count: number;
  lead_magnets: QueueTeamLeadMagnet[];
  lm_reviewed_count: number;
  lm_total_count: number;
  funnel_reviewed_count: number;
  funnel_total_count: number;
}

export interface QueueListResult {
  teams: QueueTeam[];
  summary: {
    total_teams: number;
    total_posts: number;
    remaining: number;
    total_lead_magnets: number;
    total_funnels: number;
  };
}

export interface SubmitResult {
  success: boolean;
  dfy_callback_sent: boolean;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Build a QueueTeam entry with lead magnet + funnel counts.
 * Extracted to avoid duplication between the posts loop and the LM-only teams loop.
 */
function buildTeamEntry(
  teamId: string,
  teamName: string,
  profile: { id: string; full_name: string | null; title: string | null },
  style: QueueTeamWritingStyle | null,
  lmsByTeamId: Map<string, queueRepo.QueueLeadMagnet[]>,
  funnelsByLmId: Map<string, queueRepo.QueueFunnel[]>,
  ownerId: string
): QueueTeam {
  const teamLMs = lmsByTeamId.get(teamId) ?? [];
  const lmEntries: QueueTeamLeadMagnet[] = teamLMs.map((lm) => {
    const lmFunnels = funnelsByLmId.get(lm.id) ?? [];
    return {
      id: lm.id,
      title: lm.title,
      archetype: lm.archetype,
      status: lm.status,
      reviewed_at: lm.reviewed_at,
      created_at: lm.created_at,
      funnels: lmFunnels.map((f) => ({
        id: f.id,
        slug: f.slug,
        is_published: f.is_published,
        reviewed_at: f.reviewed_at,
      })),
    };
  });

  const lmReviewedCount = lmEntries.filter((lm) => lm.reviewed_at !== null).length;
  const allFunnels = lmEntries.flatMap((lm) => lm.funnels);
  const funnelReviewedCount = allFunnels.filter((f) => f.reviewed_at !== null).length;

  return {
    team_id: teamId,
    team_name: teamName,
    profile_name: profile.full_name ?? '',
    profile_company: profile.title ?? '',
    owner_id: ownerId,
    writing_style: style,
    posts: [],
    edited_count: 0,
    total_count: 0,
    lead_magnets: lmEntries,
    lm_reviewed_count: lmReviewedCount,
    lm_total_count: lmEntries.length,
    funnel_reviewed_count: funnelReviewedCount,
    funnel_total_count: allFunnels.length,
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * Get the content queue for a user — all draft posts across all teams they belong to,
 * grouped by team with counts.
 */
export async function getQueue(userId: string): Promise<QueueListResult> {
  const userTeams = await teamRepo.getUserTeams(userId);
  if (userTeams.length === 0) {
    return {
      teams: [],
      summary: {
        total_teams: 0,
        total_posts: 0,
        remaining: 0,
        total_lead_magnets: 0,
        total_funnels: 0,
      },
    };
  }

  const teamIds = userTeams.map((e) => e.team.id);

  // Get all active team profiles for these teams
  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id, team_id, full_name, title, user_id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  if (!profiles?.length) {
    return {
      teams: [],
      summary: {
        total_teams: 0,
        total_posts: 0,
        remaining: 0,
        total_lead_magnets: 0,
        total_funnels: 0,
      },
    };
  }

  const profileIds = profiles.map((p) => p.id);
  const posts = await queueRepo.findQueuePostsByProfileIds(profileIds);

  // Fetch lead magnets and funnels for all teams in the queue
  const leadMagnets = await queueRepo.findLeadMagnetsByTeamIds(teamIds);
  const lmIds = leadMagnets.map((lm) => lm.id);
  const funnels = await queueRepo.findFunnelsByLeadMagnetIds(lmIds);

  // Build funnel lookup: lead_magnet_id → funnels[]
  const funnelsByLmId = new Map<string, typeof funnels>();
  for (const f of funnels) {
    const existing = funnelsByLmId.get(f.lead_magnet_id) ?? [];
    existing.push(f);
    funnelsByLmId.set(f.lead_magnet_id, existing);
  }

  // Build lead magnets lookup: team_id → lead magnets[]
  const lmsByTeamId = new Map<string, typeof leadMagnets>();
  for (const lm of leadMagnets) {
    const existing = lmsByTeamId.get(lm.team_id) ?? [];
    existing.push(lm);
    lmsByTeamId.set(lm.team_id, existing);
  }

  // Fetch writing styles for these team_profile_ids (cp_writing_styles links via team_profile_id)
  // Take at most one style per profile — ordered by created_at desc so we get the most recent.
  const { data: writingStyles } = await supabase
    .from('cp_writing_styles')
    .select('id, team_profile_id, name, description, style_profile')
    .in('team_profile_id', profileIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Map profile_id → first (most recent) style found
  const styleByProfile = new Map<
    string,
    {
      name: string;
      description: string | null;
      tone_keywords: string[] | null;
      writing_rules: string[] | null;
    }
  >();
  for (const s of writingStyles ?? []) {
    if (!s.team_profile_id || styleByProfile.has(s.team_profile_id)) continue;
    const profile = s.style_profile as Record<string, unknown> | null;
    styleByProfile.set(s.team_profile_id, {
      name: s.name,
      description: s.description ?? null,
      tone_keywords: Array.isArray(profile?.tone_keywords)
        ? (profile.tone_keywords as string[])
        : null,
      writing_rules: Array.isArray(profile?.rules) ? (profile.rules as string[]) : null,
    });
  }

  // Build profile → team lookup
  const profileToTeam = new Map<string, (typeof profiles)[0]>();
  for (const p of profiles) {
    profileToTeam.set(p.id, p);
  }

  // Build team entry lookup for team names and owner IDs
  const teamEntryByTeamId = new Map(userTeams.map((e) => [e.team.id, e]));

  // Group posts by team
  const teamPostsMap = new Map<string, QueueTeam>();

  for (const post of posts) {
    const profile = post.team_profile_id ? profileToTeam.get(post.team_profile_id) : null;
    if (!profile) continue;

    const entry = teamEntryByTeamId.get(profile.team_id);
    if (!entry) continue;

    let team = teamPostsMap.get(profile.team_id);
    if (!team) {
      const style = post.team_profile_id
        ? (styleByProfile.get(post.team_profile_id) ?? null)
        : null;
      team = buildTeamEntry(
        profile.team_id,
        entry.team.name,
        profile,
        style,
        lmsByTeamId,
        funnelsByLmId,
        entry.team.owner_id
      );
      teamPostsMap.set(profile.team_id, team);
    }

    const idea = post.cp_content_ideas;
    team.posts.push({
      id: post.id,
      draft_content: post.draft_content,
      idea_id: post.idea_id,
      idea_title: idea?.title ?? null,
      idea_content_type: idea?.content_type ?? null,
      edited_at: post.edited_at,
      created_at: post.created_at,
      review_data: (post.review_data as QueuePostReviewData | null) ?? null,
      image_storage_path: post.image_storage_path ?? null,
    });
    team.total_count++;
    if (post.edited_at) team.edited_count++;
  }

  // Teams with lead magnets but no posts must still appear in the queue.
  // Iterate over lmsByTeamId and add any team not already in the map.
  for (const [lmTeamId, teamLMs] of lmsByTeamId) {
    if (teamPostsMap.has(lmTeamId)) continue;
    if (teamLMs.length === 0) continue;

    const entry = teamEntryByTeamId.get(lmTeamId);
    if (!entry) continue;

    // Find the primary profile for this team (first active profile)
    const teamProfile = profiles.find((p) => p.team_id === lmTeamId);
    if (!teamProfile) continue;

    const team = buildTeamEntry(
      lmTeamId,
      entry.team.name,
      teamProfile,
      null,
      lmsByTeamId,
      funnelsByLmId,
      entry.team.owner_id
    );
    teamPostsMap.set(lmTeamId, team);
  }

  // Sort: teams with most unedited posts first
  const teams = Array.from(teamPostsMap.values()).sort(
    (a, b) => b.total_count - b.edited_count - (a.total_count - a.edited_count)
  );

  const totalPosts = teams.reduce((sum, t) => sum + t.total_count, 0);
  const totalEdited = teams.reduce((sum, t) => sum + t.edited_count, 0);
  const totalLeadMagnets = teams.reduce((sum, t) => sum + t.lm_total_count, 0);
  const totalFunnels = teams.reduce((sum, t) => sum + t.funnel_total_count, 0);

  return {
    teams,
    summary: {
      total_teams: teams.length,
      total_posts: totalPosts,
      remaining: totalPosts - totalEdited,
      total_lead_magnets: totalLeadMagnets,
      total_funnels: totalFunnels,
    },
  };
}

// ─── Writes ───────────────────────────────────────────────────────────────

/**
 * Update a post in the content queue. Validates team membership.
 * Delegates content update to existing posts service, handles edited_at separately.
 */
export async function updateQueuePost(
  userId: string,
  postId: string,
  input: ContentQueueUpdateInput
): Promise<void> {
  // Get user's accessible profile IDs
  const userTeams = await teamRepo.getUserTeams(userId);
  const teamIds = userTeams.map((e) => e.team.id);

  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id, team_id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  const profileIds = (profiles ?? []).map((p) => p.id);

  // Verify post belongs to accessible team
  const post = await queueRepo.findPostByIdForProfiles(postId, profileIds);
  if (!post) {
    throw Object.assign(new Error('Post not found or not accessible'), { statusCode: 403 });
  }

  // Update content and/or image path if provided
  const updates: Record<string, unknown> = {};
  if (input.draft_content !== undefined) updates.draft_content = input.draft_content;
  if (input.image_storage_path !== undefined) updates.image_storage_path = input.image_storage_path;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('cp_pipeline_posts').update(updates).eq('id', postId);
    if (error) throw new Error(`content-queue.updateQueuePost: ${error.message}`);
  }

  // Mark edited — capture ONE diff: AI original → human final
  // original_content is the AI-generated text stashed by the frontend when the post was first loaded
  if (input.mark_edited) {
    await queueRepo.markPostEdited(postId);

    // Capture edit for style learning — fire-and-forget, never blocks response
    // One diff per post: AI-generated → human-edited (not incremental saves)
    // editedText: use the just-saved content if provided, otherwise read current DB state
    const editedText = input.draft_content ?? post.draft_content;
    if (input.original_content && editedText) {
      try {
        const profileEntry = (profiles ?? []).find((p) => p.id === post.team_profile_id);
        const resolvedTeamId = profileEntry?.team_id ?? '';

        if (resolvedTeamId) {
          captureAndClassifyEdit(supabase, {
            teamId: resolvedTeamId,
            profileId: post.team_profile_id,
            contentType: 'post',
            contentId: postId,
            fieldName: 'draft_content',
            originalText: input.original_content,
            editedText,
            captureAll: true,
            source: 'content_queue',
          }).catch((err) => logError('content-queue/edit-capture', err, { postId }));
        }
      } catch {
        // Edit capture must never affect the save flow
      }
    }
  }
}

/**
 * Upload an image for a queue post. Validates team membership, file type/size,
 * uploads to Supabase Storage with a safe filename, and updates the post's image path.
 */
export async function uploadQueuePostImage(
  userId: string,
  postId: string,
  file: { buffer: Buffer; type: string; name: string }
): Promise<{ imageUrl: string; storagePath: string }> {
  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw Object.assign(
      new Error(`Invalid file type: ${file.type}. Allowed types: png, jpg, jpeg, webp, gif.`),
      { statusCode: 400 }
    );
  }

  // Validate file size
  if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw Object.assign(
      new Error(
        `File too large: ${(file.buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum size is 10MB.`
      ),
      { statusCode: 400 }
    );
  }

  // Team-scoped access validation
  const userTeams = await teamRepo.getUserTeams(userId);
  const teamIds = userTeams.map((e) => e.team.id);

  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id, team_id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  const profileIds = (profiles ?? []).map((p) => p.id);

  const post = await queueRepo.findPostByIdForProfiles(postId, profileIds);
  if (!post) {
    throw Object.assign(new Error('Post not found or not accessible'), { statusCode: 403 });
  }

  // Build safe storage path — never use the client-provided filename directly
  const ext =
    file.name
      .split('.')
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, '') || 'png';
  const storagePath = `${userId}/${postId}/${crypto.randomUUID()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

  // Update post's image path via repo
  await queueRepo.updatePostImagePath(postId, profileIds, storagePath);

  return { imageUrl: urlData.publicUrl, storagePath };
}

/**
 * Delete a post from the queue. Validates the user has access to the post's team.
 */
export async function deleteQueuePost(userId: string, postId: string): Promise<void> {
  const userTeams = await teamRepo.getUserTeams(userId);
  const teamIds = userTeams.map((e) => e.team.id);

  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  const profileIds = (profiles ?? []).map((p) => p.id);

  const post = await queueRepo.findPostByIdForProfiles(postId, profileIds);
  if (!post) {
    throw Object.assign(new Error('Post not found or not accessible'), { statusCode: 403 });
  }

  await queueRepo.deletePost(postId);
}

/**
 * Submit a team's batch for review.
 * submitType='posts' (default): validates all posts are edited, fires DFY callback.
 * submitType='assets': validates all lead magnets + funnels are reviewed, fires DFY callback.
 */
export async function submitBatch(
  userId: string,
  teamId: string,
  submitType: 'posts' | 'assets' = 'posts'
): Promise<SubmitResult> {
  // Verify user has team membership
  const access = await teamRepo.hasTeamAccess(userId, teamId);
  if (!access.access) {
    throw Object.assign(new Error('Not a member of this team'), { statusCode: 403 });
  }

  const supabase = createSupabaseAdminClient();
  let automationType: string;
  let resultPayload: Record<string, unknown>;

  if (submitType === 'assets') {
    // Validate all lead magnets and their funnels are reviewed
    const lms = await queueRepo.findLeadMagnetsByTeamIds([teamId]);
    const unreviewedLMs = lms.filter((lm) => lm.reviewed_at === null);
    if (unreviewedLMs.length > 0) {
      throw Object.assign(
        new Error(
          `${unreviewedLMs.length} of ${lms.length} lead magnets have not been reviewed yet`
        ),
        { statusCode: 400 }
      );
    }

    const lmIds = lms.map((lm) => lm.id);
    let funnelCount = 0;
    if (lmIds.length > 0) {
      const funnels = await queueRepo.findFunnelsByLeadMagnetIds(lmIds);
      funnelCount = funnels.length;
      const unreviewedFunnels = funnels.filter((f) => f.reviewed_at === null);
      if (unreviewedFunnels.length > 0) {
        throw Object.assign(
          new Error(
            `${unreviewedFunnels.length} of ${funnels.length} funnels have not been reviewed yet`
          ),
          { statusCode: 400 }
        );
      }
    }

    automationType = 'asset_review';
    resultPayload = { lead_magnets_reviewed: lms.length, funnels_reviewed: funnelCount };
  } else {
    // Default: posts flow
    const { data: profiles } = await supabase
      .from('team_profiles')
      .select('id')
      .in('team_id', [teamId])
      .eq('status', 'active');

    const profileIds = (profiles ?? []).map((p) => p.id);

    const { allEdited, uneditedCount, totalCount } =
      await queueRepo.checkAllPostsEdited(profileIds);
    if (!allEdited) {
      throw Object.assign(
        new Error(`${uneditedCount} of ${totalCount} posts have not been edited yet`),
        { statusCode: 400 }
      );
    }

    automationType = 'content_editing';
    resultPayload = { posts_edited: totalCount };
  }

  // Look up DFY engagement by team owner's user_id (magnetlab_user_id)
  const team = await teamRepo.getTeamById(teamId);
  const ownerId = team?.owner_id;
  let dfyCallbackSent = false;

  try {
    const callbackUrl = process.env.GTM_SYSTEM_WEBHOOK_URL;
    const callbackSecret = process.env.GTM_SYSTEM_WEBHOOK_SECRET;

    if (callbackUrl && callbackSecret) {
      // Check if there's an active DFY engagement for this user
      // We call gtm-api's callback endpoint — it will find the engagement internally
      const response = await fetch(`${callbackUrl}/api/dfy/callbacks/automation-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': callbackSecret,
        },
        body: JSON.stringify({
          magnetlab_user_id: ownerId,
          automation_type: automationType,
          status: 'completed',
          result: resultPayload,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        dfyCallbackSent = true;
        logInfo('content-queue', 'DFY callback sent successfully', {
          teamId,
          ownerId,
          submitType,
          result: resultPayload,
        });
      } else {
        const body = await response.text().catch(() => '');
        logError('content-queue', new Error(`DFY callback failed: ${response.status}`), {
          teamId,
          ownerId,
          responseBody: body,
        });
        // Non-fatal for non-DFY teams. For DFY teams, we still return success
        // but indicate the callback wasn't sent.
      }
    }
  } catch (err) {
    logError('content-queue', err, { step: 'dfy_callback', teamId, ownerId });
  }

  return { success: true, dfy_callback_sent: dfyCallbackSent };
}

/**
 * Reset edited_at for all draft posts belonging to a user's team.
 * Called by external API when client requests revisions.
 */
export async function resetEditedPosts(userId: string): Promise<{ reset_count: number }> {
  // Find teams owned by this user
  const supabase = createSupabaseAdminClient();
  const { data: teams } = await supabase.from('teams').select('id').eq('owner_id', userId);

  if (!teams?.length) {
    return { reset_count: 0 };
  }

  const teamIds = teams.map((t) => t.id);
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  const profileIds = (profiles ?? []).map((p) => p.id);
  const count = await queueRepo.resetEditedForProfiles(profileIds);

  logInfo('content-queue', 'Reset edited posts for revision flow', { userId, resetCount: count });
  return { reset_count: count };
}

/**
 * Mark a lead magnet as reviewed. Validates team membership.
 */
export async function reviewLeadMagnet(
  userId: string,
  lmId: string,
  reviewed: boolean
): Promise<void> {
  const userTeams = await teamRepo.getUserTeams(userId);
  const teamIds = userTeams.map((e) => e.team.id);

  const lm = await queueRepo.findLeadMagnetByIdForTeams(lmId, teamIds);
  if (!lm) {
    throw Object.assign(new Error('Lead magnet not found or not accessible'), { statusCode: 403 });
  }

  await queueRepo.markLeadMagnetReviewed(lmId, reviewed);
}

/**
 * Mark a funnel as reviewed. Validates team membership.
 */
export async function reviewFunnel(
  userId: string,
  funnelId: string,
  reviewed: boolean
): Promise<void> {
  const userTeams = await teamRepo.getUserTeams(userId);
  const teamIds = userTeams.map((e) => e.team.id);

  const funnel = await queueRepo.findFunnelByIdForTeams(funnelId, teamIds);
  if (!funnel) {
    throw Object.assign(new Error('Funnel not found or not accessible'), { statusCode: 403 });
  }

  await queueRepo.markFunnelReviewed(funnelId, reviewed);
}

/**
 * Reset reviewed_at for all lead magnets + funnels belonging to a user's teams.
 * Called by external API when client requests asset revisions.
 */
export async function resetReviewedAssets(userId: string): Promise<{ reset_count: number }> {
  const supabase = createSupabaseAdminClient();
  const { data: teams } = await supabase.from('teams').select('id').eq('owner_id', userId);

  if (!teams?.length) return { reset_count: 0 };

  const teamIds = teams.map((t) => t.id);
  const count = await queueRepo.resetReviewedForTeams(teamIds);

  logInfo('content-queue', 'Reset reviewed assets for revision flow', {
    userId,
    resetCount: count,
  });
  return { reset_count: count };
}

// ─── Error Handling ───────────────────────────────────────────────────────

/** Extract HTTP status from a service error (defaults to 500). */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
