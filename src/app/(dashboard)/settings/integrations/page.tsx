import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings';

export const metadata = {
  title: 'Integrations | MagnetLab Settings',
};

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  const adminClient = createSupabaseAdminClient();

  const { data: integrations } = await adminClient
    .from('user_integrations')
    .select('service, is_active, last_verified_at, metadata')
    .eq('user_id', session?.user?.id);

  return <IntegrationsSettings integrations={integrations || []} />;
}
