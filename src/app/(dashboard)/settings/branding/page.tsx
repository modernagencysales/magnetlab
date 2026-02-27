import { auth } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { BrandingPage } from '@/components/settings/BrandingPage';

export const metadata = {
  title: 'Branding | MagnetLab Settings',
};

export default async function BrandingRoute() {
  const session = await auth();
  const adminClient = createSupabaseAdminClient();
  const scope = await getDataScope(session?.user?.id || '');

  let brandKitQuery = adminClient
    .from('brand_kits')
    .select('id, user_id, business_description, business_type, credibility_markers, sender_name, saved_ideation_result, ideation_generated_at, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools, preferred_tone, style_profile, logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url, created_at, updated_at');
  brandKitQuery = applyScope(brandKitQuery, scope);
  const { data: brandKit } = await brandKitQuery.single();

  const supabase = await createSupabaseServerClient();
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', session?.user?.id)
    .single();

  return (
    <BrandingPage
      brandKit={brandKit}
      plan={subscription?.plan}
    />
  );
}
