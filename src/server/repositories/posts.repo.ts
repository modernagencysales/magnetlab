/**
 * Posts Repository
 * ALL Supabase queries for cp_pipeline_posts live here.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import type { DataScope } from "@/lib/utils/team-context";
import type {
  PipelinePost,
  PostStatus,
  PolishStatus,
} from "@/lib/types/content-pipeline";

// ─── Select column sets ────────────────────────────────────────────────────

const POST_LIST_COLUMNS =
  "id, user_id, idea_id, template_id, style_id, draft_content, final_content, dm_template, cta_word, variations, status, hook_score, polish_status, polish_notes, scheduled_time, auto_publish_after, is_buffer, buffer_position, linkedin_post_id, publish_provider, lead_magnet_id, published_at, engagement_stats, review_data, team_profile_id, created_at, updated_at";

const POST_SINGLE_COLUMNS =
  "id, user_id, idea_id, template_id, style_id, draft_content, final_content, dm_template, cta_word, variations, status, hook_score, polish_status, polish_notes, scheduled_time, auto_publish_after, is_buffer, buffer_position, linkedin_post_id, publish_provider, lead_magnet_id, published_at, engagement_stats, review_data, enable_automation, automation_config, scrape_engagement, heyreach_campaign_id, last_engagement_scrape_at, engagement_scrape_count, created_at, updated_at";

// ─── Filter types ──────────────────────────────────────────────────────────

export interface PostFilters {
  status?: PostStatus | string;
  isBuffer?: boolean;
  teamProfileId?: string;
  limit?: number;
}

export interface PostUpdateInput {
  draft_content?: string | null;
  final_content?: string | null;
  dm_template?: string | null;
  cta_word?: string | null;
  status?: PostStatus;
  scheduled_time?: string | null;
  is_buffer?: boolean;
  buffer_position?: number | null;
  scrape_engagement?: boolean;
  heyreach_campaign_id?: string | null;
}

export interface PostPublishUpdate {
  status: PostStatus;
  linkedin_post_id: string | null;
  publish_provider: string;
  published_at: string;
}

export interface PostPolishUpdate {
  final_content: string;
  hook_score: number;
  polish_status: PolishStatus;
  polish_notes: string;
}

export interface EngagementConfigUpdate {
  scrape_engagement?: boolean;
  heyreach_campaign_id?: string | null;
}

export interface PostEngagementStats {
  comments: number;
  reactions: number;
  resolved: number;
  pushed: number;
}

export interface PostEngagementRow {
  id: string;
  provider_id: string;
  engagement_type: string;
  reaction_type: string | null;
  comment_text: string | null;
  first_name: string | null;
  last_name: string | null;
  linkedin_url: string | null;
  heyreach_pushed_at: string | null;
  engaged_at: string | null;
  created_at: string;
}

export interface PostEngagementData {
  config: {
    scrape_engagement: boolean;
    heyreach_campaign_id: string | null;
    last_engagement_scrape_at: string | null;
    engagement_scrape_count: number;
  };
  stats: PostEngagementStats;
  engagements: PostEngagementRow[];
}

export interface ProfileNameMap {
  [profileId: string]: { full_name: string; title: string | null };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Posts use team_profile_id for team scoping, not team_id.
 * This resolves all active profile IDs for a given team.
 */
async function getTeamProfileIds(teamId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from("team_profiles")
    .select("id")
    .eq("team_id", teamId)
    .eq("status", "active");
  return profiles?.map((p) => p.id) ?? [];
}

// ─── List queries ──────────────────────────────────────────────────────────

