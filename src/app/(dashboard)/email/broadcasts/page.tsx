import { BroadcastList } from '@/components/email/BroadcastList';

export default function BroadcastsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Broadcasts</h1>
        <p className="text-muted-foreground">Send one-time emails to your subscribers.</p>
      </div>
      <BroadcastList />
    </div>
  );
}
