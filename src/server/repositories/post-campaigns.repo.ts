/**
 * Post Campaigns Repository
 * All Supabase access for post_campaigns, post_campaign_leads, linkedin_daily_limits.
 * Never imports route-layer modules. Admin client only — no user JWT.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { POST_CAMPAIGN_COLUMNS, POST_CAMPAIGN_LEAD_COLUMNS } from '@/lib/types/post-campaigns';
import type {
  PostCampaignStatus,
  PostCampaignLeadStatus,
  PostCampaignLeadMatchType,
  CreatePostCampaignInput,
  UpdatePostCampaignInput,
} from '@/lib/types/post-campaigns';

// ─── Update Whitelist ──────────────────────────────────────────────────────

const ALLOWED_UPDATE_FIELDS = [
  'name',
  'post_url',
  'dm_template',
  'connect_message_template',
  'reply_template',
  'poster_account_id',
  'target_locations',
  'lead_expiry_days',
  'auto_accept_connections',
  'auto_like_comments',
  'auto_connect_non_requesters',
  'daily_dm_limit',
  'daily_connection_limit',
  'status',
] as const;

// ─── Campaigns ─────────────────────────────────────────────────────────────

export async function listCampaigns(userId: string, status?: PostCampaignStatus) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('post_campaigns')
    .select(POST_CAMPAIGN_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  return { data, error };
}

export async function getCampaign(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('post_campaigns')
    .select(POST_CAMPAIGN_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function createCampaign(
  userId: string,
  teamId: string | null,
  data: CreatePostCampaignInput
) {
  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from('post_campaigns')
    .insert({
      user_id: userId,
      team_id: teamId,
      name: data.name,
      post_url: data.post_url,
      keywords: data.keywords,
      unipile_account_id: data.unipile_account_id,
      sender_name: data.sender_name ?? null,
      dm_template: data.dm_template,
      connect_message_template: data.connect_message_template ?? null,
      reply_template: data.reply_template ?? null,
      poster_account_id: data.poster_account_id ?? null,
      target_locations: data.target_locations ?? [],
      lead_expiry_days: data.lead_expiry_days ?? 7,
      funnel_page_id: data.funnel_page_id ?? null,
      auto_accept_connections: data.auto_accept_connections ?? false,
      auto_like_comments: data.auto_like_comments ?? false,
      auto_connect_non_requesters: data.auto_connect_non_requesters ?? false,
      status: 'draft',
    })
    .select(POST_CAMPAIGN_COLUMNS)
    .single();
  return { data: row, error };
}

export async function updateCampaign(
  userId: string,
  id: string,
  updates: UpdatePostCampaignInput & { status?: PostCampaignStatus }
) {
  const supabase = createSupabaseAdminClient();

  // Filter through ALLOWED_UPDATE_FIELDS whitelist
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (key in updates) {
      filtered[key] = (updates as Record<string, unknown>)[key];
    }
  }
  filtered.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('post_campaigns')
    .update(filtered)
    .eq('id', id)
    .eq('user_id', userId)
    .select(POST_CAMPAIGN_COLUMNS)
    .single();
  return { data, error };
}

export async function deleteCampaign(userId: string, id: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('post_campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  return { error };
}

/** List all active campaigns regardless of user — used by Trigger.dev polling tasks. */
export async function listActiveCampaigns() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('post_campaigns')
    .select(POST_CAMPAIGN_COLUMNS)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  return { data, error };
}

// ─── Campaign Leads ─────────────────────────────────────────────────────────

