/**
 * API Keys Repository (api_keys)
 * ALL Supabase queries for API keys live here.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export async function createKey(
  userId: string,
  payload: { keyHash: string; keyPrefix: string; name: string }
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      key_hash: payload.keyHash,
      key_prefix: payload.keyPrefix,
      name: payload.name,
    })
    .select('id, name, created_at')
    .single();

  if (error) throw new Error(`keys.createKey: ${error.message}`);
  return data as { id: string; name: string; created_at: string };
}

export async function listKeysByUserId(userId: string): Promise<ApiKeyRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, is_active, last_used_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`keys.listKeysByUserId: ${error.message}`);
  return (data ?? []) as ApiKeyRow[];
}

export async function revokeKeyByIdAndUser(keyId: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('user_id', userId);

  if (error) throw new Error(`keys.revokeKeyByIdAndUser: ${error.message}`);
  return true;
}
