/**
 * Analytics API (client). Routes: /api/analytics/overview, engagement, email, funnel/[id].
 */

import { apiClient } from './client';

export async function getOverview(range: string): Promise<unknown> {
  return apiClient.get(`/analytics/overview?range=${encodeURIComponent(range)}`);
}

export async function getEngagement(): Promise<unknown> {
  return apiClient.get('/analytics/engagement');
}

export async function getEmailAnalytics(range: string): Promise<unknown> {
  return apiClient.get(`/analytics/email?range=${encodeURIComponent(range)}`);
}

export async function getFunnelDetail(funnelId: string, range: string): Promise<unknown> {
  return apiClient.get(
    `/analytics/funnel/${funnelId}?range=${encodeURIComponent(range)}`
  );
}
