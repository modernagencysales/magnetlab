/**
 * Scrape Searches Repository (cp_scrape_searches)
 * ALL Supabase queries for cp_scrape_searches live here.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

const COLUMNS =
  "id, query, description, post_format_filter, is_active, created_at";

export interface ScrapeSearch {
  id: string;
  query: string;
  description: string | null;
  post_format_filter: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateScrapeSearchInput {
  query: string;
  description?: string | null;
  post_format_filter?: string | null;
}

export async function findScrapeSearches(): Promise<ScrapeSearch[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_scrape_searches")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`scrape-searches.find: ${error.message}`);
  return (data ?? []) as ScrapeSearch[];
}

export async function createScrapeSearch(
  input: CreateScrapeSearchInput,
): Promise<ScrapeSearch> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_scrape_searches")
    .insert({
      query: input.query,
      description: input.description ?? null,
      post_format_filter: input.post_format_filter ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(`scrape-searches.create: ${error.message}`);
  return data as ScrapeSearch;
}

export async function findScrapeSearchById(
  id: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_scrape_searches")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`scrape-searches.findById: ${error.message}`);
  return data;
}

export async function deleteScrapeSearch(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_scrape_searches")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`scrape-searches.delete: ${error.message}`);
}
