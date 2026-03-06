/**
 * Public API (no auth). Opt-in, thank-you, chat, resource click, view tracking.
 * Routes: /api/public/view, lead, chat, resource-click, questions/[id]
 */

import { apiClient } from './client';

export async function trackView(payload: {
  funnelPageId: string;
  pageType?: string;
}): Promise<void> {
  await apiClient.post('/public/view', payload);
}

export interface CaptureLeadPayload {
  funnelPageId: string;
  email: string;
  name?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  linkedinUrl?: string;
  fbc?: string;
  fbp?: string;
}

export async function captureLead(payload: CaptureLeadPayload): Promise<{
  leadId: string;
  success: boolean;
}> {
  return apiClient.post<{ leadId: string; success: boolean }>('/public/lead', payload);
}

export async function updateLeadQualification(payload: {
  leadId: string;
  answers: Record<string, string>;
}): Promise<{ leadId: string; isQualified: boolean; success: boolean }> {
  return apiClient.patch<{ leadId: string; isQualified: boolean; success: boolean }>(
    '/public/lead',
    payload
  );
}

export async function getQuestions(funnelPageId: string): Promise<{
  questions: Array<{
    id: string;
    questionText: string;
    questionOrder: number;
    answerType: string;
    options: unknown;
    placeholder: string | null;
    isRequired: boolean;
  }>;
}> {
  return apiClient.get<{ questions: unknown[] }>(
    `/public/questions/${funnelPageId}`
  ) as Promise<{
    questions: Array<{
      id: string;
      questionText: string;
      questionOrder: number;
      answerType: string;
      options: unknown;
      placeholder: string | null;
      isRequired: boolean;
    }>;
  }>;
}

export async function trackResourceClick(payload: {
  resourceId: string;
  funnelPageId?: string;
  leadId?: string;
}): Promise<void> {
  await apiClient.post('/public/resource-click', payload);
}

/** GET chat history. */
export async function getChatMessages(params: {
  leadMagnetId: string;
  sessionToken: string;
}): Promise<{ messages?: unknown[]; chatId?: string }> {
  const sp = new URLSearchParams();
  sp.set('leadMagnetId', params.leadMagnetId);
  sp.set('sessionToken', params.sessionToken);
  return apiClient.get<{ messages?: unknown[]; chatId?: string }>(
    `/public/chat?${sp.toString()}`
  );
}

/**
 * POST chat message. Returns raw Response for streaming; caller must check ok and read body.
 */
export function sendChatMessage(
  payload: { leadMagnetId: string; sessionToken: string; message: string; chatId?: string },
  signal?: AbortSignal
): Promise<Response> {
  const url = '/api/public/chat';
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
    signal,
  });
}