export async function listCampaignLeads(
  userId: string,
  campaignId: string,
  status?: PostCampaignLeadStatus,
  limit?: number,
  offset?: number
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('post_campaign_leads')
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .order('detected_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (limit != null) query = query.limit(limit);
  if (offset != null) query = query.range(offset, offset + (limit ?? 50) - 1);

  const { data, error } = await query;
  return { data, error };
}

export async function insertCampaignLead(data: {
  user_id: string;
  campaign_id: string;
  signal_lead_id?: string | null;
  linkedin_url: string;
  linkedin_username?: string | null;
  unipile_provider_id?: string | null;
  name?: string | null;
  comment_text?: string | null;
  comment_social_id?: string | null;
  match_type?: PostCampaignLeadMatchType;
  location?: string | null;
  status: PostCampaignLeadStatus;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from('post_campaign_leads')
    .insert({
      user_id: data.user_id,
      campaign_id: data.campaign_id,
      signal_lead_id: data.signal_lead_id ?? null,
      linkedin_url: data.linkedin_url,
      linkedin_username: data.linkedin_username ?? null,
      unipile_provider_id: data.unipile_provider_id ?? null,
      name: data.name ?? null,
      comment_text: data.comment_text ?? null,
      comment_social_id: data.comment_social_id ?? null,
      match_type: data.match_type ?? 'keyword',
      location: data.location ?? null,
      status: data.status,
    })
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .single();
  return { data: row, error };
}

export async function updateCampaignLead(
  id: string,
  updates: {
    status?: PostCampaignLeadStatus;
    unipile_provider_id?: string | null;
    match_type?: PostCampaignLeadMatchType;
    location?: string | null;
    liked_at?: string | null;
    replied_at?: string | null;
    connection_requested_at?: string | null;
    connection_accepted_at?: string | null;
    dm_sent_at?: string | null;
    expired_at?: string | null;
    error?: string | null;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('post_campaign_leads')
    .update(updates)
    .eq('id', id)
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .single();
  return { data, error };
}

export async function findCampaignLeadByUrl(campaignId: string, linkedinUrl: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('post_campaign_leads')
    .select('id, status')
    .eq('campaign_id', campaignId)
    .eq('linkedin_url', linkedinUrl)
    .maybeSingle();
  return { data, error };
}

export async function findLeadsByStatus(
  campaignId: string,
  status: PostCampaignLeadStatus,
  limit?: number
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('post_campaign_leads')
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('status', status)
    .order('detected_at', { ascending: true });

  if (limit != null) query = query.limit(limit);

  const { data, error } = await query;
  return { data, error };
}

export async function findLeadsByStatuses(
  campaignId: string,
  statuses: PostCampaignLeadStatus[],
  limit?: number
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('post_campaign_leads')
    .select(POST_CAMPAIGN_LEAD_COLUMNS)
    .eq('campaign_id', campaignId)
    .in('status', statuses)
    .order('detected_at', { ascending: true });

  if (limit != null) query = query.limit(limit);

  const { data, error } = await query;
  return { data, error };
}

export async function isLinkedInUrlInAnyCampaign(linkedinUrl: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from('post_campaign_leads')
    .select('id', { count: 'exact', head: true })
    .eq('linkedin_url', linkedinUrl);
  return (count ?? 0) > 0;
}

/** Batch check: return the subset of URLs that already exist in any post campaign. */
export async function findLinkedInUrlsInAnyCampaign(urls: string[]): Promise<string[]> {
  if (urls.length === 0) return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('post_campaign_leads')
    .select('linkedin_url')
    .in('linkedin_url', urls);
  if (error || !data) return [];
  return [...new Set(data.map((row) => row.linkedin_url))];
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getCampaignStats(campaignId: string): Promise<Record<string, number>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('post_campaign_leads')
    .select('status')
    .eq('campaign_id', campaignId);

  if (error || !data) return {};

  return data.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
}

// ─── Daily Limits ───────────────────────────────────────────────────────────

export async function getDailyLimit(userId: string, accountId: string) {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const DAILY_LIMIT_COLUMNS =
    'id, user_id, unipile_account_id, date, dms_sent, connections_accepted, connection_requests_sent, comments_sent, likes_sent';

  const { data: existing, error: fetchError } = await supabase
    .from('linkedin_daily_limits')
    .select(DAILY_LIMIT_COLUMNS)
    .eq('user_id', userId)
    .eq('unipile_account_id', accountId)
    .eq('date', today)
    .maybeSingle();

  if (fetchError) return { data: null, error: fetchError };
  if (existing) return { data: existing, error: null };

  const { data: created, error: insertError } = await supabase
    .from('linkedin_daily_limits')
    .insert({
      user_id: userId,
      unipile_account_id: accountId,
      date: today,
      dms_sent: 0,
      connections_accepted: 0,
      connection_requests_sent: 0,
      comments_sent: 0,
      likes_sent: 0,
    })
    .select(DAILY_LIMIT_COLUMNS)
    .single();

  return { data: created, error: insertError };
}

export async function incrementDailyLimit(
  accountId: string,
  field:
    | 'dms_sent'
    | 'connections_accepted'
    | 'connection_requests_sent'
    | 'comments_sent'
    | 'likes_sent'
) {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.rpc('increment_daily_limit', {
    p_account_id: accountId,
    p_date: today,
    p_field: field,
  });
  return { error };
}
