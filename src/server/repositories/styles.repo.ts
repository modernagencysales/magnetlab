/**
 * Writing Styles Repository (cp_writing_styles)
 * ALL Supabase queries for cp_writing_styles live here.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import type { WritingStyle, StyleProfile } from "@/lib/types/content-pipeline";

const STYLE_COLUMNS =
  "id, user_id, name, description, source_linkedin_url, source_posts_analyzed, style_profile, example_posts, is_active, last_updated_at, created_at";

export interface StyleInsertInput {
  user_id: string;
  name: string;
  description: string;
  source_linkedin_url?: string | null;
  source_posts_analyzed: number;
  style_profile: StyleProfile;
  example_posts: string[];
  embedding?: string;
}

export interface StyleUpdateInput {
  name?: string;
  description?: string | null;
  style_profile?: StyleProfile;
  example_posts?: string[] | null;
  is_active?: boolean;
  last_updated_at?: string;
}

export async function findStylesByUserId(
  userId: string,
  activeOnly = true,
): Promise<WritingStyle[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("cp_writing_styles")
    .select(STYLE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(`styles.findByUserId: ${error.message}`);
  return (data ?? []) as WritingStyle[];
}

export async function findStyleById(
  userId: string,
  id: string,
): Promise<WritingStyle | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_writing_styles")
    .select(STYLE_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as WritingStyle;
}

export async function createStyle(
  input: StyleInsertInput,
): Promise<WritingStyle> {
  const supabase = createSupabaseAdminClient();
  const row: Record<string, unknown> = {
    user_id: input.user_id,
    name: input.name,
    description: input.description,
    source_linkedin_url: input.source_linkedin_url ?? null,
    source_posts_analyzed: input.source_posts_analyzed,
    style_profile: input.style_profile,
    example_posts: input.example_posts,
  };
  if (input.embedding) {
    row.embedding = input.embedding;
  }

  const { data, error } = await supabase
    .from("cp_writing_styles")
    .insert(row)
    .select(STYLE_COLUMNS)
    .single();

  if (error) throw new Error(`styles.create: ${error.message}`);
  return data as WritingStyle;
}

export async function updateStyle(
  userId: string,
  id: string,
  updates: StyleUpdateInput,
): Promise<WritingStyle> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_writing_styles")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select(STYLE_COLUMNS)
    .single();

  if (error) throw new Error(`styles.update: ${error.message}`);
  return data as WritingStyle;
}

export async function deleteStyle(userId: string, id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_writing_styles")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`styles.delete: ${error.message}`);
}
