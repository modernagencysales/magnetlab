/**
 * Account Safety Service
 * Configurable per-account LinkedIn safety limits, operating hours, warm-up, and circuit breaker.
 * Never imports route-layer modules. Reads from account_safety_settings table.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { LINKEDIN_SAFETY, SAFETY_DEFAULTS, HIGH_RISK_ACTIONS } from '@/lib/types/post-campaigns';
import type { AccountSafetySettings, ActionType } from '@/lib/types/post-campaigns';

// ─── Re-exports for callers ───────────────────────────────────────────────────

export type { AccountSafetySettings };

// ─── Types ───────────────────────────────────────────────────────────────────

export type DailyLimitAction = ActionType;

// ─── Column Selects ──────────────────────────────────────────────────────────

const ACCOUNT_SAFETY_COLUMNS = `
  id,
  user_id,
  unipile_account_id,
  operating_hours_start,
  operating_hours_end,
  timezone,
  max_dms_per_day,
  max_connection_requests_per_day,
  max_connection_accepts_per_day,
  max_comments_per_day,
  max_likes_per_day,
  min_action_delay_ms,
  max_action_delay_ms,
  account_connected_at,
  circuit_breaker_until
`;

const DAILY_LIMITS_COLUMNS = `
  id,
  unipile_account_id,
  date,
  dms_sent,
  connections_accepted,
  connection_requests_sent,
  comments_sent,
  likes_sent,
  profile_views
`;

// ─── Settings Mapping ─────────────────────────────────────────────────────────

/** Map DB row (snake_case) to AccountSafetySettings (camelCase). */
function rowToSettings(row: Record<string, unknown>, userId: string): AccountSafetySettings {
  return {
    id: row.id as string,
    userId,
    unipileAccountId: row.unipile_account_id as string,
    operatingHoursStart:
      (row.operating_hours_start as string) ?? SAFETY_DEFAULTS.operatingHoursStart,
    operatingHoursEnd: (row.operating_hours_end as string) ?? SAFETY_DEFAULTS.operatingHoursEnd,
    timezone: (row.timezone as string) ?? SAFETY_DEFAULTS.timezone,
    maxDmsPerDay: (row.max_dms_per_day as number) ?? SAFETY_DEFAULTS.maxDmsPerDay,
    maxConnectionRequestsPerDay:
      (row.max_connection_requests_per_day as number) ??
      SAFETY_DEFAULTS.maxConnectionRequestsPerDay,
    maxConnectionAcceptsPerDay:
      (row.max_connection_accepts_per_day as number) ?? SAFETY_DEFAULTS.maxConnectionAcceptsPerDay,
    maxCommentsPerDay: (row.max_comments_per_day as number) ?? SAFETY_DEFAULTS.maxCommentsPerDay,
    maxLikesPerDay: (row.max_likes_per_day as number) ?? SAFETY_DEFAULTS.maxLikesPerDay,
    minActionDelayMs: (row.min_action_delay_ms as number) ?? SAFETY_DEFAULTS.minActionDelayMs,
    maxActionDelayMs: (row.max_action_delay_ms as number) ?? SAFETY_DEFAULTS.maxActionDelayMs,
    accountConnectedAt: (row.account_connected_at as string | null) ?? null,
    circuitBreakerUntil: (row.circuit_breaker_until as string | null) ?? null,
  };
}

// ─── Settings Access ─────────────────────────────────────────────────────────

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

  if (data) return rowToSettings(data as Record<string, unknown>, userId);

  // Return defaults for unconfigured accounts
  return {
    id: '',
    userId,
    unipileAccountId: accountId,
    ...SAFETY_DEFAULTS,
    accountConnectedAt: null,
    circuitBreakerUntil: null,
  };
}

// ─── Operating Hours ─────────────────────────────────────────────────────────

/**
 * Check if the given time is within the account's operating hours.
 * Uses the configured timezone for accurate local time comparison.
 * Accepts optional `now` for testability (defaults to current time).
 */
