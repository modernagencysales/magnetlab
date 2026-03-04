/**
 * Content pipeline transcripts API (client).
 */

import { apiClient } from '../client';

export interface ListTranscriptsParams {
  team_id?: string;
  speaker_profile_id?: string;
}

export async function listTranscripts(params: ListTranscriptsParams = {}): Promise<{ transcripts: unknown[] }> {
  const searchParams = new URLSearchParams();
  if (params.team_id) searchParams.set('team_id', params.team_id);
  if (params.speaker_profile_id) searchParams.set('speaker_profile_id', params.speaker_profile_id);
  const query = searchParams.toString();
  return apiClient.get<{ transcripts: unknown[] }>(`/content-pipeline/transcripts${query ? `?${query}` : ''}`);
}

export interface CreateTranscriptBody {
  transcript: string;
  title?: string;
  speakerProfileId?: string;
  source?: string;
}

export async function createTranscript(body: CreateTranscriptBody): Promise<{ success: boolean; transcript_id: string }> {
  return apiClient.post<{ success: boolean; transcript_id: string }>('/content-pipeline/transcripts', body);
}

export async function uploadTranscript(file: File, title?: string): Promise<{ success: boolean; transcript_id: string }> {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  return apiClient.post<{ success: boolean; transcript_id: string }>('/content-pipeline/transcripts/upload', form);
}

export async function getTranscript(id: string): Promise<{ transcript: unknown }> {
  return apiClient.get<{ transcript: unknown }>(`/content-pipeline/transcripts/${id}`);
}

export async function updateTranscript(id: string, body: Record<string, unknown>): Promise<{ transcript: unknown }> {
  return apiClient.patch<{ transcript: unknown }>(`/content-pipeline/transcripts/${id}`, body);
}

export async function deleteTranscript(id: string): Promise<void> {
  await apiClient.delete(`/content-pipeline/transcripts?id=${encodeURIComponent(id)}`);
}

export async function reprocessTranscript(id: string): Promise<{ success: boolean }> {
  return apiClient.post<{ success: boolean }>(`/content-pipeline/transcripts/${id}/reprocess`, {});
}

export async function getWebhookConfig(): Promise<{ webhook_url?: string; user_id?: string }> {
  return apiClient.get<{ webhook_url?: string; user_id?: string }>('/content-pipeline/transcripts/webhook-config');
}
