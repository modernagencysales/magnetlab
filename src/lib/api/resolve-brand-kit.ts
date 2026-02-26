// Shared brand kit resolution for external API routes.
// Tries team-level first, then falls back to user-level.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface BrandKit {
  default_theme?: string | null;
  default_primary_color?: string | null;
  default_background_style?: string | null;
  logo_url?: string | null;
  font_family?: string | null;
  font_url?: string | null;
  logos?: Array<{ name: string; imageUrl: string }> | null;
  default_testimonial?: { quote: string; author?: string; role?: string } | null;
  default_steps?: { steps: Array<{ icon?: string; title: string; description: string }> } | null;
  urgent_pains?: string[] | null;
  frequent_questions?: string[] | null;
  credibility_markers?: string[] | null;
}

const BRAND_KIT_COLUMNS = 'default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url, logos, default_testimonial, default_steps, urgent_pains, frequent_questions, credibility_markers';

/**
 * Resolves the brand kit for a user. Checks team-level first (via team_profiles owner lookup),
 * then falls back to user-level. Returns null if no brand kit found.
 */
export async function resolveBrandKit(
  supabase: SupabaseClient,
  userId: string,
  teamId?: string | null,
): Promise<BrandKit | null> {
  // If teamId is provided directly, try that first
  if (teamId) {
    const { data } = await supabase
      .from('brand_kits')
      .select(BRAND_KIT_COLUMNS)
      .eq('team_id', teamId)
      .limit(1)
      .single();
    if (data) return data as BrandKit;
  }

  // Try team-level via owner profile lookup
  const { data: teamProfile } = await supabase
    .from('team_profiles')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  if (teamProfile?.team_id) {
    const { data } = await supabase
      .from('brand_kits')
      .select(BRAND_KIT_COLUMNS)
      .eq('team_id', teamProfile.team_id)
      .limit(1)
      .single();
    if (data) return data as BrandKit;
  }

  // Fallback to user-level
  const { data } = await supabase
    .from('brand_kits')
    .select(BRAND_KIT_COLUMNS)
    .eq('user_id', userId)
    .limit(1)
    .single();

  return (data as BrandKit) || null;
}
