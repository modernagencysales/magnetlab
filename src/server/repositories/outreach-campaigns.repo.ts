/**
 * Outreach Campaigns Repository
 * All Supabase access for outreach_campaigns, outreach_campaign_steps, outreach_campaign_leads.
 * Admin client only — no user JWT. Never imports route-layer modules.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { extractLinkedInUsername } from '@/lib/utils/linkedin-url';
import {
  OUTREACH_CAMPAIGN_COLUMNS,
  OUTREACH_STEP_COLUMNS,
  OUTREACH_LEAD_COLUMNS,
  ALLOWED_CAMPAIGN_UPDATE_FIELDS,
  PRESET_STEPS,
} from '@/lib/types/outreach-campaigns';
import type {
  OutreachCampaignStatus,
  OutreachLeadStatus,
  CreateOutreachCampaignInput,
  UpdateOutreachCampaignInput,
  AddOutreachLeadInput,
  OutreachCampaignStats,
  OutreachCampaignProgress,
} from '@/lib/types/outreach-campaigns';

// ─── Campaigns ──────────────────────────────────────────────────────────────

export async function createCampaign(
  userId: string,
  teamId: string | null,
  input: CreateOutreachCampaignInput
) {
  const supabase = createSupabaseAdminClient();

  const { data: campaign, error } = await supabase
    .from('outreach_campaigns')
    .insert({
      user_id: userId,
      team_id: teamId,
      name: input.name,
      preset: input.preset,
      unipile_account_id: input.unipile_account_id,
      first_message_template: input.first_message_template,
      connect_message: input.connect_message ?? null,
      follow_up_template: input.follow_up_template ?? null,
      follow_up_delay_days: input.follow_up_delay_days ?? 3,
      withdraw_delay_days: input.withdraw_delay_days ?? 14,
      status: 'draft',
    })
    .select(OUTREACH_CAMPAIGN_COLUMNS)
    .single();

  if (error || !campaign) return { data: null, error };

  // Expand preset into step rows
  const steps = PRESET_STEPS[input.preset].map((step) => ({
    campaign_id: campaign.id,
    ...step,
    config: {},
  }));
  await supabase.from('outreach_campaign_steps').insert(steps);

  return { data: campaign, error: null };
}

export async function getCampaign(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaigns')
    .select(OUTREACH_CAMPAIGN_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function listCampaigns(userId: string, status?: OutreachCampaignStatus) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('outreach_campaigns')
    .select(OUTREACH_CAMPAIGN_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  return { data, error };
}

export async function updateCampaign(
  userId: string,
  id: string,
  input: UpdateOutreachCampaignInput
) {
  const supabase = createSupabaseAdminClient();

  // Filter through ALLOWED_CAMPAIGN_UPDATE_FIELDS whitelist
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_CAMPAIGN_UPDATE_FIELDS) {
    if (key in input) {
      filtered[key] = (input as Record<string, unknown>)[key];
    }
  }
  filtered.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('outreach_campaigns')
    .update(filtered)
    .eq('id', id)
    .eq('user_id', userId)
    .select(OUTREACH_CAMPAIGN_COLUMNS)
    .single();
  return { data, error };
}

export async function deleteCampaign(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('outreach_campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  return { error };
}

/** List all active campaigns regardless of user — used by Trigger.dev advancer tasks. */
export async function listActiveCampaigns() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaigns')
    .select(OUTREACH_CAMPAIGN_COLUMNS)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  return { data, error };
}

// ─── Steps ───────────────────────────────────────────────────────────────────

