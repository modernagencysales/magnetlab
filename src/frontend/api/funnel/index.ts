/**
 * Funnel API (client): CRUD, sections, publish, theme, generate-content, restyle.
 */

import { apiClient } from '../client';
import type { RestylePlan } from '@/lib/types/funnel';

export interface GetFunnelByTargetParams {
  leadMagnetId?: string;
  libraryId?: string;
  externalResourceId?: string;
}

export async function getFunnelByTarget(params: GetFunnelByTargetParams): Promise<{ funnel: unknown }> {
  const searchParams = new URLSearchParams();
  if (params.leadMagnetId) searchParams.set('leadMagnetId', params.leadMagnetId);
  if (params.libraryId) searchParams.set('libraryId', params.libraryId);
  if (params.externalResourceId) searchParams.set('externalResourceId', params.externalResourceId);
  const query = searchParams.toString();
  return apiClient.get<{ funnel: unknown }>(`/funnel${query ? `?${query}` : ''}`);
}

export async function createFunnel(body: Record<string, unknown>): Promise<{ funnel: unknown }> {
  return apiClient.post<{ funnel: unknown }>('/funnel', body);
}

export async function getFunnel(id: string): Promise<{ funnel: unknown }> {
  return apiClient.get<{ funnel: unknown }>(`/funnel/${id}`);
}

export async function updateFunnel(id: string, body: Record<string, unknown>): Promise<{ funnel: unknown }> {
  return apiClient.put<{ funnel: unknown }>(`/funnel/${id}`, body);
}

export async function deleteFunnel(id: string): Promise<void> {
  await apiClient.delete(`/funnel/${id}`);
}

export async function getSections(funnelId: string): Promise<{ sections: unknown[] }> {
  return apiClient.get<{ sections: unknown[] }>(`/funnel/${funnelId}/sections`);
}

export async function createSection(funnelId: string, body: Record<string, unknown>): Promise<{ section: unknown }> {
  return apiClient.post<{ section: unknown }>(`/funnel/${funnelId}/sections`, body);
}

export async function updateSection(
  funnelId: string,
  sectionId: string,
  body: Record<string, unknown>
): Promise<{ section: unknown }> {
  return apiClient.put<{ section: unknown }>(`/funnel/${funnelId}/sections/${sectionId}`, body);
}

export async function deleteSection(funnelId: string, sectionId: string): Promise<void> {
  await apiClient.delete(`/funnel/${funnelId}/sections/${sectionId}`);
}

export async function resetSections(
  funnelId: string,
  pageLocation: 'optin' | 'thankyou' | 'content'
): Promise<{ sections: unknown[] }> {
  return apiClient.post<{ sections: unknown[] }>(`/funnel/${funnelId}/sections/reset`, { pageLocation });
}

export async function publishFunnel(id: string, publish: boolean): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>(`/funnel/${id}/publish`, { publish });
}

export async function getFunnelStats(): Promise<{ stats: unknown }> {
  return apiClient.get<{ stats: unknown }>('/funnel/stats');
}

export async function reapplyBrand(funnelId: string): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>(`/funnel/${funnelId}/reapply-brand`, {});
}

export async function generateFunnelContent(leadMagnetId: string, useAI?: boolean): Promise<{ content: unknown }> {
  return apiClient.post<{ content: unknown }>('/funnel/generate-content', { leadMagnetId, useAI });
}

export async function getAllFunnels(): Promise<{ funnels: unknown[] }> {
  return apiClient.get<{ funnels: unknown[] }>('/funnel/all');
}

export async function getQuestions(funnelId: string): Promise<{ questions: unknown[] }> {
  return apiClient.get<{ questions: unknown[] }>(`/funnel/${funnelId}/questions`);
}

export async function createQuestion(funnelId: string, body: Record<string, unknown>): Promise<{ question: unknown }> {
  return apiClient.post<{ question: unknown }>(`/funnel/${funnelId}/questions`, body);
}

export async function updateQuestion(
  funnelId: string,
  questionId: string,
  body: Record<string, unknown>
): Promise<{ question: unknown }> {
  return apiClient.put<{ question: unknown }>(`/funnel/${funnelId}/questions/${questionId}`, body);
}

export async function deleteQuestion(funnelId: string, questionId: string): Promise<void> {
  await apiClient.delete(`/funnel/${funnelId}/questions/${questionId}`);
}

export async function reorderQuestions(funnelId: string, questionIds: string[]): Promise<{ success: boolean }> {
  return apiClient.patch<{ success: boolean }>(`/funnel/${funnelId}/questions`, { questionIds });
}

export async function generateRestylePlan(
  funnelId: string,
  input: { prompt?: string; urls?: string[] },
): Promise<{ plan: RestylePlan }> {
  return apiClient.post<{ plan: RestylePlan }>(`/funnel/${funnelId}/restyle`, input);
}

export async function applyRestylePlan(
  funnelId: string,
  plan: RestylePlan,
): Promise<Record<string, unknown>> {
  return apiClient.post<Record<string, unknown>>(`/funnel/${funnelId}/apply-restyle`, { plan });
}
