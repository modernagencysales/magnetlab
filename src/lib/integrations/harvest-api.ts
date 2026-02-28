// Harvest API: LinkedIn data scraping (replaces Apify)
// Docs: https://api.harvest-api.com
// Auth: X-API-Key header using HARVEST_API_KEY env var

import type {
  HarvestPostShort,
  HarvestPostComment,
  HarvestPostReaction,
  HarvestProfile,
  HarvestResponse,
  HarvestPagination,
  HarvestJobShort,
} from '@/lib/types/signals';

const HARVEST_BASE_URL = 'https://api.harvest-api.com';

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Generic GET request for paginated Harvest endpoints.
 * Builds URLSearchParams, calls fetch with X-API-Key header.
 * Returns { data: T[], error: string | null, pagination? }.
 */
async function harvestGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): Promise<{ data: T[]; error: string | null; pagination?: HarvestPagination }> {
  const apiKey = process.env.HARVEST_API_KEY;
  if (!apiKey) return { data: [], error: 'HARVEST_API_KEY not set' };

  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    }
  }

  const qs = searchParams.toString();
  const url = `${HARVEST_BASE_URL}${path}${qs ? `?${qs}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: [], error: `Harvest HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const json = (await response.json()) as HarvestResponse<T>;

    return {
      data: json.elements ?? [],
      error: json.error ?? null,
      pagination: json.pagination,
    };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * GET request for single-object Harvest responses (e.g., profile lookup).
 * Returns { data: T | null, error: string | null }.
 */
async function harvestGetSingle<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): Promise<{ data: T | null; error: string | null }> {
  const apiKey = process.env.HARVEST_API_KEY;
  if (!apiKey) return { data: null, error: 'HARVEST_API_KEY not set' };

  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    }
  }

  const qs = searchParams.toString();
  const url = `${HARVEST_BASE_URL}${path}${qs ? `?${qs}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `Harvest HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================
// PUBLIC FUNCTIONS
// ============================================

/**
 * Search LinkedIn posts by keyword, profile, or company.
 * GET /linkedin/post-search
 */
export async function searchPosts(params: {
  search?: string;
  profile?: string;
  company?: string;
  postedLimit?: '24h' | 'week' | 'month';
  scrapePostedLimit?: string;
  sortBy?: 'relevance' | 'date';
  page?: number;
  paginationToken?: string;
}): Promise<{ data: HarvestPostShort[]; error: string | null; pagination?: HarvestPagination }> {
  return harvestGet<HarvestPostShort>('/linkedin/post-search', params);
}

/**
 * Get comments on a specific LinkedIn post.
 * GET /linkedin/post-comments
 */
export async function getPostComments(
  postUrl: string,
  params?: {
    sortBy?: string;
    page?: number;
    paginationToken?: string;
  }
): Promise<{ data: HarvestPostComment[]; error: string | null; pagination?: HarvestPagination }> {
  return harvestGet<HarvestPostComment>('/linkedin/post-comments', {
    post: postUrl,
    ...params,
  });
}

/**
 * Get reactions on a specific LinkedIn post.
 * GET /linkedin/post-reactions
 */
export async function getPostReactions(
  postUrl: string,
  params?: {
    page?: number;
  }
): Promise<{ data: HarvestPostReaction[]; error: string | null; pagination?: HarvestPagination }> {
  return harvestGet<HarvestPostReaction>('/linkedin/post-reactions', {
    post: postUrl,
    ...params,
  });
}

/**
 * Get posts from a specific LinkedIn profile.
 * GET /linkedin/profile-posts
 */
export async function getProfilePosts(params: {
  profile?: string;
  profileId?: string;
  postedLimit?: string;
  scrapePostedLimit?: string;
  page?: number;
  paginationToken?: string;
}): Promise<{ data: HarvestPostShort[]; error: string | null; pagination?: HarvestPagination }> {
  return harvestGet<HarvestPostShort>('/linkedin/profile-posts', params);
}

/**
 * Get a LinkedIn profile.
 * GET /linkedin/profile — returns a single object (not array).
 */
export async function getProfile(params: {
  url?: string;
  publicIdentifier?: string;
  profileId?: string;
  main?: boolean;
  findEmail?: boolean;
  skipSmtp?: boolean;
}): Promise<{ data: HarvestProfile | null; error: string | null }> {
  return harvestGetSingle<HarvestProfile>('/linkedin/profile', params);
}

/**
 * Get posts from a specific LinkedIn company page.
 * GET /linkedin/company-posts
 */
export async function getCompanyPosts(params: {
  company?: string;
  companyId?: string;
  companyUniversalName?: string;
  postedLimit?: string;
  scrapePostedLimit?: string;
  page?: number;
  paginationToken?: string;
}): Promise<{ data: HarvestPostShort[]; error: string | null; pagination?: HarvestPagination }> {
  return harvestGet<HarvestPostShort>('/linkedin/company-posts', params);
}

/**
 * Search LinkedIn job postings.
 * GET /linkedin/job-search
 */
export async function searchJobs(params: {
  search?: string;
  companyId?: string;
  location?: string;
  postedLimit?: string;
  page?: number;
}): Promise<{ data: HarvestJobShort[]; error: string | null; pagination?: HarvestPagination }> {
  return harvestGet<HarvestJobShort>('/linkedin/job-search', params);
}
