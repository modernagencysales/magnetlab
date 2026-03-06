/**
 * Content Pipeline Broadcast Repository
 * Lookup source post and team for auth.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function getSourcePostTeamProfile(sourcePostId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('team_profile_id')
    .eq('id', sourcePostId)
    .single();
  return { data, error };
}

export async function getTeamIdByProfileId(teamProfileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('team_profiles')
    .select('team_id')
    .eq('id', teamProfileId)
    .single();
  return { data: data?.team_id ?? null, error };
}
