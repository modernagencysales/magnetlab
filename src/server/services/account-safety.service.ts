/**
 * Account Safety Service
 * Configurable per-account LinkedIn safety limits, operating hours, warm-up, and circuit breaker.
 * Never imports route-layer modules. Reads from account_safety_settings table.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { LINKEDIN_SAFETY } from '@/lib/types/post-campaigns';
import { getDailyLimit } from '@/server/repositories/post-campaigns.repo';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AccountSafetySettings {
  id: string;
  user_id: string;
  unipile_account_id: string;
  operating_hours_start: string;
  operating_hours_end: string;
  timezone: string;
  max_dms_per_day: number;
  max_connection_requests_per_day: number;
  max_connection_accepts_per_day: number;
  max_comments_per_day: number;
  max_likes_per_day: number;
  min_action_delay_ms: number;
  max_action_delay_ms: number;
  account_connected_at: string | null;
  circuit_breaker_until: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyLimitAction =
  | 'dm'
  | 'connection_request'
  | 'connection_accept'
  | 'comment'
  | 'like';

const ACCOUNT_SAFETY_COLUMNS =
  'id, user_id, unipile_account_id, operating_hours_start, operating_hours_end, timezone, max_dms_per_day, max_connection_requests_per_day, max_connection_accepts_per_day, max_comments_per_day, max_likes_per_day, min_action_delay_ms, max_action_delay_ms, account_connected_at, circuit_breaker_until, created_at, updated_at';

// ─── Default Settings ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Omit<
  AccountSafetySettings,
  'id' | 'user_id' | 'unipile_account_id' | 'created_at' | 'updated_at'
> = {
  operating_hours_start: '08:00',
  operating_hours_end: '19:00',
  timezone: 'America/New_York',
  max_dms_per_day: LINKEDIN_SAFETY.MAX_DMS_PER_DAY,
  max_connection_requests_per_day: LINKEDIN_SAFETY.MAX_CONNECT_REQUESTS_PER_DAY,
  max_connection_accepts_per_day: LINKEDIN_SAFETY.MAX_ACCEPTS_PER_DAY,
  max_comments_per_day: 30,
  max_likes_per_day: 60,
  min_action_delay_ms: LINKEDIN_SAFETY.MIN_DELAY_BETWEEN_DMS_MS,
  max_action_delay_ms: LINKEDIN_SAFETY.MAX_DELAY_BETWEEN_DMS_MS,
  account_connected_at: null,
  circuit_breaker_until: null,
};

// ─── Settings Access ────────────────────────────────────────────────────────

/**
 * Get account safety settings. Returns defaults if no row exists.
 * Creates a synthetic settings object with defaults for unconfigured accounts.
 */
export async function getAccountSettings(
  userId: string,
  accountId: string
): Promise<AccountSafetySettings> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('account_safety_settings')
    .select(ACCOUNT_SAFETY_COLUMNS)
    .eq('user_id', userId)
    .eq('unipile_account_id', accountId)
    .maybeSingle();

  if (error) {
    logError('account-safety/getSettings', error, { userId, accountId });
  }

  if (data) return data as AccountSafetySettings;

  // Return defaults for unconfigured accounts
  return {
    id: '',
    user_id: userId,
    unipile_account_id: accountId,
    ...DEFAULT_SETTINGS,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─── Operating Hours ────────────────────────────────────────────────────────

/**
 * Check if current time is within the account's operating hours.
 * Uses the configured timezone for accurate local time comparison.
 */
export function isWithinOperatingHours(settings: AccountSafetySettings): boolean {
  try {
    const now = new Date();
    const localTime = now.toLocaleTimeString('en-GB', {
      timeZone: settings.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return localTime >= settings.operating_hours_start && localTime < settings.operating_hours_end;
  } catch {
    // If timezone is invalid, default to allowing actions
    return true;
  }
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────

/** Check if the circuit breaker is currently active for this account. */
export function isCircuitBreakerActive(settings: AccountSafetySettings): boolean {
  if (!settings.circuit_breaker_until) return false;
  return new Date(settings.circuit_breaker_until) > new Date();
}

/** Activate the circuit breaker for 24 hours. */
export async function activateCircuitBreaker(
  userId: string,
  accountId: string,
  reason: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('account_safety_settings').upsert(
    {
      user_id: userId,
      unipile_account_id: accountId,
      circuit_breaker_until: until,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,unipile_account_id' }
  );

  if (error) {
    logError('account-safety/activateCircuitBreaker', error, { userId, accountId, reason });
  }
}

// ─── Warm-Up Calculation ────────────────────────────────────────────────────

/**
 * Get the effective limit for an action, applying warm-up ramp for high-risk actions.
 * Week 1: 50%, Week 2: 75%, Week 3+: 100%.
 */
export function getEffectiveLimit(
  baseLimit: number,
  connectedAt: string | null,
  isHighRisk: boolean
): number {
  if (!isHighRisk || !connectedAt) return baseLimit;

  const weeksConnected = Math.floor(
    (Date.now() - new Date(connectedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  if (weeksConnected < 1) return Math.floor(baseLimit * 0.5);
  if (weeksConnected < 2) return Math.floor(baseLimit * 0.75);
  return baseLimit;
}

// ─── Daily Limit Checks ─────────────────────────────────────────────────────

/** Map from action type to daily limit field and settings field. */
const ACTION_MAP: Record<
  DailyLimitAction,
  {
    dbField:
      | 'dms_sent'
      | 'connections_accepted'
      | 'connection_requests_sent'
      | 'comments_sent'
      | 'likes_sent';
    settingsField: keyof AccountSafetySettings;
    isHighRisk: boolean;
  }
> = {
  dm: { dbField: 'dms_sent', settingsField: 'max_dms_per_day', isHighRisk: true },
  connection_request: {
    dbField: 'connection_requests_sent',
    settingsField: 'max_connection_requests_per_day',
    isHighRisk: true,
  },
  connection_accept: {
    dbField: 'connections_accepted',
    settingsField: 'max_connection_accepts_per_day',
    isHighRisk: false,
  },
  comment: { dbField: 'comments_sent', settingsField: 'max_comments_per_day', isHighRisk: false },
  like: { dbField: 'likes_sent', settingsField: 'max_likes_per_day', isHighRisk: false },
};

/**
 * Check if a daily limit action is allowed for the given account.
 * Uses account safety settings with warm-up ramp applied.
 */
export async function checkDailyLimit(
  accountId: string,
  action: DailyLimitAction,
  settings: AccountSafetySettings
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const mapping = ACTION_MAP[action];
  const baseLimit = settings[mapping.settingsField] as number;
  const effectiveLimit = getEffectiveLimit(
    baseLimit,
    settings.account_connected_at,
    mapping.isHighRisk
  );

  const { data } = await getDailyLimit(settings.user_id, accountId);
  const current = data ? ((data as Record<string, number>)[mapping.dbField] ?? 0) : 0;

  return {
    allowed: current < effectiveLimit,
    current,
    limit: effectiveLimit,
  };
}

// ─── Randomized Delays ──────────────────────────────────────────────────────

/** Return a random delay in milliseconds based on account settings. */
export function randomDelay(settings: AccountSafetySettings): number {
  const min = settings.min_action_delay_ms;
  const max = settings.max_action_delay_ms;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Resolve after ms milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
