/**
 * Account Safety Settings Repository.
 * All Supabase access for account_safety_settings and linkedin_daily_limits (safety-related).
 * Never imports route-layer modules. Admin client only.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { ActionType } from '@/lib/types/post-campaigns';

// ─── Column Selects ──────────────────────────────────────────────────────────

const SELECT_SAFETY_SETTINGS = `
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
  circuit_breaker_until,
  created_at,
  updated_at
`;

const SELECT_DAILY_LIMITS = `
  id,
  user_id,
  unipile_account_id,
  date,
  dms_sent,
  connections_accepted,
  connection_requests_sent,
  comments_sent,
  likes_sent
`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SafetySettingsRow {
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

export interface DailyLimitsRow {
  id: string;
  user_id: string;
  unipile_account_id: string;
  date: string;
  dms_sent: number;
  connections_accepted: number;
  connection_requests_sent: number;
  comments_sent: number;
  likes_sent: number;
}

export interface SafetyUpsertInput {
  operating_hours_start?: string;
  operating_hours_end?: string;
  timezone?: string;
  max_dms_per_day?: number;
  max_connection_requests_per_day?: number;
  max_connection_accepts_per_day?: number;
  max_comments_per_day?: number;
  max_likes_per_day?: number;
  min_action_delay_ms?: number;
  max_action_delay_ms?: number;
  account_connected_at?: string | null;
}

// ─── Upsert Whitelist ────────────────────────────────────────────────────────

const ALLOWED_UPSERT_FIELDS = [
  'operating_hours_start',
  'operating_hours_end',
  'timezone',
  'max_dms_per_day',
  'max_connection_requests_per_day',
  'max_connection_accepts_per_day',
  'max_comments_per_day',
  'max_likes_per_day',
  'min_action_delay_ms',
  'max_action_delay_ms',
  'account_connected_at',
] as const;

// ─── Action → Column Mapping ─────────────────────────────────────────────────

const ACTION_COLUMN_MAP: Record<ActionType, keyof DailyLimitsRow> = {
  dm: 'dms_sent',
  connection_request: 'connection_requests_sent',
  connection_accept: 'connections_accepted',
  comment: 'comments_sent',
  like: 'likes_sent',
};

// ─── Safety Settings ─────────────────────────────────────────────────────────

export async function findByAccountId(
  userId: string,
  accountId: string
): Promise<SafetySettingsRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('account_safety_settings')
    .select(SELECT_SAFETY_SETTINGS)
    .eq('user_id', userId)
    .eq('unipile_account_id', accountId)
    .maybeSingle();

  if (error) throw new Error(`account-safety.findByAccountId: ${error.message}`);
  return data ?? null;
}

export async function findAllByUser(userId: string): Promise<SafetySettingsRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('account_safety_settings')
    .select(SELECT_SAFETY_SETTINGS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`account-safety.findAllByUser: ${error.message}`);
  return data ?? [];
}

export async function upsert(
  userId: string,
  accountId: string,
  settings: SafetyUpsertInput
): Promise<SafetySettingsRow> {
  const supabase = createSupabaseAdminClient();

  // Filter through whitelist
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_UPSERT_FIELDS) {
    if (key in settings) {
      filtered[key] = (settings as Record<string, unknown>)[key];
    }
  }
  filtered.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('account_safety_settings')
    .upsert(
      {
        user_id: userId,
        unipile_account_id: accountId,
        ...filtered,
      },
      { onConflict: 'user_id,unipile_account_id' }
    )
    .select(SELECT_SAFETY_SETTINGS)
    .single();

  if (error) throw new Error(`account-safety.upsert: ${error.message}`);
  return data;
}

// ─── Daily Limits ────────────────────────────────────────────────────────────

export async function getDailyLimits(
  accountId: string,
  localDate: string
): Promise<DailyLimitsRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_daily_limits')
    .select(SELECT_DAILY_LIMITS)
    .eq('unipile_account_id', accountId)
    .eq('date', localDate)
    .maybeSingle();

  if (error) throw new Error(`account-safety.getDailyLimits: ${error.message}`);
  return data ?? null;
}

export async function incrementDailyLimit(
  accountId: string,
  localDate: string,
  actionType: ActionType
): Promise<void> {
  const column = ACTION_COLUMN_MAP[actionType];
  if (!column)
    throw new Error(`account-safety.incrementDailyLimit: unknown action type "${actionType}"`);

  const supabase = createSupabaseAdminClient();

  // Upsert the daily limits row, then increment the field
  const { data: existing } = await supabase
    .from('linkedin_daily_limits')
    .select('id')
    .eq('unipile_account_id', accountId)
    .eq('date', localDate)
    .maybeSingle();

  if (!existing) {
    // Insert with the counter set to 1
    const insertData: Record<string, unknown> = {
      unipile_account_id: accountId,
      date: localDate,
      dms_sent: 0,
      connections_accepted: 0,
      connection_requests_sent: 0,
      comments_sent: 0,
      likes_sent: 0,
    };
    insertData[column] = 1;

    const { error: insertError } = await supabase.from('linkedin_daily_limits').insert(insertData);

    if (insertError)
      throw new Error(`account-safety.incrementDailyLimit insert: ${insertError.message}`);
    return;
  }

  // Use RPC if available, otherwise manual increment
  const { error } = await supabase.rpc('increment_daily_limit', {
    p_account_id: accountId,
    p_date: localDate,
    p_field: column,
  });

  if (error) throw new Error(`account-safety.incrementDailyLimit rpc: ${error.message}`);
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

export async function setCircuitBreaker(
  userId: string,
  accountId: string,
  until: Date | null
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('account_safety_settings')
    .update({
      circuit_breaker_until: until ? until.toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('unipile_account_id', accountId);

  if (error) throw new Error(`account-safety.setCircuitBreaker: ${error.message}`);
}
