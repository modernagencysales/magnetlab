/**
 * Admin Repository (ai_prompt_templates, ai_prompt_versions, teams, email_subscribers)
 * ALL Supabase for admin-only prompts and import-subscribers.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function listPrompts(): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ai_prompt_templates')
    .select('slug, name, category, description, model, is_active, updated_at')
    .order('category')
    .order('name');
  if (error) throw new Error(`admin.listPrompts: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function getPromptBySlug(slug: string): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ai_prompt_templates')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function getPromptVersions(promptId: string): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ai_prompt_versions')
    .select('*')
    .eq('prompt_id', promptId)
    .order('version', { ascending: false });
  if (error) throw new Error(`admin.getPromptVersions: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function getVersionById(versionId: string): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ai_prompt_versions')
    .select('*')
    .eq('id', versionId)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function getTeamOwner(teamId: string): Promise<{ id: string; owner_id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('teams')
    .select('id, owner_id')
    .eq('id', teamId)
    .single();
  if (error || !data) return null;
  return data as { id: string; owner_id: string };
}

export interface EmailSubscriberRecord {
  team_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  source: string;
  status: string;
  metadata: Record<string, unknown>;
}

export async function upsertEmailSubscribersBatch(
  records: EmailSubscriberRecord[],
): Promise<{ count: number }> {
  if (records.length === 0) return { count: 0 };
  const supabase = createSupabaseAdminClient();
  const { error, count } = await supabase
    .from('email_subscribers')
    .upsert(records, { onConflict: 'team_id,email', ignoreDuplicates: false });
  if (error) throw new Error(`admin.upsertEmailSubscribersBatch: ${error.message}`);
  return { count: count ?? records.length };
}
