import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import MagnetsListClient, { type MagnetListItem } from '@/components/magnets/MagnetsListClient';

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
      <div className="mb-4 flex gap-3">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="rounded-xl border bg-card">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-12 animate-pulse rounded bg-muted" />
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
    .select('id, user_id, title, archetype, status, created_at')
    .order('created_at', { ascending: false });
  magnetsQuery = applyScope(magnetsQuery, scope);

  let funnelsQuery = supabase
    .from('funnel_pages')
    .select('id, lead_magnet_id, is_published, slug')
    .eq('is_variant', false);
  funnelsQuery = applyScope(funnelsQuery, scope);

  const [leadMagnetsRes, funnelsRes] = await Promise.all([
    magnetsQuery,
    funnelsQuery,
  ]);

  const leadMagnets = leadMagnetsRes.data || [];
  const funnels = (funnelsRes.data || []) as FunnelInfo[];

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

  // Shape data for client component
  const items: MagnetListItem[] = leadMagnets.map((lm) => {
    const funnel = funnelByMagnet.get(lm.id);
    const views = funnel ? (viewsByFunnel.get(funnel.id) || 0) : 0;
    const leads = funnel ? (leadsByFunnel.get(funnel.id) || 0) : 0;

    return {
      id: lm.id,
      title: lm.title,
      archetype: lm.archetype,
      status: lm.status,
      createdAt: lm.created_at,
      isLive: funnel?.is_published ?? false,
      hasFunnel: !!funnel,
      views,
      leads,
      conversionRate: views > 0 ? (leads / views) * 100 : null,
    };
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Magnets</h1>
          <p className="mt-1 text-muted-foreground">
            {items.length} lead magnet{items.length !== 1 ? 's' : ''} created
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

      {items.length > 0 ? (
        <MagnetsListClient items={items} totalCount={items.length} />
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
