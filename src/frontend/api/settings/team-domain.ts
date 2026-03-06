/**
 * Team custom domain API (client). Routes: /api/settings/team-domain, .../verify
 */

import { apiClient } from '../client';

export async function getTeamDomain(): Promise<{ domain: unknown }> {
  return apiClient.get<{ domain: unknown }>('/settings/team-domain');
}

export async function setTeamDomain(domain: string): Promise<{
  domain: unknown;
  dnsInstructions?: unknown;
}> {
  return apiClient.post<{ domain: unknown; dnsInstructions?: unknown }>(
    '/settings/team-domain',
    { domain }
  );
}

export async function verifyTeamDomain(): Promise<{
  status?: string;
  verified: boolean;
  verification?: unknown;
}> {
  return apiClient.post<{ status?: string; verified: boolean; verification?: unknown }>(
    '/settings/team-domain/verify',
    {}
  );
}

export async function deleteTeamDomain(): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>('/settings/team-domain');
}
