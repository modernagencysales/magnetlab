import { EmailAnalytics } from '@/components/analytics/EmailAnalytics';

export const metadata = {
  title: 'Email Analytics | MagnetLab',
  description: 'Track email delivery, opens, clicks, and bounces across your lead magnets',
};

export default function EmailAnalyticsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Email Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Track delivery rates, opens, clicks, and bounces for your email sequences.
        </p>
      </div>
      <EmailAnalytics />
    </div>
  );
}
