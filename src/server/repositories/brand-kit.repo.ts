/**
 * Brand Kit Repository (brand_kits)
 * Scoped by team or user. ALL Supabase for brand kit CRUD here.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

const BRAND_KIT_COLUMNS =
  'id, user_id, team_id, business_description, business_type, credibility_markers, sender_name, saved_ideation_result, ideation_generated_at, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools, preferred_tone, style_profile, best_video_url, best_video_title, content_links, community_url, logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url, website_url, created_at, updated_at';

export async function getBrandKit(scope: DataScope): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const query = applyScope(
    supabase.from('brand_kits').select(BRAND_KIT_COLUMNS),
    scope,
  );
  const { data, error } = await query.single();
  if (error && error.code !== 'PGRST116') throw new Error(`brand-kit.getBrandKit: ${error.message}`);
  return (data ?? null) as Record<string, unknown> | null;
}

export async function upsertBrandKit(
  scope: DataScope,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const onConflict = scope.type === 'team' && scope.teamId ? 'team_id' : 'user_id';
  const { data, error } = await supabase
    .from('brand_kits')
    .upsert(payload, { onConflict })
    .select()
    .single();
  if (error) throw new Error(`brand-kit.upsertBrandKit: ${error.message}`);
  return data as Record<string, unknown>;
}
