/**
 * Account Safety Service.
 * Business logic for per-account safety settings: operating hours, daily limits,
 * warm-up ramp, circuit breaker, randomized delays.
 * Never imports route-layer modules (NextRequest, NextResponse, cookies).
 */

import * as safetyRepo from '@/server/repositories/account-safety.repo';
import { SAFETY_DEFAULTS, HIGH_RISK_ACTIONS } from '@/lib/types/post-campaigns';
import type {
  AccountSafetySettings,
  SafetyLimitsInput,
  ActionType,
} from '@/lib/types/post-campaigns';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DailyLimitCheck {
  allowed: boolean;
  used: number;
  limit: number;
}

// ─── Row → Domain Transform ──────────────────────────────────────────────────

function toSettings(row: safetyRepo.SafetySettingsRow): AccountSafetySettings {
  return {
    id: row.id,
    userId: row.user_id,
    unipileAccountId: row.unipile_account_id,
    operatingHoursStart: row.operating_hours_start,
    operatingHoursEnd: row.operating_hours_end,
    timezone: row.timezone,
    maxDmsPerDay: row.max_dms_per_day,
    maxConnectionRequestsPerDay: row.max_connection_requests_per_day,
    maxConnectionAcceptsPerDay: row.max_connection_accepts_per_day,
    maxCommentsPerDay: row.max_comments_per_day,
    maxLikesPerDay: row.max_likes_per_day,
    minActionDelayMs: row.min_action_delay_ms,
    maxActionDelayMs: row.max_action_delay_ms,
    accountConnectedAt: row.account_connected_at,
    circuitBreakerUntil: row.circuit_breaker_until,
  };
}

