/**
 * Signal Engine Service
 *
 * Core data layer for the LinkedIn signal monitoring engine.
 * Handles lead upsert, event recording, score computation,
 * and batch processing of post engagers.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { SignalType, SentimentScore } from '@/lib/types/signals';

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
  const supabase = createSupabaseAdminClient();

  const normalizedUrl = normalizeLinkedInUrl(lead.linkedin_url);

  const { data, error } = await supabase
    .from('signal_leads')
    .upsert(
      {
        user_id: lead.user_id,
        linkedin_url: normalizedUrl,
        first_name: lead.first_name || null,
        last_name: lead.last_name || null,
        headline: lead.headline || null,
        job_title: lead.job_title || null,
        company: lead.company || null,
        country: lead.country || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,linkedin_url' }
    )
    .select('id')
    .single();

  if (error) {
    logError('services/signal-engine', new Error('Failed to upsert signal lead'), {
      detail: error.message,
      linkedin_url: normalizedUrl,
    });
    return { id: null, error: error.message };
  }

  return { id: data?.id ?? null, error: null };
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
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('signal_events')
    .upsert(
      {
        user_id: event.user_id,
        lead_id: event.lead_id,
        signal_type: event.signal_type,
        source_url: event.source_url || null,
        source_monitor_id: event.source_monitor_id || null,
        comment_text: event.comment_text || null,
        sentiment: event.sentiment || null,
        keyword_matched: event.keyword_matched || null,
        engagement_type: event.engagement_type || null,
        metadata: event.metadata || {},
        detected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lead_id,signal_type,source_url', ignoreDuplicates: true }
    );

  if (error) {
    logError('services/signal-engine', new Error('Failed to record signal event'), {
      detail: error.message,
      lead_id: event.lead_id,
      signal_type: event.signal_type,
    });
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Recompute signal_count, compound_score, and sentiment_score
 * for a given lead based on all their signal_events.
 */
export async function updateSignalCounts(
  userId: string,
  leadId: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Fetch all signal events for this lead
  const { data: events, error } = await supabase
    .from('signal_events')
    .select('signal_type, sentiment')
    .eq('user_id', userId)
    .eq('lead_id', leadId);

  if (error) {
    logError('services/signal-engine', new Error('Failed to fetch signal events for scoring'), {
      detail: error.message,
      leadId,
    });
    return;
  }

  if (!events || events.length === 0) {
    return;
  }

  // Count distinct signal types
  const distinctTypes = new Set<string>();
  let compoundScore = 0;
  let bestSentiment: SentimentScore | null = null;
  let bestSentimentRank = 0;

  for (const event of events) {
    const signalType = event.signal_type as SignalType;

    // Only count weight for each signal type once
    if (!distinctTypes.has(signalType)) {
      distinctTypes.add(signalType);
      compoundScore += SIGNAL_TYPE_WEIGHTS[signalType] || 0;
    }

    // Sentiment bonus (add for each event that has sentiment)
    const sentiment = event.sentiment as SentimentScore | null;
    if (sentiment && SENTIMENT_BONUS[sentiment]) {
      compoundScore += SENTIMENT_BONUS[sentiment];
    }

    // Track best sentiment
    if (sentiment && SENTIMENT_RANK[sentiment]) {
      const rank = SENTIMENT_RANK[sentiment];
      if (rank > bestSentimentRank) {
        bestSentimentRank = rank;
        bestSentiment = sentiment;
      }
    }
  }

  // Cap at 100
  compoundScore = Math.min(compoundScore, 100);

  // Update the lead
  const { error: updateError } = await supabase
    .from('signal_leads')
    .update({
      signal_count: distinctTypes.size,
      compound_score: compoundScore,
      sentiment_score: bestSentiment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('user_id', userId);

  if (updateError) {
    logError('services/signal-engine', new Error('Failed to update signal counts'), {
      detail: updateError.message,
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
