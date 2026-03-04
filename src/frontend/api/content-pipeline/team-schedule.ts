/**
 * Content pipeline team schedule / command center API (client).
 */

import { apiClient } from '../client';

export async function getTeamSchedule(params: { team_id: string; week_start?: string | null }): Promise<Record<string, unknown>> {
  const searchParams = new URLSearchParams({ team_id: params.team_id });
  if (params.week_start) searchParams.set('week_start', params.week_start);
  return apiClient.get<Record<string, unknown>>(`/content-pipeline/team-schedule?${searchParams.toString()}`);
}

export async function assignPost(body: {
  post_id: string;
  scheduled_time: string;
  team_profile_id?: string;
}): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>('/content-pipeline/team-schedule/assign', body);
}
