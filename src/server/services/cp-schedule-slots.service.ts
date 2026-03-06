/**
 * Content Pipeline Schedule Slots Service
 * List, create, update, delete posting slots.
 */

import { logError } from '@/lib/utils/logger';
import * as cpSlotsRepo from '@/server/repositories/cp-schedule-slots.repo';

export async function list(userId: string) {
  const { data, error } = await cpSlotsRepo.listSlots(userId);
  if (error) {
    logError('cp/schedule/slots', error, { step: 'slots_fetch_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, slots: data };
}

export async function create(
  userId: string,
  payload: { time_of_day: string; day_of_week?: number | null; timezone?: string }
) {
  const timeMatch = payload.time_of_day?.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch || parseInt(timeMatch[1], 10) > 23 || parseInt(timeMatch[2], 10) > 59) {
    return { success: false, error: 'validation' as const, message: 'time_of_day required in HH:MM format (00:00-23:59)' };
  }

  const { data, error } = await cpSlotsRepo.createSlot(userId, payload);
  if (error) {
    logError('cp/schedule/slots', error, { step: 'slot_create_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, slot: data };
}

const ALLOWED_FIELDS = ['time_of_day', 'day_of_week', 'timezone', 'is_active'];

export async function update(userId: string, id: string, body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'validation' as const, message: 'No valid fields to update' };
  }

  const { data, error } = await cpSlotsRepo.updateSlot(id, userId, updates as Parameters<typeof cpSlotsRepo.updateSlot>[2]);
  if (error) {
    logError('cp/schedule/slots', error, { step: 'slot_update_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, slot: data };
}

export async function deleteSlot(userId: string, id: string) {
  const { error } = await cpSlotsRepo.deleteSlot(id, userId);
  if (error) {
    logError('cp/schedule/slots', error, { step: 'slot_delete_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}
