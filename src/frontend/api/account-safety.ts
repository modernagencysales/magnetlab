/**
 * Account Safety Settings API (client).
 * Route: /api/settings/account-safety
 * Stub — backend routes not yet implemented.
 */

import { apiClient } from './client';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AccountSafetySettings {
  account_id: string;
  account_name: string;
  account_connected_at: string | null;
  operating_hours: {
    start: string;
    end: string;
    timezone: string;
  };
  daily_limits: {
    dms: number;
    connection_requests: number;
    connection_accepts: number;
    comments: number;
    likes: number;
  };
  action_delays: {
    min_delay_ms: number;
    max_delay_ms: number;
  };
  circuit_breaker: {
    active: boolean;
    active_until: string | null;
  } | null;
}

export interface UpdateAccountSafetyInput {
  operating_hours?: {
    start: string;
    end: string;
    timezone: string;
  };
  daily_limits?: {
    dms?: number;
    connection_requests?: number;
    connection_accepts?: number;
    comments?: number;
    likes?: number;
  };
  action_delays?: {
    min_delay_ms?: number;
    max_delay_ms?: number;
  };
}

// ─── API Calls ─────────────────────────────────────────────────────────────

export async function getAccountSafetySettings(): Promise<{
  accounts: AccountSafetySettings[];
}> {
  return apiClient.get<{ accounts: AccountSafetySettings[] }>(
    '/settings/account-safety'
  );
}

export async function updateAccountSafetySettings(
  accountId: string,
  input: UpdateAccountSafetyInput
): Promise<{ success: boolean }> {
  return apiClient.patch<{ success: boolean }>(
    `/settings/account-safety/${accountId}`,
    input
  );
}
