import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Eye, Globe } from 'lucide-react';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';
import { formatDate } from '@/lib/utils';

export const metadata = {
  title: 'Lead Magnets | MagnetLab',
  description: 'Your lead magnets',
};

function MagnetsSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-5 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <div className="mb-2 h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mb-2 h-6 w-full animate-pulse rounded bg-muted" />
            <div className="mb-4 h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface FunnelInfo {
  id: string;
  lead_magnet_id: string;
  is_published: boolean;
  slug: string;
}

async function MagnetsContent() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const supabase = createSupabaseAdminClient();
  const scope = await getDataScope(session.user.id);

  let magnetsQuery = supabase
    .from('lead_magnets')
    .select('id, user_id, title, archetype, concept, status, created_at, updated_at')
    .order('created_at', { ascending: false });
  magnetsQuery = applyScope(magnetsQuery, scope);

  let funnelsQuery = supabase
    .from('funnel_pages')
    .select('id, lead_magnet_id, is_published, slug');
  funnelsQuery = applyScope(funnelsQuery, scope);

  const [leadMagnetsRes, funnelsRes] = await Promise.all([
    magnetsQuery,
    funnelsQuery,
  ]);

  const leadMagnets = leadMagnetsRes.data || [];
  const funnels = (funnelsRes.data || []) as FunnelInfo[];

  // Build funnel lookup by lead_magnet_id
  const funnelByMagnet = new Map<string, FunnelInfo>();
  for (const f of funnels) {
    funnelByMagnet.set(f.lead_magnet_id, f);
  }

  // Fetch views and leads scoped to user's funnels only
  const funnelIds = funnels.map(f => f.id);
  const viewsByFunnel = new Map<string, number>();
  const leadsByFunnel = new Map<string, number>();

  if (funnelIds.length > 0) {
    const [viewsRes, leadsCountRes] = await Promise.all([
      supabase
        .from('page_views')
        .select('funnel_page_id')
        .eq('page_type', 'optin')
        .in('funnel_page_id', funnelIds),
      supabase
        .from('funnel_leads')
        .select('funnel_page_id')
        .in('funnel_page_id', funnelIds),
    ]);

    for (const v of viewsRes.data || []) {
      viewsByFunnel.set(v.funnel_page_id, (viewsByFunnel.get(v.funnel_page_id) || 0) + 1);
    }
    for (const l of leadsCountRes.data || []) {
      leadsByFunnel.set(l.funnel_page_id, (leadsByFunnel.get(l.funnel_page_id) || 0) + 1);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Magnets</h1>
          <p className="mt-1 text-muted-foreground">
            {leadMagnets.length} lead magnet{leadMagnets.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <Link
          href="/create"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Create New
        </Link>
      </div>

      {leadMagnets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leadMagnets.map((lm) => {
            const funnel = funnelByMagnet.get(lm.id);

            return (
              <Link
                key={lm.id}
                href={`/magnets/${lm.id}`}
                className="group rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-lg"
              >
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {ARCHETYPE_NAMES[lm.archetype as keyof typeof ARCHETYPE_NAMES]}
                </div>

                <h3 className="mb-2 font-semibold group-hover:text-primary">
                  {lm.title}
                </h3>

                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      lm.status === 'published'
                        ? 'bg-green-500/10 text-green-600'
                        : lm.status === 'scheduled'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {lm.status}
                  </span>
                  {funnel && (
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      funnel.is_published
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      <Globe className="h-3 w-3" />
                      {funnel.is_published ? 'Live' : 'Draft page'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(lm.created_at)}
                  </span>
                  {lm.concept?.whyNowHook && (
                    <span className="flex items-center gap-1 truncate">
                      <Eye className="h-3 w-3" />
                      <span className="truncate max-w-[120px]">{lm.concept.whyNowHook}</span>
                    </span>
                  )}
                  {funnel && (() => {
                    const funnelViews = viewsByFunnel.get(funnel.id) || 0;
                    const funnelLeadCount = leadsByFunnel.get(funnel.id) || 0;
                    if (funnelViews === 0) return null;
                    const rate = ((funnelLeadCount / funnelViews) * 100).toFixed(1);
                    return (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {rate}% conversion
                      </span>
                    );
                  })()}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">No lead magnets yet</h3>
          <p className="mb-6 text-muted-foreground">
            Create your first lead magnet to start capturing leads.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Create Your First Lead Magnet
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MagnetsPage() {
  return (
    <Suspense fallback={<MagnetsSkeleton />}>
      <MagnetsContent />
    </Suspense>
  );
}
