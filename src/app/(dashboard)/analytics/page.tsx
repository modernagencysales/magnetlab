import { Suspense } from 'react';
import { PageContainer, PageTitle, LoadingCard } from '@magnetlab/magnetui';
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';

export const metadata = {
  title: 'Analytics | MagnetLab',
  description: 'View your funnel performance metrics',
};

export default function AnalyticsPage() {
  return (
    <PageContainer maxWidth="xl">
      <PageTitle
        title="Analytics"
        description="Track your funnel performance and lead generation."
      />
      <Suspense fallback={<LoadingCard count={4} />}>
        <AnalyticsOverview />
      </Suspense>
    </PageContainer>
  );
}
