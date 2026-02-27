import { auth } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { AccountSettings } from '@/components/settings/AccountSettings';

export const metadata = {
  title: 'Account Settings | MagnetLab',
};

export default async function AccountPage() {
  const session = await auth();
  const supabase = await createSupabaseServerClient();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at')
    .eq('user_id', session?.user?.id)
    .single();

  const monthYear = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('id, user_id, month_year, lead_magnets_created, posts_scheduled, created_at, updated_at')
    .eq('user_id', session?.user?.id)
    .eq('month_year', monthYear)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('username')
    .eq('id', session?.user?.id)
    .single();

  const adminClient = createSupabaseAdminClient();
  const scope = await getDataScope(session?.user?.id || '');
  let brandKitQuery = adminClient
    .from('brand_kits')
    .select('business_description');
  brandKitQuery = applyScope(brandKitQuery, scope);
  const { data: brandKit } = await brandKitQuery.single();

  return (
    <AccountSettings
      user={session?.user || null}
      username={userData?.username || null}
      subscription={subscription}
      usage={usage}
      brandKitDescription={brandKit?.business_description || null}
    />
  );
}
