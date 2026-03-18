/**
 * Teams API (client). Routes: /api/teams, /api/teams/profiles, /api/teams/members, /api/teams/links
 */

import { apiClient } from './client';

export interface ListTeamsResponse {
  teams?: unknown[];
  [key: string]: unknown;
}

export async function listTeams(): Promise<ListTeamsResponse> {
  return apiClient.get<ListTeamsResponse>('/teams');
}

export interface CreateTeamBody {
  name: string;
  description?: string | null;
  industry?: string | null;
  target_audience?: string | null;
  shared_goal?: string | null;
}

export async function createTeam(body: CreateTeamBody): Promise<unknown> {
  return apiClient.post<unknown>('/teams', body);
}

export interface UpdateTeamBody {
  team_id: string;
  name?: string;
  description?: string;
  industry?: string;
  target_audience?: string;
  shared_goal?: string;
}

export async function updateTeam(body: UpdateTeamBody): Promise<unknown> {
  return apiClient.patch<unknown>('/teams', body);
}

export interface CreateProfileBody {
  full_name: string;
  email?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  bio?: string | null;
  expertise_areas?: string[] | null;
  voice_profile?: Record<string, unknown> | null;
}

export interface ListProfilesResponse {
  profiles?: unknown[];
  [key: string]: unknown;
}

export async function listProfiles(): Promise<unknown[]> {
  const data = await apiClient.get<ListProfilesResponse | unknown[]>('/teams/profiles');
  if (Array.isArray(data)) return data;
  return (data as ListProfilesResponse).profiles ?? [];
}

export async function createProfile(body: CreateProfileBody): Promise<unknown> {
  return apiClient.post<unknown>('/teams/profiles', body);
}

export async function updateProfile(id: string, body: Record<string, unknown>): Promise<unknown> {
  return apiClient.patch<unknown>(`/teams/profiles/${id}`, body);
}

export async function deleteProfile(id: string): Promise<void> {
  await apiClient.delete(`/teams/profiles/${id}`);
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(teamId: string): Promise<unknown> {
  return apiClient.get(`/teams/members?team_id=${teamId}`);
}

export async function addMember(
  teamId: string,
  userId: string,
  role: string = 'member'
): Promise<unknown> {
  return apiClient.post('/teams/members', { team_id: teamId, user_id: userId, role });
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  await apiClient.delete(`/teams/members?team_id=${teamId}&user_id=${userId}`);
}

// ─── Team Links ───────────────────────────────────────────────────────────────

export async function listTeamLinks(): Promise<unknown> {
  return apiClient.get('/teams/links');
}

export async function createTeamLink(
  agencyTeamId: string,
  clientTeamId: string
): Promise<unknown> {
  return apiClient.post('/teams/links', {
    agency_team_id: agencyTeamId,
    client_team_id: clientTeamId,
  });
}

export async function deleteTeamLink(linkId: string): Promise<void> {
  await apiClient.delete(`/teams/links/${linkId}`);
}
