/**
 * Content pipeline planner API (client).
 */

import { apiClient } from '../client';

export async function listPlans(params?: { week?: string }): Promise<{ plans: unknown[] }> {
  const query = params?.week ? `?week=${encodeURIComponent(params.week)}` : '';
  return apiClient.get<{ plans: unknown[] }>(`/content-pipeline/planner${query}`);
}

export interface GeneratePlanBody {
  week_start_date: string;
  posts_per_week?: number;
  pillar_distribution?: Record<string, number>;
}

export async function generatePlan(body: GeneratePlanBody): Promise<{ plan: unknown; notes?: string }> {
  return apiClient.post<{ plan: unknown; notes?: string }>('/content-pipeline/planner/generate', body);
}

export async function approvePlan(planId: string): Promise<{ success: boolean; posts_created?: number }> {
  return apiClient.post<{ success: boolean; posts_created?: number }>('/content-pipeline/planner/approve', { plan_id: planId });
}
