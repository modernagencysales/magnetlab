/**
 * Content pipeline business context API (client).
 */

import { apiClient } from '../client';

export async function getBusinessContext(): Promise<{ context: unknown }> {
  return apiClient.get<{ context: unknown }>('/content-pipeline/business-context');
}

export interface UpsertBusinessContextBody {
  company_name?: string | null;
  industry?: string | null;
  company_description?: string | null;
  icp_title?: string | null;
  icp_industry?: string | null;
  icp_pain_points?: string[];
  target_audience?: string | null;
  content_preferences?: Record<string, unknown>;
}

export async function upsertBusinessContext(body: UpsertBusinessContextBody): Promise<{ context: unknown }> {
  return apiClient.put<{ context: unknown }>('/content-pipeline/business-context', body);
}
