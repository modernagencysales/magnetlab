/**
 * Analytics Service
 * Builds overview, engagement, email, and funnel-detail responses.
 */

import { VALID_RANGES, parseDays, buildDateRange, type Range } from '@/lib/utils/analytics-helpers';
import type { DataScope } from '@/lib/utils/team-context';
import * as analyticsRepo from '@/server/repositories/analytics.repo';

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
  for (const v of views) viewsByDateMap.set(v.view_date, (viewsByDateMap.get(v.view_date) || 0) + 1);
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
    totals: { comments: totalComments, reactions: totalReactions, dmsSent: totalDmsSent, dmsFailed: totalDmsFailed },
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
      case 'delivered': delivered++; break;
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
      case 'bounced': bounced++; break;
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
  let byMagnet: Array<{ leadMagnetId: string; title: string; sent: number; opened: number; clicked: number }> = [];
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

  const { optinViews, thankyouViews, leads } = await analyticsRepo.getFunnelDetailViewsAndLeads(funnelId, startDate);

  const viewsByDateMap = new Map<string, number>();
  for (const v of optinViews) viewsByDateMap.set(v.view_date, (viewsByDateMap.get(v.view_date) || 0) + 1);
  const leadsByDateMap = new Map<string, number>();
  for (const l of leads) {
    const date = l.created_at.split('T')[0];
    leadsByDateMap.set(date, (leadsByDateMap.get(date) || 0) + 1);
  }
  const thankyouViewsByDateMap = new Map<string, number>();
  for (const v of thankyouViews) thankyouViewsByDateMap.set(v.view_date, (thankyouViewsByDateMap.get(v.view_date) || 0) + 1);

  const viewsByDay = dateRange.map((date) => ({ date, views: viewsByDateMap.get(date) || 0 }));
  const leadsByDay = dateRange.map((date) => ({ date, leads: leadsByDateMap.get(date) || 0 }));
  const thankyouViewsByDay = dateRange.map((date) => ({ date, views: thankyouViewsByDateMap.get(date) || 0 }));

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
    conversionRate: optinViews.length > 0 ? Math.round((leads.length / optinViews.length) * 100) : 0,
    qualificationRate: leads.length > 0 ? Math.round((totalQualified / leads.length) * 100) : 0,
    responseRate: thankyouViews.length > 0 ? Math.round((totalResponded / thankyouViews.length) * 100) : 0,
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
