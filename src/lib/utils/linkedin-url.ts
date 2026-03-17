/** LinkedIn URL normalization utilities. Never imports server-side deps. */

// ─── Post URL Normalization ──────────────────────────────────────────────

const ACTIVITY_URN_REGEX = /urn:li:activity:(\d+)/;
const POSTS_URL_REGEX = /linkedin\.com\/posts\/[^/]+-activity-(\d+)/;
const FEED_URL_REGEX = /linkedin\.com\/feed\/update\/urn:li:activity:(\d+)/;

/**
 * Normalize any LinkedIn post URL to canonical activity URN format.
 * Returns null if the URL doesn't match any known LinkedIn post pattern.
 */
export function normalizePostUrl(url: string): string | null {
  if (!url) return null;

  // Already a URN
  const urnMatch = url.match(/^urn:li:activity:(\d+)$/);
  if (urnMatch) return url;

  // Feed URL: /feed/update/urn:li:activity:123
  const feedMatch = url.match(FEED_URL_REGEX);
  if (feedMatch) return `urn:li:activity:${feedMatch[1]}`;

  // Posts URL: /posts/username-activity-123-slug
  const postsMatch = url.match(POSTS_URL_REGEX);
  if (postsMatch) return `urn:li:activity:${postsMatch[1]}`;

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
