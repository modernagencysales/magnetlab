'use client';

/** Outreach campaign detail page. */

import { use } from 'react';
import { PageContainer } from '@magnetlab/magnetui';
import { OutreachCampaignDetail } from '@/components/campaigns/OutreachCampaignDetail';

export default function OutreachCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <PageContainer maxWidth="xl">
      <OutreachCampaignDetail campaignId={id} />
    </PageContainer>
  );
}