function buildDefaults(userId: string, accountId: string): AccountSafetySettings {
  return {
    id: '',
    userId,
    unipileAccountId: accountId,
    operatingHoursStart: SAFETY_DEFAULTS.operatingHoursStart,
    operatingHoursEnd: SAFETY_DEFAULTS.operatingHoursEnd,
    timezone: SAFETY_DEFAULTS.timezone,
    maxDmsPerDay: SAFETY_DEFAULTS.maxDmsPerDay,
    maxConnectionRequestsPerDay: SAFETY_DEFAULTS.maxConnectionRequestsPerDay,
    maxConnectionAcceptsPerDay: SAFETY_DEFAULTS.maxConnectionAcceptsPerDay,
    maxCommentsPerDay: SAFETY_DEFAULTS.maxCommentsPerDay,
    maxLikesPerDay: SAFETY_DEFAULTS.maxLikesPerDay,
    minActionDelayMs: SAFETY_DEFAULTS.minActionDelayMs,
    maxActionDelayMs: SAFETY_DEFAULTS.maxActionDelayMs,
    accountConnectedAt: null,
    circuitBreakerUntil: null,
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getAccountSettings(
  userId: string,
  accountId: string
): Promise<AccountSafetySettings> {
  const row = await safetyRepo.findByAccountId(userId, accountId);
  if (!row) return buildDefaults(userId, accountId);
  return toSettings(row);
}

export async function getAllAccountSettings(userId: string): Promise<AccountSafetySettings[]> {
  const rows = await safetyRepo.findAllByUser(userId);
  return rows.map(toSettings);
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function updateAccountSettings(
  userId: string,
  accountId: string,
  input: SafetyLimitsInput
): Promise<AccountSafetySettings> {
  const dbInput: safetyRepo.SafetyUpsertInput = {};

  if (input.operatingHoursStart !== undefined)
    dbInput.operating_hours_start = input.operatingHoursStart;
  if (input.operatingHoursEnd !== undefined) dbInput.operating_hours_end = input.operatingHoursEnd;
  if (input.timezone !== undefined) dbInput.timezone = input.timezone;
  if (input.maxDmsPerDay !== undefined) dbInput.max_dms_per_day = input.maxDmsPerDay;
  if (input.maxConnectionRequestsPerDay !== undefined)
    dbInput.max_connection_requests_per_day = input.maxConnectionRequestsPerDay;
  if (input.maxConnectionAcceptsPerDay !== undefined)
    dbInput.max_connection_accepts_per_day = input.maxConnectionAcceptsPerDay;
  if (input.maxCommentsPerDay !== undefined) dbInput.max_comments_per_day = input.maxCommentsPerDay;
  if (input.maxLikesPerDay !== undefined) dbInput.max_likes_per_day = input.maxLikesPerDay;
  if (input.minActionDelayMs !== undefined) dbInput.min_action_delay_ms = input.minActionDelayMs;
  if (input.maxActionDelayMs !== undefined) dbInput.max_action_delay_ms = input.maxActionDelayMs;

  const row = await safetyRepo.upsert(userId, accountId, dbInput);
  return toSettings(row);
}

// ─── Effective Limit (warm-up ramp) ──────────────────────────────────────────

/**
 * Returns the effective daily limit for a given action type, applying warm-up
 * ramp for HIGH_RISK_ACTIONS:
 * - Week 1 (0-6 days since connected): 50% of configured limit
 * - Week 2 (7-13 days): 75% of configured limit
 * - Week 3+ (14+ days) or no connected date: 100% of configured limit
 *
 * Non-high-risk actions always return 100% of configured limit.
 */
export function getEffectiveLimit(settings: AccountSafetySettings, actionType: ActionType): number {
  const configuredLimit = getConfiguredLimit(settings, actionType);

  if (!HIGH_RISK_ACTIONS.includes(actionType)) {
    return configuredLimit;
  }

  if (!settings.accountConnectedAt) {
    return configuredLimit;
  }

  const connectedAt = new Date(settings.accountConnectedAt);
  const now = new Date();
  const daysSinceConnected = Math.floor(
    (now.getTime() - connectedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceConnected < 7) {
    return Math.floor(configuredLimit * 0.5);
  }
  if (daysSinceConnected < 14) {
    return Math.floor(configuredLimit * 0.75);
  }
  return configuredLimit;
}

function getConfiguredLimit(settings: AccountSafetySettings, actionType: ActionType): number {
  switch (actionType) {
    case 'dm':
      return settings.maxDmsPerDay;
    case 'connection_request':
      return settings.maxConnectionRequestsPerDay;
    case 'connection_accept':
      return settings.maxConnectionAcceptsPerDay;
    case 'comment':
      return settings.maxCommentsPerDay;
    case 'like':
      return settings.maxLikesPerDay;
  }
}

// ─── Operating Hours ─────────────────────────────────────────────────────────

/**
 * Returns true if the current time is within the account's operating hours
 * in the account's configured timezone.
 */
export function isWithinOperatingHours(settings: AccountSafetySettings, now?: Date): boolean {
  const currentTime = now ?? new Date();

  // Format current time in the account's timezone as HH:MM
  const timeStr = currentTime.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: settings.timezone,
  });

  const [startH, startM] = settings.operatingHoursStart.split(':').map(Number);
  const [endH, endM] = settings.operatingHoursEnd.split(':').map(Number);
  const [nowH, nowM] = timeStr.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const nowMinutes = nowH * 60 + nowM;

  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

/**
 * Returns true if the circuit breaker is active (timestamp is in the future).
 */
export function isCircuitBreakerActive(settings: AccountSafetySettings, now?: Date): boolean {
  if (!settings.circuitBreakerUntil) return false;
  const breakerUntil = new Date(settings.circuitBreakerUntil);
  const currentTime = now ?? new Date();
  return breakerUntil.getTime() > currentTime.getTime();
}

// ─── Daily Limit Check ──────────────────────────────────────────────────────

/**
 * Check if the account can perform one more action of the given type today.
 */
export async function checkDailyLimit(
  accountId: string,
  actionType: ActionType,
  settings: AccountSafetySettings
): Promise<DailyLimitCheck> {
  const limit = getEffectiveLimit(settings, actionType);

  // Get today's date in the account's timezone
  const now = new Date();
  const localDate = now.toLocaleDateString('en-CA', { timeZone: settings.timezone });

  const dailyLimits = await safetyRepo.getDailyLimits(accountId, localDate);
  const used = dailyLimits ? getUsedCount(dailyLimits, actionType) : 0;

  return {
    allowed: used < limit,
    used,
    limit,
  };
}

function getUsedCount(limits: safetyRepo.DailyLimitsRow, actionType: ActionType): number {
  switch (actionType) {
    case 'dm':
      return limits.dms_sent;
    case 'connection_request':
      return limits.connection_requests_sent;
    case 'connection_accept':
      return limits.connections_accepted;
    case 'comment':
      return limits.comments_sent;
    case 'like':
      return limits.likes_sent;
  }
}

// ─── Randomized Delay ────────────────────────────────────────────────────────

/**
 * Returns a promise that resolves after a random delay between
 * settings.minActionDelayMs and settings.maxActionDelayMs.
 */
export function randomDelay(settings: AccountSafetySettings): Promise<void> {
  const min = settings.minActionDelayMs;
  const max = settings.maxActionDelayMs;
  const delayMs = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Returns the delay duration without sleeping (for testing or external scheduling).
 */
export function getRandomDelayMs(settings: AccountSafetySettings): number {
  const min = settings.minActionDelayMs;
  const max = settings.maxActionDelayMs;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Skip Run Jitter ─────────────────────────────────────────────────────────

/**
 * 10% chance returns true — used to add natural randomness to polling patterns.
 */
export function shouldSkipRun(): boolean {
  return Math.random() < 0.1;
}
