/**
 * Content pipeline schedule API (buffer, slots, autopilot).
 */

import { apiClient } from '../client';

export async function getBuffer(): Promise<{ buffer: unknown[] }> {
  return apiClient.get<{ buffer: unknown[] }>('/content-pipeline/schedule/buffer');
}

export async function bufferAction(postId: string, action: 'approve' | 'reject'): Promise<{ success: boolean; action: string }> {
  return apiClient.post<{ success: boolean; action: string }>('/content-pipeline/schedule/buffer', { postId, action });
}

export async function getSlots(): Promise<{ slots: unknown[] }> {
  return apiClient.get<{ slots: unknown[] }>('/content-pipeline/schedule/slots');
}

export interface CreateSlotBody {
  time_of_day: string;
  day_of_week: number | null;
  timezone: string;
}

export async function createSlot(body: CreateSlotBody): Promise<{ slot: unknown }> {
  return apiClient.post<{ slot: unknown }>('/content-pipeline/schedule/slots', body);
}

export async function updateSlot(id: string, body: { is_active?: boolean }): Promise<{ slot: unknown }> {
  return apiClient.patch<{ slot: unknown }>(`/content-pipeline/schedule/slots/${id}`, body);
}

export async function deleteSlot(id: string): Promise<void> {
  await apiClient.delete(`/content-pipeline/schedule/slots/${id}`);
}

export async function getAutopilotStatus(): Promise<{
  bufferSize: number;
  nextScheduledSlot: string;
  pillarCounts: Record<string, number>;
}> {
  return apiClient.get('/content-pipeline/schedule/autopilot');
}

export interface TriggerAutopilotBody {
  postsPerBatch?: number;
  bufferTarget?: number;
  autoPublish?: boolean;
  profileId?: string;
  teamId?: string;
}

export async function triggerAutopilot(body: TriggerAutopilotBody = {}): Promise<{ triggered: boolean; runId: string }> {
  return apiClient.post<{ triggered: boolean; runId: string }>('/content-pipeline/schedule/autopilot', body);
}
