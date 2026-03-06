/**
 * LinkedIn Repository
 * All Supabase access for LinkedIn schedule (cp_pipeline_posts, lead_magnets, usage) and automations.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function getSubscriptionPlan(userId: string): Promise<{ plan: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function insertScheduledPost(params: {
  userId: string;
  finalContent: string;
  scheduledTime: string;
  leadMagnetId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .insert({
      user_id: params.userId,
      final_content: params.finalContent,
      status: 'scheduled',
      scheduled_time: params.scheduledTime,
      lead_magnet_id: params.leadMagnetId,
    })
    .select('id')
    .single();
  return { data, error };
}

export async function updateLeadMagnetScheduled(
  leadMagnetId: string,
  userId: string,
  scheduledTime: string
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('lead_magnets')
    .update({ scheduled_time: scheduledTime, status: 'scheduled' })
    .eq('id', leadMagnetId)
    .eq('user_id', userId);
  return { error };
}

export async function incrementUsage(userId: string, limitType: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_limit_type: limitType,
  });
  return { error };
}

export async function listLinkedInAutomations(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_automations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function createLinkedInAutomation(
  userId: string,
  payload: {
    name: string;
    postId?: string | null;
    postSocialId?: string | null;
    keywords?: string[];
    dmTemplate?: string | null;
    autoConnect?: boolean;
    autoLike?: boolean;
    commentReplyTemplate?: string | null;
    enableFollowUp?: boolean;
    followUpTemplate?: string | null;
    followUpDelayMinutes?: number;
    unipileAccountId?: string | null;
    heyreachCampaignId?: string | null;
    resourceUrl?: string | null;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_automations')
    .insert({
      user_id: userId,
      name: payload.name,
      post_id: payload.postId ?? null,
      post_social_id: payload.postSocialId ?? null,
      keywords: payload.keywords ?? [],
      dm_template: payload.dmTemplate ?? null,
      auto_connect: payload.autoConnect ?? false,
      auto_like: payload.autoLike ?? false,
      comment_reply_template: payload.commentReplyTemplate ?? null,
      enable_follow_up: payload.enableFollowUp ?? false,
      follow_up_template: payload.followUpTemplate ?? null,
      follow_up_delay_minutes: payload.followUpDelayMinutes ?? 1440,
      unipile_account_id: payload.unipileAccountId ?? null,
      heyreach_campaign_id: payload.heyreachCampaignId ?? null,
      resource_url: payload.resourceUrl ?? null,
    })
    .select()
    .single();
  return { data, error };
}

export async function getLinkedInAutomation(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_automations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function getLinkedInAutomationEvents(automationId: string, limit: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_automation_events')
    .select('*')
    .eq('automation_id', automationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data ?? [], error };
}

const ALLOWED_UPDATE_FIELDS = [
  'name',
  'post_social_id',
  'keywords',
  'dm_template',
  'auto_connect',
  'auto_like',
  'comment_reply_template',
  'enable_follow_up',
  'follow_up_template',
  'follow_up_delay_minutes',
  'status',
  'unipile_account_id',
  'heyreach_campaign_id',
  'resource_url',
] as const;

export async function updateLinkedInAutomation(
  id: string,
  userId: string,
  updates: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  const sanitized: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (key in updates) sanitized[key] = updates[key];
  }
  const { data, error } = await supabase
    .from('linkedin_automations')
    .update(sanitized)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

export async function deleteLinkedInAutomation(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('linkedin_automations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  return { error };
}
