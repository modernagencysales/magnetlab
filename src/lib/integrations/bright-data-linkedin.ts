/**
 * Bright Data LinkedIn Scraping Client
 *
 * Scrapes LinkedIn posts via the Bright Data Web Scraper API.
 * Used by the scrape-linkedin-content Trigger.dev task for content pipeline.
 *
 * Pattern: POST /trigger -> poll /progress/{snapshotId} -> GET /snapshot/{snapshotId}?format=json
 *
 * The Profile Posts dataset uses "discover_new" mode with "discover_by=profile_url"
 * to find posts from a given creator's profile. The response uses Bright Data's
 * raw field names which we map to our LinkedInPost interface.
 *
 * Docs: https://docs.brightdata.com/scraping-automation/web-data-apis
 */

import { logError, logInfo, logWarn } from '@/lib/utils/logger';

const LOG_CTX = 'bright-data-linkedin';

const BASE_URL = 'https://api.brightdata.com/datasets/v3';

// Dataset IDs for different types of LinkedIn data
const DATASET_IDS = {
  /** Posts discovered from a profile URL (discover_new mode) */
  PROFILE_POSTS: 'gd_lyy3tktm25m4avu764',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LinkedInPost {
  url: string;
  author: {
    name: string;
    headline: string;
    profile_url: string;
    followers?: number;
  };
  content: string;
  posted_date: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
}

/** Raw response from Bright Data profile posts discover endpoint */
interface BrightDataPost {
  url: string;
  user_id: string;
  use_url: string;
  title?: string;
  headline?: string;
  post_text: string;
  date_posted: string;
  num_likes: number;
  num_comments: number;
  user_followers?: number;
  user_title?: string;
  post_type?: string;
  discovery_input?: { url: string };
}

interface TriggerResponse {
  snapshot_id: string;
}

interface ProgressResponse {
  status: 'running' | 'ready' | 'failed';
  progress?: number;
}

interface FilterWinnersOptions {
  /** Minimum likes floor (default 100) */
  minLikes?: number;
  /** Top percentile to keep, 0-100 (default 30) */
  topPercentile?: number;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.BRIGHT_DATA_API_KEY;
  if (!key) {
    throw new Error('BRIGHT_DATA_API_KEY is not set');
  }
  return key;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Map Bright Data raw post to our LinkedInPost interface.
 */
function mapBrightDataPost(raw: BrightDataPost): LinkedInPost {
  return {
    url: raw.url,
    author: {
      name: raw.user_id || 'Unknown',
      headline: raw.user_title || raw.headline || '',
      profile_url: raw.use_url || raw.discovery_input?.url || '',
      followers: raw.user_followers ?? undefined,
    },
    content: raw.post_text || '',
    posted_date: raw.date_posted || '',
    engagement: {
      likes: raw.num_likes || 0,
      comments: raw.num_comments || 0,
      shares: 0, // Bright Data doesn't return shares for this dataset
    },
  };
}

/**
 * Trigger a scrape job. Returns the snapshot ID to poll.
 */
async function triggerScrape(
  datasetId: string,
  params: Record<string, unknown>[],
  extraQuery?: Record<string, string>
): Promise<string> {
  const qp = new URLSearchParams({
    dataset_id: datasetId,
    format: 'json',
    uncompressed_webhook: 'true',
    ...extraQuery,
  });
  const url = `${BASE_URL}/trigger?${qp.toString()}`;

  logInfo(LOG_CTX, 'Triggering scrape', { datasetId, inputCount: params.length });

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bright Data trigger failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as TriggerResponse;
  if (!data.snapshot_id) {
    throw new Error('Bright Data trigger response missing snapshot_id');
  }

  logInfo(LOG_CTX, 'Scrape triggered', { snapshotId: data.snapshot_id });
  return data.snapshot_id;
}

/**
 * Check progress of a scrape job.
 */
async function getProgress(snapshotId: string): Promise<ProgressResponse> {
  const url = `${BASE_URL}/progress/${snapshotId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bright Data progress check failed (HTTP ${response.status}): ${errorText}`);
  }

  return (await response.json()) as ProgressResponse;
}

/**
 * Fetch completed results for a snapshot and map to LinkedInPost.
 */
