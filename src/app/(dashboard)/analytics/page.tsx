import { Suspense } from 'react';
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';

export const metadata = {
  title: 'Analytics | MagnetLab',
  description: 'View your funnel performance metrics',
};

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Track your funnel performance and lead generation.
        </p>
      </div>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsOverview />
      </Suspense>
    </div>
  );
}
