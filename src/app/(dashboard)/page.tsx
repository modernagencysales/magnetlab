import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  Magnet,
  Users,
  FileText,
  Plus,
  Upload,
  PenTool,
  CheckCircle2,
  Circle,
  ArrowRight,
  Globe,
  Eye,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { DashboardWelcomeClient } from '@/components/dashboard/DashboardWelcomeClient';

export const metadata = {
  title: 'Home | MagnetLab',
  description: 'Your MagnetLab dashboard',
};

interface DashboardStats {
  leadMagnets: number;
  leads: number;
  transcripts: number;
  posts: number;
  hasFunnels: boolean;
  hasBrandKit: boolean;
  recentDraft: { id: string; title: string } | null;
  magnetsWithoutFunnels: { id: string; title: string }[];
  viewsThisWeek: number;
  viewsLastWeek: number;
  leadsThisWeek: number;
  leadsLastWeek: number;
}

async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = createSupabaseAdminClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [leadMagnetsRes, leadsRes, transcriptsRes, postsRes, funnelsRes, brandKitRes, recentDraftRes, allMagnetsRes, leadsThisWeekRes, leadsLastWeekRes] =
    await Promise.all([
      supabase
        .from('lead_magnets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('funnel_leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('cp_call_transcripts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('cp_pipeline_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('funnel_pages')
        .select('id, lead_magnet_id', { count: 'exact' })
        .eq('user_id', userId),
      supabase
        .from('brand_kits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('lead_magnets')
        .select('id, title')
        .eq('user_id', userId)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(1),
      supabase
        .from('lead_magnets')
        .select('id, title')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      // Leads this week
      supabase
        .from('funnel_leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo),
      // Leads last week
      supabase
        .from('funnel_leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo),
    ]);

  // Find magnets without funnels
  const funnelMagnetIds = new Set((funnelsRes.data || []).map((f: { lead_magnet_id: string }) => f.lead_magnet_id));
  const magnetsWithoutFunnels = (allMagnetsRes.data || [])
    .filter((m: { id: string }) => !funnelMagnetIds.has(m.id))
    .slice(0, 3);

  // Fetch page view trends — requires funnel IDs
  const funnelIds = (funnelsRes.data || []).map((f: { id: string }) => f.id);
  let viewsThisWeek = 0;
  let viewsLastWeek = 0;

  if (funnelIds.length > 0) {
    const [viewsThisWeekRes, viewsLastWeekRes] = await Promise.all([
      supabase
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .in('funnel_page_id', funnelIds)
        .gte('view_date', sevenDaysAgo),
      supabase
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .in('funnel_page_id', funnelIds)
        .gte('view_date', fourteenDaysAgo)
        .lt('view_date', sevenDaysAgo),
    ]);
    viewsThisWeek = viewsThisWeekRes.count ?? 0;
    viewsLastWeek = viewsLastWeekRes.count ?? 0;
  }

  return {
    leadMagnets: leadMagnetsRes.count ?? 0,
    leads: leadsRes.count ?? 0,
    transcripts: transcriptsRes.count ?? 0,
    posts: postsRes.count ?? 0,
    hasFunnels: (funnelsRes.count ?? 0) > 0,
    hasBrandKit: (brandKitRes.count ?? 0) > 0,
    recentDraft: recentDraftRes.data?.[0] || null,
    magnetsWithoutFunnels,
    viewsThisWeek,
    viewsLastWeek,
    leadsThisWeek: leadsThisWeekRes.count ?? 0,
    leadsLastWeek: leadsLastWeekRes.count ?? 0,
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { current: number; previous: number };
}) {
  const trendDisplay = (() => {
    if (!trend) return null;
    const { current, previous } = trend;
    if (current === previous || (current === 0 && previous === 0)) {
      return (
        <span className="text-xs text-muted-foreground">No change</span>
      );
    }
    const pct = Math.round(((current - previous) / Math.max(previous, 1)) * 100);
    if (current > previous) {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="h-3 w-3" />
          {pct}% vs last week
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
        <TrendingDown className="h-3 w-3" />
        {Math.abs(pct)}% vs last week
      </span>
    );
  })();

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {trendDisplay && <div className="mt-1">{trendDisplay}</div>}
    </div>
  );
}

function ChecklistItem({
  label,
  done,
  href,
}: {
  label: string;
  done: boolean;
  href: string;
}) {
  const content = (
    <div className="flex items-center gap-3 py-2">
      {done ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
      )}
      <span
        className={
          done
            ? 'text-sm text-muted-foreground line-through'
            : 'text-sm text-foreground'
        }
      >
        {label}
      </span>
      {!done && (
        <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground/40" />
      )}
    </div>
  );

  if (done) return content;

  return (
    <Link href={href} className="block hover:bg-secondary/50 -mx-2 px-2 rounded-lg transition-colors">
      {content}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-5 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-9 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted" />
        ))}
      </div>
    </div>
  );
}

