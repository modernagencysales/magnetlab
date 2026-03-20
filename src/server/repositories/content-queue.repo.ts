/**
 * Content Queue Repository.
 * Cross-team post queries for the content editing queue.
 * Includes lead magnet + funnel queries for the unified asset review queue.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Column Constants ─────────────────────────────────────────────────────

const QUEUE_POST_COLUMNS =
  'id, draft_content, idea_id, edited_at, created_at, team_profile_id, status, review_data, image_storage_path';

const QUEUE_POST_WITH_IDEA_COLUMNS =
  'id, draft_content, idea_id, edited_at, created_at, team_profile_id, status, review_data, image_storage_path, cp_content_ideas(title, content_type)';

// ─── Types ────────────────────────────────────────────────────────────────

export interface QueuePostReviewData {
  score: number;
  category: 'excellent' | 'good_with_edits' | 'needs_rewrite' | 'delete';
  notes: string[];
  flags: string[];
  reviewed_at: string;
}

export interface QueuePost {
  id: string;
  draft_content: string | null;
  idea_id: string | null;
  edited_at: string | null;
  created_at: string;
  team_profile_id: string | null;
  status: string;
  review_data: QueuePostReviewData | null;
  image_storage_path: string | null;
  cp_content_ideas: { title: string | null; content_type: string | null } | null;
}

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * Fetch all queue-eligible posts (draft + reviewing) across multiple team profile IDs.
 * Used by the content queue to aggregate posts across teams.
 */
export async function findQueuePostsByProfileIds(profileIds: string[]): Promise<QueuePost[]> {
  if (profileIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select(QUEUE_POST_WITH_IDEA_COLUMNS)
    .in('team_profile_id', profileIds)
    .in('status', ['draft', 'reviewing'])
    .order('created_at', { ascending: true });

  if (error) throw new Error(`content-queue.findQueuePostsByProfileIds: ${error.message}`);
  return (data ?? []) as QueuePost[];
}

/**
 * Find a single post by ID, verifying it belongs to one of the given profile IDs.
 * Returns null if not found or not accessible.
 */
export async function findPostByIdForProfiles(
  postId: string,
  profileIds: string[]
): Promise<QueuePost | null> {
  if (profileIds.length === 0) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select(QUEUE_POST_COLUMNS)
    .eq('id', postId)
    .in('team_profile_id', profileIds)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`content-queue.findPostByIdForProfiles: ${error.message}`);
  }
  return (data as QueuePost) ?? null;
}

// ─── Writes ───────────────────────────────────────────────────────────────

/**
 * Delete a post from the pipeline. Hard delete — used by queue operators.
 */
export async function deletePost(postId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cp_pipeline_posts').delete().eq('id', postId);
  if (error) throw new Error(`content-queue.deletePost: ${error.message}`);
}

/**
 * Set edited_at on a post (mark as edited by operator).
 */
