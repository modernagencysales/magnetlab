/**
 * Creators Repository (cp_tracked_creators)
 * ALL Supabase queries for cp_tracked_creators live here.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

const CREATOR_COLUMNS =
  "id, linkedin_url, name, headline, avatar_url, avg_engagement, post_count, added_by_user_id, is_active, last_scraped_at, created_at";

export interface TrackedCreator {
  id: string;
  linkedin_url: string;
  name: string | null;
  headline: string | null;
  avatar_url: string | null;
  avg_engagement: number | null;
  post_count: number | null;
  added_by_user_id: string;
  is_active: boolean;
  last_scraped_at: string | null;
  created_at: string;
}

export interface CreateCreatorInput {
  linkedin_url: string;
  name?: string | null;
  headline?: string | null;
}

/** List creators added by the given user. */
export async function findCreatorsByUserId(
  userId: string,
): Promise<TrackedCreator[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_tracked_creators")
    .select(CREATOR_COLUMNS)
    .eq("added_by_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`creators.findByUserId: ${error.message}`);
  return (data ?? []) as TrackedCreator[];
}

/** Find one creator by linkedin_url (for dedupe). */
export async function findCreatorByLinkedInUrl(
  linkedinUrl: string,
): Promise<TrackedCreator | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_tracked_creators")
    .select(CREATOR_COLUMNS)
    .eq("linkedin_url", linkedinUrl)
    .maybeSingle();

  if (error) throw new Error(`creators.findByLinkedInUrl: ${error.message}`);
  return data as TrackedCreator | null;
}

/** Find one creator by id (minimal fields for ownership check). */
export async function findCreatorById(
  id: string,
): Promise<{ id: string; added_by_user_id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_tracked_creators")
    .select("id, added_by_user_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`creators.findById: ${error.message}`);
  return data;
}

export async function createCreator(
  userId: string,
  input: CreateCreatorInput,
): Promise<TrackedCreator> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_tracked_creators")
    .insert({
      linkedin_url: input.linkedin_url,
      name: input.name ?? null,
      headline: input.headline ?? null,
      added_by_user_id: userId,
    })
    .select(CREATOR_COLUMNS)
    .single();

  if (error) throw new Error(`creators.create: ${error.message}`);
  return data as TrackedCreator;
}

export async function deleteCreator(id: string, userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_tracked_creators")
    .delete()
    .eq("id", id)
    .eq("added_by_user_id", userId);

  if (error) throw new Error(`creators.delete: ${error.message}`);
}
