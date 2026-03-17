/**
 * Admin Repository (ai_prompt_templates, ai_prompt_versions, teams, email_subscribers)
 * ALL Supabase for admin-only prompts and import-subscribers.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Column Constants ─────────────────────────────────────────────────────────

export const AI_PROMPT_TEMPLATE_COLUMNS =
  'id, slug, name, category, description, system_prompt, user_prompt, model, temperature, max_tokens, variables, is_active, created_at, updated_at';

export const AI_PROMPT_VERSION_COLUMNS =
  'id, prompt_id, version, system_prompt, user_prompt, model, temperature, max_tokens, change_note, changed_by, created_at';

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
    .select(AI_PROMPT_TEMPLATE_COLUMNS)
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function getPromptVersions(promptId: string): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ai_prompt_versions')
    .select(AI_PROMPT_VERSION_COLUMNS)
    .eq('prompt_id', promptId)
    .order('version', { ascending: false });
  if (error) throw new Error(`admin.getPromptVersions: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function getVersionById(versionId: string): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ai_prompt_versions')
    .select(AI_PROMPT_VERSION_COLUMNS)
    .eq('id', versionId)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function getTeamOwner(
  teamId: string
): Promise<{ id: string; owner_id: string } | null> {
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

export async function getActivePromptBySlug(slug: string): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('ai_prompt_templates')
    .select(AI_PROMPT_TEMPLATE_COLUMNS)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  return data ? (data as Record<string, unknown>) : null;
}

export async function updatePromptTemplate(
  slug: string,
  updates: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('ai_prompt_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('slug', slug);
  if (error) throw new Error(`admin.updatePromptTemplate: ${error.message}`);
}

export async function getLatestPromptVersion(
  promptId: string
): Promise<{ version: number } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('ai_prompt_versions')
    .select('version')
    .eq('prompt_id', promptId)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  return data ? (data as { version: number }) : null;
}

export async function insertPromptVersion(record: {
  prompt_id: string;
  version: number;
  system_prompt: string;
  user_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  change_note: string | null;
  changed_by: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('ai_prompt_versions').insert(record);
  if (error) throw new Error(`admin.insertPromptVersion: ${error.message}`);
}

export async function upsertEmailSubscribersBatch(
  records: EmailSubscriberRecord[]
): Promise<{ count: number }> {
  if (records.length === 0) return { count: 0 };
  const supabase = createSupabaseAdminClient();
  const { error, count } = await supabase
    .from('email_subscribers')
    .upsert(records, { onConflict: 'team_id,email', ignoreDuplicates: false });
  if (error) throw new Error(`admin.upsertEmailSubscribersBatch: ${error.message}`);
  return { count: count ?? records.length };
}
