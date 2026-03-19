'use client';

/** Outreach campaign detail page. */

import { use } from 'react';
import { PageContainer } from '@magnetlab/magnetui';
import { OutreachCampaignDetail } from '@/components/campaigns/OutreachCampaignDetail';
import { useCopilotContext } from '@/components/copilot/useCopilotContext';

export default function OutreachCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useCopilotContext({ page: 'campaigns', entityId: id });

  return (
    <PageContainer maxWidth="xl">
      <OutreachCampaignDetail campaignId={id} />
    </PageContainer>
  );
}
