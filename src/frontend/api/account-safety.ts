/**
 * Account Safety API (client). Routes: /api/account-safety-settings/*
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AccountSafetySettingsResponse {
  id: string;
  unipileAccountId: string;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  timezone: string;
  maxDmsPerDay: number;
  maxConnectionRequestsPerDay: number;
  maxConnectionAcceptsPerDay: number;
  maxCommentsPerDay: number;
  maxLikesPerDay: number;
  minActionDelayMs: number;
  maxActionDelayMs: number;
  accountConnectedAt: string | null;
  circuitBreakerUntil: string | null;
}

export interface SafetySettingsInput {
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  timezone?: string;
  maxDmsPerDay?: number;
  maxConnectionRequestsPerDay?: number;
  maxConnectionAcceptsPerDay?: number;
  maxCommentsPerDay?: number;
  maxLikesPerDay?: number;
  minActionDelayMs?: number;
  maxActionDelayMs?: number;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listAccountSettings(): Promise<{
  settings: AccountSafetySettingsResponse[];
}> {
  return apiClient.get<{ settings: AccountSafetySettingsResponse[] }>('/account-safety-settings');
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function updateAccountSettings(
  accountId: string,
  input: SafetySettingsInput
): Promise<AccountSafetySettingsResponse> {
  return apiClient.patch<AccountSafetySettingsResponse>(
    `/account-safety-settings/${accountId}`,
    input
  );
}
