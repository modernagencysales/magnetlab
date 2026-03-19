/**
 * Reddit Fetcher.
 * Fetches posts from Reddit subreddits via the public JSON API.
 * No authentication required.
 * Never imports from Next.js HTTP layer.
 */

import { logError } from '@/lib/utils/logger';
import type { ScannedContent } from '@/lib/types/exploits';

// ─── Constants ──────────────────────────────────────────────────────────────

const REDDIT_BASE_URL = 'https://www.reddit.com';
const REDDIT_USER_AGENT = 'magnetlab-scanner/1.0';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    author: string;
    permalink: string;
    url: string;
    created_utc: number;
    subreddit: string;
    is_self: boolean;
    over_18: boolean;
  };
}

interface RedditListingResponse {
  data: {
    children: RedditPost[];
    after: string | null;
  };
}

export interface FetchSubredditOptions {
  sort?: 'hot' | 'top' | 'new' | 'rising';
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
  minScore?: number;
}

export interface SearchRedditOptions {
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
  minScore?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Maps a single RedditPost to the shared ScannedContent shape.
 */
function mapToScannedContent(post: RedditPost): ScannedContent {
  const { data } = post;
  return {
    source_platform: 'reddit',
    source_url: `${REDDIT_BASE_URL}${data.permalink}`,
    source_author: data.author,
    content_text: data.selftext ? `${data.title}\n\n${data.selftext}` : data.title,
    engagement: {
      likes: data.score,
      comments: data.num_comments,
      shares: 0,
    },
    posted_at: new Date(data.created_utc * 1000),
  };
}

/**
 * Applies NSFW and minScore filters to a list of raw Reddit posts.
 */
function filterPosts(posts: RedditPost[], minScore: number): RedditPost[] {
  return posts.filter((p) => !p.data.over_18 && p.data.score >= minScore);
}

/**
 * Shared fetch helper — builds the URL, sets headers, returns parsed listing or null.
 */
async function redditFetch(url: string): Promise<RedditListingResponse | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      logError('reddit-fetcher', new Error(`Reddit HTTP ${response.status}`), { url });
      return null;
    }

    return (await response.json()) as RedditListingResponse;
  } catch (err) {
    logError('reddit-fetcher', err, { url });
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetches posts from a subreddit (no r/ prefix) via the public Reddit JSON API.
 * Returns empty array on error.
 */
export async function fetchSubredditPosts(
  subreddit: string,
  options: FetchSubredditOptions = {}
): Promise<ScannedContent[]> {
  const { sort = 'hot', timeframe = 'day', limit = 25, minScore = 50 } = options;

  const params = new URLSearchParams({
    t: timeframe,
    limit: String(Math.min(limit, 100)),
    raw_json: '1',
  });

  const url = `${REDDIT_BASE_URL}/r/${subreddit}/${sort}.json?${params.toString()}`;
  const listing = await redditFetch(url);
  if (!listing) return [];

  const posts = listing.data.children;
  return filterPosts(posts, minScore).map(mapToScannedContent);
}

/**
 * Searches Reddit using the public search API.
 * Returns empty array on error.
 */
export async function searchReddit(
  query: string,
  options: SearchRedditOptions = {}
): Promise<ScannedContent[]> {
  const { sort = 'relevance', timeframe = 'week', limit = 25, minScore = 20 } = options;

  const params = new URLSearchParams({
    q: query,
    sort,
    t: timeframe,
    limit: String(Math.min(limit, 100)),
    raw_json: '1',
  });

  const url = `${REDDIT_BASE_URL}/search.json?${params.toString()}`;
  const listing = await redditFetch(url);
  if (!listing) return [];

  const posts = listing.data.children;
  return filterPosts(posts, minScore).map(mapToScannedContent);
}
