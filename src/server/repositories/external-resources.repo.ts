/**
 * External Resources Repository (external_resources)
 * ALL Supabase for external resources CRUD.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const SELECT_COLUMNS = 'id, user_id, title, url, icon, click_count, created_at, updated_at';

export async function listByUserId(
  userId: string,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_resources')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`external-resources.listByUserId: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function create(
  userId: string,
  payload: { title: string; url: string; icon?: string },
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_resources')
    .insert({
      user_id: userId,
      title: payload.title,
      url: payload.url,
      icon: payload.icon ?? '🔗',
    })
    .select()
    .single();
  if (error) throw new Error(`external-resources.create: ${error.message}`);
  return data as Record<string, unknown>;
}

export async function getByIdAndUser(
  id: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_resources')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function updateByIdAndUser(
  id: string,
  userId: string,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_resources')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function deleteByIdAndUser(id: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from('external_resources')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (!existing) return false;
  const { error } = await supabase.from('external_resources').delete().eq('id', id);
  if (error) throw new Error(`external-resources.deleteByIdAndUser: ${error.message}`);
  return true;
}
