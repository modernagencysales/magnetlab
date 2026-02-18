/**
 * Bright Data LinkedIn Scraping Client
 *
 * Scrapes LinkedIn posts via the Bright Data Web Scraper API.
 * Used by the scrape-linkedin-content Trigger.dev task for content pipeline.
 *
 * Pattern: POST /trigger -> poll /progress/{snapshotId} -> GET /snapshot/{snapshotId}?format=json
 *
 * Docs: https://docs.brightdata.com/scraping-automation/web-data-apis
 */

import { logError, logInfo, logWarn } from '@/lib/utils/logger';

const LOG_CTX = 'bright-data-linkedin';

const BASE_URL = 'https://api.brightdata.com/datasets/v3';

// Dataset IDs for different types of LinkedIn data
const DATASET_IDS = {
  /** Posts by individual from their profile URL */
  PROFILE_POSTS: 'gd_lyy3tktm25m4avu764',
  /** LinkedIn search results (for viral post discovery) */
  SEARCH_POSTS: 'gd_l7q7dkf244hwjntr0',
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
 * Trigger a scrape job. Returns the snapshot ID to poll.
 */
async function triggerScrape(
  datasetId: string,
  params: Record<string, unknown>[]
): Promise<string> {
  const url = `${BASE_URL}/trigger?dataset_id=${datasetId}&format=json&uncompressed_webhook=true`;

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
 * Fetch completed results for a snapshot.
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

  return (await response.json()) as LinkedInPost[];
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
 * Triggers an async Bright Data job, polls until ready, returns posts.
 *
 * @param profileUrl - LinkedIn profile URL (e.g. https://linkedin.com/in/username)
 * @param daysBack - How many days of posts to fetch (default 7)
 */
export async function scrapeCreatorPosts(
  profileUrl: string,
  daysBack: number = 7
): Promise<LinkedInPost[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const params = [
    {
      url: profileUrl,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    },
  ];

  try {
    const snapshotId = await triggerScrape(DATASET_IDS.PROFILE_POSTS, params);
    await pollUntilReady(snapshotId);
    const posts = await getResults(snapshotId);

    logInfo(LOG_CTX, 'Creator posts scraped', {
      profileUrl,
      daysBack,
      postCount: posts.length,
    });

    return posts;
  } catch (error) {
    logError(LOG_CTX, error, { profileUrl, daysBack });
    throw error;
  }
}

/**
 * Batch scrape multiple creators' posts in a single Bright Data job.
 *
 * @param profileUrls - Array of LinkedIn profile URLs
 * @param daysBack - How many days of posts to fetch (default 7)
 */
export async function scrapeCreatorPostsBatch(
  profileUrls: string[],
  daysBack: number = 7
): Promise<LinkedInPost[]> {
  if (profileUrls.length === 0) {
    logWarn(LOG_CTX, 'scrapeCreatorPostsBatch called with empty URL array');
    return [];
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const params = profileUrls.map((url) => ({
    url,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  }));

  try {
    const snapshotId = await triggerScrape(DATASET_IDS.PROFILE_POSTS, params);
    // Batch jobs get a longer timeout (5 minutes)
    await pollUntilReady(snapshotId, 300_000, 10_000);
    const posts = await getResults(snapshotId);

    logInfo(LOG_CTX, 'Batch posts scraped', {
      creatorCount: profileUrls.length,
      daysBack,
      postCount: posts.length,
    });

    return posts;
  } catch (error) {
    logError(LOG_CTX, error, {
      creatorCount: profileUrls.length,
      daysBack,
    });
    throw error;
  }
}

/**
 * Scrape LinkedIn search results (for viral post discovery).
 *
 * @param searchUrl - Full LinkedIn search URL
 */
export async function scrapeSearchPosts(
  searchUrl: string
): Promise<LinkedInPost[]> {
  const params = [
    {
      url: searchUrl,
    },
  ];

  try {
    const snapshotId = await triggerScrape(DATASET_IDS.SEARCH_POSTS, params);
    await pollUntilReady(snapshotId);
    const posts = await getResults(snapshotId);

    logInfo(LOG_CTX, 'Search posts scraped', {
      searchUrl,
      postCount: posts.length,
    });

    return posts;
  } catch (error) {
    logError(LOG_CTX, error, { searchUrl });
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
