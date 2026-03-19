'use client';

/** Outreach campaign detail page. */

import { use } from 'react';
import { PageContainer } from '@magnetlab/magnetui';
import { OutreachCampaignDetail } from '@/components/campaigns/OutreachCampaignDetail';
import { useCopilotPageContext } from '@/components/copilot/CopilotNavigator';

export default function OutreachCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useCopilotPageContext({ page: 'campaigns', entityId: id });

  return (
    <PageContainer maxWidth="xl">
      <OutreachCampaignDetail campaignId={id} />
    </PageContainer>
  );
}
