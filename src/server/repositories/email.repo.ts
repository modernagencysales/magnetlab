/**
 * Email Repository
 * ALL Supabase queries for email_sequences, email_broadcasts, email_flows,
 * email_flow_steps, email_flow_contacts, email_subscribers, and related tables.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Column sets ─────────────────────────────────────────────────────────────

const SEQ_COLUMNS =
  'id, lead_magnet_id, user_id, emails, status, created_at, updated_at';

const BROADCAST_COLUMNS =
  'id, team_id, user_id, subject, body, status, audience_filter, recipient_count, sent_at, created_at, updated_at';

const FLOW_COLUMNS =
  'id, team_id, user_id, name, description, trigger_type, trigger_lead_magnet_id, status, created_at, updated_at';

const STEP_COLUMNS =
  'id, flow_id, step_number, subject, body, delay_days, created_at, updated_at';

const SUBSCRIBER_COLUMNS =
  'id, team_id, email, first_name, last_name, status, source, source_id, subscribed_at, unsubscribed_at';

// ─── Email sequences ──────────────────────────────────────────────────────────

export async function verifyLeadMagnetInScope(scope: DataScope, leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await applyScope(
    supabase.from('lead_magnets').select('id').eq('id', leadMagnetId),
    scope,
  ).single();
  return data ?? null;
}

export async function findEmailSequence(scope: DataScope, leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('email_sequences').select(SEQ_COLUMNS).eq('lead_magnet_id', leadMagnetId),
    scope,
  ).single();
  if (error && error.code !== 'PGRST116') throw new Error(`email.findEmailSequence: ${error.message}`);
  return data ?? null;
}

export async function findEmailSequenceMaybe(scope: DataScope, leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('email_sequences').select('id, emails').eq('lead_magnet_id', leadMagnetId),
    scope,
  ).maybeSingle();
  if (error) throw new Error(`email.findEmailSequenceMaybe: ${error.message}`);
  return data ?? null;
}

export async function updateEmailSequenceById(
  scope: DataScope,
  seqId: string,
  updates: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await applyScope(
    supabase.from('email_sequences').update(updates).eq('id', seqId),
    scope,
  )
    .select()
    .single();
  if (error) throw new Error(`email.updateEmailSequenceById: ${error.message}`);
  return data;
}

export async function findEmailSequenceByOwner(userId: string, leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_sequences')
    .select(SEQ_COLUMNS)
    .eq('lead_magnet_id', leadMagnetId)
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function updateEmailSequenceByOwner(
  userId: string,
  seqId: string,
  updates: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_sequences')
    .update(updates)
    .eq('id', seqId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw new Error(`email.updateEmailSequenceByOwner: ${error.message}`);
  return data;
}

export async function upsertEmailSequence(
  userId: string,
  teamId: string | null,
  leadMagnetId: string,
  emails: unknown,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_sequences')
    .upsert(
      { lead_magnet_id: leadMagnetId, user_id: userId, team_id: teamId, emails, status: 'draft' },
      { onConflict: 'lead_magnet_id' },
    )
    .select(SEQ_COLUMNS)
    .single();
  if (error || !data) throw new Error(`email.upsertEmailSequence: ${error?.message ?? 'no data'}`);
  return data;
}

// ─── Broadcasts ───────────────────────────────────────────────────────────────

export async function findBroadcasts(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_broadcasts')
    .select(BROADCAST_COLUMNS)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`email.findBroadcasts: ${error.message}`);
  return data ?? [];
}

export async function findBroadcastById(teamId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_broadcasts')
    .select(BROADCAST_COLUMNS)
    .eq('id', id)
    .eq('team_id', teamId)
    .maybeSingle();
  return data ?? null;
}

export async function findBroadcastForEdit(teamId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_broadcasts')
    .select('id, status, subject, body')
    .eq('id', id)
    .eq('team_id', teamId)
    .maybeSingle();
  return data ?? null;
}

export async function findBroadcastForSend(teamId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_broadcasts')
    .select('id, team_id, subject, body, status, audience_filter')
    .eq('id', id)
    .eq('team_id', teamId)
    .maybeSingle();
  return data ?? null;
}

export async function createBroadcast(
  teamId: string,
  userId: string,
  subject: string,
  body: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_broadcasts')
    .insert({ team_id: teamId, user_id: userId, subject: subject || '', body: body || '', status: 'draft', recipient_count: 0 })
    .select(BROADCAST_COLUMNS)
    .single();
  if (error) throw new Error(`email.createBroadcast: ${error.message}`);
  return data;
}

export async function updateBroadcastById(
  teamId: string,
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_broadcasts')
    .update(updates)
    .eq('id', id)
    .eq('team_id', teamId)
    .select(BROADCAST_COLUMNS)
    .single();
  if (error) throw new Error(`email.updateBroadcastById: ${error.message}`);
  return data;
}

export async function deleteBroadcastById(teamId: string, id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('email_broadcasts')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId);
  if (error) throw new Error(`email.deleteBroadcastById: ${error.message}`);
}

export async function getFilteredSubscriberCount(teamId: string, filter: unknown): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('get_filtered_subscriber_count', {
    p_team_id: teamId,
    p_filter: filter || {},
  });
  if (error) throw new Error(`email.getFilteredSubscriberCount: ${error.message}`);
  return data ?? 0;
}

export async function markBroadcastSending(
  teamId: string,
  id: string,
  recipientCount: number,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('email_broadcasts')
    .update({ status: 'sending', recipient_count: recipientCount })
    .eq('id', id)
    .eq('team_id', teamId);
  if (error) throw new Error(`email.markBroadcastSending: ${error.message}`);
}

// ─── Flows ────────────────────────────────────────────────────────────────────

export async function findFlows(teamId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_flows')
    .select(FLOW_COLUMNS)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`email.findFlows: ${error.message}`);
  return data ?? [];
}

export async function findFlowStepCountRows(flowIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_flow_steps')
    .select('flow_id')
    .in('flow_id', flowIds);
  return data ?? [];
}

export async function findFlowById(teamId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_flows')
    .select(FLOW_COLUMNS)
    .eq('id', id)
    .eq('team_id', teamId)
    .single();
  return data ?? null;
}

export async function findFlowWithSteps(teamId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data: flow } = await supabase
    .from('email_flows')
    .select(FLOW_COLUMNS)
    .eq('id', id)
    .eq('team_id', teamId)
    .single();
  if (!flow) return null;
  const { data: steps } = await supabase
    .from('email_flow_steps')
    .select(STEP_COLUMNS)
    .eq('flow_id', id)
    .order('step_number', { ascending: true });
  return { flow, steps: steps || [] };
}

export async function findFlowForOp(teamId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_flows')
    .select('id, status, trigger_type')
    .eq('id', id)
    .eq('team_id', teamId)
    .single();
  return data ?? null;
}

export async function findFlowForGenerate(teamId: string, flowId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_flows')
    .select('id, name, description, trigger_type, trigger_lead_magnet_id, status')
    .eq('id', flowId)
    .eq('team_id', teamId)
    .single();
  return data ?? null;
}

export async function countFlowSteps(flowId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('email_flow_steps')
    .select('id', { count: 'exact', head: true })
    .eq('flow_id', flowId);
  return count ?? 0;
}

export async function findLeadMagnetByOwnerForFlow(userId: string, leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('lead_magnets')
    .select('id')
    .eq('id', leadMagnetId)
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function createFlow(
  teamId: string,
  userId: string,
  data: {
    name: string;
    description?: string | null;
    trigger_type: string;
    trigger_lead_magnet_id?: string | null;
  },
) {
  const supabase = createSupabaseAdminClient();
  const { data: flow, error } = await supabase
    .from('email_flows')
    .insert({
      team_id: teamId,
      user_id: userId,
      name: data.name,
      description: data.description || null,
      trigger_type: data.trigger_type,
      trigger_lead_magnet_id: data.trigger_type === 'lead_magnet' ? data.trigger_lead_magnet_id : null,
      status: 'draft',
    })
    .select(FLOW_COLUMNS)
    .single();
  if (error) throw new Error(`email.createFlow: ${error.message}`);
  return flow;
}

export async function updateFlowById(
  teamId: string,
  id: string,
  updates: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_flows')
    .update(updates)
    .eq('id', id)
    .eq('team_id', teamId)
    .select(FLOW_COLUMNS)
    .single();
  if (error) throw new Error(`email.updateFlowById: ${error.message}`);
  return data;
}

export async function deleteFlowById(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('email_flows').delete().eq('id', id);
  if (error) throw new Error(`email.deleteFlowById: ${error.message}`);
}

export async function replaceFlowSteps(
  flowId: string,
  stepsData: Array<{
    flow_id: string;
    step_number: number;
    subject: string;
    body: string;
    delay_days: number;
  }>,
) {
  const supabase = createSupabaseAdminClient();
  const { error: delError } = await supabase
    .from('email_flow_steps')
    .delete()
    .eq('flow_id', flowId);
  if (delError) throw new Error(`email.replaceFlowSteps/delete: ${delError.message}`);
  const { data, error: insError } = await supabase
    .from('email_flow_steps')
    .insert(stepsData)
    .select(STEP_COLUMNS);
  if (insError) throw new Error(`email.replaceFlowSteps/insert: ${insError.message}`);
  return data ?? [];
}

// ─── Flow steps ───────────────────────────────────────────────────────────────

export async function findFlowForStepOp(teamId: string, flowId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_flows')
    .select('id, status')
    .eq('id', flowId)
    .eq('team_id', teamId)
    .single();
  return data ?? null;
}

export async function insertFlowStep(
  flowId: string,
  data: { step_number: number; subject: string; body: string; delay_days: number },
) {
  const supabase = createSupabaseAdminClient();
  const { data: step, error } = await supabase
    .from('email_flow_steps')
    .insert({ flow_id: flowId, ...data })
    .select(STEP_COLUMNS)
    .single();
  if (error) throw new Error(`email.insertFlowStep: ${error.message}`);
  return step;
}

export async function findFlowStep(flowId: string, stepId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_flow_steps')
    .select('id, step_number')
    .eq('id', stepId)
    .eq('flow_id', flowId)
    .single();
  return data ?? null;
}

export async function updateFlowStepById(
  flowId: string,
  stepId: string,
  updates: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_flow_steps')
    .update(updates)
    .eq('id', stepId)
    .eq('flow_id', flowId)
    .select(STEP_COLUMNS)
    .single();
  if (error) throw new Error(`email.updateFlowStepById: ${error.message}`);
  return data;
}

export async function deleteFlowStepById(stepId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('email_flow_steps').delete().eq('id', stepId);
  if (error) throw new Error(`email.deleteFlowStepById: ${error.message}`);
}

export async function renumberStepsAfter(
  flowId: string,
  deletedStepNumber: number,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: remaining } = await supabase
    .from('email_flow_steps')
    .select('id, step_number')
    .eq('flow_id', flowId)
    .gt('step_number', deletedStepNumber)
    .order('step_number', { ascending: true });
  if (!remaining || remaining.length === 0) return;
  for (const step of remaining) {
    await supabase
      .from('email_flow_steps')
      .update({ step_number: step.step_number - 1 })
      .eq('id', step.id);
  }
}

// ─── Flow contacts ────────────────────────────────────────────────────────────

export async function verifyFlowOwnership(teamId: string, flowId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_flows')
    .select('id')
    .eq('id', flowId)
    .eq('team_id', teamId)
    .single();
  return data ?? null;
}

export async function findFlowContactsPaginated(flowId: string, from: number, to: number) {
  const supabase = createSupabaseAdminClient();
  const [contactsResult, countResult] = await Promise.all([
    supabase
      .from('email_flow_contacts')
      .select(
        'id, flow_id, subscriber_id, current_step, status, entered_at, last_sent_at, email_subscribers!inner(email, first_name, last_name)',
      )
      .eq('flow_id', flowId)
      .order('entered_at', { ascending: false })
      .range(from, to),
    supabase
      .from('email_flow_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('flow_id', flowId),
  ]);
  if (contactsResult.error) throw new Error(`email.findFlowContacts: ${contactsResult.error.message}`);
  if (countResult.error) throw new Error(`email.countFlowContacts: ${countResult.error.message}`);
  return { data: contactsResult.data || [], count: countResult.count ?? 0 };
}

// ─── Subscribers ─────────────────────────────────────────────────────────────

export async function findSubscribersPaginated(
  teamId: string,
  opts: { search: string; status: string | null; source: string | null; from: number; to: number },
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('email_subscribers')
    .select(SUBSCRIBER_COLUMNS)
    .eq('team_id', teamId)
    .order('subscribed_at', { ascending: false })
    .range(opts.from, opts.to);
  let countQuery = supabase
    .from('email_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId);

  if (opts.search) {
    const ilike = `%${opts.search}%`;
    const filter = `email.ilike.${ilike},first_name.ilike.${ilike},last_name.ilike.${ilike}`;
    query = query.or(filter);
    countQuery = countQuery.or(filter);
  }
  if (opts.status) { query = query.eq('status', opts.status); countQuery = countQuery.eq('status', opts.status); }
  if (opts.source) { query = query.eq('source', opts.source); countQuery = countQuery.eq('source', opts.source); }

  const [dataResult, countResult] = await Promise.all([query, countQuery]);
  if (dataResult.error) throw new Error(`email.findSubscribers: ${dataResult.error.message}`);
  if (countResult.error) throw new Error(`email.countSubscribers: ${countResult.error.message}`);
  return { data: dataResult.data ?? [], count: countResult.count ?? 0 };
}

export async function findSubscriberByEmail(teamId: string, email: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_subscribers')
    .select(SUBSCRIBER_COLUMNS)
    .eq('team_id', teamId)
    .eq('email', email)
    .maybeSingle();
  return data ?? null;
}

/** For subscriber-sync webhook: fetch existing for merge (company, metadata). */
export async function findSubscriberForSync(teamId: string, email: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_subscribers')
    .select('id, first_name, last_name, company, metadata')
    .eq('team_id', teamId)
    .eq('email', email)
    .maybeSingle();
  return data ?? null;
}

