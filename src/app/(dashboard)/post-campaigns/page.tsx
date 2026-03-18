'use client';

/**
 * Post Campaigns list page. Shows all campaigns with create button.
 * Pattern: client component following signals/page.tsx.
 */

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageContainer, PageTitle, Button } from '@magnetlab/magnetui';
import { CampaignList } from '@/components/post-campaigns/CampaignList';
import { useCopilotContext } from '@/components/copilot/useCopilotContext';

export default function PostCampaignsPage() {
  useCopilotContext({ page: 'post-campaigns' });

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <PageTitle
          title="Post Campaigns"
          description="Automatically engage with people who comment on your LinkedIn posts"
          actions={
            <Button asChild>
              <Link href="/post-campaigns/new">
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Link>
            </Button>
          }
        />
        <CampaignList />
      </div>
    </PageContainer>
  );
}
