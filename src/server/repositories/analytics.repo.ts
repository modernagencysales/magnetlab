/**
 * Analytics Repository
 * ALL Supabase for analytics overview, engagement, email, funnel detail.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

export async function getFunnelIdsByScope(scope: DataScope): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const query = applyScope(supabase.from('funnel_pages').select('id'), scope);
  const { data, error } = await query;
  if (error) throw new Error(`analytics.getFunnelIdsByScope: ${error.message}`);
  return (data ?? []).map((r: { id: string }) => r.id);
}

export async function getContentPipelineStats(scope: DataScope): Promise<{
  posts: { status: string }[];
  transcriptsCount: number;
  knowledgeCount: number;
}> {
  const supabase = createSupabaseAdminClient();
  const postsQuery = applyScope(supabase.from('cp_pipeline_posts').select('status'), scope);
  const transcriptsQuery = applyScope(
    supabase.from('cp_call_transcripts').select('id', { count: 'exact', head: true }),
    scope,
  );
  const knowledgeQuery = applyScope(
    supabase.from('cp_knowledge_entries').select('id', { count: 'exact', head: true }),
    scope,
  );
  const [postsRes, transcriptsRes, knowledgeRes] = await Promise.all([
    postsQuery,
    transcriptsQuery,
    knowledgeQuery,
  ]);
  if (postsRes.error) throw new Error(`analytics.getContentPipelineStats posts: ${postsRes.error.message}`);
  if (transcriptsRes.error) throw new Error(`analytics.getContentPipelineStats transcripts: ${transcriptsRes.error.message}`);
  if (knowledgeRes.error) throw new Error(`analytics.getContentPipelineStats knowledge: ${knowledgeRes.error.message}`);
  return {
    posts: (postsRes.data ?? []) as { status: string }[],
    transcriptsCount: transcriptsRes.count ?? 0,
    knowledgeCount: knowledgeRes.count ?? 0,
  };
}

export async function getPageViewsAndLeads(
  funnelIds: string[],
  startDate: string,
): Promise<{
  views: { funnel_page_id: string; view_date: string }[];
  leads: { funnel_page_id: string; is_qualified: boolean | null; utm_source: string | null; created_at: string }[];
}> {
  if (funnelIds.length === 0) {
    return { views: [], leads: [] };
  }
  const supabase = createSupabaseAdminClient();
  const [viewsRes, leadsRes] = await Promise.all([
    supabase
      .from('page_views')
      .select('funnel_page_id, view_date')
      .in('funnel_page_id', funnelIds)
      .gte('view_date', startDate)
      .order('view_date'),
    supabase
      .from('funnel_leads')
      .select('funnel_page_id, is_qualified, utm_source, created_at')
      .in('funnel_page_id', funnelIds)
      .gte('created_at', `${startDate}T00:00:00Z`)
      .order('created_at'),
  ]);
  if (viewsRes.error) throw new Error(`analytics.getPageViewsAndLeads views: ${viewsRes.error.message}`);
  if (leadsRes.error) throw new Error(`analytics.getPageViewsAndLeads leads: ${leadsRes.error.message}`);
  return {
    views: (viewsRes.data ?? []) as { funnel_page_id: string; view_date: string }[],
    leads: (leadsRes.data ?? []) as { funnel_page_id: string; is_qualified: boolean | null; utm_source: string | null; created_at: string }[],
  };
}

export async function getPublishedPostsByUserId(userId: string): Promise<{ id: string; title: string | null; published_at: string | null; linkedin_post_id: string | null }[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id, title, published_at, linkedin_post_id')
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw new Error(`analytics.getPublishedPostsByUserId: ${error.message}`);
  return (data ?? []) as { id: string; title: string | null; published_at: string | null; linkedin_post_id: string | null }[];
}

export async function getEngagementsByPostIds(postIds: string[]): Promise<{ post_id: string; engagement_type: string }[]> {
  if (postIds.length === 0) return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_post_engagements')
    .select('post_id, engagement_type')
    .in('post_id', postIds);
  if (error) throw new Error(`analytics.getEngagementsByPostIds: ${error.message}`);
  return (data ?? []) as { post_id: string; engagement_type: string }[];
}

export async function getAutomationsAndEvents(userId: string, postIds: string[]): Promise<{
  automationToPost: Record<string, string>;
  events: { automation_id: string; event_type: string }[];
}> {
  if (postIds.length === 0) return { automationToPost: {}, events: [] };
  const supabase = createSupabaseAdminClient();
  const { data: automations, error: autoError } = await supabase
    .from('linkedin_automations')
    .select('id, post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  if (autoError) throw new Error(`analytics.getAutomationsAndEvents: ${autoError.message}`);
  const automationToPost: Record<string, string> = {};
  const automationIds: string[] = [];
  for (const a of automations ?? []) {
    const row = a as { id: string; post_id: string | null };
    automationIds.push(row.id);
    if (row.post_id) automationToPost[row.id] = row.post_id;
  }
  if (automationIds.length === 0) return { automationToPost, events: [] };
  const { data: events, error: eventsError } = await supabase
    .from('linkedin_automation_events')
    .select('automation_id, event_type')
    .in('automation_id', automationIds)
    .in('event_type', ['dm_sent', 'dm_failed']);
  if (eventsError) throw new Error(`analytics.getAutomationsAndEvents events: ${eventsError.message}`);
  return {
    automationToPost,
    events: (events ?? []) as { automation_id: string; event_type: string }[],
  };
}

export async function getEmailEventsByUserId(userId: string, startIso: string): Promise<{ event_type: string; lead_magnet_id: string | null }[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_events')
    .select('event_type, lead_magnet_id')
    .eq('user_id', userId)
    .gte('created_at', startIso);
  if (error) throw new Error(`analytics.getEmailEventsByUserId: ${error.message}`);
  return (data ?? []) as { event_type: string; lead_magnet_id: string | null }[];
}

export async function getLeadMagnetTitles(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('lead_magnets').select('id, title').in('id', ids);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as { id: string; title: string | null };
    map[r.id] = r.title || 'Untitled';
  }
  return map;
}

export async function getFunnelByIdAndScope(
  funnelId: string,
  scope: DataScope,
): Promise<{ id: string; slug: string; optin_headline: string } | null> {
  const supabase = createSupabaseAdminClient();
  const query = applyScope(
    supabase.from('funnel_pages').select('id, slug, optin_headline').eq('id', funnelId),
    scope,
  );
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as { id: string; slug: string; optin_headline: string };
}

export async function getFunnelDetailViewsAndLeads(
  funnelId: string,
  startDate: string,
): Promise<{
  optinViews: { view_date: string }[];
  thankyouViews: { view_date: string }[];
  leads: { id: string; email: string; name: string | null; is_qualified: boolean | null; qualification_answers: unknown; utm_source: string | null; created_at: string }[];
}> {
  const supabase = createSupabaseAdminClient();
  const [optinRes, thankyouRes, leadsRes] = await Promise.all([
    supabase
      .from('page_views')
      .select('view_date')
      .eq('funnel_page_id', funnelId)
      .eq('page_type', 'optin')
      .gte('view_date', startDate)
      .order('view_date'),
    supabase
      .from('page_views')
      .select('view_date')
      .eq('funnel_page_id', funnelId)
      .eq('page_type', 'thankyou')
      .gte('view_date', startDate)
      .order('view_date'),
    supabase
      .from('funnel_leads')
      .select('id, email, name, is_qualified, qualification_answers, utm_source, created_at')
      .eq('funnel_page_id', funnelId)
      .gte('created_at', `${startDate}T00:00:00Z`)
      .order('created_at'),
  ]);
  if (optinRes.error) throw new Error(`analytics.getFunnelDetailViewsAndLeads optin: ${optinRes.error.message}`);
  if (thankyouRes.error) throw new Error(`analytics.getFunnelDetailViewsAndLeads thankyou: ${thankyouRes.error.message}`);
  if (leadsRes.error) throw new Error(`analytics.getFunnelDetailViewsAndLeads leads: ${leadsRes.error.message}`);
  return {
    optinViews: (optinRes.data ?? []) as { view_date: string }[],
    thankyouViews: (thankyouRes.data ?? []) as { view_date: string }[],
    leads: (leadsRes.data ?? []) as { id: string; email: string; name: string | null; is_qualified: boolean | null; qualification_answers: unknown; utm_source: string | null; created_at: string }[],
  };
}
