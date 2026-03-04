/**
 * Team API (client). Routes: /api/team, /api/team/memberships, /api/team/[id]
 */

import { apiClient } from './client';

/** GET /api/team returns the members array directly. */
export async function listTeamMembers(): Promise<unknown[]> {
  return apiClient.get<unknown[]>('/team');
}

/** GET /api/team/memberships — team-based memberships for the current user. */
export async function getTeamMemberships(): Promise<unknown[]> {
  const data = await apiClient.get<unknown[] | { memberships?: unknown[] }>('/team/memberships');
  if (Array.isArray(data)) return data;
  return (data as { memberships?: unknown[] }).memberships ?? [];
}

/** GET /api/team/[id] — fetch team by ID (requires membership). */
export async function getTeam(teamId: string): Promise<unknown> {
  return apiClient.get<unknown>(`/team/${teamId}`);
}

export async function inviteTeamMember(email: string): Promise<unknown> {
  return apiClient.post<unknown>('/team', { email });
}

export async function removeTeamMember(memberId: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/team/${memberId}`);
}