export async function findPosts(
  scope: DataScope,
  filters: PostFilters = {},
): Promise<PipelinePost[]> {
  const supabase = createSupabaseAdminClient();
  const { limit = 50, status, isBuffer, teamProfileId } = filters;

  let query = supabase
    .from("cp_pipeline_posts")
    .select(POST_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Posts use team_profile_id scoping, not team_id
  if (scope.type === "team" && scope.teamId) {
    const profileIds = await getTeamProfileIds(scope.teamId);
    if (profileIds.length > 0) {
      query = query.in("team_profile_id", profileIds);
    } else {
      query = query.eq("user_id", scope.userId);
    }
  } else {
    query = query.eq("user_id", scope.userId);
  }

  if (status) query = query.eq("status", status);
  if (isBuffer !== undefined) query = query.eq("is_buffer", isBuffer);
  if (teamProfileId) query = query.eq("team_profile_id", teamProfileId);

  const { data, error } = await query;
  if (error) throw new Error(`posts.findPosts: ${error.message}`);
  return (data ?? []) as unknown as PipelinePost[];
}

export async function findPostsByDateRange(
  scope: DataScope,
  start: string,
  end: string,
): Promise<PipelinePost[]> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("cp_pipeline_posts")
    .select(POST_LIST_COLUMNS)
    .not("scheduled_time", "is", null)
    .gte("scheduled_time", start)
    .lte("scheduled_time", end)
    .order("scheduled_time", { ascending: true });

  if (scope.type === "team" && scope.teamId) {
    const profileIds = await getTeamProfileIds(scope.teamId);
    if (profileIds.length > 0) {
      query = query.in("team_profile_id", profileIds);
    } else {
      query = query.eq("user_id", scope.userId);
    }
  } else {
    query = query.eq("user_id", scope.userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`posts.findPostsByDateRange: ${error.message}`);
  return (data ?? []) as unknown as PipelinePost[];
}

// ─── Single-item queries (always user-scoped — posts belong to users) ──────

export async function findPostById(
  userId: string,
  id: string,
): Promise<PipelinePost | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .select(POST_SINGLE_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

/** Minimal fetch used before updates to compute edit diffs. */
export async function findPostSnapshot(
  userId: string,
  id: string,
): Promise<{
  draft_content: string | null;
  final_content: string | null;
  team_profile_id: string | null;
} | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("cp_pipeline_posts")
    .select("draft_content, final_content, team_profile_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  return data ?? null;
}

/** Fetch needed fields for polish operation. */
export async function findPostForPolish(
  userId: string,
  id: string,
): Promise<{
  draft_content: string | null;
  final_content: string | null;
  team_profile_id: string | null;
} | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .select("draft_content, final_content, team_profile_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

/** Fetch needed fields for publish operation. */
export async function findPostForPublish(
  userId: string,
  id: string,
): Promise<{
  id: string;
  draft_content: string | null;
  final_content: string | null;
  status: PostStatus;
  lead_magnet_id: string | null;
} | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .select(
      "id, user_id, draft_content, final_content, scheduled_time, status, lead_magnet_id",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

/** Fetch needed fields for schedule operation. */
export async function findPostForSchedule(
  userId: string,
  id: string,
): Promise<{
  draft_content: string | null;
  final_content: string | null;
  status: PostStatus;
  scheduled_time: string | null;
} | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .select("id, draft_content, final_content, status, scheduled_time")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

/** Fetch needed fields for retry operation. */
export async function findPostForRetry(
  userId: string,
  id: string,
): Promise<{ id: string; status: PostStatus } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("cp_pipeline_posts")
    .select("id, status, user_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  return data ?? null;
}

/** Fetch post engagement config fields. */
export async function findPostEngagementConfig(
  userId: string,
  id: string,
): Promise<{
  scrape_engagement: boolean;
  heyreach_campaign_id: string | null;
  last_engagement_scrape_at: string | null;
  engagement_scrape_count: number;
} | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .select(
      "id, scrape_engagement, heyreach_campaign_id, last_engagement_scrape_at, engagement_scrape_count",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

// ─── Write operations ──────────────────────────────────────────────────────

export interface PostCreateInput {
  draft_content?: string | null;
  final_content?: string | null;
  dm_template?: string | null;
  cta_word?: string | null;
  variations?: unknown;
  status?: PostStatus;
  hook_score?: number | null;
  polish_status?: PolishStatus | null;
  polish_notes?: string | null;
  team_profile_id?: string | null;
}

export async function createPost(
  userId: string,
  input: PostCreateInput,
): Promise<PipelinePost> {
  const supabase = createSupabaseAdminClient();
  const row = {
    user_id: userId,
    draft_content: input.draft_content ?? null,
    final_content: input.final_content ?? null,
    dm_template: input.dm_template ?? null,
    cta_word: input.cta_word ?? null,
    variations: input.variations ?? null,
    status: input.status ?? "draft",
    hook_score: input.hook_score ?? null,
    polish_status: input.polish_status ?? null,
    polish_notes: input.polish_notes ?? null,
    team_profile_id: input.team_profile_id ?? null,
  };
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`posts.createPost: ${error.message}`);
  return data as PipelinePost;
}

/** List draft posts for external review-content (by user_id or team_profile_id). */
export async function findDraftPostsForReview(
  userId: string,
  teamProfileId?: string | null,
): Promise<Array<{ id: string; final_content: string | null; draft_content: string | null; hook_score: number | null }>> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("cp_pipeline_posts")
    .select("id, final_content, draft_content, hook_score")
    .eq("status", "draft");
  if (teamProfileId) {
    query = query.eq("team_profile_id", teamProfileId);
  } else {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query;
  if (error) throw new Error(`posts.findDraftPostsForReview: ${error.message}`);
  return (data ?? []) as Array<{ id: string; final_content: string | null; draft_content: string | null; hook_score: number | null }>;
}

/** Update post review_data by id (for external review-content). */
export async function updatePostReviewData(
  userId: string,
  postId: string,
  reviewData: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_pipeline_posts")
    .update({ review_data: reviewData })
    .eq("id", postId)
    .eq("user_id", userId);
  if (error) throw new Error(`posts.updatePostReviewData: ${error.message}`);
}

/** Bulk insert pipeline posts (for external import-posts). */
export async function insertPipelinePostsBulk(rows: Array<{
  user_id: string;
  team_profile_id: string | null;
  status: string;
  draft_content: string;
  final_content: string;
}>): Promise<Array<{ id: string; status: string }>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .insert(rows)
    .select("id, status");
  if (error) throw new Error(`posts.insertPipelinePostsBulk: ${error.message}`);
  return (data ?? []) as Array<{ id: string; status: string }>;
}

export async function updatePost(
  userId: string,
  id: string,
  updates: Record<string, unknown>,
): Promise<PipelinePost> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw new Error(`posts.updatePost: ${error.message}`);
  return data;
}

export async function deletePost(userId: string, id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_pipeline_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`posts.deletePost: ${error.message}`);
}

/** Update a lead magnet's publish state when a post is published. */
export async function updateLeadMagnetPublishState(
  userId: string,
  leadMagnetId: string,
  payload: {
    linkedin_post_id: string | null;
    publish_provider: string;
    status: string;
  },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("lead_magnets")
    .update(payload)
    .eq("id", leadMagnetId)
    .eq("user_id", userId);
}

// ─── Engagement queries ────────────────────────────────────────────────────

export async function getPostEngagementData(postId: string): Promise<{
  stats: PostEngagementStats;
  engagements: PostEngagementRow[];
}> {
  const supabase = createSupabaseAdminClient();

  const [
    { count: commentCount },
    { count: reactionCount },
    { count: resolvedCount },
    { count: pushedCount },
    { data: recentEngagements },
  ] = await Promise.all([
    supabase
      .from("cp_post_engagements")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .eq("engagement_type", "comment"),
    supabase
      .from("cp_post_engagements")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .eq("engagement_type", "reaction"),
    supabase
      .from("cp_post_engagements")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .not("linkedin_url", "is", null),
    supabase
      .from("cp_post_engagements")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId)
      .not("heyreach_pushed_at", "is", null),
    supabase
      .from("cp_post_engagements")
      .select(
        "id, provider_id, engagement_type, reaction_type, comment_text, first_name, last_name, linkedin_url, heyreach_pushed_at, engaged_at, created_at",
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    stats: {
      comments: commentCount ?? 0,
      reactions: reactionCount ?? 0,
      resolved: resolvedCount ?? 0,
      pushed: pushedCount ?? 0,
    },
    engagements: recentEngagements ?? [],
  };
}

export async function updateEngagementConfig(
  userId: string,
  id: string,
  updates: EngagementConfigUpdate,
): Promise<{
  id: string;
  scrape_engagement: boolean;
  heyreach_campaign_id: string | null;
}> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_pipeline_posts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, scrape_engagement, heyreach_campaign_id")
    .single();
  if (error) throw new Error(`posts.updateEngagementConfig: ${error.message}`);
  return data;
}

// ─── Enrichment helpers ────────────────────────────────────────────────────

export async function getProfileNameMap(
  profileIds: string[],
): Promise<ProfileNameMap> {
  if (profileIds.length === 0) return {};
  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from("team_profiles")
    .select("id, full_name, title")
    .in("id", profileIds);
  if (!profiles) return {};
  return Object.fromEntries(
    profiles.map((p) => [p.id, { full_name: p.full_name, title: p.title }]),
  );
}

/** Fetch a team profile's voice_profile for polish. */
export async function getTeamProfileVoice(
  profileId: string,
): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("team_profiles")
    .select("voice_profile")
    .eq("id", profileId)
    .single();
  return (data?.voice_profile as Record<string, unknown>) ?? null;
}
