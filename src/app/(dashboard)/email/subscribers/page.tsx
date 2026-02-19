import { SubscriberTable } from '@/components/email/SubscriberTable';

export const metadata = {
  title: 'Email Subscribers | MagnetLab',
  description: 'Manage your email subscriber list',
};

export default function EmailSubscribersPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Subscribers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscriber list, add contacts manually, or import via CSV.
        </p>
      </div>
      <SubscriberTable />
    </div>
  );
}
