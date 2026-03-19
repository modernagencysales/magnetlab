'use client';

/** Unified campaigns list — outreach + post campaigns. */

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button, PageContainer, PageTitle } from '@magnetlab/magnetui';
import { CampaignsList } from '@/components/campaigns/CampaignsList';

export default function CampaignsPage() {
  return (
    <PageContainer maxWidth="xl">
      <PageTitle
        title="Campaigns"
        description="Outreach sequences and post campaigns"
        actions={
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="mr-2 h-4 w-4" />
              New Outreach Campaign
            </Link>
          </Button>
        }
      />
      <CampaignsList />
    </PageContainer>
  );
}