export async function getSteps(campaignId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaign_steps')
    .select(OUTREACH_STEP_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('step_order', { ascending: true });
  return { data, error };
}

// ─── Leads ───────────────────────────────────────────────────────────────────

/** Insert leads for a campaign. Deduplicates within the campaign by linkedin_url. Max 500 per call. */
export async function bulkAddLeads(
  userId: string,
  campaignId: string,
  leads: AddOutreachLeadInput[]
) {
  if (leads.length === 0) return { inserted: 0, error: null };

  const batch = leads.slice(0, 500);
  const supabase = createSupabaseAdminClient();

  // Fetch existing URLs in this campaign to dedup
  const urls = batch.map((l) => l.linkedin_url);
  const { data: existing } = await supabase
    .from('outreach_campaign_leads')
    .select('linkedin_url')
    .eq('campaign_id', campaignId)
    .in('linkedin_url', urls);

  const existingUrls = new Set(
    (existing ?? []).map((r: { linkedin_url: string }) => r.linkedin_url)
  );

  const toInsert = batch
    .filter((l) => !existingUrls.has(l.linkedin_url))
    .map((l) => ({
      user_id: userId,
      campaign_id: campaignId,
      linkedin_url: l.linkedin_url,
      linkedin_username: extractLinkedInUsername(l.linkedin_url),
      name: l.name ?? null,
      company: l.company ?? null,
      status: 'pending' as OutreachLeadStatus,
      current_step_order: 0,
    }));

  if (toInsert.length === 0) return { inserted: 0, error: null };

  const { data, error } = await supabase
    .from('outreach_campaign_leads')
    .insert(toInsert)
    .select('id');

  return { inserted: data?.length ?? 0, error };
}

export async function listLeads(userId: string, campaignId: string, status?: OutreachLeadStatus) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('outreach_campaign_leads')
    .select(OUTREACH_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  return { data, error };
}

export async function getLead(userId: string, leadId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaign_leads')
    .select(OUTREACH_LEAD_COLUMNS)
    .eq('id', leadId)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

/** Update specific fields on a lead — internal only, no whitelist needed. */
export async function updateLead(
  leadId: string,
  fields: {
    status?: OutreachLeadStatus;
    current_step_order?: number;
    step_completed_at?: string | null;
    viewed_at?: string | null;
    connect_sent_at?: string | null;
    connected_at?: string | null;
    messaged_at?: string | null;
    follow_up_sent_at?: string | null;
    withdrawn_at?: string | null;
    unipile_provider_id?: string | null;
    error?: string | null;
    updated_at?: string;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaign_leads')
    .update({ ...fields, updated_at: fields.updated_at ?? new Date().toISOString() })
    .eq('id', leadId)
    .select(OUTREACH_LEAD_COLUMNS)
    .single();
  return { data, error };
}

export async function skipLead(leadId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaign_leads')
    .update({ status: 'skipped', updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select(OUTREACH_LEAD_COLUMNS)
    .single();
  return { data, error };
}

/** Get leads by status for a campaign — used by the sequence advancer. */
export async function getLeadsByStatus(
  campaignId: string,
  status: OutreachLeadStatus,
  limit?: number
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('outreach_campaign_leads')
    .select(OUTREACH_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('status', status)
    .order('created_at', { ascending: true });

  if (limit != null) query = query.limit(limit);

  const { data, error } = await query;
  return { data, error };
}

/**
 * Get active leads that have been messaged but not yet followed up.
 * Used by check-outreach-replies to find leads requiring reply detection or follow-up.
 */
export async function getMessagedLeadsPendingFollowUp(campaignId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaign_leads')
    .select(OUTREACH_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('status', 'active')
    .not('messaged_at', 'is', null)
    .is('follow_up_sent_at', null)
    .order('messaged_at', { ascending: true });
  return { data, error };
}

/** Get leads by multiple statuses for a campaign — used by the sequence advancer. */
export async function getLeadsByStatuses(campaignId: string, statuses: OutreachLeadStatus[]) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaign_leads')
    .select(OUTREACH_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .in('status', statuses)
    .order('created_at', { ascending: true });
  return { data, error };
}

/** Update campaign status directly — internal only, no user_id scoping. Used by Trigger.dev tasks. */
export async function updateCampaignStatusInternal(
  campaignId: string,
  status: OutreachCampaignStatus
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaigns')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .select(OUTREACH_CAMPAIGN_COLUMNS)
    .single();
  return { data, error };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getCampaignStats(campaignId: string): Promise<OutreachCampaignStats> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaign_leads')
    .select('status')
    .eq('campaign_id', campaignId);

  if (error || !data) {
    return {
      total: 0,
      pending: 0,
      active: 0,
      completed: 0,
      replied: 0,
      withdrawn: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const counts = data.reduce<Record<string, number>>((acc, row: { status: string }) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: data.length,
    pending: counts['pending'] ?? 0,
    active: counts['active'] ?? 0,
    completed: counts['completed'] ?? 0,
    replied: counts['replied'] ?? 0,
    withdrawn: counts['withdrawn'] ?? 0,
    failed: counts['failed'] ?? 0,
    skipped: counts['skipped'] ?? 0,
  };
}

export async function getCampaignProgress(campaignId: string): Promise<OutreachCampaignProgress> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('outreach_campaign_leads')
    .select('viewed_at, connect_sent_at, connected_at, messaged_at, follow_up_sent_at')
    .eq('campaign_id', campaignId);

  if (error || !data) {
    return { viewed: 0, connect_sent: 0, connected: 0, messaged: 0, follow_up_sent: 0 };
  }

  type ProgressRow = {
    viewed_at: string | null;
    connect_sent_at: string | null;
    connected_at: string | null;
    messaged_at: string | null;
    follow_up_sent_at: string | null;
  };

  return {
    viewed: data.filter((r: ProgressRow) => r.viewed_at != null).length,
    connect_sent: data.filter((r: ProgressRow) => r.connect_sent_at != null).length,
    connected: data.filter((r: ProgressRow) => r.connected_at != null).length,
    messaged: data.filter((r: ProgressRow) => r.messaged_at != null).length,
    follow_up_sent: data.filter((r: ProgressRow) => r.follow_up_sent_at != null).length,
  };
}
