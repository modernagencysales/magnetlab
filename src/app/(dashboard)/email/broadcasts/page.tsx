import { BroadcastList } from '@/components/email/BroadcastList';

export const metadata = {
  title: 'Email Broadcasts | MagnetLab',
  description: 'Send one-time emails to your subscribers',
};

export default function EmailBroadcastsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Broadcasts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send one-time emails to all or a filtered segment of your subscribers.
        </p>
      </div>
      <BroadcastList />
    </div>
  );
}
