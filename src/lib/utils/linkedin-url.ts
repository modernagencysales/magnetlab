/** LinkedIn URL normalization utilities. Never imports server-side deps. */

// ─── Post URL Normalization ──────────────────────────────────────────────

const ACTIVITY_URN_REGEX = /urn:li:activity:(\d+)/;
const UGC_POST_URN_REGEX = /^urn:li:ugcPost:(\d+)$/;
const POSTS_URL_REGEX = /linkedin\.com\/posts\/[^/]+-activity-(\d+)/;
const POSTS_URL_NUMERIC_REGEX = /linkedin\.com\/posts\/[^/]+-(\d{16,})/;
const FEED_URL_REGEX = /linkedin\.com\/feed\/update\/urn:li:activity:(\d+)/;

/**
 * Normalize any LinkedIn post URL to canonical URN format.
 * Handles activity URNs, ugcPost URNs, feed URLs, and /posts/ URLs.
 * Returns null if the URL doesn't match any known LinkedIn post pattern.
 */
export function normalizePostUrl(url: string): string | null {
  if (!url) return null;

  // Already a URN — activity or ugcPost passthrough
  const urnMatch = url.match(/^urn:li:activity:(\d+)$/);
  if (urnMatch) return url;

  const ugcMatch = url.match(UGC_POST_URN_REGEX);
  if (ugcMatch) return url;

  // Feed URL: /feed/update/urn:li:activity:123
  const feedMatch = url.match(FEED_URL_REGEX);
  if (feedMatch) return `urn:li:activity:${feedMatch[1]}`;

  // Posts URL with explicit -activity- prefix: /posts/username-activity-123-slug
  const postsMatch = url.match(POSTS_URL_REGEX);
  if (postsMatch) return `urn:li:activity:${postsMatch[1]}`;

  // Posts URL with numeric ID (no -activity- prefix): /posts/username-text-7332661864792854528-xxxx
  const postsNumericMatch = url.match(POSTS_URL_NUMERIC_REGEX);
  if (postsNumericMatch) return `urn:li:activity:${postsNumericMatch[1]}`;

  // Generic: contains activity URN anywhere
  const genericMatch = url.match(ACTIVITY_URN_REGEX);
  if (genericMatch) return `urn:li:activity:${genericMatch[1]}`;

  return null;
}

// ─── Profile Username Extraction ─────────────────────────────────────────

const PROFILE_URL_REGEX = /linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/;

/**
 * Extract LinkedIn username from a profile URL.
 * Returns null if the URL doesn't match the /in/username pattern.
 */
export function extractLinkedInUsername(url: string): string | null {
  if (!url) return null;
  const match = url.match(PROFILE_URL_REGEX);
  return match ? match[1] : null;
}
