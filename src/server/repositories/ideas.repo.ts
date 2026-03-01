/**
 * Ideas Repository
 * ALL Supabase queries for cp_content_ideas live here.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { DataScope } from '@/lib/utils/team-context';
import type { ContentIdea, IdeaStatus } from '@/lib/types/content-pipeline';

// ─── Select column sets ────────────────────────────────────────────────────

const IDEA_COLUMNS =
  'id, user_id, transcript_id, title, core_insight, why_post_worthy, full_context, content_type, content_pillar, relevance_score, composite_score, hook, key_points, source_quote, target_audience, status, team_profile_id, created_at, updated_at';

// ─── Filter types ──────────────────────────────────────────────────────────

export interface IdeaFilters {
  status?: IdeaStatus | string;
  pillar?: string;
  contentType?: string;
  teamProfileId?: string;
  limit?: number;
}

export interface IdeaUpdateInput {
  status?: IdeaStatus;
  title?: string;
  content_pillar?: string;
  content_type?: string;
  core_insight?: string;
  why_post_worthy?: string;
  full_context?: string;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

async function getTeamProfileIds(teamId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id')
    .eq('team_id', teamId)
    .eq('status', 'active');
  return profiles?.map((p) => p.id) ?? [];
}

// ─── List queries ──────────────────────────────────────────────────────────

export async function findIdeas(
  scope: DataScope,
  filters: IdeaFilters = {},
): Promise<ContentIdea[]> {
  const supabase = createSupabaseAdminClient();
  const { limit = 50, status, pillar, contentType, teamProfileId } = filters;

  let query = supabase
    .from('cp_content_ideas')
    .select(IDEA_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (scope.type === 'team' && scope.teamId) {
    const profileIds = await getTeamProfileIds(scope.teamId);
    if (profileIds.length > 0) {
      query = query.in('team_profile_id', profileIds);
    } else {
      query = query.eq('user_id', scope.userId);
    }
  } else {
    query = query.eq('user_id', scope.userId);
  }

  if (status) query = query.eq('status', status);
  if (pillar) query = query.eq('content_pillar', pillar);
  if (contentType) query = query.eq('content_type', contentType);
  if (teamProfileId) query = query.eq('team_profile_id', teamProfileId);

  const { data, error } = await query;
  if (error) throw new Error(`ideas.findIdeas: ${error.message}`);
  return (data ?? []) as unknown as ContentIdea[];
}

// ─── Single-item queries ───────────────────────────────────────────────────

export async function findIdeaById(
  scope: DataScope,
  id: string,
): Promise<ContentIdea | null> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('cp_content_ideas')
    .select(IDEA_COLUMNS)
    .eq('id', id);

  if (scope.type === 'team' && scope.teamId) {
    const profileIds = await getTeamProfileIds(scope.teamId);
    if (profileIds.length > 0) {
      query = query.in('team_profile_id', profileIds);
    } else {
      query = query.eq('user_id', scope.userId);
    }
  } else {
    query = query.eq('user_id', scope.userId);
  }

  const { data, error } = await query.single();
  if (error) return null;
  return data as unknown as ContentIdea;
}

/** Fetch an idea with only the fields needed for write-post flow. */
export async function findIdeaForWrite(
  scope: DataScope,
  id: string,
): Promise<{ id: string; user_id: string; status: IdeaStatus; team_profile_id: string | null } | null> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('cp_content_ideas')
    .select('id, user_id, status, team_profile_id')
    .eq('id', id);

  if (scope.type === 'team' && scope.teamId) {
    const profileIds = await getTeamProfileIds(scope.teamId);
    if (profileIds.length > 0) {
      query = query.in('team_profile_id', profileIds);
    } else {
      query = query.eq('user_id', scope.userId);
    }
  } else {
    query = query.eq('user_id', scope.userId);
  }

  const { data } = await query.single();
  return data ?? null;
}

// ─── Write operations ──────────────────────────────────────────────────────

export async function updateIdea(
  scope: DataScope,
  id: string,
  updates: Record<string, unknown>,
): Promise<ContentIdea> {
  const supabase = createSupabaseAdminClient();

  // Verify access before updating
  const accessible = await findIdeaById(scope, id);
  if (!accessible) throw Object.assign(new Error('Idea not found'), { statusCode: 404 });

  const { data, error } = await supabase
    .from('cp_content_ideas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`ideas.updateIdea: ${error.message}`);
  return data as unknown as ContentIdea;
}

export async function updateIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('cp_content_ideas').update({ status }).eq('id', id);
}

export async function deleteIdea(scope: DataScope, id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Verify access before deleting
  const accessible = await findIdeaById(scope, id);
  if (!accessible) throw Object.assign(new Error('Idea not found'), { statusCode: 404 });

  const { error } = await supabase.from('cp_content_ideas').delete().eq('id', id);
  if (error) throw new Error(`ideas.deleteIdea: ${error.message}`);
}

// ─── Enrichment helpers ────────────────────────────────────────────────────

export async function getProfileNameMapForIdeas(
  profileIds: string[],
): Promise<Record<string, string>> {
  if (profileIds.length === 0) return {};
  const supabase = createSupabaseAdminClient();
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id, full_name')
    .in('id', profileIds);
  if (!profiles) return {};
  return Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));
}

/** Fetch the team_id for a given profile — used by the write-post trigger. */
export async function getTeamIdForProfile(profileId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('team_profiles')
    .select('team_id')
    .eq('id', profileId)
    .single();
  return data?.team_id ?? null;
}
