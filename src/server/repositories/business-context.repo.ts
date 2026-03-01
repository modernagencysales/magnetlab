/**
 * Business Context Repository
 * ALL Supabase queries for cp_business_context live here.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import type { BusinessContext } from "@/lib/types/content-pipeline";

const COLUMNS =
  "id, user_id, company_name, industry, company_description, icp_title, icp_industry, icp_pain_points, target_audience, content_preferences, created_at, updated_at";

export interface BusinessContextUpsertInput {
  company_name?: string | null;
  industry?: string | null;
  company_description?: string | null;
  icp_title?: string | null;
  icp_industry?: string | null;
  icp_pain_points?: string[];
  target_audience?: string | null;
  content_preferences?: Record<string, unknown>;
}

/** Find business context by user (single row per user). Returns null if not found. */
export async function findBusinessContextByUserId(
  userId: string,
): Promise<BusinessContext | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_business_context")
    .select(COLUMNS)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`business-context.findByUserId: ${error.message}`);
  }
  return data as BusinessContext | null;
}

/** Upsert business context for a user (onConflict: user_id). */
export async function upsertBusinessContext(
  userId: string,
  input: BusinessContextUpsertInput,
): Promise<BusinessContext> {
  const supabase = createSupabaseAdminClient();
  const row = {
    user_id: userId,
    company_name: input.company_name ?? null,
    industry: input.industry ?? null,
    company_description: input.company_description ?? null,
    icp_title: input.icp_title ?? null,
    icp_industry: input.icp_industry ?? null,
    icp_pain_points: input.icp_pain_points ?? [],
    target_audience: input.target_audience ?? null,
    content_preferences: input.content_preferences ?? {},
  };

  const { data, error } = await supabase
    .from("cp_business_context")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw new Error(`business-context.upsert: ${error.message}`);
  return data as BusinessContext;
}
