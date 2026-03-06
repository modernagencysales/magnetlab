/**
 * Email flows API (client). Routes: /api/email/flows, /api/email/flows/[id], steps, generate
 */

import { apiClient } from '../client';

export async function listFlows(): Promise<{ flows: unknown[] }> {
  return apiClient.get<{ flows: unknown[] }>('/email/flows');
}

export async function createFlow(
  body: Record<string, unknown>
): Promise<{ flow: unknown }> {
  return apiClient.post<{ flow: unknown }>('/email/flows', body);
}

export async function getFlow(id: string): Promise<{ flow: unknown }> {
  return apiClient.get<{ flow: unknown }>(`/email/flows/${id}`);
}

export async function updateFlow(
  id: string,
  body: Record<string, unknown>
): Promise<{ flow: unknown }> {
  return apiClient.put<{ flow: unknown }>(`/email/flows/${id}`, body);
}

export async function deleteFlow(id: string): Promise<void> {
  await apiClient.delete(`/email/flows/${id}`);
}

export async function generateFlowSteps(
  flowId: string,
  options?: { stepCount?: number }
): Promise<{ steps: unknown[]; generated: boolean; stepCount: number }> {
  return apiClient.post<{
    steps: unknown[];
    generated: boolean;
    stepCount: number;
  }>(`/email/flows/${flowId}/generate`, options ?? {});
}

export async function addFlowStep(
  flowId: string,
  body: Record<string, unknown>
): Promise<{ step: unknown }> {
  return apiClient.post<{ step: unknown }>(
    `/email/flows/${flowId}/steps`,
    body
  );
}

export async function updateFlowStep(
  flowId: string,
  stepId: string,
  body: Record<string, unknown>
): Promise<{ step: unknown }> {
  return apiClient.put<{ step: unknown }>(
    `/email/flows/${flowId}/steps/${stepId}`,
    body
  );
}

export async function deleteFlowStep(
  flowId: string,
  stepId: string
): Promise<void> {
  await apiClient.delete(`/email/flows/${flowId}/steps/${stepId}`);
}
