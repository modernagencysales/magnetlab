/**
 * Homepage Data Service.
 * Builds suggestions, stats, and conversations for the copilot homepage.
 * Constraint: Never imports from Next.js request/response objects.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { fetchBriefingData, type BriefingData } from '@/server/services/copilot-briefing.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  label: string;
  action: string;
  priority: number;
}

type ChangeType = 'positive' | 'negative' | 'neutral';

interface Stat {
  key: string;
  label: string;
  value: number;
  change: string | null;
  changeType: ChangeType;
  period?: string;
  sublabel?: string;
}

interface RecentConversation {
  id: string;
  title: string;
  updatedAt: string;
}

export interface HomepageData {
  suggestions: Suggestion[];
  stats: Stat[];
  recentConversations: RecentConversation[];
  userName: string | null;
}

// ─── Column selects ───────────────────────────────────────────────────────────

const POST_COUNT_COLUMNS = 'id';
const FUNNEL_PAGE_COLUMNS = 'id';
const VIEW_COUNT_COLUMNS = 'id';
const CONVERSATION_COLUMNS = 'id, title, updated_at';

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function getHomepageData(userId: string, userName?: string): Promise<HomepageData> {
  const supabase = createSupabaseAdminClient();
  const scope = await getDataScope(userId);

  // ── Date boundaries ───────────────────────────────────────────────────────
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // ── Posts: this week vs last week ─────────────────────────────────────────
  // cp_pipeline_posts uses user_id (not team_id) — scope to userId in both modes
  const [postsThisWeekRes, postsLastWeekRes, briefing, funnelPagesRes, conversationsRes] =
    await Promise.all([
      supabase
        .from('cp_pipeline_posts')
        .select(POST_COUNT_COLUMNS, { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo),
      supabase
        .from('cp_pipeline_posts')
        .select(POST_COUNT_COLUMNS, { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo),
      fetchBriefingData(supabase, scope),
      // Fetch funnel page IDs so we can count page views
      supabase.from('funnel_pages').select(FUNNEL_PAGE_COLUMNS).eq('user_id', userId),
      // Recent conversations (scoped to user — conversations are always personal)
      supabase
        .from('copilot_conversations')
        .select(CONVERSATION_COLUMNS)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5),
    ]);

  // ── Page views (needs funnel page IDs) ────────────────────────────────────
  const funnelPageIds = ((funnelPagesRes.data ?? []) as { id: string }[]).map((p) => p.id);

  let viewsThisWeek = 0;
  let viewsLastWeek = 0;

  if (funnelPageIds.length > 0) {
    const [viewsThisWeekRes, viewsLastWeekRes] = await Promise.all([
      supabase
        .from('page_views')
        .select(VIEW_COUNT_COLUMNS, { count: 'exact', head: true })
        .in('funnel_page_id', funnelPageIds)
        .gte('view_date', sevenDaysAgo),
      supabase
        .from('page_views')
        .select(VIEW_COUNT_COLUMNS, { count: 'exact', head: true })
        .in('funnel_page_id', funnelPageIds)
        .gte('view_date', fourteenDaysAgo)
        .lt('view_date', sevenDaysAgo),
    ]);
    viewsThisWeek = viewsThisWeekRes.count ?? 0;
    viewsLastWeek = viewsLastWeekRes.count ?? 0;
  }

  const postsThisWeek = postsThisWeekRes.count ?? 0;
  const postsLastWeek = postsLastWeekRes.count ?? 0;

  // ── Build response ────────────────────────────────────────────────────────
  const suggestions = buildSuggestions(briefing);
  const stats = buildStats(briefing, postsThisWeek, postsLastWeek, viewsThisWeek, viewsLastWeek);
  const recentConversations = buildConversations(
    conversationsRes.data as { id: string; title: string; updated_at: string }[] | null
  );

  const resolvedUserName = userName?.split(' ')[0] ?? null;
  return { suggestions, stats, recentConversations, userName: resolvedUserName };
}

// ─── Error helper ─────────────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}

// ─── buildSuggestions ─────────────────────────────────────────────────────────

function buildSuggestions(briefing: BriefingData): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Priority 1 — content queue
  if (briefing.queueCount > 0) {
    suggestions.push({
      label: `${briefing.queueCount} posts need review`,
      action: 'Review my content queue',
      priority: 1,
    });
  }

  // Priority 2 — new leads
  if (briefing.newLeadsCount > 0) {
    suggestions.push({
      label: `${briefing.newLeadsCount} new leads this week`,
      action: "Show me this week's new leads",
      priority: 2,
    });
  }

  // Priority 3 — autopilot status
  if (briefing.autopilotStatus === 'running') {
    suggestions.push({
      label: 'Autopilot running',
      action: 'How is autopilot performing?',
      priority: 3,
    });
  } else if (briefing.autopilotStatus === 'paused') {
    suggestions.push({
      label: 'Autopilot paused — refill ideas',
      action: 'Help me add more content ideas',
      priority: 3,
    });
  } else {
    // no_ideas
    suggestions.push({
      label: 'No content ideas remaining',
      action: 'Help me generate new content ideas',
      priority: 3,
    });
  }

  // Priority 4 — scheduled posts this week
  if (briefing.scheduledThisWeek > 0 && briefing.nextScheduledPost) {
    suggestions.push({
      label: `${briefing.scheduledThisWeek} posts scheduled this week`,
      action: 'Show me my scheduled posts',
      priority: 4,
    });
  }

  // Priority 10 — always-present fallback
  suggestions.push({
    label: 'Create a lead magnet',
    action: 'Help me create a new lead magnet',
    priority: 10,
  });

  // Sort by priority ascending, return top 6
  return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

// ─── buildStats ───────────────────────────────────────────────────────────────

function buildStats(
  briefing: BriefingData,
  postsThisWeek: number,
  postsLastWeek: number,
  viewsThisWeek: number,
  viewsLastWeek: number
): Stat[] {
  return [
    {
      key: 'posts',
      label: 'Posts',
      value: postsThisWeek,
      change: formatCountChange(postsThisWeek, postsLastWeek),
      changeType: deriveChangeType(postsThisWeek, postsLastWeek),
      period: 'this week',
    },
    {
      key: 'views',
      label: 'Views',
      value: viewsThisWeek,
      change: formatPercentChange(viewsThisWeek, viewsLastWeek),
      changeType: deriveChangeType(viewsThisWeek, viewsLastWeek),
      period: 'vs last week',
    },
    {
      key: 'leads',
      label: 'Leads',
      value: briefing.newLeadsCount,
      change: `+${briefing.newLeadsCount}`,
      changeType: briefing.newLeadsCount > 0 ? 'positive' : 'neutral',
      period: 'this week',
    },
    {
      key: 'magnets',
      label: 'Magnets',
      value: briefing.magnetCount,
      change: null,
      changeType: 'neutral',
      sublabel: `${briefing.publishedMagnetCount} published`,
    },
  ];
}

// ─── buildConversations ───────────────────────────────────────────────────────

function buildConversations(
  data: { id: string; title: string; updated_at: string }[] | null
): RecentConversation[] {
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updated_at,
  }));
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCountChange(current: number, previous: number): string | null {
  if (current === 0 && previous === 0) return null;
  const delta = current - previous;
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

function formatPercentChange(current: number, previous: number): string | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return current > 0 ? '+100%' : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

function deriveChangeType(current: number, previous: number): ChangeType {
  if (current > previous) return 'positive';
  if (current < previous) return 'negative';
  return 'neutral';
}
