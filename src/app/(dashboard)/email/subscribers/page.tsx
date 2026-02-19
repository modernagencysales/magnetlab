import { SubscriberTable } from '@/components/email/SubscriberTable';

export default function SubscribersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscribers</h1>
        <p className="text-muted-foreground">Manage your email subscriber list.</p>
      </div>
      <SubscriberTable />
    </div>
  );
}
