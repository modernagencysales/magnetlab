/**
 * Email subscribers API (client). Routes: /api/email/subscribers, /api/email/subscribers/import
 */

import { apiClient } from '../client';

export interface ListSubscribersParams {
  search?: string;
  status?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export async function listSubscribers(
  params: ListSubscribersParams = {}
): Promise<{
  subscribers: unknown[];
  total: number;
  page: number;
  limit: number;
}> {
  const sp = new URLSearchParams();
  if (params.search) sp.set('search', params.search);
  if (params.status) sp.set('status', params.status);
  if (params.source) sp.set('source', params.source);
  if (params.page != null) sp.set('page', String(params.page));
  if (params.limit != null) sp.set('limit', String(params.limit));
  const query = sp.toString();
  return apiClient.get<{
    subscribers: unknown[];
    total: number;
    page: number;
    limit: number;
  }>(`/email/subscribers${query ? `?${query}` : ''}`);
}

export async function createSubscriber(body: {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}): Promise<{ subscriber: unknown }> {
  return apiClient.post<{ subscriber: unknown }>('/email/subscribers', body);
}

/** Unsubscribe (soft delete) by subscriber id. Returns message. */
export async function unsubscribeSubscriber(
  id: string
): Promise<{ message: string; already?: boolean }> {
  return apiClient.delete<{ message: string; already?: boolean }>(
    `/email/subscribers/${id}`
  );
}

/** Preview CSV import: validate rows, return valid/invalid. */
export async function importSubscribersPreview(
  formData: FormData
): Promise<{ valid: unknown[]; invalid: unknown[]; total: number }> {
  return apiClient.post<{ valid: unknown[]; invalid: unknown[]; total: number }>(
    '/email/subscribers/import',
    formData
  );
}

/** Confirm CSV import: perform upsert. */
export async function importSubscribersConfirm(
  formData: FormData
): Promise<{ imported: number; skipped: number }> {
  return apiClient.post<{ imported: number; skipped: number }>(
    '/email/subscribers/import?confirm=true',
    formData
  );
}
