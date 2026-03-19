/**
 * Trends API (client).
 * Read-only access to trending topics detected by scanner.
 * Never imports from Next.js HTTP layer.
 */

import { apiClient } from '../client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrendingTopic {
  topic: string;
  count: number;
  confidence: number;
  trend: 'rising' | 'stable' | 'declining';
}

interface TrendsResponse {
  topics: TrendingTopic[];
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getTrends(limit = 12): Promise<TrendingTopic[]> {
  const data = await apiClient.get<TrendsResponse>(`/content-pipeline/trends?limit=${limit}`);
  return data.topics ?? [];
}
