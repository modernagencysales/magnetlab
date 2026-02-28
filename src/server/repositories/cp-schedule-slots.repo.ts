/**
 * Content Pipeline Schedule Slots Repository
 * All Supabase access for cp_posting_slots.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function listSlots(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_posting_slots')
    .select('id, user_id, slot_number, time_of_day, day_of_week, timezone, is_active, created_at')
    .eq('user_id', userId)
    .order('slot_number', { ascending: true });
  return { data: data ?? [], error };
}

export async function getMaxSlotNumber(userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('cp_posting_slots')
    .select('slot_number')
    .eq('user_id', userId)
    .order('slot_number', { ascending: false })
    .limit(1)
    .single();
  return (data as { slot_number?: number } | null)?.slot_number ?? 0;
}

export async function createSlot(
  userId: string,
  payload: { time_of_day: string; day_of_week?: number | null; timezone?: string }
) {
  const supabase = createSupabaseAdminClient();
  const nextSlot = (await getMaxSlotNumber(userId)) + 1;
  const { data, error } = await supabase
    .from('cp_posting_slots')
    .insert({
      user_id: userId,
      slot_number: nextSlot,
      time_of_day: payload.time_of_day,
      day_of_week: payload.day_of_week ?? null,
      timezone: payload.timezone ?? 'UTC',
      is_active: true,
    })
    .select()
    .single();
  return { data, error };
}

export async function updateSlot(
  id: string,
  userId: string,
  updates: Partial<{ time_of_day: string; day_of_week: number | null; timezone: string; is_active: boolean }>
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_posting_slots')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
}

export async function deleteSlot(id: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cp_posting_slots').delete().eq('id', id).eq('user_id', userId);
  return { error };
}
