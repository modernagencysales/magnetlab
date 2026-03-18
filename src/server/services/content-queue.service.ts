/**
 * Content Queue Service.
 * Business logic for the cross-team content editing queue.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import * as teamRepo from '@/server/repositories/team.repo';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError, logInfo } from '@/lib/utils/logger';
import { captureAndClassifyEdit } from '@/lib/services/edit-capture';
import * as queueRepo from '@/server/repositories/content-queue.repo';
import type { ContentQueueUpdateInput } from '@/lib/validations/content-queue';

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
    image_urls: string[] | null;
  }>;
  edited_count: number;
  total_count: number;
}

export interface QueueListResult {
  teams: QueueTeam[];
  summary: {
    total_teams: number;
    total_posts: number;
    remaining: number;
  };
}

export interface SubmitResult {
  success: boolean;
  dfy_callback_sent: boolean;
  error?: string;
}

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * Get the content queue for a user — all draft posts across all teams they belong to,
 * grouped by team with counts.
 */
export async function getQueue(userId: string): Promise<QueueListResult> {
  const userTeams = await teamRepo.getUserTeams(userId);
  if (userTeams.length === 0) {
    return { teams: [], summary: { total_teams: 0, total_posts: 0, remaining: 0 } };
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
    return { teams: [], summary: { total_teams: 0, total_posts: 0, remaining: 0 } };
  }

  const profileIds = profiles.map((p) => p.id);
  const posts = await queueRepo.findQueuePostsByProfileIds(profileIds);

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
      team = {
        team_id: profile.team_id,
        team_name: entry.team.name,
        profile_name: profile.full_name ?? '',
        profile_company: profile.title ?? '',
        owner_id: entry.team.owner_id,
        writing_style: style,
        posts: [],
        edited_count: 0,
        total_count: 0,
      };
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
      image_urls: post.image_urls ?? null,
    });
    team.total_count++;
    if (post.edited_at) team.edited_count++;
  }

  // Sort: teams with most unedited posts first
  const teams = Array.from(teamPostsMap.values()).sort(
    (a, b) => b.total_count - b.edited_count - (a.total_count - a.edited_count)
  );

  const totalPosts = teams.reduce((sum, t) => sum + t.total_count, 0);
  const totalEdited = teams.reduce((sum, t) => sum + t.edited_count, 0);

  return {
    teams,
    summary: {
      total_teams: teams.length,
      total_posts: totalPosts,
      remaining: totalPosts - totalEdited,
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

  // Update content if provided
  if (input.draft_content !== undefined) {
    // Read pre-update snapshot for edit capture (style learning)
    const originalContent = post.draft_content;

    const updates: Record<string, unknown> = {};
    if (input.draft_content !== undefined) updates.draft_content = input.draft_content;

    const { error } = await supabase.from('cp_pipeline_posts').update(updates).eq('id', postId);

    if (error) throw new Error(`content-queue.updateQueuePost: ${error.message}`);

    // Capture edit for style learning — fire-and-forget, never blocks response
    // captureAll: true — professional editor edits, every change is signal (no 5% threshold)
    // source: 'content_queue' — distinguishes DFY editor edits from self-edits
    // profileId: post's team_profile_id — learns the CLIENT's voice, not the operator's
    if (originalContent && input.draft_content) {
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
            originalText: originalContent,
            editedText: input.draft_content,
            captureAll: true,
            source: 'content_queue',
          }).catch((err) => logError('content-queue/edit-capture', err, { postId }));
        }
      } catch {
        // Edit capture must never affect the save flow
      }
    }
  }

  // Mark edited if requested
  if (input.mark_edited) {
    await queueRepo.markPostEdited(postId);
  }
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
 * Validates all posts are edited, fires DFY callback if engagement exists.
 */
export async function submitBatch(userId: string, teamId: string): Promise<SubmitResult> {
  // Verify user has team membership
  const access = await teamRepo.hasTeamAccess(userId, teamId);
  if (!access.access) {
    throw Object.assign(new Error('Not a member of this team'), { statusCode: 403 });
  }

  // Get team's profile IDs
  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id')
    .in('team_id', [teamId])
    .eq('status', 'active');

  const profileIds = (profiles ?? []).map((p) => p.id);

  // Check all posts are edited
  const { allEdited, uneditedCount, totalCount } = await queueRepo.checkAllPostsEdited(profileIds);
  if (!allEdited) {
    throw Object.assign(
      new Error(`${uneditedCount} of ${totalCount} posts have not been edited yet`),
      { statusCode: 400 }
    );
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
          automation_type: 'content_editing',
          status: 'completed',
          result: { posts_edited: totalCount },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        dfyCallbackSent = true;
        logInfo('content-queue', 'DFY callback sent successfully', { teamId, ownerId, totalCount });
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

// ─── Error Handling ───────────────────────────────────────────────────────

/** Extract HTTP status from a service error (defaults to 500). */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
