// Apify LinkedIn Engagement Scraping
// Actor 1: scraping_solutions/linkedin-posts-engagers (commenters + likers from a post URL)
// Actor 2: supreme_coder/linkedin-post (recent posts from a profile URL)

const ENGAGERS_ACTOR = 'scraping_solutions~linkedin-posts-engagers-likers-and-commenters-no-cookies';
const POSTS_ACTOR = 'supreme_coder~linkedin-post';
const APIFY_BASE = 'https://api.apify.com/v2';
const SYNC_TIMEOUT = 120; // seconds

export interface ApifyEngager {
  type: 'commenters' | 'likers';
  post_Link: string;
  url_profile: string;   // LinkedIn URL (clean /in/slug for commenters, /in/ACoXXX for likers)
  name: string;
  subtitle: string;       // headline
  content?: string;        // comment text (commenters only)
  timestamp?: number;
  datetime?: string;
}

export interface ApifyPost {
  url: string;
  text: string;
  numLikes: number;
  numComments: number;
  numShares: number;
  postedAtISO: string;
  postedAtTimestamp: number;
  authorName: string;
  authorProfileUrl: string;
  author: {
    firstName: string;
    lastName: string;
    occupation: string;
    publicId: string;
  };
}

/**
 * Scrape engagers (commenters or likers) from a single LinkedIn post URL.
 * Returns up to ~50 engagers per call.
 */
export async function scrapeEngagers(
  postUrl: string,
  type: 'commenters' | 'likers'
): Promise<{ data: ApifyEngager[]; error: string | null }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return { data: [], error: 'APIFY_API_TOKEN not set' };

  try {
    const response = await fetch(
      `${APIFY_BASE}/acts/${ENGAGERS_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=${SYNC_TIMEOUT}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: postUrl, type }),
        signal: AbortSignal.timeout((SYNC_TIMEOUT + 30) * 1000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { data: [], error: `Apify HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return { data: [], error: `Unexpected response type: ${typeof data}` };
    }

    return { data: data as ApifyEngager[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Scrape recent posts from a LinkedIn profile URL.
 * Uses the supreme_coder/linkedin-post actor (already rented).
 */
export async function scrapeProfilePosts(
  profileUrl: string,
  limit: number = 10
): Promise<{ data: ApifyPost[]; error: string | null }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return { data: [], error: 'APIFY_API_TOKEN not set' };

  try {
    const response = await fetch(
      `${APIFY_BASE}/acts/${POSTS_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=${SYNC_TIMEOUT}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [profileUrl],
          limitPerSource: limit,
          deepScrape: true,
        }),
        signal: AbortSignal.timeout((SYNC_TIMEOUT + 30) * 1000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { data: [], error: `Apify HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return { data: [], error: `Unexpected response type: ${typeof data}` };
    }

    return { data: data as ApifyPost[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
