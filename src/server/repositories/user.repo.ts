/**
 * User Repository (users table — profile fields used by API)
 * ALL Supabase queries for user profile data live here.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function getUsername(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('username')
    .eq('id', userId)
    .single();

  if (error) throw new Error(`user.getUsername: ${error.message}`);
  return data?.username ?? null;
}

/** Returns true if another user (not userId) has this username. */
export async function isUsernameTakenByOther(username: string, userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .neq('id', userId)
    .single();
  return !!data;
}

export async function updateUsername(userId: string, username: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .update({ username })
    .eq('id', userId)
    .select('username')
    .single();

  if (error) throw new Error(`user.updateUsername: ${error.message}`);
  return data.username;
}

export interface UserDefaultsRow {
  default_vsl_url: string | null;
  default_funnel_template: string | null;
}

export async function getDefaults(userId: string): Promise<UserDefaultsRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('default_vsl_url, default_funnel_template')
    .eq('id', userId)
    .single();

  if (error) throw new Error(`user.getDefaults: ${error.message}`);
  return data as UserDefaultsRow;
}

export async function updateDefaults(
  userId: string,
  updates: { default_vsl_url?: string | null; default_funnel_template?: string }
): Promise<UserDefaultsRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('default_vsl_url, default_funnel_template')
    .single();

  if (error) throw new Error(`user.updateDefaults: ${error.message}`);
  return data as UserDefaultsRow;
}
