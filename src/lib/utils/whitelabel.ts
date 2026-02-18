import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export interface WhitelabelConfig {
  hideBranding: boolean;
  customFaviconUrl: string | null;
  customSiteName: string | null;
}

export async function getWhitelabelConfig(teamId: string | null): Promise<WhitelabelConfig | null> {
  if (!teamId) return null;

  const supabase = createSupabaseAdminClient();
  const { data: team } = await supabase
    .from('teams')
    .select('whitelabel_enabled, hide_branding, custom_favicon_url, custom_site_name')
    .eq('id', teamId)
    .single();

  if (!team || !team.whitelabel_enabled) return null;

  return {
    hideBranding: team.hide_branding || false,
    customFaviconUrl: team.custom_favicon_url || null,
    customSiteName: team.custom_site_name || null,
  };
}
