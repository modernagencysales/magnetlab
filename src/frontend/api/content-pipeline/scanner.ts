/**
 * Scanner API (client).
 * CRUD for scanner sources and manual scan trigger.
 * Never imports from Next.js HTTP layer.
 */

import { apiClient } from '../client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScannerSourceType =
  | 'creator'
  | 'search_term'
  | 'hashtag'
  | 'competitor'
  | 'reddit_subreddit'
  | 'reddit_search';

export interface ScannerSource {
  id: string;
  source_type: ScannerSourceType;
  source_value: string;
  priority: number;
  is_active: boolean;
  last_pulled_at: string | null;
  created_at: string;
}

export interface AddScannerSourceInput {
  source_type: ScannerSourceType;
  source_value: string;
  priority?: number;
}

interface SourcesResponse {
  sources: ScannerSource[];
}

interface RunScannerResponse {
  triggered: boolean;
  taskId: string;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getScannerSources(): Promise<ScannerSource[]> {
  const data = await apiClient.get<SourcesResponse>('/content-pipeline/scanner/sources');
  return data.sources ?? [];
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function addScannerSource(body: AddScannerSourceInput): Promise<ScannerSource> {
  const data = await apiClient.post<{ source: ScannerSource }>(
    '/content-pipeline/scanner/sources',
    body
  );
  return data.source;
}

export async function deleteScannerSource(id: string): Promise<void> {
  await apiClient.delete('/content-pipeline/scanner/sources', { body: { source_id: id } });
}

export async function runScanner(): Promise<RunScannerResponse> {
  return apiClient.post<RunScannerResponse>('/content-pipeline/scanner/run');
}
