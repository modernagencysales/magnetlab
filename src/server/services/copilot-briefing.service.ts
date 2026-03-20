/**
 * Copilot Briefing Service.
 * Fetches live dashboard metrics and formats them as a system prompt briefing.
 * Constraint: Never imported by 'use client' files.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefingData {
  queueCount: number;
  scheduledThisWeek: number;
  autopilotStatus: 'running' | 'paused' | 'no_ideas';
  ideasRemaining: number;
  nextScheduledPost: string | null;
  newLeadsCount: number;
  newLeadsBySource: { source: string; count: number }[];
  activeCampaigns: { postCampaigns: number; outreachSequences: number };
  magnetCount: number;
  publishedMagnetCount: number;
}

// ─── Column selects ───────────────────────────────────────────────────────────

const POST_QUEUE_COLUMNS = 'id';
const SCHEDULED_POST_COLUMNS = 'scheduled_time';
const IDEA_COLUMNS = 'id';
const LEAD_COLUMNS = 'lead_magnet_id';
const LEAD_MAGNET_TITLE_COLUMNS = 'id, title';
const CAMPAIGN_COUNT_COLUMNS = 'id';
const MAGNET_COUNT_COLUMNS = 'id';

// ─── Scope helpers ────────────────────────────────────────────────────────────

/**
 * Apply scope to cp_pipeline_posts.
 * In team mode, resolve team_profile_id via team_profiles lookup (cp_pipeline_posts uses team_profile_id).
 * In personal mode, scope to user_id.
 * Extra query is small and runs once per homepage load — acceptable trade-off.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function applyPostScope(
  query: any,
  scope: DataScope,
  supabase: SupabaseClient
): Promise<any> {
  if (scope.type === 'team' && scope.teamId) {
    const { data: profile } = await supabase
      .from('team_profiles')
      .select('id')
      .eq('team_id', scope.teamId)
      .eq('user_id', scope.userId)
      .maybeSingle();
    if (profile) {
      return query.eq('team_profile_id', profile.id);
    }
  }
  return query.eq('user_id', scope.userId);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Apply scope to cp_content_ideas — has team_id for team mode.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyIdeasScope(query: any, scope: DataScope): any {
  if (scope.type === 'team' && scope.teamId) {
    return query.eq('team_id', scope.teamId);
  }
  return query.eq('user_id', scope.userId);
}

/**
 * Apply scope to post_campaigns — has user_id only (no team_id column).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPostCampaignScope(query: any, scope: DataScope): any {
  return query.eq('user_id', scope.userId);
}

// ─── fetchBriefingData ────────────────────────────────────────────────────────

/**
 * Fetch all live metrics needed for the copilot briefing.
 * Runs parallel queries across 6 data domains.
 */
export async function fetchBriefingData(
  supabase: SupabaseClient,
  scope: DataScope
): Promise<BriefingData> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekStart = getWeekStart(now).toISOString();
  const weekEnd = getWeekEnd(now).toISOString();

  // ── Query 1: Posts pending review (status = 'reviewing') ──────────────────
  const queueQuery = await applyPostScope(
    supabase
      .from('cp_pipeline_posts')
      .select(POST_QUEUE_COLUMNS, { count: 'exact', head: true })
      .eq('status', 'reviewing'),
    scope,
    supabase
  );

  // ── Query 2: Scheduled posts this week ────────────────────────────────────
  const scheduledQuery = await applyPostScope(
    supabase
      .from('cp_pipeline_posts')
      .select(SCHEDULED_POST_COLUMNS, { count: 'exact' })
      .eq('status', 'scheduled')
      .gte('scheduled_time', weekStart)
      .lte('scheduled_time', weekEnd)
      .order('scheduled_time', { ascending: true }),
    scope,
    supabase
  );

  // ── Query 3: Ideas remaining (actionable statuses) ─────────────────────────
  const ideasQuery = applyIdeasScope(
    supabase
      .from('cp_content_ideas')
      .select(IDEA_COLUMNS, { count: 'exact', head: true })
      .in('status', ['new', 'extracted', 'selected', 'approved']),
    scope
  );

  // ── Query 4a: New leads in last 7 days ─────────────────────────────────────
  const leadsQuery = applyScope(
    supabase.from('funnel_leads').select(LEAD_COLUMNS).gte('created_at', sevenDaysAgo),
    scope
  );

  // ── Query 5a: Active post campaigns ───────────────────────────────────────
  const postCampaignsQuery = applyPostCampaignScope(
    supabase
      .from('post_campaigns')
      .select(CAMPAIGN_COUNT_COLUMNS, { count: 'exact', head: true })
      .eq('status', 'active'),
    scope
  );

  // ── Query 5b: Active outreach campaigns ───────────────────────────────────
  const outreachQuery = applyScope(
    supabase
      .from('outreach_campaigns')
      .select(CAMPAIGN_COUNT_COLUMNS, { count: 'exact', head: true })
      .eq('status', 'active'),
    scope
  );

  // ── Query 6a: Total lead magnets ───────────────────────────────────────────
  const magnetTotalQuery = applyScope(
    supabase.from('lead_magnets').select(MAGNET_COUNT_COLUMNS, { count: 'exact', head: true }),
    scope
  );

  // ── Query 6b: Published lead magnets ──────────────────────────────────────
  const magnetPublishedQuery = applyScope(
    supabase
      .from('lead_magnets')
      .select(MAGNET_COUNT_COLUMNS, { count: 'exact', head: true })
      .eq('status', 'published'),
    scope
  );

  // ── Run all queries in parallel ───────────────────────────────────────────
  const [
    queueRes,
    scheduledRes,
    ideasRes,
    leadsRes,
    postCampaignsRes,
    outreachRes,
    magnetTotalRes,
    magnetPublishedRes,
  ] = await Promise.all([
    queueQuery,
    scheduledQuery,
    ideasQuery,
    leadsQuery,
    postCampaignsQuery,
    outreachQuery,
    magnetTotalQuery,
    magnetPublishedQuery,
  ]);

  // ── Derive leads by source ─────────────────────────────────────────────────
  const leadsData = (leadsRes.data ?? []) as { lead_magnet_id: string | null }[];
  const newLeadsCount = leadsData.length;
  const newLeadsBySource = await resolveLeadsBySource(supabase, scope, leadsData);

  // ── Derive scheduled posts data ────────────────────────────────────────────
  const scheduledData = (scheduledRes.data ?? []) as { scheduled_time: string }[];
  const scheduledThisWeek = scheduledData.length;
  const nextScheduledPost = scheduledData.length > 0 ? scheduledData[0].scheduled_time : null;

  // ── Derive autopilot status ────────────────────────────────────────────────
  const ideasRemaining = ideasRes.count ?? 0;
  const autopilotStatus = deriveAutopilotStatus(ideasRemaining, scheduledThisWeek);

  return {
    queueCount: queueRes.count ?? 0,
    scheduledThisWeek,
    autopilotStatus,
    ideasRemaining,
    nextScheduledPost,
    newLeadsCount,
    newLeadsBySource,
    activeCampaigns: {
      postCampaigns: postCampaignsRes.count ?? 0,
      outreachSequences: outreachRes.count ?? 0,
    },
    magnetCount: magnetTotalRes.count ?? 0,
    publishedMagnetCount: magnetPublishedRes.count ?? 0,
  };
}