export function isWithinOperatingHours(settings: AccountSafetySettings, now?: Date): boolean {
  try {
    const time = now ?? new Date();
    const localTime = time.toLocaleTimeString('en-GB', {
      timeZone: settings.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return localTime >= settings.operatingHoursStart && localTime < settings.operatingHoursEnd;
  } catch {
    // If timezone is invalid, default to allowing actions
    return true;
  }
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

/**
 * Check if the circuit breaker is currently active for this account.
 * Accepts optional `now` for testability (defaults to current time).
 */
export function isCircuitBreakerActive(settings: AccountSafetySettings, now?: Date): boolean {
  if (!settings.circuitBreakerUntil) return false;
  return new Date(settings.circuitBreakerUntil) > (now ?? new Date());
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

// ─── Warm-Up Calculation ─────────────────────────────────────────────────────

/** Map action type to the settings field that holds its base limit. */
const ACTION_LIMIT_FIELD: Record<DailyLimitAction, keyof AccountSafetySettings> = {
  dm: 'maxDmsPerDay',
  connection_request: 'maxConnectionRequestsPerDay',
  connection_accept: 'maxConnectionAcceptsPerDay',
  comment: 'maxCommentsPerDay',
  like: 'maxLikesPerDay',
  profile_view: 'maxLikesPerDay', // profile views share likes limit for safety
};

/** Map action type to the DB column for daily count. */
const ACTION_DB_FIELD: Record<
  DailyLimitAction,
  | 'dms_sent'
  | 'connections_accepted'
  | 'connection_requests_sent'
  | 'comments_sent'
  | 'likes_sent'
  | 'profile_views'
> = {
  dm: 'dms_sent',
  connection_request: 'connection_requests_sent',
  connection_accept: 'connections_accepted',
  comment: 'comments_sent',
  like: 'likes_sent',
  profile_view: 'profile_views',
};

/**
 * Get the effective daily limit for an action, applying warm-up ramp for high-risk actions.
 * Week 1 (0–6 days): 50%, Week 2 (7–13 days): 75%, Week 3+: 100%.
 */
export function getEffectiveLimit(
  settings: AccountSafetySettings,
  action: DailyLimitAction
): number {
  const limitField = ACTION_LIMIT_FIELD[action];
  const baseLimit = settings[limitField] as number;
  const isHighRisk = (HIGH_RISK_ACTIONS as readonly string[]).includes(action);

  if (!isHighRisk || !settings.accountConnectedAt) return baseLimit;

  const weeksConnected = Math.floor(
    (Date.now() - new Date(settings.accountConnectedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  if (weeksConnected < 1) return Math.floor(baseLimit * 0.5);
  if (weeksConnected < 2) return Math.floor(baseLimit * 0.75);
  return baseLimit;
}

// ─── Daily Limit Checks ──────────────────────────────────────────────────────

/**
 * Check if a daily limit action is allowed for the given account.
 * Uses account safety settings with warm-up ramp applied.
 * Returns { allowed, used, limit }.
 */
export async function checkDailyLimit(
  accountId: string,
  action: DailyLimitAction,
  settings: AccountSafetySettings
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = getEffectiveLimit(settings, action);
  const dbField = ACTION_DB_FIELD[action];

  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('linkedin_daily_limits')
    .select(DAILY_LIMITS_COLUMNS)
    .eq('unipile_account_id', accountId)
    .eq('date', today)
    .maybeSingle();

  const used = data ? ((data as Record<string, number>)[dbField] ?? 0) : 0;

  return { allowed: used < limit, used, limit };
}

// ─── All Accounts ─────────────────────────────────────────────────────────────

/** Get all account safety settings rows for a user. */
export async function getAllAccountSettings(userId: string): Promise<AccountSafetySettings[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('account_safety_settings')
    .select(ACCOUNT_SAFETY_COLUMNS)
    .eq('user_id', userId);

  if (error) {
    logError('account-safety/getAllSettings', error, { userId });
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => rowToSettings(row, userId));
}

// ─── Update Settings ──────────────────────────────────────────────────────────

const SETTINGS_FIELD_MAP: Record<string, string> = {
  maxDmsPerDay: 'max_dms_per_day',
  maxConnectionRequestsPerDay: 'max_connection_requests_per_day',
  maxConnectionAcceptsPerDay: 'max_connection_accepts_per_day',
  maxCommentsPerDay: 'max_comments_per_day',
  maxLikesPerDay: 'max_likes_per_day',
  minActionDelayMs: 'min_action_delay_ms',
  maxActionDelayMs: 'max_action_delay_ms',
  operatingHoursStart: 'operating_hours_start',
  operatingHoursEnd: 'operating_hours_end',
  timezone: 'timezone',
};

/** Upsert account safety settings for a user/account pair. */
export async function updateAccountSettings(
  userId: string,
  accountId: string,
  input: Record<string, unknown>
): Promise<AccountSafetySettings> {
  const supabase = createSupabaseAdminClient();

  // Map camelCase input fields to snake_case DB columns
  const dbFields: Record<string, unknown> = {
    user_id: userId,
    unipile_account_id: accountId,
    updated_at: new Date().toISOString(),
  };
  for (const [key, dbKey] of Object.entries(SETTINGS_FIELD_MAP)) {
    if (key in input) {
      dbFields[dbKey] = input[key];
    }
  }

  const { data, error } = await supabase
    .from('account_safety_settings')
    .upsert(dbFields, { onConflict: 'user_id,unipile_account_id' })
    .select(ACCOUNT_SAFETY_COLUMNS)
    .single();

  if (error) {
    logError('account-safety/updateSettings', error, { userId, accountId });
    throw Object.assign(new Error('Failed to update account safety settings'), { statusCode: 500 });
  }

  return rowToSettings(data as Record<string, unknown>, userId);
}

// ─── Randomized Delays ────────────────────────────────────────────────────────

/** Return a random delay in milliseconds based on account settings. */
export function getRandomDelayMs(settings: AccountSafetySettings): number {
  const min = settings.minActionDelayMs;
  const max = settings.maxActionDelayMs;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** @deprecated Use getRandomDelayMs instead */
export function randomDelay(settings: AccountSafetySettings): number {
  return getRandomDelayMs(settings);
}

/** Resolve after ms milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Run Jitter ───────────────────────────────────────────────────────────────

/** Return true ~10% of the time to add natural unpredictability to scheduled runs. */
export function shouldSkipRun(): boolean {
  return Math.random() < 0.1;
}

// ─── Queue Action Mapping ────────────────────────────────────────────────────

/** Map a queue action_type to DailyLimitAction. Returns null for actions without daily limits (withdraw). */
export function mapToLimitAction(actionType: string): DailyLimitAction | null {
  const map: Record<string, DailyLimitAction | null> = {
    view_profile: 'profile_view',
    connect: 'connection_request',
    message: 'dm',
    follow_up_message: 'dm',
    withdraw: null,
    accept_invitation: 'connection_accept',
    react: 'like',
    comment: 'comment',
  };
  return map[actionType] ?? null;
}

// ─── Legacy Exports ───────────────────────────────────────────────────────────

/** @deprecated Use SAFETY_DEFAULTS from @/lib/types/post-campaigns */
export const LINKEDIN_SAFETY_LEGACY = LINKEDIN_SAFETY;
