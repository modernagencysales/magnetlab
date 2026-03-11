import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Magnet } from 'lucide-react';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { PageContainer, PageTitle, Button, EmptyState, LoadingCard } from '@magnetlab/magnetui';
import MagnetsListClient, { type MagnetListItem } from '@/components/magnets/MagnetsListClient';

export const metadata = {
  title: 'Lead Magnets | MagnetLab',
  description: 'Your lead magnets',
};

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

  const [leadMagnetsRes, funnelsRes] = await Promise.all([magnetsQuery, funnelsQuery]);

  const leadMagnets = leadMagnetsRes.data || [];
  const funnels = (funnelsRes.data || []) as FunnelInfo[];

  const funnelByMagnet = new Map<string, FunnelInfo>();
  for (const f of funnels) {
    funnelByMagnet.set(f.lead_magnet_id, f);
  }

  // Fetch views and leads scoped to user's funnels only
  const funnelIds = funnels.map((f) => f.id);
  const viewsByFunnel = new Map<string, number>();
  const leadsByFunnel = new Map<string, number>();

  if (funnelIds.length > 0) {
    const [viewsRes, leadsCountRes] = await Promise.all([
      supabase
        .from('page_views')
        .select('funnel_page_id')
        .eq('page_type', 'optin')
        .in('funnel_page_id', funnelIds),
      supabase.from('funnel_leads').select('funnel_page_id').in('funnel_page_id', funnelIds),
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
    const views = funnel ? viewsByFunnel.get(funnel.id) || 0 : 0;
    const leads = funnel ? leadsByFunnel.get(funnel.id) || 0 : 0;

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
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <PageTitle
          title="Lead Magnets"
          description={`${items.length} lead magnet${items.length !== 1 ? 's' : ''} created`}
          actions={
            <Button asChild>
              <Link href="/create">
                <Plus className="mr-1 h-4 w-4" />
                Create New
              </Link>
            </Button>
          }
        />

        {items.length > 0 ? (
          <MagnetsListClient items={items} totalCount={items.length} />
        ) : (
          <EmptyState
          icon={<Magnet />}
          title="No lead magnets yet"
          description="Create your first lead magnet to start capturing leads."
          action={
            <Button asChild>
              <Link href="/create">
                <Plus className="mr-1 h-4 w-4" />
                Create Your First Lead Magnet
              </Link>
            </Button>
          }
          />
        )}
      </div>
    </PageContainer>
  );
}

export default function MagnetsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer maxWidth="xl">
          <LoadingCard count={6} />
        </PageContainer>
      }
    >
      <MagnetsContent />
    </Suspense>
  );
}
