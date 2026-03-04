/**
 * Team API (client). Routes: /api/team, /api/team/[id]
 */

import { apiClient } from './client';

/** GET /api/team returns the members array directly. */
export async function listTeamMembers(): Promise<unknown[]> {
  return apiClient.get<unknown[]>('/team');
}

export async function inviteTeamMember(email: string): Promise<unknown> {
  return apiClient.post<unknown>('/team', { email });
}

export async function removeTeamMember(memberId: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/team/${memberId}`);
}
