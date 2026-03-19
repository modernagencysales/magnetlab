/**
 * LinkedIn Action Queue Repository
 * All Supabase access for linkedin_action_queue and linkedin_activity_log tables.
 * Admin client only — no user JWT. Never imports route-layer modules.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { QUEUE_ACTION_COLUMNS, ACTIVITY_LOG_COLUMNS } from '@/lib/types/linkedin-action-queue';
import type { EnqueueActionInput, ActivityLogEntry } from '@/lib/types/linkedin-action-queue';

// ─── Activity Log Insert Input ──────────────────────────────────────────────

export interface InsertActivityLogInput {
  user_id: string;
  unipile_account_id: string;
  action_type: string;
  target_provider_id?: string | null;
  target_linkedin_url?: string | null;
  source_type: string;
  source_campaign_id: string;
  source_lead_id: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
}

// ─── Activity Log Filters ───────────────────────────────────────────────────

export interface ActivityLogFilters {
  accountId?: string;
  actionType?: string;
  since?: string;
  sourceCampaignId?: string;
  limit?: number;
  offset?: number;
}

// ─── Enqueue ────────────────────────────────────────────────────────────────

/** Insert a new action into the queue and return the created row. */
export async function enqueueAction(input: EnqueueActionInput) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .insert({
      user_id: input.user_id,
      unipile_account_id: input.unipile_account_id,
      action_type: input.action_type,
      target_provider_id: input.target_provider_id ?? null,
      target_linkedin_url: input.target_linkedin_url ?? null,
      payload: input.payload,
      priority: input.priority,
      source_type: input.source_type,
      source_campaign_id: input.source_campaign_id,
      source_lead_id: input.source_lead_id,
      status: 'queued',
      processed: false,
      attempts: 0,
    })
    .select(QUEUE_ACTION_COLUMNS)
    .single();
  return { data, error };
}

// ─── Dequeue ────────────────────────────────────────────────────────────────

/** Select the oldest queued action for an account, ordered by priority ASC then created_at ASC. */
export async function dequeueNext(accountId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .select(QUEUE_ACTION_COLUMNS)
    .eq('unipile_account_id', accountId)
    .eq('status', 'queued')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return { data, error };
}

// ─── Status Updates ─────────────────────────────────────────────────────────

/** Mark an action as executing. */
export async function markExecuting(actionId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .update({ status: 'executing' })
    .eq('id', actionId)
    .select(QUEUE_ACTION_COLUMNS)
    .single();
  return { data, error };
}

/** Mark an action as completed with its result. */
export async function markCompleted(actionId: string, result: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .update({
      status: 'completed',
      executed_at: new Date().toISOString(),
      result,
    })
    .eq('id', actionId)
    .select(QUEUE_ACTION_COLUMNS)
    .single();
  return { data, error };
}

/** Mark an action as failed with an error message. */
export async function markFailed(actionId: string, error: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error: dbError } = await supabase
    .from('linkedin_action_queue')
    .update({
      status: 'failed',
      error,
    })
    .eq('id', actionId)
    .select(QUEUE_ACTION_COLUMNS)
    .single();
  return { data, error: dbError };
}

/** Mark an action as processed (result consumed by downstream logic). */
export async function markProcessed(actionId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .update({ processed: true })
    .eq('id', actionId)
    .select(QUEUE_ACTION_COLUMNS)
    .single();
  return { data, error };
}

// ─── Cancellation ───────────────────────────────────────────────────────────

/** Cancel all queued actions for a campaign. */
export async function cancelByCampaign(sourceCampaignId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .update({ status: 'cancelled' })
    .eq('source_campaign_id', sourceCampaignId)
    .eq('status', 'queued')
    .select(QUEUE_ACTION_COLUMNS);
  return { data, error };
}

