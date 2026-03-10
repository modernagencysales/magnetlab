/**
 * Signal Engine Service
 *
 * Core data layer for the LinkedIn signal monitoring engine.
 * Handles lead upsert, event recording, score computation,
 * and batch processing of post engagers.
 */

import { logError } from '@/lib/utils/logger';
import type {
  SignalType,
  SentimentScore,
  SignalCustomVariable,
  NumberScoringRule,
  BooleanScoringRule,
  TextScoringRule,
} from '@/lib/types/signals';
import {
  upsertSignalLeadRecord,
  upsertSignalEventRecord,
  findSignalEventsByLead,
  updateSignalLeadScores,
  getSignalLeadCustomData,
} from '@/server/repositories/signals.repo';

// ============================================
// PURE HELPERS
// ============================================

/**
 * Normalize a LinkedIn URL:
 * - Prepend https://www.linkedin.com if missing protocol
 * - Strip query params and fragment
 * - Remove trailing slash
 * - Lowercase the whole thing
 */
export function normalizeLinkedInUrl(url: string): string {
  let normalized = url.trim();

  // Prepend protocol + host if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    // Handle paths like "/in/someone" or "in/someone"
    if (normalized.startsWith('/')) {
      normalized = `https://www.linkedin.com${normalized}`;
    } else {
      normalized = `https://www.linkedin.com/${normalized}`;
    }
  }

  // Parse to strip query params and fragment
  try {
    const parsed = new URL(normalized);
    normalized = `${parsed.origin}${parsed.pathname}`;
  } catch {
    // If URL is malformed, just strip query params manually
    normalized = normalized.split('?')[0].split('#')[0];
  }

  // Remove trailing slash, lowercase
  normalized = normalized.replace(/\/+$/, '').toLowerCase();

  return normalized;
}

/**
 * Split a full name into first and last name.
 * Single part -> firstName only, lastName = ''
 * Multiple parts -> first word is firstName, rest joined as lastName
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

// ============================================
// SIGNAL TYPE WEIGHTS + SENTIMENT BONUSES
// ============================================

const SIGNAL_TYPE_WEIGHTS: Record<SignalType, number> = {
  job_change: 30,
  job_posting: 20,
  keyword_engagement: 15,
  content_velocity: 15,
  company_engagement: 10,
  profile_engagement: 10,
};

const SENTIMENT_BONUS: Record<SentimentScore, number> = {
  high_intent: 20,
  question: 15,
  medium_intent: 5,
  low_intent: 0,
};

const SENTIMENT_RANK: Record<SentimentScore, number> = {
  high_intent: 4,
  question: 3,
  medium_intent: 2,
  low_intent: 1,
};

// ============================================
// CUSTOM VARIABLE SCORING (pure)
// ============================================

export function computeCustomVariableScore(
  variables: SignalCustomVariable[],
  customData: Record<string, unknown> | null
): number {
  if (!customData || variables.length === 0) return 0;
  let total = 0;
  for (const variable of variables) {
    const value = customData[variable.name];
    if (value === undefined || value === null) continue;
    switch (variable.field_type) {
      case 'number': {
        const numValue = typeof value === 'number' ? value : Number(value);
        if (isNaN(numValue)) break;
        const rule = variable.scoring_rule as NumberScoringRule;
        if (!rule.ranges) break;
        for (const range of rule.ranges) {
          if (numValue >= range.min && (range.max === undefined || numValue < range.max)) {
            total += range.weight;
            break;
          }
        }
        break;
      }
      case 'boolean': {
        const boolValue = typeof value === 'boolean' ? value : value === 'true';
        const rule = variable.scoring_rule as BooleanScoringRule;
        total += boolValue ? (rule.when_true ?? 0) : (rule.when_false ?? 0);
        break;
      }
      case 'text': {
        const textValue = String(value).toLowerCase();
        const rule = variable.scoring_rule as TextScoringRule;
        if (!rule.contains) {
          total += rule.default ?? 0;
          break;
        }
        let matched = false;
        for (const [keyword, weight] of Object.entries(rule.contains)) {
          if (textValue.includes(keyword.toLowerCase())) {
            total += weight;
            matched = true;
            break;
          }
        }
        if (!matched) total += rule.default ?? 0;
        break;
      }
    }
  }
  return total;
}

// ============================================
// DB OPERATIONS
// ============================================

/**
 * Upsert a signal lead into the signal_leads table.
 * Uses onConflict on (user_id, linkedin_url) to avoid duplicates.
 */
export async function upsertSignalLead(lead: {
  user_id: string;
  linkedin_url: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  job_title?: string;
  company?: string;
  country?: string;
}): Promise<{ id: string | null; error: string | null }> {
  const normalizedUrl = normalizeLinkedInUrl(lead.linkedin_url);

  const result = await upsertSignalLeadRecord({
    ...lead,
    linkedin_url: normalizedUrl,
  });

  if (result.error) {
    logError('services/signal-engine', new Error('Failed to upsert signal lead'), {
      detail: result.error,
      linkedin_url: normalizedUrl,
    });
  }

  return result;
}

