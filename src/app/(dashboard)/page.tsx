import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
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
} from 'lucide-react';
import {
  PageContainer,
  PageTitle,
  StatCard as MagnetStatCard,
  Card,
  CardContent,
  IconWrapper,
  Skeleton,
  LoadingCard,
} from '@magnetlab/magnetui';
import { DashboardWelcomeClient } from '@/components/dashboard/DashboardWelcomeClient';

export const dynamic = 'force-dynamic';

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
  const scope = await getDataScope(userId);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // cp_pipeline_posts uses team_profile_id, not team_id — build query before Promise.all
  let postsQuery = supabase.from('cp_pipeline_posts').select('id', { count: 'exact', head: true });
  if (scope.type === 'team' && scope.teamId) {
    const { data: profiles } = await supabase
      .from('team_profiles')
      .select('id')
      .eq('team_id', scope.teamId)
      .eq('status', 'active');
    const profileIds = profiles?.map((p) => p.id) ?? [];
    postsQuery =
      profileIds.length > 0
        ? postsQuery.in('team_profile_id', profileIds)
        : postsQuery.eq('user_id', userId);
  } else {
    postsQuery = postsQuery.eq('user_id', userId);
  }

  const [
    leadMagnetsRes,
    leadsRes,
    transcriptsRes,
    postsRes,
    funnelsRes,
    brandKitRes,
    recentDraftRes,
    allMagnetsRes,
    leadsThisWeekRes,
    leadsLastWeekRes,
  ] = await Promise.all([
    applyScope(supabase.from('lead_magnets').select('id', { count: 'exact', head: true }), scope),
    applyScope(supabase.from('funnel_leads').select('id', { count: 'exact', head: true }), scope),
    applyScope(
      supabase.from('cp_call_transcripts').select('id', { count: 'exact', head: true }),
      scope
    ),
    postsQuery,
    applyScope(
      supabase.from('funnel_pages').select('id, lead_magnet_id', { count: 'exact' }),
      scope
    ),
    applyScope(supabase.from('brand_kits').select('id', { count: 'exact', head: true }), scope),
    applyScope(
      supabase
        .from('lead_magnets')
        .select('id, title')
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(1),
      scope
    ),
    applyScope(
      supabase
        .from('lead_magnets')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(10),
      scope
    ),
    applyScope(
      supabase
        .from('funnel_leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo),
      scope
    ),
    applyScope(
      supabase
        .from('funnel_leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo),
      scope
    ),
  ]);

  const funnelMagnetIds = new Set(
    (funnelsRes.data || []).map((f: { lead_magnet_id: string }) => f.lead_magnet_id)
  );
  const magnetsWithoutFunnels = (allMagnetsRes.data || [])
    .filter((m: { id: string }) => !funnelMagnetIds.has(m.id))
    .slice(0, 3);

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

function formatTrend(current: number, previous: number) {
  if (current === previous || (current === 0 && previous === 0)) {
    return 'No change';
  }
  const pct = Math.round(((current - previous) / Math.max(previous, 1)) * 100);
  const arrow = current > previous ? '\u2191' : '\u2193';
  return `${arrow} ${Math.abs(pct)}% vs last week`;
}

function ChecklistItem({ label, done, href }: { label: string; done: boolean; href: string }) {
  const content = (
    <div className="flex items-center gap-3 py-2.5">
      {done ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
      )}
      <span
        className={done ? 'text-sm text-muted-foreground line-through' : 'text-sm text-foreground'}
      >
        {label}
      </span>
      {!done && <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground/40" />}
    </div>
  );

  if (done) return content;

  return (
    <Link
      href={href}
      className="-mx-2 block rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50"
    >
      {content}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <PageContainer maxWidth="xl">
      <div className="mb-8">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-2 h-5 w-48" />
      </div>
      <LoadingCard count={4} />
    </PageContainer>
  );
}

async function DashboardContent() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;
  const userName = session.user.name;
  const stats = await fetchDashboardStats(userId);

  const isNewUser =
    stats.leadMagnets === 0 && stats.leads === 0 && stats.transcripts === 0 && stats.posts === 0;

  const checklistItems = [
    { label: 'Set up your Brand Kit', done: stats.hasBrandKit, href: '/settings' },
    { label: 'Create your first lead magnet', done: stats.leadMagnets > 0, href: '/create' },
    {
      label: 'Build a funnel page',
      done: stats.hasFunnels,
      href: stats.magnetsWithoutFunnels[0]
        ? `/magnets/${stats.magnetsWithoutFunnels[0].id}?tab=funnel`
        : '/create',
    },
    { label: 'Capture your first lead', done: stats.leads > 0, href: '/leads' },
    { label: 'Write a LinkedIn post', done: stats.posts > 0, href: '/posts' },
  ];

  const completedCount = checklistItems.filter((item) => item.done).length;
  const allComplete = completedCount === checklistItems.length;

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        {/* Welcome Modal (client component) */}
        <DashboardWelcomeClient isNewUser={isNewUser} />

        {/* Welcome Header */}
        <PageTitle
          title={userName ? `Welcome back, ${userName}` : 'Welcome to MagnetLab'}
          description={
            isNewUser
              ? 'Get started by creating your first lead magnet or importing transcripts.'
              : "Here's an overview of your activity."
          }
        />

        {/* How MagnetLab Works — new user only */}
        {isNewUser && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <IconWrapper variant="primary" size="lg" className="mx-auto mb-3">
                  <Plus className="h-6 w-6" />
                </IconWrapper>
                <h3 className="mb-1 font-semibold">1. Create</h3>
                <p className="text-sm text-muted-foreground">
                  Build a lead magnet from your expertise using AI
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <IconWrapper variant="success" size="lg" className="mx-auto mb-3">
                  <Globe className="h-6 w-6" />
                </IconWrapper>
                <h3 className="mb-1 font-semibold">2. Publish</h3>
                <p className="text-sm text-muted-foreground">
                  Create a funnel page and share it on LinkedIn
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <IconWrapper variant="info" size="lg" className="mx-auto mb-3">
                  <Users className="h-6 w-6" />
                </IconWrapper>
                <h3 className="mb-1 font-semibold">3. Capture</h3>
                <p className="text-sm text-muted-foreground">
                  Collect leads and grow your audience automatically
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Continue where you left off */}
        {!isNewUser && stats.recentDraft && (
          <Card className="border-primary/20 bg-primary/5 hover:border-primary/30 transition-colors hover:shadow-sm">
            <CardContent className="p-0">
              <Link
                href={`/magnets/${stats.recentDraft.id}`}
                className="flex items-center gap-4 p-4"
              >
                <IconWrapper variant="primary" size="md">
                  <Magnet className="h-5 w-5" />
                </IconWrapper>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-primary">
                    Continue where you left off
                  </div>
                  <div className="font-semibold truncate">{stats.recentDraft.title}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary/40" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MagnetStatCard
            label="Lead Magnets"
            value={stats.leadMagnets}
            icon={<Magnet className="h-5 w-5" />}
          />
          <MagnetStatCard
            label="Page Views"
            value={stats.viewsThisWeek + stats.viewsLastWeek}
            icon={<Eye className="h-5 w-5" />}
            description={formatTrend(stats.viewsThisWeek, stats.viewsLastWeek)}
          />
          <MagnetStatCard
            label="Leads Captured"
            value={stats.leads}
            icon={<Users className="h-5 w-5" />}
            description={formatTrend(stats.leadsThisWeek, stats.leadsLastWeek)}
          />
          <MagnetStatCard
            label="Posts"
            value={stats.posts}
            icon={<FileText className="h-5 w-5" />}
          />
        </div>
        <div className="flex justify-end">
          <Link
            href="/analytics"
            className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            View detailed analytics <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Quick Actions */}
        <section>
          <h2 className="mb-4 text-base font-semibold">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href="/create" className="group">
              <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <IconWrapper
                    variant="primary"
                    size="lg"
                    className="transition-colors group-hover:bg-primary/20"
                  >
                    <Plus className="h-6 w-6" />
                  </IconWrapper>
                  <div className="min-w-0">
                    <div className="font-semibold group-hover:text-primary">Create Lead Magnet</div>
                    <div className="text-sm text-muted-foreground">
                      Extract your expertise into content
                    </div>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/knowledge" className="group">
              <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <IconWrapper
                    variant="primary"
                    size="lg"
                    className="transition-colors group-hover:bg-primary/20"
                  >
                    <Upload className="h-6 w-6" />
                  </IconWrapper>
                  <div className="min-w-0">
                    <div className="font-semibold group-hover:text-primary">Upload Transcript</div>
                    <div className="text-sm text-muted-foreground">
                      Import calls for AI extraction
                    </div>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/posts" className="group">
              <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-sm">
                <CardContent className="flex items-center gap-4 p-4">
                  <IconWrapper
                    variant="primary"
                    size="lg"
                    className="transition-colors group-hover:bg-primary/20"
                  >
                    <PenTool className="h-6 w-6" />
                  </IconWrapper>
                  <div className="min-w-0">
                    <div className="font-semibold group-hover:text-primary">Write a Post</div>
                    <div className="text-sm text-muted-foreground">Create LinkedIn content</div>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* What to do next — contextual cards for active users */}
        {!isNewUser && stats.magnetsWithoutFunnels.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold">What to do next</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {stats.magnetsWithoutFunnels.map((m) => (
                <Link key={m.id} href={`/magnets/${m.id}?tab=funnel`} className="group">
                  <Card className="transition-colors hover:border-primary/50 hover:shadow-sm">
                    <CardContent className="flex items-center gap-3 p-4">
                      <IconWrapper variant="warning" size="sm">
                        <Globe className="h-4 w-4" />
                      </IconWrapper>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate group-hover:text-primary">
                          {m.title}
                        </div>
                        <div className="text-xs text-muted-foreground">Needs a funnel page</div>
                      </div>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-primary" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Getting Started Checklist */}
        {!allComplete && (
          <Card>
            <CardContent className="p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-base font-semibold">Getting Started</h2>
                <span className="text-sm text-muted-foreground">
                  {completedCount} of {checklistItems.length} complete
                </span>
              </div>
              <div className="mb-6 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${(completedCount / checklistItems.length) * 100}%`,
                  }}
                />
              </div>
              <div className="divide-y divide-border">
                {checklistItems.map((item) => (
                  <ChecklistItem
                    key={item.label}
                    label={item.label}
                    done={item.done}
                    href={item.href}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
