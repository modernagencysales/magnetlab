import { Suspense } from 'react';
import { EngagementDashboard } from '@/components/analytics/EngagementDashboard';

export const metadata = {
  title: 'Engagement Analytics | MagnetLab',
  description: 'Track LinkedIn engagement metrics across your published posts',
};

function EngagementSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-48 rounded-lg bg-muted" />
    </div>
  );
}

export default function EngagementAnalyticsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Engagement Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Track comments, reactions, and DMs across your published posts.
        </p>
      </div>
      <Suspense fallback={<EngagementSkeleton />}>
        <EngagementDashboard />
      </Suspense>
    </div>
  );
}
