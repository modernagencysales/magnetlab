/**
 * Email Sequence Repository
 * All Supabase access for email sequences (generate, get, update, activate).
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';
import type { Email } from '@/lib/types/email';

// ----- Lead magnet & context for generation -----

export async function getLeadMagnetForUser(leadMagnetId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_magnets')
    .select('id, user_id, team_id, title, archetype, concept, extracted_content')
    .eq('id', leadMagnetId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return { data: null, error };
  return { data, error: null };
}

export async function getBrandKitForUser(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('brand_kits')
    .select('business_description, sender_name, best_video_url, best_video_title, content_links, community_url')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function getUserName(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('users').select('name').eq('id', userId).single();
  return data?.name ?? null;
}

// ----- Email sequence CRUD -----

export async function upsertEmailSequence(params: {
  leadMagnetId: string;
  userId: string;
  teamId: string | null;
  emails: Email[];
  status: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_sequences')
    .upsert(
      {
        lead_magnet_id: params.leadMagnetId,
        user_id: params.userId,
        team_id: params.teamId,
        emails: params.emails,
        status: params.status,
      },
      { onConflict: 'lead_magnet_id' }
    )
    .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
    .single();
  return { data, error };
}

export async function getLeadMagnetIdByScope(leadMagnetId: string, scope: DataScope): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  let q = supabase.from('lead_magnets').select('id').eq('id', leadMagnetId);
  q = applyScope(q, scope);
  const { data } = await q.single();
  return data?.id ?? null;
}

export async function getEmailSequenceByLeadMagnetId(leadMagnetId: string, scope: DataScope) {
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from('email_sequences')
    .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
    .eq('lead_magnet_id', leadMagnetId);
  q = applyScope(q, scope);
  const { data, error } = await q.single();
  return { data, error };
}

export async function getEmailSequenceForUpdate(leadMagnetId: string, scope: DataScope) {
  const supabase = createSupabaseAdminClient();
  let q = supabase.from('email_sequences').select('id, emails').eq('lead_magnet_id', leadMagnetId);
  q = applyScope(q, scope);
  const { data, error } = await q.maybeSingle();
  return { data, error };
}

export async function updateEmailSequenceById(
  sequenceId: string,
  update: { emails?: Email[]; status?: string },
  scope: DataScope
) {
  const supabase = createSupabaseAdminClient();
  let q = supabase.from('email_sequences').update(update).eq('id', sequenceId);
  q = applyScope(q, scope);
  const { data, error } = await q.select().single();
  return { data, error };
}

// For activate: user-scoped only (no team)
export async function getEmailSequenceByLeadMagnetIdForUser(leadMagnetId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_sequences')
    .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function setEmailSequenceStatusActive(sequenceId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('email_sequences')
    .update({ status: 'active' })
    .eq('id', sequenceId)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}
