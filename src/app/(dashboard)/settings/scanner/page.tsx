import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ScannerSettings } from '@/components/settings/ScannerSettings';

export const metadata = {
  title: 'Scanner Settings | MagnetLab',
};

export default async function ScannerSettingsRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <ScannerSettings />;
}
