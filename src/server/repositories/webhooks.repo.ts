/**
 * Webhooks Repository
 * All Supabase access for webhook_configs.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const SELECT_COLUMNS = 'id, user_id, name, url, is_active, created_at, updated_at';

export async function listWebhooks(userId: string, limit: number, offset: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('webhook_configs')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return { data: data ?? [], error };
}

export async function createWebhook(userId: string, name: string, url: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('webhook_configs')
    .insert({ user_id: userId, name, url, is_active: true })
    .select()
    .single();
  return { data, error };
}

export async function getWebhookById(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('webhook_configs')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function getWebhookUrlAndName(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('webhook_configs')
    .select('url, name')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function updateWebhook(
  id: string,
  userId: string,
  updates: Partial<{ name: string; url: string; is_active: boolean }>
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('webhook_configs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

export async function deleteWebhook(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('webhook_configs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  return { error };
}
