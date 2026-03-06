/**
 * Email sequence API (client).
 */

import { apiClient } from './client';

export async function getEmailSequence(leadMagnetId: string): Promise<{ emailSequence: unknown }> {
  return apiClient.get<{ emailSequence: unknown }>(`/email-sequence/${leadMagnetId}`);
}

export interface EmailSequenceUpdateBody {
  emails?: Array<{ day: number; subject: string; body: string; replyTrigger: string }>;
  status?: 'draft' | 'synced' | 'active';
}

export async function updateEmailSequence(
  leadMagnetId: string,
  body: EmailSequenceUpdateBody
): Promise<{ emailSequence: unknown }> {
  return apiClient.put<{ emailSequence: unknown }>(`/email-sequence/${leadMagnetId}`, body);
}

export async function generateEmailSequence(
  leadMagnetId: string,
  useAI?: boolean
): Promise<{ emailSequence: unknown; generated?: boolean }> {
  return apiClient.post<{ emailSequence: unknown; generated?: boolean }>('/email-sequence/generate', {
    leadMagnetId,
    useAI,
  });
}

export async function activateEmailSequence(leadMagnetId: string): Promise<{ emailSequence: unknown; message?: string }> {
  return apiClient.post<{ emailSequence: unknown; message?: string }>(`/email-sequence/${leadMagnetId}/activate`, {});
}
