import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { logError, logWarn } from '@/lib/utils/logger';

// ============================================
// Types
// ============================================

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  platform?: string;
  author_name?: string;
  author_url?: string;
}

export interface InspirationContent {
  title: string;
  content_preview: string;
  source_url: string;
  platform: string;
  author_name: string | null;
  author_url: string | null;
  engagement_metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

export interface InspirationAnalysis {
  hook_type: string;
  format: string;
  topic: string;
  what_makes_it_work: string;
  suggested_adaptation: string;
  estimated_quality: number; // 1-10
}

export interface TrendSummary {
  trending_topics: string[];
  emerging_formats: string[];
  key_observations: string[];
  content_opportunities: string[];
}

// ============================================
// Web Search
// ============================================

/**
 * Search for high-performing posts on a topic using Serper API.
 * Falls back gracefully if SERPER_API_KEY is not available.
 */
export async function searchTopPerformingPosts(
  query: string,
  platform: string = 'linkedin'
): Promise<InspirationContent[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    logWarn('ai/inspiration', 'SERPER_API_KEY not set, skipping web search for posts');
    return [];
  }

  const searchQuery = `site:${platform}.com ${query} top performing post`;

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 10,
      }),
    });

    if (!response.ok) {
      logError('ai/inspiration', new Error('Serper search failed'), { status: response.status, statusText: response.statusText });
      return [];
    }

    const data = await response.json();
    const results: SearchResult[] = data.organic || [];

    return results.slice(0, 8).map((r) => ({
      title: r.title,
      content_preview: r.snippet,
      source_url: r.link || '',
      platform,
      author_name: extractAuthorFromTitle(r.title),
      author_url: null,
      engagement_metrics: {},
    }));
  } catch (error) {
    logError('ai/inspiration', error, { action: 'search_posts' });
    return [];
  }
}

/**
 * Search for successful lead magnets / opt-in pages.
 */
export async function searchTopLeadMagnets(query: string): Promise<InspirationContent[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    logWarn('ai/inspiration', 'SERPER_API_KEY not set, skipping web search for lead magnets');
    return [];
  }

  const searchQuery = `${query} lead magnet free download opt-in`;

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 10,
      }),
    });

    if (!response.ok) {
      logError('ai/inspiration', new Error('Serper search failed'), { status: response.status, statusText: response.statusText });
      return [];
    }

    const data = await response.json();
    const results: SearchResult[] = data.organic || [];

    return results.slice(0, 8).map((r) => ({
      title: r.title,
      content_preview: r.snippet,
      source_url: r.link || '',
      platform: 'web',
      author_name: null,
      author_url: null,
      engagement_metrics: {},
    }));
  } catch (error) {
    logError('ai/inspiration', error, { action: 'search_lead_magnets' });
    return [];
  }
}

/**
 * Search for content by a specific creator.
 */
export async function searchCreatorContent(
  creatorUrl: string,
  maxResults: number = 8
): Promise<InspirationContent[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    logWarn('ai/inspiration', 'SERPER_API_KEY not set, skipping creator search');
    return [];
  }

  // Extract creator name/handle from URL for better search
  const creatorIdentifier = extractCreatorFromUrl(creatorUrl);
  const searchQuery = creatorIdentifier
    ? `"${creatorIdentifier}" linkedin post`
    : `site:linkedin.com "${creatorUrl}"`;

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchQuery,
        num: maxResults,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const results: SearchResult[] = data.organic || [];

    return results.slice(0, maxResults).map((r) => ({
      title: r.title,
      content_preview: r.snippet,
      source_url: r.link || '',
      platform: 'linkedin',
      author_name: creatorIdentifier,
      author_url: creatorUrl,
      engagement_metrics: {},
    }));
  } catch (error) {
    logError('ai/inspiration', error, { action: 'search_creator_content' });
    return [];
  }
}

/**
 * Search for content by hashtag.
 */
export async function searchHashtagContent(
  hashtag: string,
  maxResults: number = 8
): Promise<InspirationContent[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    logWarn('ai/inspiration', 'SERPER_API_KEY not set, skipping hashtag search');
    return [];
  }

  const cleanHashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
  const searchQuery = `site:linkedin.com "${cleanHashtag}" post`;

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchQuery,
        num: maxResults,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const results: SearchResult[] = data.organic || [];

    return results.slice(0, maxResults).map((r) => ({
      title: r.title,
      content_preview: r.snippet,
      source_url: r.link || '',
      platform: 'linkedin',
      author_name: extractAuthorFromTitle(r.title),
      author_url: null,
      engagement_metrics: {},
    }));
  } catch (error) {
    logError('ai/inspiration', error, { action: 'search_hashtag_content' });
    return [];
  }
}