/**
 * Record a signal event in the signal_events table.
 */
export async function recordSignalEvent(event: {
  user_id: string;
  lead_id: string;
  signal_type: SignalType;
  source_url?: string;
  source_monitor_id?: string;
  comment_text?: string;
  sentiment?: SentimentScore;
  keyword_matched?: string;
  engagement_type?: 'comment' | 'reaction' | 'post_author';
  metadata?: Record<string, unknown>;
}): Promise<{ error: string | null }> {
  const result = await upsertSignalEventRecord(event);

  if (result.error) {
    logError('services/signal-engine', new Error('Failed to record signal event'), {
      detail: result.error,
      lead_id: event.lead_id,
      signal_type: event.signal_type,
    });
  }

  return result;
}

/**
 * Recompute signal_count, compound_score, and sentiment_score
 * for a given lead based on all their signal_events.
 */
export async function updateSignalCounts(
  userId: string,
  leadId: string,
  customVariables?: SignalCustomVariable[]
): Promise<void> {
  const { data: events, error } = await findSignalEventsByLead(userId, leadId);

  if (error) {
    logError('services/signal-engine', new Error('Failed to fetch signal events for scoring'), {
      detail: error,
      leadId,
    });
    return;
  }

  // Count distinct signal types from events
  const distinctTypes = new Set<string>();
  let compoundScore = 0;
  let bestSentiment: SentimentScore | null = null;
  let bestSentimentRank = 0;

  if (events && events.length > 0) {
    for (const event of events) {
      const signalType = event.signal_type as SignalType;

      if (!distinctTypes.has(signalType)) {
        distinctTypes.add(signalType);
        compoundScore += SIGNAL_TYPE_WEIGHTS[signalType] || 0;
      }

      const sentiment = event.sentiment as SentimentScore | null;
      if (sentiment && SENTIMENT_BONUS[sentiment]) {
        compoundScore += SENTIMENT_BONUS[sentiment];
      }

      if (sentiment && SENTIMENT_RANK[sentiment]) {
        const rank = SENTIMENT_RANK[sentiment];
        if (rank > bestSentimentRank) {
          bestSentimentRank = rank;
          bestSentiment = sentiment;
        }
      }
    }
  }

  // Add custom variable scores if provided
  if (customVariables && customVariables.length > 0) {
    const { data: customData } = await getSignalLeadCustomData(leadId, userId);
    if (customData) {
      compoundScore += computeCustomVariableScore(customVariables, customData);
    }
  }

  // Skip update if no events and no custom variable contribution
  if (distinctTypes.size === 0 && compoundScore === 0) {
    return;
  }

  compoundScore = Math.min(compoundScore, 100);

  const { error: updateError } = await updateSignalLeadScores(userId, leadId, {
    signal_count: distinctTypes.size,
    compound_score: compoundScore,
    sentiment_score: bestSentiment,
  });

  if (updateError) {
    logError('services/signal-engine', new Error('Failed to update signal counts'), {
      detail: updateError,
      leadId,
    });
  }
}

/**
 * Process a batch of engagers from a scraped post.
 * For each engager: split name, upsert lead, record event.
 * Skips entries without a linkedinUrl.
 */
export async function processEngagers(params: {
  userId: string;
  signalType: SignalType;
  sourceUrl: string;
  sourceMonitorId?: string;
  keywordMatched?: string;
  engagers: Array<{
    linkedinUrl: string;
    name: string;
    headline?: string;
    commentText?: string;
    engagementType: 'comment' | 'reaction';
  }>;
}): Promise<{ processed: number; errors: string[] }> {
  const { userId, signalType, sourceUrl, sourceMonitorId, keywordMatched, engagers } = params;

  let processed = 0;
  const errors: string[] = [];

  for (const engager of engagers) {
    // Skip if no LinkedIn URL
    if (!engager.linkedinUrl) {
      continue;
    }

    try {
      const { firstName, lastName } = splitName(engager.name || '');

      // Upsert the lead
      const { id: leadId, error: upsertError } = await upsertSignalLead({
        user_id: userId,
        linkedin_url: engager.linkedinUrl,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        headline: engager.headline,
      });

      if (upsertError || !leadId) {
        errors.push(`Upsert failed for ${engager.linkedinUrl}: ${upsertError}`);
        continue;
      }

      // Record the signal event
      const { error: eventError } = await recordSignalEvent({
        user_id: userId,
        lead_id: leadId,
        signal_type: signalType,
        source_url: sourceUrl,
        source_monitor_id: sourceMonitorId,
        comment_text: engager.commentText,
        keyword_matched: keywordMatched,
        engagement_type: engager.engagementType,
      });

      if (eventError) {
        errors.push(`Event failed for ${engager.linkedinUrl}: ${eventError}`);
        continue;
      }

      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Exception for ${engager.linkedinUrl}: ${msg}`);
    }
  }

  return { processed, errors };
}
