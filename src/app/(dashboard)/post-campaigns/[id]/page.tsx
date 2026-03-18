'use client';

/**
 * Post Campaign detail page. Shows stats, leads, and config for a single campaign.
 * Pattern: client component, gets campaign ID from params.
 */

import { use } from 'react';
import { PageContainer } from '@magnetlab/magnetui';
import { CampaignDetail } from '@/components/post-campaigns/CampaignDetail';
import { useCopilotContext } from '@/components/copilot/useCopilotContext';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PostCampaignDetailPage({ params }: PageProps) {
  const { id } = use(params);
  useCopilotContext({ page: 'post-campaigns', entityId: id });

  return (
    <PageContainer maxWidth="xl">
      <CampaignDetail campaignId={id} />
    </PageContainer>
  );
}