async function DashboardContent() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;
  const userName = session.user.name;
  const stats = await fetchDashboardStats(userId);

  const isNewUser =
    stats.leadMagnets === 0 &&
    stats.leads === 0 &&
    stats.transcripts === 0 &&
    stats.posts === 0;

  const checklistItems = [
    { label: 'Set up your Brand Kit', done: stats.hasBrandKit, href: '/settings' },
    { label: 'Create your first lead magnet', done: stats.leadMagnets > 0, href: '/create' },
    { label: 'Build a funnel page', done: stats.hasFunnels, href: stats.magnetsWithoutFunnels[0] ? `/magnets/${stats.magnetsWithoutFunnels[0].id}?tab=funnel` : '/create' },
    { label: 'Capture your first lead', done: stats.leads > 0, href: '/leads' },
    { label: 'Write a LinkedIn post', done: stats.posts > 0, href: '/posts' },
  ];

  const completedCount = checklistItems.filter((item) => item.done).length;
  const allComplete = completedCount === checklistItems.length;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Welcome Modal (client component) */}
      <DashboardWelcomeClient isNewUser={isNewUser} />

      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {userName ? `Welcome back, ${userName}` : 'Welcome to MagnetLab'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isNewUser
            ? 'Get started by creating your first lead magnet or importing transcripts.'
            : "Here's an overview of your activity."}
        </p>
      </div>

      {/* How MagnetLab Works — new user only */}
      {isNewUser && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10">
              <Plus className="h-6 w-6 text-violet-500" />
            </div>
            <h3 className="mb-1 font-semibold">1. Create</h3>
            <p className="text-sm text-muted-foreground">
              Build a lead magnet from your expertise using AI
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Globe className="h-6 w-6 text-emerald-500" />
            </div>
            <h3 className="mb-1 font-semibold">2. Publish</h3>
            <p className="text-sm text-muted-foreground">
              Create a funnel page and share it on LinkedIn
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <h3 className="mb-1 font-semibold">3. Capture</h3>
            <p className="text-sm text-muted-foreground">
              Collect leads and grow your audience automatically
            </p>
          </div>
        </div>
      )}

      {/* Continue where you left off */}
      {!isNewUser && stats.recentDraft && (
        <div className="mb-8">
          <Link
            href={`/magnets/${stats.recentDraft.id}`}
            className="group flex items-center gap-4 rounded-xl border border-violet-200 bg-violet-50 p-5 transition-all hover:border-violet-300 hover:shadow-md dark:border-violet-500/20 dark:bg-violet-500/5 dark:hover:border-violet-500/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
              <Magnet className="h-5 w-5 text-violet-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-violet-600 dark:text-violet-400">
                Continue where you left off
              </div>
              <div className="font-semibold truncate">
                {stats.recentDraft.title}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-violet-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      )}

      {/* Stats Row */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Lead Magnets" value={stats.leadMagnets} icon={Magnet} />
        <StatCard
          label="Page Views"
          value={stats.viewsThisWeek + stats.viewsLastWeek}
          icon={Eye}
          trend={{ current: stats.viewsThisWeek, previous: stats.viewsLastWeek }}
        />
        <StatCard
          label="Leads Captured"
          value={stats.leads}
          icon={Users}
          trend={{ current: stats.leadsThisWeek, previous: stats.leadsLastWeek }}
        />
        <StatCard label="Posts" value={stats.posts} icon={FileText} />
      </div>
      <div className="mb-8 flex justify-end">
        <Link href="/analytics" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
          View detailed analytics <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/create"
            className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold group-hover:text-primary">
                Create Lead Magnet
              </div>
              <div className="text-sm text-muted-foreground">
                Extract your expertise into content
              </div>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>

          <Link
            href="/knowledge"
            className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold group-hover:text-primary">
                Upload Transcript
              </div>
              <div className="text-sm text-muted-foreground">
                Import calls for AI extraction
              </div>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>

          <Link
            href="/posts"
            className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-lg"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
              <PenTool className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold group-hover:text-primary">
                Write a Post
              </div>
              <div className="text-sm text-muted-foreground">
                Create LinkedIn content
              </div>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      </div>

      {/* What to do next — contextual cards for active users */}
      {!isNewUser && stats.magnetsWithoutFunnels.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">What to do next</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {stats.magnetsWithoutFunnels.map((m) => (
              <Link
                key={m.id}
                href={`/magnets/${m.id}?tab=funnel`}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <Globe className="h-4 w-4 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate group-hover:text-primary">
                    {m.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Needs a funnel page
                  </div>
                </div>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Getting Started Checklist */}
      {!allComplete && (
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Getting Started</h2>
            <span className="text-sm text-muted-foreground">
              {completedCount} of {checklistItems.length} complete
            </span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${(completedCount / checklistItems.length) * 100}%`,
              }}
            />
          </div>
          <div className="divide-y">
            {checklistItems.map((item) => (
              <ChecklistItem
                key={item.label}
                label={item.label}
                done={item.done}
                href={item.href}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
