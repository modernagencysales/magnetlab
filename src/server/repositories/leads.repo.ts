/**
 * Leads Repository (funnel_leads)
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { applyScope } from "@/lib/utils/team-context";
import type { DataScope } from "@/lib/utils/team-context";

const SELECT_LEADS_WITH_FUNNEL = `
  id,
  email,
  name,
  is_qualified,
  qualification_answers,
  utm_source,
  utm_medium,
  utm_campaign,
  created_at,
  funnel_pages!inner (
    slug,
    optin_headline,
    lead_magnets (
      title
    )
  )
`;

const SELECT_LEADS_EXPORT = `
  email,
  name,
  is_qualified,
  qualification_answers,
  utm_source,
  utm_medium,
  utm_campaign,
  created_at,
  funnel_pages!inner(slug),
  lead_magnets!inner(title)
`;

export interface LeadFilters {
  funnelPageId?: string;
  leadMagnetId?: string;
  qualified?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function findLeads(
  scope: DataScope,
  filters: LeadFilters,
): Promise<{ data: unknown[]; count: number }> {
  const supabase = createSupabaseAdminClient();
  let query = applyScope(
    supabase.from("funnel_leads").select(SELECT_LEADS_WITH_FUNNEL, { count: "exact" }),
    scope,
  )
    .order("created_at", { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

  if (filters.funnelPageId) query = query.eq("funnel_page_id", filters.funnelPageId);
  if (filters.leadMagnetId) query = query.eq("lead_magnet_id", filters.leadMagnetId);
  if (filters.qualified === true) query = query.eq("is_qualified", true);
  else if (filters.qualified === false) query = query.eq("is_qualified", false);
  if (filters.search) {
    query = query.or(`email.ilike.%${filters.search}%,name.ilike.%${filters.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`leads.find: ${error.message}`);
  return { data: data ?? [], count: count ?? 0 };
}

const MAX_EXPORT = 10000;

export async function findLeadsForExport(
  scope: DataScope,
  filters: Omit<LeadFilters, "limit" | "offset">,
): Promise<unknown[]> {
  const supabase = createSupabaseAdminClient();
  let query = applyScope(
    supabase.from("funnel_leads").select(SELECT_LEADS_EXPORT),
    scope,
  )
    .order("created_at", { ascending: false })
    .limit(MAX_EXPORT);

  if (filters.funnelPageId) query = query.eq("funnel_page_id", filters.funnelPageId);
  if (filters.leadMagnetId) query = query.eq("lead_magnet_id", filters.leadMagnetId);
  if (filters.qualified === true) query = query.eq("is_qualified", true);
  else if (filters.qualified === false) query = query.eq("is_qualified", false);

  const { data, error } = await query;
  if (error) throw new Error(`leads.findForExport: ${error.message}`);
  return data ?? [];
}