export async function markPostEdited(postId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_pipeline_posts')
    .update({ edited_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) throw new Error(`content-queue.markPostEdited: ${error.message}`);
}

/**
 * Reset edited_at to null for all draft posts belonging to given profile IDs.
 * Used when client requests revisions.
 */
export async function resetEditedForProfiles(profileIds: string[]): Promise<number> {
  if (profileIds.length === 0) return 0;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .update({ edited_at: null })
    .in('team_profile_id', profileIds)
    .in('status', ['draft', 'reviewing'])
    .not('edited_at', 'is', null)
    .select('id');

  if (error) throw new Error(`content-queue.resetEditedForProfiles: ${error.message}`);
  return data?.length ?? 0;
}

// ─── Lead Magnet Column Constants ─────────────────────────────────────────

const LM_COLUMNS = 'id, title, archetype, status, reviewed_at, created_at, team_id';

// ─── Lead Magnet Types ────────────────────────────────────────────────────

export interface QueueLeadMagnet {
  id: string;
  title: string;
  archetype: string;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  team_id: string;
}

export interface QueueFunnel {
  id: string;
  slug: string;
  is_published: boolean;
  reviewed_at: string | null;
  lead_magnet_id: string;
}

// ─── Lead Magnet Reads ────────────────────────────────────────────────────

/**
 * Fetch all lead magnets for the given team IDs.
 * Returns non-archived lead magnets for the content queue.
 */
export async function findLeadMagnetsByTeamIds(teamIds: string[]): Promise<QueueLeadMagnet[]> {
  if (teamIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .select(LM_COLUMNS)
    .in('team_id', teamIds)
    .in('status', ['draft', 'published'])
    .order('created_at', { ascending: true });

  if (error) throw new Error(`content-queue.findLeadMagnetsByTeamIds: ${error.message}`);
  return (data ?? []) as QueueLeadMagnet[];
}

/**
 * Fetch funnel pages for the given lead magnet IDs.
 * Only fetches funnels with target_type = 'lead_magnet' (not library or external).
 */
export async function findFunnelsByLeadMagnetIds(lmIds: string[]): Promise<QueueFunnel[]> {
  if (lmIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, slug, is_published, reviewed_at, lead_magnet_id')
    .in('lead_magnet_id', lmIds)
    .eq('target_type', 'lead_magnet');

  if (error) throw new Error(`content-queue.findFunnelsByLeadMagnetIds: ${error.message}`);
  return (data ?? []) as QueueFunnel[];
}

// ─── Lead Magnet / Funnel Writes ──────────────────────────────────────────

/**
 * Set reviewed_at on a lead magnet.
 */
export async function markLeadMagnetReviewed(lmId: string, reviewed: boolean): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('lead_magnets')
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq('id', lmId);

  if (error) throw new Error(`content-queue.markLeadMagnetReviewed: ${error.message}`);
}

/**
 * Set reviewed_at on a funnel page.
 */
export async function markFunnelReviewed(funnelId: string, reviewed: boolean): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_pages')
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq('id', funnelId);

  if (error) throw new Error(`content-queue.markFunnelReviewed: ${error.message}`);
}

/**
 * Reset reviewed_at for all lead magnets + funnels belonging to given team IDs.
 * Used when client requests revisions on assets.
 */
export async function resetReviewedForTeams(teamIds: string[]): Promise<number> {
  if (teamIds.length === 0) return 0;

  const supabase = createSupabaseAdminClient();
  let count = 0;

  const { data: lmData, error: lmErr } = await supabase
    .from('lead_magnets')
    .update({ reviewed_at: null })
    .in('team_id', teamIds)
    .not('reviewed_at', 'is', null)
    .select('id');

  if (lmErr) throw new Error(`content-queue.resetReviewedForTeams (lm): ${lmErr.message}`);
  count += lmData?.length ?? 0;

  // Get LM IDs to reset their funnels
  const { data: lms } = await supabase.from('lead_magnets').select('id').in('team_id', teamIds);

  const lmIds = (lms ?? []).map((lm) => lm.id);
  if (lmIds.length > 0) {
    const { data: funnelData, error: funnelErr } = await supabase
      .from('funnel_pages')
      .update({ reviewed_at: null })
      .in('lead_magnet_id', lmIds)
      .eq('target_type', 'lead_magnet')
      .not('reviewed_at', 'is', null)
      .select('id');

    if (funnelErr)
      throw new Error(`content-queue.resetReviewedForTeams (funnel): ${funnelErr.message}`);
    count += funnelData?.length ?? 0;
  }

  return count;
}

/**
 * Find a lead magnet by ID, verifying it belongs to one of the given team IDs.
 */
export async function findLeadMagnetByIdForTeams(
  lmId: string,
  teamIds: string[]
): Promise<QueueLeadMagnet | null> {
  if (teamIds.length === 0) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .select(LM_COLUMNS)
    .eq('id', lmId)
    .in('team_id', teamIds)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`content-queue.findLeadMagnetByIdForTeams: ${error.message}`);
  }
  return (data as QueueLeadMagnet) ?? null;
}

/**
 * Find a funnel by ID, verifying its lead magnet belongs to one of the given team IDs.
 */
export async function findFunnelByIdForTeams(
  funnelId: string,
  teamIds: string[]
): Promise<QueueFunnel | null> {
  if (teamIds.length === 0) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('id, slug, is_published, reviewed_at, lead_magnet_id, lead_magnets!inner(team_id)')
    .eq('id', funnelId)
    .eq('target_type', 'lead_magnet')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`content-queue.findFunnelByIdForTeams: ${error.message}`);
  }
  if (!data) return null;

  // Verify team access via the joined lead_magnets.team_id
  const lmTeamId = (data.lead_magnets as unknown as { team_id: string })?.team_id;
  if (!teamIds.includes(lmTeamId)) return null;

  return {
    id: data.id,
    slug: data.slug,
    is_published: data.is_published,
    reviewed_at: data.reviewed_at,
    lead_magnet_id: data.lead_magnet_id,
  } as QueueFunnel;
}

/**
 * Update image_storage_path for a post, scoped to accessible profiles.
 */
export async function updatePostImagePath(
  postId: string,
  profileIds: string[],
  storagePath: string | null
): Promise<void> {
  if (profileIds.length === 0) {
    throw new Error('content-queue.updatePostImagePath: no accessible profiles');
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_pipeline_posts')
    .update({ image_storage_path: storagePath })
    .eq('id', postId)
    .in('team_profile_id', profileIds);

  if (error) throw new Error(`content-queue.updatePostImagePath: ${error.message}`);
}

/**
 * Check whether all draft posts for given profile IDs have been edited.
 * Returns { allEdited, uneditedCount }.
 */
export async function checkAllPostsEdited(
  profileIds: string[]
): Promise<{ allEdited: boolean; uneditedCount: number; totalCount: number }> {
  if (profileIds.length === 0) return { allEdited: true, uneditedCount: 0, totalCount: 0 };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id, edited_at')
    .in('team_profile_id', profileIds)
    .in('status', ['draft', 'reviewing']);

  if (error) throw new Error(`content-queue.checkAllPostsEdited: ${error.message}`);

  const total = data?.length ?? 0;
  const unedited = (data ?? []).filter((p) => !p.edited_at).length;
  return { allEdited: unedited === 0 && total > 0, uneditedCount: unedited, totalCount: total };
}
