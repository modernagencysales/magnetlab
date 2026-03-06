/**
 * Team email domain API (client). Routes: /api/settings/team-email-domain, .../verify, .../from-email
 */

import { apiClient } from '../client';

export async function getTeamEmailDomain(): Promise<{ emailDomain: unknown }> {
  return apiClient.get<{ emailDomain: unknown }>('/settings/team-email-domain');
}

export async function setTeamEmailDomain(domain: string): Promise<{
  emailDomain: unknown;
  dnsRecords?: unknown;
}> {
  return apiClient.post<{ emailDomain: unknown; dnsRecords?: unknown }>(
    '/settings/team-email-domain',
    { domain }
  );
}

export async function verifyTeamEmailDomain(): Promise<{
  status?: string;
  verified: boolean;
  records?: unknown;
}> {
  return apiClient.post<{ status?: string; verified: boolean; records?: unknown }>(
    '/settings/team-email-domain/verify',
    {}
  );
}

export async function deleteTeamEmailDomain(): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>('/settings/team-email-domain');
}

export async function setTeamFromEmail(fromEmail: string): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(
    '/settings/team-email-domain/from-email',
    { fromEmail }
  );
}
