/**
 * ICP Filter Service for LinkedIn Intent Signals
 *
 * Pure utility module (no DB, no API calls) for filtering and scoring
 * LinkedIn profiles against Ideal Customer Profile (ICP) criteria.
 * Used by the enrichment pipeline to filter leads before pushing to HeyReach.
 */

import type { SignalConfig, HarvestProfile } from '@/lib/types/signals';

// ============================================
// TYPES
// ============================================

export type IcpFilters = Pick<
  SignalConfig,
  | 'target_countries'
  | 'target_job_titles'
  | 'exclude_job_titles'
  | 'min_company_size'
  | 'max_company_size'
  | 'target_industries'
>;

// ============================================
// matchesIcp
// ============================================

/**
 * Determines whether a LinkedIn profile matches the ICP filter criteria.
 *
 * Logic (all must pass):
 * 1. Country filter: if target_countries is non-empty AND country exists on
 *    profile, reject if country not in the list. Empty list = no restriction.
 * 2. Exclude filter: if any exclude_job_titles keyword found in headline
 *    (case-insensitive), reject.
 * 3. Target filter: if target_job_titles is non-empty, reject if NO target
 *    title keyword found in headline. Empty list = no restriction.
 */
export function matchesIcp(
  profile: HarvestProfile,
  config: IcpFilters
): boolean {
  const headline = (profile.headline ?? '').toLowerCase();
  const country = profile.location?.parsed?.countryCode?.toUpperCase() ?? null;

  // 1. Country filter
  if (config.target_countries.length > 0 && country) {
    const upperCountries = config.target_countries.map((c) => c.toUpperCase());
    if (!upperCountries.includes(country)) {
      return false;
    }
  }

  // 2. Exclude filter
  if (config.exclude_job_titles.length > 0) {
    const excluded = config.exclude_job_titles.some((keyword) =>
      headline.includes(keyword.toLowerCase())
    );
    if (excluded) {
      return false;
    }
  }

  // 3. Target filter
  if (config.target_job_titles.length > 0) {
    const matched = config.target_job_titles.some((keyword) =>
      headline.includes(keyword.toLowerCase())
    );
    if (!matched) {
      return false;
    }
  }

  return true;
}

// ============================================
// computeIcpScore
// ============================================

/**
 * Computes a 0-100 ICP score for a LinkedIn profile.
 *
 * Scoring breakdown:
 * - Country match: +20 (or +20 if no country filter configured)
 * - Job title match: +30 (or +15 if no filter configured)
 * - Has current position (experience with no endDate): +10
 * - Recent role change (first experience startDate within 90 days): +20
 * - High connection count (>500): +5
 * - High follower count (>1000): +5
 * - openToWork: -10 (negative signal for decision-makers)
 * - hiring: +10 (company is growing)
 *
 * Result clamped to [0, 100].
 */
export function computeIcpScore(
  profile: HarvestProfile,
  config: IcpFilters
): number {
  let score = 0;
  const headline = (profile.headline ?? '').toLowerCase();
  const country = profile.location?.parsed?.countryCode?.toUpperCase() ?? null;

  // Country match: +20
  if (config.target_countries.length === 0) {
    score += 20;
  } else if (country) {
    const upperCountries = config.target_countries.map((c) => c.toUpperCase());
    if (upperCountries.includes(country)) {
      score += 20;
    }
  }

  // Job title match: +30 (or +15 if no filter)
  if (config.target_job_titles.length === 0) {
    score += 15;
  } else {
    const matched = config.target_job_titles.some((keyword) =>
      headline.includes(keyword.toLowerCase())
    );
    if (matched) {
      score += 30;
    }
  }

  // Has current position (experience with no endDate): +10
  if (profile.experience && profile.experience.length > 0) {
    const hasCurrentPosition = profile.experience.some((exp) => !exp.endDate);
    if (hasCurrentPosition) {
      score += 10;
    }
  }

  // Recent role change (first experience startDate within 90 days): +20
  if (profile.experience && profile.experience.length > 0) {
    const firstExp = profile.experience[0];
    if (firstExp.startDate) {
      const startDate = new Date(firstExp.startDate);
      const now = new Date();
      const diffMs = now.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 90) {
        score += 20;
      }
    }
  }

  // High connection count (>500): +5
  if (profile.connectionsCount && profile.connectionsCount > 500) {
    score += 5;
  }

  // High follower count (>1000): +5
  if (profile.followerCount && profile.followerCount > 1000) {
    score += 5;
  }

  // openToWork: -10
  if (profile.openToWork) {
    score -= 10;
  }

  // hiring: +10
  if (profile.hiring) {
    score += 10;
  }

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, score));
}

// ============================================
// extractJobTitle
// ============================================

/**
 * Extracts the job title portion from a LinkedIn headline.
 *
 * Parses common patterns:
 * - "Title at Company"
 * - "Title | Company"
 * - "Title, Company"
 *
 * Returns the title part trimmed, or the entire headline if no separator
 * is found. Returns null for empty/whitespace-only headlines.
 */
export function extractJobTitle(headline: string): string | null {
  const trimmed = headline.trim();
  if (!trimmed) return null;

  // Try " at " separator (case-insensitive)
  const atIndex = trimmed.search(/\s+at\s+/i);
  if (atIndex !== -1) {
    return trimmed.substring(0, atIndex).trim() || null;
  }

  // Try " @ " separator
  const atSignIndex = trimmed.search(/\s+@\s+/);
  if (atSignIndex !== -1) {
    return trimmed.substring(0, atSignIndex).trim() || null;
  }

  // Try " | " separator
  const pipeIndex = trimmed.indexOf(' | ');
  if (pipeIndex !== -1) {
    return trimmed.substring(0, pipeIndex).trim() || null;
  }

  // Try ", " separator
  const commaIndex = trimmed.indexOf(', ');
  if (commaIndex !== -1) {
    return trimmed.substring(0, commaIndex).trim() || null;
  }

  // No separator found — return whole headline
  return trimmed;
}

// ============================================
// extractCompany
// ============================================

/**
 * Extracts the company name from a LinkedIn headline.
 *
 * Parses patterns:
 * - "... at Company"
 * - "... @ Company"
 *
 * Returns the company part trimmed, or null if no "at"/"@" separator found.
 */
export function extractCompany(headline: string): string | null {
  const trimmed = headline.trim();
  if (!trimmed) return null;

  // Try " at " separator (case-insensitive)
  const atMatch = trimmed.match(/\s+at\s+(.+)$/i);
  if (atMatch) {
    return atMatch[1].trim() || null;
  }

  // Try " @ " separator
  const atSignMatch = trimmed.match(/\s+@\s+(.+)$/);
  if (atSignMatch) {
    return atSignMatch[1].trim() || null;
  }

  return null;
}
