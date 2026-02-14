import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';

export const metadata = {
  title: 'Analytics | MagnetLab',
  description: 'View your funnel performance metrics',
};

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Track your funnel performance and lead generation.
        </p>
      </div>
      <AnalyticsOverview />
    </div>
  );
}
