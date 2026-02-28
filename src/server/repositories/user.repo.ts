/**
 * User Repository (users table — profile fields used by API)
 * ALL Supabase queries for user profile data live here.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/** Find user by id (id, name, username) for external API. */
export async function findUserByIdForExternal(userId: string): Promise<{ id: string; name: string | null; username: string | null } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, name, username')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as { id: string; name: string | null; username: string | null };
}

/** Find user by email (for external create-account). */
export async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('users').select('id').eq('email', email).single();
  return data ? (data as { id: string }) : null;
}

/** Create user (email, name only — for external create-account). */
export async function createUser(payload: { email: string; name: string }): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .insert({ email: payload.email, name: payload.name })
    .select('id')
    .single();
  if (error) throw new Error(`user.createUser: ${error.message}`);
  return data as { id: string };
}

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

/** Funnel default styling (for external funnel create). */
export async function getFunnelDefaults(userId: string): Promise<{
  default_theme: string | null;
  default_primary_color: string | null;
  default_background_style: string | null;
  default_logo_url: string | null;
}> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('default_theme, default_primary_color, default_background_style, default_logo_url')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`user.getFunnelDefaults: ${error.message}`);
  return (data ?? {}) as { default_theme: string | null; default_primary_color: string | null; default_background_style: string | null; default_logo_url: string | null };
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
