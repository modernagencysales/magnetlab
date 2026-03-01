/**
 * Content Pipeline Team Schedule Service
 * Get schedule for a team; assign post to slot.
 */

import { startOfWeek, endOfWeek, parseISO, format } from 'date-fns';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { verifyTeamMembership } from '@/lib/services/team-integrations';
import { detectContentCollisions } from '@/lib/ai/content-pipeline/collision-detector';
import type { PostForCollision } from '@/lib/ai/content-pipeline/collision-detector';
import * as cpTeamScheduleRepo from '@/server/repositories/cp-team-schedule.repo';

function buildLinkedInConnectedMap(
  profiles: { id: string; user_id: string | null }[],
  teamIntegrations: { team_profile_id: string; is_active: boolean; metadata: unknown }[],
  userIntegrations: { user_id: string; is_active: boolean; metadata: unknown }[]
): Map<string, boolean> {
  const integrationMap = new Map<string, boolean>();
  for (const ti of teamIntegrations) {
    if (ti.is_active) {
      const accountId = (ti.metadata as Record<string, unknown>)?.unipile_account_id;
      if (typeof accountId === 'string') {
        integrationMap.set(ti.team_profile_id, true);
      }
    }
  }
  const userIntegrationMap = new Map<string, boolean>();
  for (const ui of userIntegrations) {
    if (ui.is_active) {
      const accountId = (ui.metadata as Record<string, unknown>)?.unipile_account_id;
      if (typeof accountId === 'string') {
        userIntegrationMap.set(ui.user_id, true);
      }
    }
  }
  for (const profile of profiles) {
    if (profile.user_id && !integrationMap.has(profile.id) && userIntegrationMap.has(profile.user_id)) {
      integrationMap.set(profile.id, true);
    }
  }
  return integrationMap;
}

export type TeamScheduleData = {
  profiles: unknown[];
  posts: unknown[];
  slots: unknown[];
  buffer_posts: unknown[];
  week_start: string | null;
  week_end: string | null;
  collisions: unknown;
};

export async function getTeamSchedule(
  teamId: string,
  userId: string,
  weekStartParam: string | null
): Promise<
  | { success: true; data: TeamScheduleData }
  | { success: false; error: string; status: number }
> {
  const supabase = createSupabaseAdminClient();
  const memberCheck = await verifyTeamMembership(supabase, teamId, userId);
  if (!memberCheck.authorized) {
    return { success: false, error: memberCheck.error, status: memberCheck.status };
  }

  const { data: profiles, error: profilesError } = await cpTeamScheduleRepo.getActiveProfiles(teamId);
  if (profilesError) {
    return { success: false, error: profilesError.message, status: 500 };
  }
  if (!profiles || profiles.length === 0) {
    return {
      success: true,
      data: {
        profiles: [],
        posts: [],
        slots: [],
        buffer_posts: [],
        week_start: null,
        week_end: null,
        collisions: null,
      },
    };
  }

  const profileIds = profiles.map((p) => p.id);
  const baseDate = weekStartParam ? parseISO(weekStartParam) : new Date();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });

  const [postsResult, slotsResult, bufferResult, teamIntResult] = await Promise.all([
    cpTeamScheduleRepo.getPostsForWeek(profileIds, weekStart.toISOString(), weekEnd.toISOString()),
    cpTeamScheduleRepo.getSlots(profileIds),
    cpTeamScheduleRepo.getBufferPosts(profileIds),
    cpTeamScheduleRepo.getTeamProfileIntegrations(profileIds),
  ]);

  if (postsResult.error) {
    return { success: false, error: postsResult.error.message, status: 500 };
  }
  if (slotsResult.error) {
    return { success: false, error: slotsResult.error.message, status: 500 };
  }
  if (bufferResult.error) {
    return { success: false, error: bufferResult.error.message, status: 500 };
  }

  const teamOnlyMap = new Map<string, boolean>();
  for (const ti of teamIntResult.data ?? []) {
    if (ti.is_active) {
      const accountId = (ti.metadata as Record<string, unknown>)?.unipile_account_id;
      if (typeof accountId === 'string') teamOnlyMap.set(ti.team_profile_id, true);
    }
  }
  const userIds = profiles
    .filter((p) => p.user_id && !teamOnlyMap.has(p.id))
    .map((p) => p.user_id as string);
  const { data: userIntegrations } = await cpTeamScheduleRepo.getUserIntegrationsUnipile(userIds);

  const integrationMap = buildLinkedInConnectedMap(
    profiles,
    teamIntResult.data ?? [],
    userIntegrations
  );
  const enrichedProfiles = profiles.map((p) => ({
    ...p,
    linkedin_connected: integrationMap.has(p.id),
  }));

  let collisions: Awaited<ReturnType<typeof detectContentCollisions>> | null = null;
  const posts = postsResult.data ?? [];
  if (posts.length >= 2) {
    try {
      const profileNameMap = new Map(profiles.map((p) => [p.id, p.full_name || 'Unknown']));
      const postsForCollision: PostForCollision[] = posts
        .map((p) => ({
          id: p.id,
          profile_name: profileNameMap.get(p.team_profile_id) || 'Unknown',
          content: ((p.final_content || p.draft_content) ?? '').slice(0, 500),
          scheduled_date: p.scheduled_time ? format(new Date(p.scheduled_time), 'yyyy-MM-dd') : '',
        }))
        .filter((p) => p.scheduled_date && p.content);
      if (postsForCollision.length >= 2) {
        collisions = await detectContentCollisions(postsForCollision);
      }
    } catch (err) {
      logError('cp/team-schedule', err, { step: 'collision_detection_error' });
    }
  }

  return {
    success: true,
    data: {
      profiles: enrichedProfiles,
      posts,
      slots: slotsResult.data ?? [],
      buffer_posts: bufferResult.data ?? [],
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      collisions,
    },
  };
}

export async function assignPost(
  userId: string,
  postId: string,
  scheduledTime: string,
  teamProfileId?: string
): Promise<
  | { success: true }
  | { success: false; error: string; status: number }
> {
  const { data: post, error: postError } = await cpTeamScheduleRepo.getPostById(postId);
  if (postError || !post) {
    return { success: false, error: 'Post not found', status: 404 };
  }

  const profileIdForAuth = teamProfileId ?? post.team_profile_id;
  if (profileIdForAuth) {
    const { data: teamId } = await cpTeamScheduleRepo.getTeamIdByProfileId(profileIdForAuth);
    if (teamId) {
      const supabase = createSupabaseAdminClient();
      const memberCheck = await verifyTeamMembership(supabase, teamId, userId);
      if (!memberCheck.authorized) {
        return { success: false, error: memberCheck.error, status: memberCheck.status };
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    scheduled_time: scheduledTime,
    status: 'scheduled',
    is_buffer: false,
  };
  if (teamProfileId) {
    updatePayload.team_profile_id = teamProfileId;
  }

  const { error: updateError } = await cpTeamScheduleRepo.updatePostSchedule(postId, updatePayload as { scheduled_time: string; status: string; is_buffer: boolean; team_profile_id?: string });
  if (updateError) {
    return { success: false, error: updateError.message, status: 500 };
  }
  return { success: true };
}