async function getResults(snapshotId: string): Promise<LinkedInPost[]> {
  const url = `${BASE_URL}/snapshot/${snapshotId}?format=json`;

  const response = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bright Data results fetch failed (HTTP ${response.status}): ${errorText}`);
  }

  const raw = (await response.json()) as BrightDataPost[];
  logInfo(LOG_CTX, 'Raw results fetched', { count: raw.length, snapshotId });
  return raw.map(mapBrightDataPost);
}

/**
 * Poll a snapshot until it reaches 'ready' or 'failed' status.
 * @param snapshotId - The snapshot to poll
 * @param maxWaitMs - Maximum wait time (default 180000ms = 3 minutes)
 * @param pollIntervalMs - Polling interval (default 5000ms = 5 seconds)
 */
async function pollUntilReady(
  snapshotId: string,
  maxWaitMs: number = 180_000,
  pollIntervalMs: number = 5_000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const progress = await getProgress(snapshotId);

    if (progress.status === 'ready') {
      logInfo(LOG_CTX, 'Snapshot ready', {
        snapshotId,
        elapsedMs: Date.now() - startTime,
      });
      return;
    }

    if (progress.status === 'failed') {
      throw new Error(`Bright Data scrape job failed (snapshot: ${snapshotId})`);
    }

    logInfo(LOG_CTX, 'Polling...', {
      snapshotId,
      status: progress.status,
      progress: progress.progress,
      elapsedMs: Date.now() - startTime,
    });

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Bright Data scrape timed out after ${maxWaitMs}ms (snapshot: ${snapshotId})`
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if Bright Data is configured (API key present).
 */
export function isBrightDataConfigured(): boolean {
  return !!process.env.BRIGHT_DATA_API_KEY;
}

/**
 * Scrape one creator's recent posts from their LinkedIn profile.
 *
 * Uses Bright Data's "discover_new" mode to find posts from a profile URL.
 * Note: date filtering is not supported in discover mode — returns ~10 most recent posts.
 *
 * @param profileUrl - LinkedIn profile URL (e.g. https://linkedin.com/in/username)
 */
export async function scrapeCreatorPosts(
  profileUrl: string
): Promise<LinkedInPost[]> {
  const params = [{ url: profileUrl }];

  try {
    const snapshotId = await triggerScrape(DATASET_IDS.PROFILE_POSTS, params, {
      type: 'discover_new',
      discover_by: 'profile_url',
    });
    await pollUntilReady(snapshotId);
    const posts = await getResults(snapshotId);

    logInfo(LOG_CTX, 'Creator posts scraped', {
      profileUrl,
      postCount: posts.length,
    });

    return posts;
  } catch (error) {
    logError(LOG_CTX, error, { profileUrl });
    throw error;
  }
}

/**
 * Batch scrape multiple creators' posts in a single Bright Data job.
 *
 * Uses Bright Data's "discover_new" mode. Returns ~10 posts per profile.
 * With 479 profiles, expect the job to take several minutes.
 *
 * @param profileUrls - Array of LinkedIn profile URLs
 */
export async function scrapeCreatorPostsBatch(
  profileUrls: string[]
): Promise<LinkedInPost[]> {
  if (profileUrls.length === 0) {
    logWarn(LOG_CTX, 'scrapeCreatorPostsBatch called with empty URL array');
    return [];
  }

  const params = profileUrls.map((url) => ({ url }));

  try {
    const snapshotId = await triggerScrape(DATASET_IDS.PROFILE_POSTS, params, {
      type: 'discover_new',
      discover_by: 'profile_url',
    });
    // Batch jobs with many profiles get a longer timeout (10 minutes)
    await pollUntilReady(snapshotId, 600_000, 15_000);
    const posts = await getResults(snapshotId);

    logInfo(LOG_CTX, 'Batch posts scraped', {
      creatorCount: profileUrls.length,
      postCount: posts.length,
    });

    return posts;
  } catch (error) {
    logError(LOG_CTX, error, {
      creatorCount: profileUrls.length,
    });
    throw error;
  }
}

/**
 * Compute a weighted engagement score for a post.
 *
 * Formula: likes + comments*3 + shares*2
 */
export function computeEngagementScore(post: LinkedInPost): number {
  const { likes, comments, shares } = post.engagement;
  return likes + comments * 3 + shares * 2;
}

/**
 * Filter posts to find "winners" — high-performing content.
 *
 * Applies two filters:
 * 1. Absolute floor: post must have >= minLikes (default 100)
 * 2. Top percentile: only keep top N% by engagement score (default 30%)
 *
 * Both conditions must be met.
 *
 * @param posts - Array of posts to filter
 * @param opts - Filter options (minLikes, topPercentile)
 */
export function filterWinners(
  posts: LinkedInPost[],
  opts?: FilterWinnersOptions
): LinkedInPost[] {
  const minLikes = opts?.minLikes ?? 100;
  const topPercentile = opts?.topPercentile ?? 30;

  if (posts.length === 0) return [];

  // Step 1: Apply absolute floor
  const aboveFloor = posts.filter((p) => p.engagement.likes >= minLikes);
  if (aboveFloor.length === 0) return [];

  // Step 2: Sort by engagement score (descending)
  const scored = aboveFloor
    .map((post) => ({ post, score: computeEngagementScore(post) }))
    .sort((a, b) => b.score - a.score);

  // Step 3: Keep top N%
  const cutoffIndex = Math.max(1, Math.ceil(scored.length * (topPercentile / 100)));
  const winners = scored.slice(0, cutoffIndex).map((s) => s.post);

  logInfo(LOG_CTX, 'Filtered winners', {
    totalPosts: posts.length,
    aboveFloor: aboveFloor.length,
    winners: winners.length,
    minLikes,
    topPercentile,
  });

  return winners;
}
