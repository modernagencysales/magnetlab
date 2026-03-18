/**
 * Content Queue Repository.
 * Cross-team post queries for the content editing queue.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Column Constants ─────────────────────────────────────────────────────

const QUEUE_POST_COLUMNS =
  'id, draft_content, idea_id, edited_at, created_at, team_profile_id, status, review_data';

const QUEUE_POST_WITH_IDEA_COLUMNS =
  'id, draft_content, idea_id, edited_at, created_at, team_profile_id, status, review_data, cp_content_ideas(title, content_type)';

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
