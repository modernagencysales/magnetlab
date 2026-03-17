import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import * as leadsService from '@/server/services/leads.service';
import * as funnelsService from '@/server/services/funnels.service';
import { LeadsPageClient } from '@/components/leads/LeadsPageClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Leads | MagnetLab',
  description: 'Manage your captured leads',
};

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const scope = await getDataScope(session.user.id);

  const [leadsData, funnelsData] = await Promise.all([
    leadsService.getLeads(scope, { limit: 25, offset: 0 }),
    funnelsService.getAllFunnels(scope),
  ]);

  const initialFunnels = (
    funnelsData as Array<{ id: string; slug: string; optin_headline: string }>
  ).map((f) => ({ id: f.id, slug: f.slug, optinHeadline: f.optin_headline }));

  return (
    <Suspense>
      <LeadsPageClient
        initialLeads={leadsData.leads}
        initialTotal={leadsData.total}
        initialFunnels={initialFunnels}
      />
    </Suspense>
  );
}
