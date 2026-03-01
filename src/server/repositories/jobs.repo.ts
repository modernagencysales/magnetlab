/**
 * Background Jobs Repository (background_jobs)
 * ALL Supabase queries for background_jobs live here.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

export interface BackgroundJobRow {
  id: string;
  status: string;
  result: unknown;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function findJobById(
  userId: string,
  id: string,
): Promise<BackgroundJobRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id, status, result, error, created_at, completed_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as BackgroundJobRow;
}
