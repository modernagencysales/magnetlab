import { EngagementDashboard } from '@/components/analytics/EngagementDashboard';

export const metadata = {
  title: 'Engagement Analytics | MagnetLab',
  description: 'Track LinkedIn engagement metrics across your published posts',
};

export default function EngagementAnalyticsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Engagement Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Track comments, reactions, and DMs across your published posts.
        </p>
      </div>
      <EngagementDashboard />
    </div>
  );
}