/** Cancel all queued actions for a specific lead. */
export async function cancelByLead(sourceLeadId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .update({ status: 'cancelled' })
    .eq('source_lead_id', sourceLeadId)
    .eq('status', 'queued')
    .select(QUEUE_ACTION_COLUMNS);
  return { data, error };
}

// ─── Result Queries ─────────────────────────────────────────────────────────

/** Get completed/failed unprocessed results for a lead (for downstream processing). */
export async function getUnprocessedResults(sourceLeadId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .select(QUEUE_ACTION_COLUMNS)
    .eq('source_lead_id', sourceLeadId)
    .in('status', ['completed', 'failed'])
    .eq('processed', false);
  return { data, error };
}

/** Get completed/failed unprocessed results for a campaign by source type. */
export async function getUnprocessedResultsByCampaign(
  sourceType: string,
  sourceCampaignId: string
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .select(QUEUE_ACTION_COLUMNS)
    .eq('source_type', sourceType)
    .eq('source_campaign_id', sourceCampaignId)
    .in('status', ['completed', 'failed'])
    .eq('processed', false);
  return { data, error };
}

/** Return true if the lead has any queued or executing actions. */
export async function hasPendingAction(sourceLeadId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('linkedin_action_queue')
    .select('id', { count: 'exact', head: true })
    .eq('source_lead_id', sourceLeadId)
    .in('status', ['queued', 'executing']);
  return (count ?? 0) > 0;
}

// ─── Account Discovery ──────────────────────────────────────────────────────

/** Return distinct (unipile_account_id, user_id) pairs that have queued actions. */
export async function getDistinctQueuedAccounts(): Promise<
  Array<{ unipile_account_id: string; user_id: string }>
> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_action_queue')
    .select('unipile_account_id, user_id')
    .eq('status', 'queued');

  if (error || !data) return [];

  // Deduplicate in-process (Supabase does not support DISTINCT via .select() on the JS client)
  const seen = new Set<string>();
  const unique: Array<{ unipile_account_id: string; user_id: string }> = [];
  for (const row of data) {
    const key = `${row.unipile_account_id}:${row.user_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ unipile_account_id: row.unipile_account_id, user_id: row.user_id });
    }
  }
  return unique;
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/** Delete processed terminal rows older than 7 days to keep the table lean. */
export async function cleanupOldRows() {
  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('linkedin_action_queue')
    .delete()
    .in('status', ['completed', 'failed', 'cancelled'])
    .eq('processed', true)
    .lt('created_at', cutoff);
  return { error };
}

// ─── Activity Log ───────────────────────────────────────────────────────────

/** Insert a record into the linkedin_activity_log table. */
export async function insertActivityLog(entry: InsertActivityLogInput) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_activity_log')
    .insert({
      user_id: entry.user_id,
      unipile_account_id: entry.unipile_account_id,
      action_type: entry.action_type,
      target_provider_id: entry.target_provider_id ?? null,
      target_linkedin_url: entry.target_linkedin_url ?? null,
      source_type: entry.source_type,
      source_campaign_id: entry.source_campaign_id,
      source_lead_id: entry.source_lead_id,
      payload: entry.payload,
      result: entry.result,
    })
    .select(ACTIVITY_LOG_COLUMNS)
    .single();
  return { data, error };
}

/** List activity log entries with optional filters, ordered by created_at DESC. */
export async function listActivityLog(filters: ActivityLogFilters = {}) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('linkedin_activity_log')
    .select(ACTIVITY_LOG_COLUMNS)
    .order('created_at', { ascending: false });

  if (filters.accountId) query = query.eq('unipile_account_id', filters.accountId);
  if (filters.actionType) query = query.eq('action_type', filters.actionType);
  if (filters.sourceCampaignId) query = query.eq('source_campaign_id', filters.sourceCampaignId);
  if (filters.since) query = query.gte('created_at', filters.since);
  if (filters.limit != null) query = query.limit(filters.limit);
  if (filters.offset != null) {
    query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  return { data: data as ActivityLogEntry[] | null, error };
}
