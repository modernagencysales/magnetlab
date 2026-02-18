import { auth } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { SettingsContent } from '@/components/dashboard/SettingsContent';

export const metadata = {
  title: 'Settings | MagnetLab',
  description: 'Manage your account and integrations',
};

export default async function SettingsPage() {
  const session = await auth();
  const supabase = await createSupabaseServerClient();

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at')
    .eq('user_id', session?.user?.id)
    .single();

  // Get brand kit (team-scoped)
  const adminClient = createSupabaseAdminClient();
  const scope = await getDataScope(session?.user?.id || '');
  let brandKitQuery = adminClient
    .from('brand_kits')
    .select('id, user_id, business_description, business_type, credibility_markers, sender_name, saved_ideation_result, ideation_generated_at, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools, preferred_tone, style_profile, logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url, created_at, updated_at');
  brandKitQuery = applyScope(brandKitQuery, scope);
  const { data: brandKit } = await brandKitQuery.single();

  // Get usage
  const monthYear = new Date().toISOString().slice(0, 7);
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('id, user_id, month_year, lead_magnets_created, posts_scheduled, created_at, updated_at')
    .eq('user_id', session?.user?.id)
    .eq('month_year', monthYear)
    .single();

  // Get integrations (use admin client to bypass RLS since we verify auth via NextAuth)
  const { data: integrations } = await adminClient
    .from('user_integrations')
    .select('service, is_active, last_verified_at, metadata')
    .eq('user_id', session?.user?.id);

  // Get username
  const { data: userData } = await supabase
    .from('users')
    .select('username')
    .eq('id', session?.user?.id)
    .single();

  return (
    <SettingsContent
      user={session?.user || null}
      username={userData?.username || null}
      subscription={subscription}
      brandKit={brandKit}
      usage={usage}
      integrations={integrations || []}
    />
  );
}