/** Upsert subscriber from sync webhook (company, metadata supported). */
export async function upsertSubscriberSync(teamId: string, data: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { data: subscriber, error } = await supabase
    .from('email_subscribers')
    .upsert({ team_id: teamId, ...data }, { onConflict: 'team_id,email' })
    .select('id, email, first_name, last_name, company, source, status')
    .single();
  return { data: subscriber, error };
}

export async function upsertSubscriberRecord(teamId: string, data: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { data: subscriber, error } = await supabase
    .from('email_subscribers')
    .upsert({ team_id: teamId, ...data }, { onConflict: 'team_id,email' })
    .select(SUBSCRIBER_COLUMNS)
    .single();
  if (error) throw new Error(`email.upsertSubscriberRecord: ${error.message}`);
  return subscriber;
}

export async function findSubscriberByIdAndTeam(teamId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_subscribers')
    .select('id, team_id, status')
    .eq('id', id)
    .eq('team_id', teamId)
    .maybeSingle();
  return data ?? null;
}

export async function softUnsubscribeSubscriber(teamId: string, id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('email_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', teamId);
  if (error) throw new Error(`email.softUnsubscribeSubscriber: ${error.message}`);
}

export async function deactivateSubscriberFlowContacts(
  subscriberId: string,
  teamId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('email_flow_contacts')
    .update({ status: 'unsubscribed' })
    .eq('subscriber_id', subscriberId)
    .eq('team_id', teamId)
    .eq('status', 'active');
}

