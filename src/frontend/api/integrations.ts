/**
 * Integrations API (client). Routes: /api/integrations, verify, resend, fathom, email-marketing, gohighlevel, heyreach
 */

import { apiClient } from './client';

export async function verifyIntegration(body: {
  service: string;
  api_key?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ verified: boolean; error?: string | null }> {
  return apiClient.post<{ verified: boolean; error?: string | null }>('/integrations/verify', body);
}

export async function getIntegrations(): Promise<{ integrations: unknown[] }> {
  return apiClient.get<{ integrations: unknown[] }>('/integrations');
}

export async function saveIntegration(body: {
  service: string;
  api_key?: string | null;
  webhook_secret?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ integration: unknown; message?: string }> {
  return apiClient.post<{ integration: unknown; message?: string }>('/integrations', body);
}

export async function updateResendSettings(body: {
  fromEmail?: string | null;
  fromName?: string | null;
}): Promise<{ success: boolean; message?: string }> {
  return apiClient.put<{ success: boolean; message?: string }>(
    '/integrations/resend/settings',
    body
  );
}

// ── Fathom ──
export async function getFathomWebhookUrl(): Promise<{
  configured: boolean;
  webhook_url?: string | null;
}> {
  return apiClient.get<{ configured: boolean; webhook_url?: string | null }>(
    '/integrations/fathom/webhook-url'
  );
}

export async function createFathomWebhookUrl(): Promise<{ webhook_url: string }> {
  return apiClient.post<{ webhook_url: string }>('/integrations/fathom/webhook-url', {});
}

export async function deleteFathomWebhookUrl(): Promise<void> {
  await apiClient.delete('/integrations/fathom/webhook-url');
}

// ── Email marketing (Kit, MailerLite, etc.) ──
export async function connectEmailMarketing(body: {
  provider: string;
  api_key: string;
  metadata?: Record<string, string>;
}): Promise<unknown> {
  return apiClient.post<unknown>('/integrations/email-marketing/connect', body);
}

export async function verifyEmailMarketing(body: { provider: string }): Promise<unknown> {
  return apiClient.post<unknown>('/integrations/email-marketing/verify', body);
}

export async function disconnectEmailMarketing(body: { provider: string }): Promise<unknown> {
  return apiClient.post<unknown>('/integrations/email-marketing/disconnect', body);
}

// ── GoHighLevel ──
export async function connectGoHighLevel(body: { api_key: string }): Promise<unknown> {
  return apiClient.post<unknown>('/integrations/gohighlevel/connect', body);
}

export async function verifyGoHighLevel(): Promise<unknown> {
  return apiClient.post<unknown>('/integrations/gohighlevel/verify', {});
}

export async function disconnectGoHighLevel(): Promise<void> {
  await apiClient.post('/integrations/gohighlevel/disconnect', {});
}

// ── HeyReach ──
export async function connectHeyReach(body: { api_key: string }): Promise<unknown> {
  return apiClient.post<unknown>('/integrations/heyreach/connect', body);
}

export async function verifyHeyReach(): Promise<unknown> {
  return apiClient.post<unknown>('/integrations/heyreach/verify', {});
}

export async function disconnectHeyReach(): Promise<void> {
  await apiClient.post('/integrations/heyreach/disconnect', {});
}

// ── Status (GET) ──
export async function getGoHighLevelStatus(): Promise<{ connected: boolean }> {
  return apiClient.get<{ connected: boolean }>('/integrations/gohighlevel/status');
}

export async function getHeyReachStatus(): Promise<{ connected: boolean }> {
  return apiClient.get<{ connected: boolean }>('/integrations/heyreach/status');
}

export async function getEmailMarketingConnected(): Promise<{ providers: string[] }> {
  return apiClient.get<{ providers: string[] }>('/integrations/email-marketing/connected');
}

export async function getHeyReachCampaigns(): Promise<{ campaigns?: unknown[] }> {
  return apiClient.get<{ campaigns?: unknown[] }>('/integrations/heyreach/campaigns');
}