// ============================================
// AI Analysis
// ============================================

/**
 * AI analysis of why a piece of content works (hook, format, structure).
 * Batches multiple items for efficiency.
 */
export async function analyzeInspiration(
  content: InspirationContent
): Promise<InspirationAnalysis> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `Analyze this piece of content and explain why it works. Be specific and tactical.

TITLE: ${content.title || 'N/A'}
CONTENT PREVIEW: ${content.content_preview || 'N/A'}
PLATFORM: ${content.platform}
${content.engagement_metrics?.likes ? `LIKES: ${content.engagement_metrics.likes}` : ''}
${content.engagement_metrics?.comments ? `COMMENTS: ${content.engagement_metrics.comments}` : ''}

Return ONLY valid JSON:
{
  "hook_type": "question|bold_statement|story|statistic|number_hook|contrarian|other",
  "format": "short_form|long_form|numbered_list|bullet_list|carousel|paragraph|other",
  "topic": "The main topic or theme",
  "what_makes_it_work": "2-3 sentences explaining why this content is effective",
  "suggested_adaptation": "One sentence suggesting how the user could adapt this for their own content",
  "estimated_quality": 7
}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<InspirationAnalysis>(textContent.text);
}

/**
 * Batch analyze multiple inspiration items. Processes in batches of 3 to avoid rate limits.
 */
export async function batchAnalyzeInspiration(
  items: InspirationContent[]
): Promise<Map<string, InspirationAnalysis | null>> {
  const results = new Map<string, InspirationAnalysis | null>();
  const BATCH_SIZE = 3;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((item) => analyzeInspiration(item))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      const key = batch[j].source_url || batch[j].title || `item-${i + j}`;
      results.set(key, result.status === 'fulfilled' ? result.value : null);
    }
  }

  return results;
}

/**
 * Extract trends from a collection of inspiration pulls.
 * Summarizes what's trending in the user's niche.
 */
export async function extractTrends(
  pulls: Array<{ title: string | null; content_preview: string | null; ai_analysis: InspirationAnalysis | null; platform: string }>
): Promise<TrendSummary> {
  if (pulls.length === 0) {
    return {
      trending_topics: [],
      emerging_formats: [],
      key_observations: [],
      content_opportunities: [],
    };
  }

  const client = getAnthropicClient();

  const contentSummary = pulls
    .slice(0, 20) // Cap at 20 items for prompt size
    .map((p, i) => {
      const analysis = p.ai_analysis;
      return `${i + 1}. "${p.title || 'Untitled'}" (${p.platform})
   Topic: ${analysis?.topic || 'unknown'}
   Format: ${analysis?.format || 'unknown'}
   Hook: ${analysis?.hook_type || 'unknown'}
   Why it works: ${analysis?.what_makes_it_work || p.content_preview || 'N/A'}`;
    })
    .join('\n\n');

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Analyze these recent high-performing content pieces and identify trends. Be specific about what's actually trending, not generic advice.

RECENT HIGH-PERFORMING CONTENT:
${contentSummary}

Return ONLY valid JSON:
{
  "trending_topics": ["Specific topic 1", "Specific topic 2"],
  "emerging_formats": ["Format trend 1 with description"],
  "key_observations": ["Observation about patterns across these posts"],
  "content_opportunities": ["Specific opportunity the user could capitalize on"]
}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<TrendSummary>(textContent.text);
}

// ============================================
// Helpers
// ============================================

function extractAuthorFromTitle(title: string): string | null {
  // LinkedIn titles often look like: "Author Name on LinkedIn: post content..."
  const match = title.match(/^(.+?)\s+on\s+LinkedIn/i);
  if (match) return match[1].trim();

  // "Author Name - LinkedIn post"
  const match2 = title.match(/^(.+?)\s*[-|]\s*LinkedIn/i);
  if (match2) return match2[1].trim();

  return null;
}

function extractCreatorFromUrl(url: string): string | null {
  // https://www.linkedin.com/in/username/ -> username
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  if (match) return match[1].replace(/-/g, ' ');

  // https://twitter.com/username -> @username
  const twitterMatch = url.match(/(?:twitter|x)\.com\/([^\/\?]+)/);
  if (twitterMatch) return `@${twitterMatch[1]}`;

  return null;
}