export async function findSubscribersByEmails(teamId: string, emails: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('email_subscribers')
    .select('email, first_name, last_name')
    .eq('team_id', teamId)
    .in('email', emails);
  return data ?? [];
}

export async function bulkUpsertSubscribers(
  rows: Array<{
    team_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    source: 'import';
    status: 'active';
  }>,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { error, count } = await supabase
    .from('email_subscribers')
    .upsert(rows, { onConflict: 'team_id,email', count: 'exact' });
  if (error) throw new Error(`email.bulkUpsertSubscribers: ${error.message}`);
  return count ?? rows.length;
}

// ─── Unsubscribe (public — no auth) ──────────────────────────────────────────

export async function unsubscribeSubscriberById(sid: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('email_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', sid);
  if (error) throw new Error(`email.unsubscribeSubscriberById: ${error.message}`);
}

export async function deactivateFlowContactsBySid(sid: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('email_flow_contacts')
    .update({ status: 'unsubscribed' })
    .eq('subscriber_id', sid)
    .eq('status', 'active');
}

// ─── AI generation context ────────────────────────────────────────────────────

export async function findLeadMagnetForEmail(userId: string, leadMagnetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('lead_magnets')
    .select('id, user_id, team_id, title, archetype, concept, extracted_content')
    .eq('id', leadMagnetId)
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function findBrandKitBasic(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('brand_kits')
    .select('business_description, sender_name, best_video_url, best_video_title, content_links, community_url')
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function findUserDisplayName(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('users').select('name').eq('id', userId).single();
  return data?.name ?? null;
}

// ─── Generate-daily context ───────────────────────────────────────────────────

export async function findTeamProfile(teamId: string, profileId?: string) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('team_profiles')
    .select('id, voice_profile, full_name')
    .eq('team_id', teamId)
    .eq('status', 'active');
  if (profileId) query = query.eq('id', profileId);
  const { data } = await query.limit(1);
  return data?.[0] ?? null;
}

export async function findTodayApprovedPost(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('cp_pipeline_posts')
    .select('draft_content')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .gte('created_at', today)
    .limit(1);
  return data?.[0]?.draft_content ?? null;
}

export async function createBroadcastDraft(
  teamId: string,
  userId: string,
  subject: string,
  body: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_broadcasts')
    .insert({ team_id: teamId, user_id: userId, subject, body, status: 'draft', recipient_count: 0 })
    .select('id, team_id, user_id, subject, body, status, recipient_count, created_at, updated_at')
    .single();
  if (error) throw new Error(`email.createBroadcastDraft: ${error.message}`);
  return data;
}
