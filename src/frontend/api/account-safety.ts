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

// ─── Grouped types (used by AccountSafetySettings component) ─────────────────

export interface AccountSafetySettings {
  account_id: string;
  account_name: string;
  account_connected_at: string | null;
  circuit_breaker: { active: boolean; active_until: string | null } | null;
  operating_hours: { start: string; end: string; timezone: string };
  daily_limits: {
    dms: number;
    connection_requests: number;
    connection_accepts: number;
    comments: number;
    likes: number;
  };
  action_delays: { min_delay_ms: number; max_delay_ms: number };
}

export interface UpdateAccountSafetyInput {
  operating_hours?: { start: string; end: string; timezone: string };
  daily_limits?: {
    dms: number;
    connection_requests: number;
    connection_accepts: number;
    comments: number;
    likes: number;
  };
  action_delays?: { min_delay_ms: number; max_delay_ms: number };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listAccountSettings(): Promise<{
  settings: AccountSafetySettingsResponse[];
}> {
  return apiClient.get<{ settings: AccountSafetySettingsResponse[] }>('/account-safety-settings');
}

/**
 * Fetch grouped account safety settings for the settings UI.
 * The component needs a nested shape; this fetches the flat API and maps to grouped.
 */
export async function getAccountSafetySettings(): Promise<{
  accounts: AccountSafetySettings[];
}> {
  const { settings } = await listAccountSettings();
  const accounts: AccountSafetySettings[] = settings.map((s) => ({
    account_id: s.unipileAccountId,
    account_name: s.unipileAccountId,
    account_connected_at: s.accountConnectedAt,
    circuit_breaker: s.circuitBreakerUntil
      ? { active: new Date(s.circuitBreakerUntil) > new Date(), active_until: s.circuitBreakerUntil }
      : null,
    operating_hours: {
      start: s.operatingHoursStart,
      end: s.operatingHoursEnd,
      timezone: s.timezone,
    },
    daily_limits: {
      dms: s.maxDmsPerDay,
      connection_requests: s.maxConnectionRequestsPerDay,
      connection_accepts: s.maxConnectionAcceptsPerDay,
      comments: s.maxCommentsPerDay,
      likes: s.maxLikesPerDay,
    },
    action_delays: {
      min_delay_ms: s.minActionDelayMs,
      max_delay_ms: s.maxActionDelayMs,
    },
  }));
  return { accounts };
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

/** Update grouped safety settings for the settings UI component. */
export async function updateAccountSafetySettings(
  accountId: string,
  input: UpdateAccountSafetyInput
): Promise<void> {
  const flat: SafetySettingsInput = {};
  if (input.operating_hours) {
    flat.operatingHoursStart = input.operating_hours.start;
    flat.operatingHoursEnd = input.operating_hours.end;
    flat.timezone = input.operating_hours.timezone;
  }
  if (input.daily_limits) {
    if (input.daily_limits.dms !== undefined) flat.maxDmsPerDay = input.daily_limits.dms;
    if (input.daily_limits.connection_requests !== undefined)
      flat.maxConnectionRequestsPerDay = input.daily_limits.connection_requests;
    if (input.daily_limits.connection_accepts !== undefined)
      flat.maxConnectionAcceptsPerDay = input.daily_limits.connection_accepts;
    if (input.daily_limits.comments !== undefined) flat.maxCommentsPerDay = input.daily_limits.comments;
    if (input.daily_limits.likes !== undefined) flat.maxLikesPerDay = input.daily_limits.likes;
  }
  if (input.action_delays) {
    if (input.action_delays.min_delay_ms !== undefined)
      flat.minActionDelayMs = input.action_delays.min_delay_ms;
    if (input.action_delays.max_delay_ms !== undefined)
      flat.maxActionDelayMs = input.action_delays.max_delay_ms;
  }
  await updateAccountSettings(accountId, flat);
}