// ─── resolveLeadsBySource ─────────────────────────────────────────────────────

/**
 * Group leads by their lead magnet title (source).
 * Fetches lead_magnet titles for all magnet IDs found in the leads batch.
 */
async function resolveLeadsBySource(
  supabase: SupabaseClient,
  scope: DataScope,
  leads: { lead_magnet_id: string | null }[]
): Promise<{ source: string; count: number }[]> {
  if (leads.length === 0) return [];

  const magnetIds = [...new Set(leads.map((l) => l.lead_magnet_id).filter(Boolean))] as string[];
  if (magnetIds.length === 0) return [];

  const { data: magnets } = await applyScope(
    supabase.from('lead_magnets').select(LEAD_MAGNET_TITLE_COLUMNS).in('id', magnetIds),
    scope
  );

  const magnetMap = new Map<string, string>(
    ((magnets ?? []) as { id: string; title: string }[]).map((m) => [m.id, m.title])
  );

  // Aggregate counts per magnet title
  const countMap = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.lead_magnet_id) continue;
    const title = magnetMap.get(lead.lead_magnet_id) ?? lead.lead_magnet_id;
    countMap.set(title, (countMap.get(title) ?? 0) + 1);
  }

  return Array.from(countMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── deriveAutopilotStatus ────────────────────────────────────────────────────

function deriveAutopilotStatus(
  ideasRemaining: number,
  scheduledThisWeek: number
): BriefingData['autopilotStatus'] {
  if (ideasRemaining === 0) return 'no_ideas';
  if (scheduledThisWeek > 0) return 'running';
  return 'paused';
}

// ─── Week boundary helpers ────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ─── formatBriefingPrompt ─────────────────────────────────────────────────────

/**
 * Format BriefingData into a markdown system prompt section.
 */
export function formatBriefingPrompt(data: BriefingData): string {
  const nextPost = data.nextScheduledPost
    ? formatDateTime(data.nextScheduledPost)
    : 'none upcoming';

  const sourceLines =
    data.newLeadsBySource.length > 0
      ? data.newLeadsBySource.map((s) => `  - ${s.count} from "${s.source}"`).join('\n')
      : '  - (no leads this week)';

  return `## Current Status Briefing

Content Queue: ${data.queueCount} posts pending review, ${data.scheduledThisWeek} scheduled for this week
Autopilot: ${data.autopilotStatus} — ${data.ideasRemaining} ideas remaining, next post scheduled ${nextPost}
New Leads: ${data.newLeadsCount} this week
${sourceLines}
Active Campaigns: ${data.activeCampaigns.postCampaigns} post campaigns, ${data.activeCampaigns.outreachSequences} outreach sequences
Lead Magnets: ${data.magnetCount} total (${data.publishedMagnetCount} published with funnels)

The user is on the homepage and may ask about any of these. Proactively reference relevant status when it's useful context for their question.`;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
  } catch {
    return isoString;
  }
}
