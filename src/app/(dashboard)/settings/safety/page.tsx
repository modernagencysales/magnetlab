import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AccountSafetySettings } from '@/components/settings/AccountSafetySettings';

export const metadata = {
  title: 'Account Safety | MagnetLab Settings',
};

export default async function SafetySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Account Safety</h2>
        <p className="text-sm text-muted-foreground">
          Configure operating hours, daily limits, and safety settings for each LinkedIn account.
        </p>
      </div>
      <AccountSafetySettings />
    </div>
  );
}
