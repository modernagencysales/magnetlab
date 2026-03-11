/**
 * Creative Strategy Client API
 * Frontend data layer for creative strategy system.
 * Never imports from src/server/.
 */

import { apiClient } from './client';
import type {
  CsSignal,
  CsPlay,
  PlayWithStats,
  CsPlayTemplate,
  CsPlayFeedback,
  CsScrapeConfig,
  SignalFilters,
  PlayFilters,
} from '@/lib/types/creative-strategy';

// ─── Signals ────────────────────────────────────────────────────────────────

export async function listSignals(filters: SignalFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.source) params.set('source', filters.source);
  if (filters.niche) params.set('niche', filters.niche);
  if (filters.min_multiplier) params.set('min_multiplier', String(filters.min_multiplier));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  return apiClient.get<{ signals: CsSignal[]; total: number }>(
    `/creative-strategy/signals?${params}`
  );
}

export async function submitSignal(input: {
  content: string;
  author_name: string;
  linkedin_url: string;
  media_urls?: string[];
  niche?: string;
  notes?: string;
}) {
  return apiClient.post<{ signal: CsSignal }>('/creative-strategy/signals', input);
}

export async function reviewSignal(id: string, status: 'reviewed' | 'used' | 'dismissed') {
  return apiClient.patch<{ signal: CsSignal }>(`/creative-strategy/signals/${id}`, { status });
}

// ─── Plays ──────────────────────────────────────────────────────────────────

export async function listPlays(filters: PlayFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.visibility) params.set('visibility', filters.visibility);
  if (filters.exploit_type) params.set('exploit_type', filters.exploit_type);
  if (filters.niche) params.set('niche', filters.niche);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  return apiClient.get<{ plays: CsPlay[]; total: number }>(`/creative-strategy/plays?${params}`);
}

export async function getPlay(id: string) {
  return apiClient.get<PlayWithStats>(`/creative-strategy/plays/${id}`);
}

export async function createPlay(input: {
  title: string;
  thesis: string;
  exploit_type: string;
  format_instructions: string;
  signal_ids: string[];
  niches?: string[];
}) {
  return apiClient.post<{ play: CsPlay }>('/creative-strategy/plays', input);
}

export async function updatePlay(id: string, input: Record<string, unknown>) {
  return apiClient.patch<{ play: CsPlay }>(`/creative-strategy/plays/${id}`, input);
}

export async function deletePlay(id: string) {
  return apiClient.delete(`/creative-strategy/plays/${id}`);
}

// ─── Play results, feedback, assignments ────────────────────────────────────

export async function getPlayResults(playId: string) {
  return apiClient.get<{
    total_tests: number;
    avg_multiplier: number | null;
    std_deviation: number | null;
    niche_breakdown: Record<string, { count: number; avg: number }>;
  }>(`/creative-strategy/plays/${playId}/results`);
}

export async function submitFeedback(playId: string, rating: 'up' | 'down', note?: string) {
  return apiClient.post<{ feedback: CsPlayFeedback }>(
    `/creative-strategy/plays/${playId}/feedback`,
    { rating, note }
  );
}

export async function assignPlay(playId: string, userId: string) {
  return apiClient.post(`/creative-strategy/plays/${playId}/assign`, { user_id: userId });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(playId?: string) {
  const params = playId ? `?play_id=${playId}` : '';
  return apiClient.get<{ templates: CsPlayTemplate[] }>(`/creative-strategy/templates${params}`);
}

// ─── Config ─────────────────────────────────────────────────────────────────

export async function listScrapeConfigs() {
  return apiClient.get<{ configs: CsScrapeConfig[] }>('/creative-strategy/config');
}

export async function updateScrapeConfig(config: {
  config_type: string;
  outlier_threshold_multiplier: number;
  min_reactions: number;
  min_comments: number;
  target_niches?: string[];
  search_keywords?: string[];
  active: boolean;
}) {
  return apiClient.put<{ config: CsScrapeConfig }>('/creative-strategy/config', config);
}
