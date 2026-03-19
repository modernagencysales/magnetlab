'use client';

/** Create a new outreach campaign. */

import { useRouter } from 'next/navigation';
import { PageContainer, PageTitle } from '@magnetlab/magnetui';
import { OutreachCampaignForm } from '@/components/campaigns/OutreachCampaignForm';

export default function NewOutreachCampaignPage() {
  const router = useRouter();
  return (
    <PageContainer maxWidth="lg">
      <PageTitle title="New Outreach Campaign" />
      <OutreachCampaignForm onSubmit={(id) => router.push(`/campaigns/${id}`)} />
    </PageContainer>
  );
}
