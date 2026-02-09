import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  Magnet,
  Users,
  Mic,
  FileText,
  Plus,
  Upload,
  PenTool,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { DashboardWelcomeClient } from '@/components/dashboard/DashboardWelcomeClient';

export const metadata = {
  title: 'Dashboard | MagnetLab',
  description: 'Your MagnetLab dashboard',
};

interface DashboardStats {
  leadMagnets: number;
  leads: number;
  transcripts: number;
  posts: number;
  hasFunnels: boolean;
}

async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = createSupabaseAdminClient();

  const [leadMagnetsRes, leadsRes, transcriptsRes, postsRes, funnelsRes] =
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
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

  return {
    leadMagnets: leadMagnetsRes.count ?? 0,
    leads: leadsRes.count ?? 0,
    transcripts: transcriptsRes.count ?? 0,
    posts: postsRes.count ?? 0,
    hasFunnels: (funnelsRes.count ?? 0) > 0,
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
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
    </div>
  );
}

function ChecklistItem({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
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
    </div>
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

  const showChecklist = stats.leadMagnets < 3;

  const checklistItems = [
    { label: 'Create your first lead magnet', done: stats.leadMagnets > 0 },
    { label: 'Build a funnel page', done: stats.hasFunnels },
    { label: 'Capture your first lead', done: stats.leads > 0 },
    { label: 'Upload a call transcript', done: stats.transcripts > 0 },
    { label: 'Generate your first post', done: stats.posts > 0 },
  ];

  const completedCount = checklistItems.filter((item) => item.done).length;

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

      {/* Stats Row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Lead Magnets Created"
          value={stats.leadMagnets}
          icon={Magnet}
        />
        <StatCard
          label="Leads Captured"
          value={stats.leads}
          icon={Users}
        />
        <StatCard
          label="Transcripts Processed"
          value={stats.transcripts}
          icon={Mic}
        />
        <StatCard
          label="Posts Generated"
          value={stats.posts}
          icon={FileText}
        />
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
            href="/content?tab=transcripts"
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
            href="/content?tab=pipeline"
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

      {/* Getting Started Checklist */}
      {showChecklist && (
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
