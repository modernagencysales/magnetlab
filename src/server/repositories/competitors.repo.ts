/**
 * Competitors Repository (cp_monitored_competitors, cp_post_engagements count)
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

export interface CompetitorRow {
  id: string;
  user_id: string;
  linkedin_profile_url: string;
  heyreach_campaign_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function findCompetitorsByUserId(
  userId: string,
): Promise<CompetitorRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_monitored_competitors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`competitors.find: ${error.message}`);
  return (data ?? []) as CompetitorRow[];
}

export async function countCompetitorsByUserId(userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("cp_monitored_competitors")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(`competitors.count: ${error.message}`);
  return count ?? 0;
}

export async function createCompetitor(
  userId: string,
  input: { linkedin_profile_url: string; heyreach_campaign_id?: string | null },
): Promise<CompetitorRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_monitored_competitors")
    .insert({
      user_id: userId,
      linkedin_profile_url: input.linkedin_profile_url,
      heyreach_campaign_id: input.heyreach_campaign_id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`competitors.create: ${error.message}`);
  return data as CompetitorRow;
}

export async function countEngagementsForCompetitor(
  competitorId: string,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("cp_post_engagements")
    .select("id", { count: "exact", head: true })
    .eq("competitor_id", competitorId);
  if (error) throw new Error(`competitors.countEngagements: ${error.message}`);
  return count ?? 0;
}

export async function updateCompetitor(
  userId: string,
  id: string,
  updates: Record<string, unknown>,
): Promise<CompetitorRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_monitored_competitors")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !data) return null;
  return data as CompetitorRow;
}

export async function deleteCompetitor(
  userId: string,
  id: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_monitored_competitors")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`competitors.delete: ${error.message}`);
}
