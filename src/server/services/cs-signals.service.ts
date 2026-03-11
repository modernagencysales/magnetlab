/**
 * Creative Strategy Signals Service
 * Business logic for signal ingestion, review, and scrape config.
 * Shared resource — no DataScope. Auth gated by isSuperAdmin() in route layer.
 * Never imports from Next.js HTTP layer.
 */

import { logError } from '@/lib/utils/logger';
import * as signalsRepo from '@/server/repositories/cs-signals.repo';

import type {
  CsSignal,
  CsScrapeConfig,
  SignalFilters,
  SignalStatus,
} from '@/lib/types/creative-strategy';
import type { SubmitSignalInput, ScrapeConfigInput } from '@/lib/validations/creative-strategy';

// ─── Validation constants ───────────────────────────────────────────────────

const VALID_REVIEW_STATUSES: SignalStatus[] = ['reviewed', 'used', 'dismissed'];

// ─── Signal reads ───────────────────────────────────────────────────────────

export async function listSignals(filters: SignalFilters) {
  const { data, count } = await signalsRepo.findSignals(filters);
  return {
    signals: data,
    total: count,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
}

export async function getSignalById(id: string) {
  return signalsRepo.findSignalById(id);
}

// ─── Signal writes ──────────────────────────────────────────────────────────

export async function submitSignal(
  input: SubmitSignalInput,
  submittedBy: string
): Promise<CsSignal> {
  // Check for duplicate URL
  const existing = await signalsRepo.findSignalByUrl(input.linkedin_url);
  if (existing) {
    throw Object.assign(new Error('Signal with this URL already exists'), { statusCode: 409 });
  }

  const signal = await signalsRepo.createSignal({
    source: 'manual',
    source_account_id: null,
    linkedin_url: input.linkedin_url,
    author_name: input.author_name,
    author_headline: null,
    author_follower_count: null,
    content: input.content,
    media_type: 'none',
    media_description: null,
    media_urls: input.media_urls ?? [],
    impressions: null,
    likes: 0,
    comments: 0,
    shares: null,
    engagement_multiplier: null,
    niche: input.niche ?? null,
    status: 'pending',
    submitted_by: submittedBy,
  });

  // Fire analyze-signal task (non-blocking)
  try {
    const { tasks } = await import('@trigger.dev/sdk/v3');
    await tasks.trigger('analyze-signal', { signalId: signal.id });
  } catch (error) {
    // Analysis trigger must never block signal creation
    logError('cs-signals.submitSignal', error, { signalId: signal.id, step: 'trigger_analysis' });
  }

  return signal;
}

export async function reviewSignal(id: string, status: SignalStatus): Promise<CsSignal> {
  if (!VALID_REVIEW_STATUSES.includes(status)) {
    throw Object.assign(new Error('Invalid review status'), { statusCode: 400 });
  }

  const existing = await signalsRepo.findSignalById(id);
  if (!existing) {
    throw Object.assign(new Error('Signal not found'), { statusCode: 404 });
  }

  return signalsRepo.updateSignalStatus(id, status);
}

// ─── Config operations ──────────────────────────────────────────────────────

export async function listScrapeConfigs(): Promise<CsScrapeConfig[]> {
  return signalsRepo.findScrapeConfigs();
}

export async function updateScrapeConfig(input: ScrapeConfigInput): Promise<CsScrapeConfig> {
  return signalsRepo.upsertScrapeConfig({
    config_type: input.config_type,
    outlier_threshold_multiplier: input.outlier_threshold_multiplier,
    min_reactions: input.min_reactions,
    min_comments: input.min_comments,
    target_niches: input.target_niches ?? [],
    search_keywords: input.search_keywords ?? [],
    active: input.active,
  });
}

// ─── Error helper ───────────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
