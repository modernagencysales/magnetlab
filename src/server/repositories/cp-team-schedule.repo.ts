/**
 * Content Pipeline Team Schedule Repository
 * team_profiles, cp_pipeline_posts, cp_posting_slots, team_profile_integrations, user_integrations.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function getActiveProfiles(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .select('id, full_name, title, avatar_url, role, linkedin_url, user_id')
    .eq('team_id', teamId)
    .eq('status', 'active')
    .order('is_default', { ascending: false });
  return { data, error };
}

export async function getPostsForWeek(
  profileIds: string[],
  weekStart: string,
  weekEnd: string
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id, team_profile_id, status, scheduled_time, draft_content, final_content, broadcast_group_id, is_buffer, buffer_position, auto_publish_after, created_at')
    .in('team_profile_id', profileIds)
    .in('status', ['draft', 'reviewing', 'approved', 'scheduled'])
    .gte('scheduled_time', weekStart)
    .lte('scheduled_time', weekEnd);
  return { data, error };
}

export async function getSlots(profileIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_posting_slots')
    .select('id, user_id, slot_number, day_of_week, time_of_day, timezone, is_active, team_profile_id')
    .in('team_profile_id', profileIds)
    .eq('is_active', true);
  return { data, error };
}

export async function getBufferPosts(profileIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id, team_profile_id, status, scheduled_time, draft_content, final_content, broadcast_group_id, is_buffer, buffer_position, auto_publish_after, created_at')
    .in('team_profile_id', profileIds)
    .eq('is_buffer', true)
    .in('status', ['approved', 'reviewing'])
    .order('buffer_position', { ascending: true })
    .limit(50);
  return { data, error };
}

export async function getTeamProfileIntegrations(profileIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profile_integrations')
    .select('team_profile_id, is_active, metadata')
    .in('team_profile_id', profileIds)
    .eq('service', 'unipile');
  return { data, error };
}

export async function getUserIntegrationsUnipile(userIds: string[]) {
  if (userIds.length === 0) return { data: [] as { user_id: string; is_active: boolean; metadata: unknown }[], error: null };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_integrations')
    .select('user_id, is_active, metadata')
    .in('user_id', userIds)
    .eq('service', 'unipile');
  return { data: data ?? [], error };
}

export async function getPostById(postId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id, team_profile_id')
    .eq('id', postId)
    .single();
  return { data, error };
}

export async function getTeamIdByProfileId(profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .select('team_id')
    .eq('id', profileId)
    .single();
  return { data: data?.team_id ?? null, error };
}

export async function updatePostSchedule(
  postId: string,
  payload: { scheduled_time: string; status: string; is_buffer: boolean; team_profile_id?: string }
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_pipeline_posts')
    .update(payload)
    .eq('id', postId);
  return { error };
}
