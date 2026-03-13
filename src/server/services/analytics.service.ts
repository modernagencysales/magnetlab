/**
 * Analytics Service
 * Builds overview, engagement, email, funnel-detail, performance-insights, and recommendations.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { VALID_RANGES, parseDays, buildDateRange, type Range } from '@/lib/utils/analytics-helpers';
import type { DataScope } from '@/lib/utils/team-context';
import * as analyticsRepo from '@/server/repositories/analytics.repo';

// ─── Performance Insights ────────────────────────────────────────────────────

export const VALID_PERIODS = ['last_7_days', 'last_30_days', 'last_90_days', 'all_time'] as const;
export type Period = (typeof VALID_PERIODS)[number];

function periodToStartDate(period: Period): string | null {
  if (period === 'all_time') return null;
  const days = period === 'last_7_days' ? 7 : period === 'last_30_days' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export interface ArchetypeStat {
  archetype: string;
  leads: number;
  conversion_rate: number;
}

export interface LeadMagnetStat {
  id: string;
  title: string;
  leads: number;
  views: number;
}

export interface PerformanceInsightsResult {
  top_archetypes: ArchetypeStat[];
  top_lead_magnets: LeadMagnetStat[];
  totals: {
    total_leads: number;
    total_views: number;
    avg_conversion_rate: number;
  };
  period: Period;
}

export async function getPerformanceInsights(
  scope: DataScope,
  period: Period
): Promise<PerformanceInsightsResult> {
  const startDate = periodToStartDate(period);

  const funnelPages = await analyticsRepo.getFunnelPagesWithMagnet(scope);
  if (funnelPages.length === 0) {
    return {
      top_archetypes: [],
      top_lead_magnets: [],
      totals: { total_leads: 0, total_views: 0, avg_conversion_rate: 0 },
      period,
    };
  }

  const funnelPageIds = funnelPages.map((fp) => fp.id);
  const leadMagnetIds = [...new Set(funnelPages.map((fp) => fp.lead_magnet_id).filter(Boolean))];

  const [leads, views, leadMagnets] = await Promise.all([
    analyticsRepo.getFunnelLeadsByPageIds(funnelPageIds, startDate),
    analyticsRepo.getPageViewsByPageIds(funnelPageIds, startDate),
    analyticsRepo.getLeadMagnetsByIds(leadMagnetIds),
  ]);

  // Build lookup: funnelPageId → leadMagnetId
  const pageToMagnet = new Map<string, string>();
  for (const fp of funnelPages) {
    if (fp.lead_magnet_id) pageToMagnet.set(fp.id, fp.lead_magnet_id);
  }

  // Build lookup: leadMagnetId → LeadMagnetRow
  const magnetById = new Map(leadMagnets.map((lm) => [lm.id, lm]));

  // Per-magnet lead/view counts
  const magnetLeads = new Map<string, number>();
  const magnetViews = new Map<string, number>();

  for (const lead of leads) {
    const magId = pageToMagnet.get(lead.funnel_page_id);
    if (magId) magnetLeads.set(magId, (magnetLeads.get(magId) ?? 0) + 1);
  }
  for (const view of views) {
    const magId = pageToMagnet.get(view.funnel_page_id);
    if (magId) magnetViews.set(magId, (magnetViews.get(magId) ?? 0) + 1);
  }

  // top_lead_magnets: all magnets with activity, sorted by leads desc
  const top_lead_magnets: LeadMagnetStat[] = leadMagnets
    .map((lm) => ({
      id: lm.id,
      title: lm.title,
      leads: magnetLeads.get(lm.id) ?? 0,
      views: magnetViews.get(lm.id) ?? 0,
    }))
    .filter((lm) => lm.leads > 0 || lm.views > 0)
    .sort((a, b) => b.leads - a.leads);

  // Per-archetype lead/view counts
  const archetypeLeads = new Map<string, number>();
  const archetypeViews = new Map<string, number>();

  for (const [magId, count] of magnetLeads) {
    const lm = magnetById.get(magId);
    if (lm) archetypeLeads.set(lm.archetype, (archetypeLeads.get(lm.archetype) ?? 0) + count);
  }
  for (const [magId, count] of magnetViews) {
    const lm = magnetById.get(magId);
    if (lm) archetypeViews.set(lm.archetype, (archetypeViews.get(lm.archetype) ?? 0) + count);
  }

  const top_archetypes: ArchetypeStat[] = Array.from(archetypeLeads.entries())
    .map(([archetype, arcLeads]) => {
      const arcViews = archetypeViews.get(archetype) ?? 0;
      return {
        archetype,
        leads: arcLeads,
        conversion_rate: arcViews > 0 ? Math.round((arcLeads / arcViews) * 100) : 0,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  const totalLeads = leads.length;
  const totalViews = views.length;

  return {
    top_archetypes,
    top_lead_magnets,
    totals: {
      total_leads: totalLeads,
      total_views: totalViews,
      avg_conversion_rate: totalViews > 0 ? Math.round((totalLeads / totalViews) * 100) : 0,
    },
    period,
  };
}

// ─── Recommendations (Phase 1 Stub) ─────────────────────────────────────────

export interface Suggestion {
  type: 'content_gap' | 'performance' | 'general';
  message: string;
}

export interface RecommendationsResult {
  phase: 'stub';
  note: string;
  suggestions: Suggestion[];
}

export async function getRecommendations(scope: DataScope): Promise<RecommendationsResult> {
  const userId = scope.userId;

  // Collect data in parallel; errors in either should surface (not swallowed)
  const [topics, funnelPages] = await Promise.all([
    analyticsRepo.getKnowledgeTopics(userId),
    analyticsRepo.getFunnelPagesWithMagnet(scope),
  ]);

  const suggestions: Suggestion[] = [];

  // ─── Content gap: expertise with no lead magnet ──────────────────────────
  if (topics.length > 0 && funnelPages.length === 0) {
    const topTopic = topics[0];
    suggestions.push({
      type: 'content_gap',
      message: `You have expertise in "${topTopic.display_name}" but no lead magnet for it yet. This could be your first conversion asset.`,
    });
  } else if (topics.length > 0 && funnelPages.length > 0) {
    // Surface top uncovered topic (simple heuristic for Phase 1)
    const topTopic = topics[0];
    suggestions.push({
      type: 'content_gap',
      message: `Your top knowledge topic is "${topTopic.display_name}" (${topTopic.entry_count} entries). Consider creating a dedicated lead magnet to convert that expertise into leads.`,
    });
  }

  // ─── Performance: surface best-converting archetype ──────────────────────
  if (funnelPages.length > 0) {
    const funnelPageIds = funnelPages.map((fp) => fp.id);
    const leadMagnetIds = [...new Set(funnelPages.map((fp) => fp.lead_magnet_id).filter(Boolean))];

    const [leads, views, leadMagnets] = await Promise.all([
      analyticsRepo.getFunnelLeadsByPageIds(funnelPageIds, null),
      analyticsRepo.getPageViewsByPageIds(funnelPageIds, null),
      analyticsRepo.getLeadMagnetsByIds(leadMagnetIds),
    ]);

    const pageToMagnet = new Map<string, string>();
    for (const fp of funnelPages) {
      if (fp.lead_magnet_id) pageToMagnet.set(fp.id, fp.lead_magnet_id);
    }

    const magnetById = new Map(leadMagnets.map((lm) => [lm.id, lm]));
    const archetypeLeads = new Map<string, number>();
    const archetypeViews = new Map<string, number>();

    for (const lead of leads) {
      const magId = pageToMagnet.get(lead.funnel_page_id);
      if (magId) {
        const lm = magnetById.get(magId);
        if (lm) archetypeLeads.set(lm.archetype, (archetypeLeads.get(lm.archetype) ?? 0) + 1);
      }
    }
    for (const view of views) {
      const magId = pageToMagnet.get(view.funnel_page_id);
      if (magId) {
        const lm = magnetById.get(magId);
        if (lm) archetypeViews.set(lm.archetype, (archetypeViews.get(lm.archetype) ?? 0) + 1);
      }
    }

    // Only surface performance insight if there are ≥2 archetypes with data
    const archetypeStats = Array.from(archetypeLeads.entries())
      .map(([archetype, arcLeads]) => {
        const arcViews = archetypeViews.get(archetype) ?? 0;
        return { archetype, leads: arcLeads, rate: arcViews > 0 ? arcLeads / arcViews : 0 };
      })
      .filter((a) => a.leads > 0);

    if (archetypeStats.length >= 2) {
      archetypeStats.sort((a, b) => b.rate - a.rate);
      const best = archetypeStats[0];
      const worst = archetypeStats[archetypeStats.length - 1];
      if (best.rate > 0 && worst.rate >= 0 && best.archetype !== worst.archetype) {
        const ratio = worst.rate > 0 ? (best.rate / worst.rate).toFixed(1) : 'significantly';
        suggestions.push({
          type: 'performance',
          message: `Your ${best.archetype} lead magnets convert ${ratio}x better than ${worst.archetype}. Consider creating more in the ${best.archetype} format.`,
        });
      }
    } else if (archetypeStats.length === 1) {
      const best = archetypeStats[0];
      suggestions.push({
        type: 'performance',
        message: `Your ${best.archetype} lead magnets are generating leads. Try a second archetype to see what resonates best with your audience.`,
      });
    }
  }

  return {
    phase: 'stub',
    note: 'Full intelligence in Phase 4',
    suggestions,
  };
}

export function getValidRanges(): readonly string[] {
  return VALID_RANGES;
}

export async function getOverview(scope: DataScope, range: Range) {
  const days = parseDays(range);
  const dateRange = buildDateRange(days);
  const startDate = dateRange[0];

  const funnelIds = await analyticsRepo.getFunnelIdsByScope(scope);
  const contentStats = await analyticsRepo.getContentPipelineStats(scope);

  const posts = contentStats.posts;
  const contentStatsResponse = {
    posts: {
      total: posts.length,
      draft: posts.filter((p) => p.status === 'draft').length,
      review: posts.filter((p) => p.status === 'review').length,
      scheduled: posts.filter((p) => p.status === 'scheduled').length,
      published: posts.filter((p) => p.status === 'published').length,
    },
    transcripts: contentStats.transcriptsCount,
    knowledgeEntries: contentStats.knowledgeCount,
  };

  if (funnelIds.length === 0) {
    return {
      viewsByDay: dateRange.map((date) => ({ date, views: 0 })),
      leadsByDay: dateRange.map((date) => ({ date, leads: 0 })),
      utmBreakdown: [],
      totals: { views: 0, leads: 0, qualified: 0, conversionRate: 0, qualificationRate: 0 },
      contentStats: contentStatsResponse,
    };
  }

  const { views, leads } = await analyticsRepo.getPageViewsAndLeads(funnelIds, startDate);

  const viewsByDateMap = new Map<string, number>();
  for (const v of views)
    viewsByDateMap.set(v.view_date, (viewsByDateMap.get(v.view_date) || 0) + 1);
  const leadsByDateMap = new Map<string, number>();
  for (const l of leads) {
    const date = l.created_at.split('T')[0];
    leadsByDateMap.set(date, (leadsByDateMap.get(date) || 0) + 1);
  }

  const viewsByDay = dateRange.map((date) => ({ date, views: viewsByDateMap.get(date) || 0 }));
  const leadsByDay = dateRange.map((date) => ({ date, leads: leadsByDateMap.get(date) || 0 }));

  const utmCounts = new Map<string, number>();
  let totalQualified = 0;
  for (const l of leads) {
    const source = l.utm_source || 'direct';
    utmCounts.set(source, (utmCounts.get(source) || 0) + 1);
    if (l.is_qualified === true) totalQualified++;
  }
  const utmBreakdown = Array.from(utmCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const totals = {
    views: views.length,
    leads: leads.length,
    qualified: totalQualified,
    conversionRate: views.length > 0 ? Math.round((leads.length / views.length) * 100) : 0,
    qualificationRate: leads.length > 0 ? Math.round((totalQualified / leads.length) * 100) : 0,
  };

  return { viewsByDay, leadsByDay, utmBreakdown, totals, contentStats: contentStatsResponse };
}

export async function getEngagement(userId: string) {
  const publishedPosts = await analyticsRepo.getPublishedPostsByUserId(userId);
  if (publishedPosts.length === 0) {
    return { totals: { comments: 0, reactions: 0, dmsSent: 0, dmsFailed: 0 }, byPost: [] };
  }
  const postIds = publishedPosts.map((p) => p.id);

  let engagements: { post_id: string; engagement_type: string }[] = [];
  try {
    engagements = await analyticsRepo.getEngagementsByPostIds(postIds);
  } catch {
    // table may not exist
  }
  const { automationToPost, events } = await analyticsRepo.getAutomationsAndEvents(userId, postIds);

  const engagementsByPost: Record<string, { comments: number; reactions: number }> = {};
  let totalComments = 0;
  let totalReactions = 0;
  for (const eng of engagements) {
    const pid = eng.post_id;
    if (!engagementsByPost[pid]) engagementsByPost[pid] = { comments: 0, reactions: 0 };
    if (eng.engagement_type === 'comment') {
      engagementsByPost[pid].comments++;
      totalComments++;
    } else if (eng.engagement_type === 'reaction') {
      engagementsByPost[pid].reactions++;
      totalReactions++;
    }
  }

  const dmsByPost: Record<string, number> = {};
  let totalDmsSent = 0;
  let totalDmsFailed = 0;
  for (const ev of events) {
    const postId = automationToPost[ev.automation_id];
    if (ev.event_type === 'dm_sent') {
      totalDmsSent++;
      if (postId) dmsByPost[postId] = (dmsByPost[postId] || 0) + 1;
    } else if (ev.event_type === 'dm_failed') totalDmsFailed++;
  }

  const byPost = publishedPosts.map((p) => ({
    postId: p.id,
    title: p.title || 'Untitled Post',
    publishedAt: p.published_at,
    comments: engagementsByPost[p.id]?.comments || 0,
    reactions: engagementsByPost[p.id]?.reactions || 0,
    dmsSent: dmsByPost[p.id] || 0,
  }));

  return {
    totals: {
      comments: totalComments,
      reactions: totalReactions,
      dmsSent: totalDmsSent,
      dmsFailed: totalDmsFailed,
    },
    byPost,
  };
}

const EMAIL_VALID_RANGES = ['7d', '30d', '90d'] as const;
export function getEmailValidRanges(): readonly string[] {
  return EMAIL_VALID_RANGES;
}

export async function getEmailAnalytics(userId: string, range: string) {
  const days = parseInt(range.replace('d', ''), 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startIso = startDate.toISOString();

  const allEvents = await analyticsRepo.getEmailEventsByUserId(userId, startIso);

  let sent = 0;
  let delivered = 0;
  let opened = 0;
  let clicked = 0;
  let bounced = 0;
  const magnetStats: Record<string, { sent: number; opened: number; clicked: number }> = {};

  for (const event of allEvents) {
    const type = event.event_type;
    const lmId = event.lead_magnet_id;
    switch (type) {
      case 'sent':
        sent++;
        if (lmId) {
          if (!magnetStats[lmId]) magnetStats[lmId] = { sent: 0, opened: 0, clicked: 0 };
          magnetStats[lmId].sent++;
        }
        break;
      case 'delivered':
        delivered++;
        break;
      case 'opened':
        opened++;
        if (lmId) {
          if (!magnetStats[lmId]) magnetStats[lmId] = { sent: 0, opened: 0, clicked: 0 };
          magnetStats[lmId].opened++;
        }
        break;
      case 'clicked':
        clicked++;
        if (lmId) {
          if (!magnetStats[lmId]) magnetStats[lmId] = { sent: 0, opened: 0, clicked: 0 };
          magnetStats[lmId].clicked++;
        }
        break;
      case 'bounced':
        bounced++;
        break;
    }
  }

  const totals = { sent, delivered, opened, clicked, bounced };
  const rates = {
    deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
    openRate: delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0,
    clickRate: delivered > 0 ? Math.round((clicked / delivered) * 1000) / 10 : 0,
    bounceRate: sent > 0 ? Math.round((bounced / sent) * 1000) / 10 : 0,
  };

  const magnetIds = Object.keys(magnetStats);
  let byMagnet: Array<{
    leadMagnetId: string;
    title: string;
    sent: number;
    opened: number;
    clicked: number;
  }> = [];
  if (magnetIds.length > 0) {
    const titleMap = await analyticsRepo.getLeadMagnetTitles(magnetIds);
    byMagnet = magnetIds
      .map((id) => ({ leadMagnetId: id, title: titleMap[id] || 'Untitled', ...magnetStats[id] }))
      .sort((a, b) => b.sent - a.sent);
  }
  return { totals, rates, byMagnet };
}

export async function getFunnelDetail(scope: DataScope, funnelId: string, range: Range) {
  const funnel = await analyticsRepo.getFunnelByIdAndScope(funnelId, scope);
  if (!funnel) return null;

  const days = parseDays(range);
  const dateRange = buildDateRange(days);
  const startDate = dateRange[0];

  const { optinViews, thankyouViews, leads } = await analyticsRepo.getFunnelDetailViewsAndLeads(
    funnelId,
    startDate
  );

  const viewsByDateMap = new Map<string, number>();
  for (const v of optinViews)
    viewsByDateMap.set(v.view_date, (viewsByDateMap.get(v.view_date) || 0) + 1);
  const leadsByDateMap = new Map<string, number>();
  for (const l of leads) {
    const date = l.created_at.split('T')[0];
    leadsByDateMap.set(date, (leadsByDateMap.get(date) || 0) + 1);
  }
  const thankyouViewsByDateMap = new Map<string, number>();
  for (const v of thankyouViews)
    thankyouViewsByDateMap.set(v.view_date, (thankyouViewsByDateMap.get(v.view_date) || 0) + 1);

  const viewsByDay = dateRange.map((date) => ({ date, views: viewsByDateMap.get(date) || 0 }));
  const leadsByDay = dateRange.map((date) => ({ date, leads: leadsByDateMap.get(date) || 0 }));
  const thankyouViewsByDay = dateRange.map((date) => ({
    date,
    views: thankyouViewsByDateMap.get(date) || 0,
  }));

  let totalResponded = 0;
  for (const l of leads) {
    if (l.qualification_answers) totalResponded++;
  }
  const leadsTable = leads.map((l) => ({
    id: l.id,
    email: l.email,
    name: l.name ?? null,
    isQualified: l.is_qualified ?? null,
    utmSource: l.utm_source ?? null,
    createdAt: l.created_at,
  }));

  let totalQualified = 0;
  for (const l of leads) {
    if (l.is_qualified === true) totalQualified++;
  }

  const totals = {
    views: optinViews.length,
    thankyouViews: thankyouViews.length,
    leads: leads.length,
    qualified: totalQualified,
    responded: totalResponded,
    conversionRate:
      optinViews.length > 0 ? Math.round((leads.length / optinViews.length) * 100) : 0,
    qualificationRate: leads.length > 0 ? Math.round((totalQualified / leads.length) * 100) : 0,
    responseRate:
      thankyouViews.length > 0 ? Math.round((totalResponded / thankyouViews.length) * 100) : 0,
  };

  return {
    funnel: { id: funnel.id, title: funnel.optin_headline, slug: funnel.slug },
    viewsByDay,
    thankyouViewsByDay,
    leadsByDay,
    leads: leadsTable,
    totals,
  };
}
