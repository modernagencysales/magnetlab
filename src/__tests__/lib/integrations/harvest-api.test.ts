/**
 * @jest-environment node
 */

import {
  searchPosts,
  getPostComments,
  getPostReactions,
  getProfilePosts,
  getProfile,
  getCompanyPosts,
  searchJobs,
} from '@/lib/integrations/harvest-api';

// ============================================
// MOCK SETUP
// ============================================

const mockFetch = jest.fn();
global.fetch = mockFetch;

const MOCK_API_KEY = 'test-harvest-api-key';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.HARVEST_API_KEY = MOCK_API_KEY;
});

afterEach(() => {
  delete process.env.HARVEST_API_KEY;
});

// ============================================
// HELPER: build a mock paginated response
// ============================================

function mockHarvestResponse<T>(elements: T[], pagination?: Partial<import('@/lib/types/signals').HarvestPagination>) {
  return {
    elements,
    pagination: {
      totalPages: 1,
      totalElements: elements.length,
      pageNumber: 1,
      previousElements: 0,
      pageSize: 50,
      paginationToken: null,
      ...pagination,
    },
    status: 'ok',
  };
}

function mockOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function mockError(status: number, body: string) {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

// ============================================
// TESTS: searchPosts
// ============================================

describe('searchPosts', () => {
  it('sends correct URL params and headers', async () => {
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse([])));

    await searchPosts({
      search: 'sales automation',
      postedLimit: 'week',
      sortBy: 'relevance',
      page: 2,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    // Verify URL and params
    expect(url).toContain('https://api.harvest-api.com/linkedin/post-search');
    expect(url).toContain('search=sales+automation');
    expect(url).toContain('postedLimit=week');
    expect(url).toContain('sortBy=relevance');
    expect(url).toContain('page=2');

    // Verify headers
    expect(options.method).toBe('GET');
    expect(options.headers['X-API-Key']).toBe(MOCK_API_KEY);
    expect(options.headers['Accept']).toBe('application/json');
  });

  it('returns posts array and pagination', async () => {
    const mockPosts = [
      { id: 'post-1', content: 'Hello world', linkedinUrl: 'https://linkedin.com/feed/update/1' },
      { id: 'post-2', content: 'Second post', linkedinUrl: 'https://linkedin.com/feed/update/2' },
    ];
    const pagination = { totalPages: 3, totalElements: 120, pageNumber: 1, paginationToken: 'abc123' };
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse(mockPosts, pagination)));

    const result = await searchPosts({ search: 'outreach' });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('post-1');
    expect(result.data[1].content).toBe('Second post');
    expect(result.error).toBeNull();
    expect(result.pagination?.totalPages).toBe(3);
    expect(result.pagination?.paginationToken).toBe('abc123');
  });

  it('omits undefined/null params from query string', async () => {
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse([])));

    await searchPosts({ search: 'test', profile: undefined, company: undefined });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('search=test');
    expect(url).not.toContain('profile');
    expect(url).not.toContain('company');
  });

  it('returns empty data when API key is not set', async () => {
    delete process.env.HARVEST_API_KEY;

    const result = await searchPosts({ search: 'test' });

    expect(result.data).toEqual([]);
    expect(result.error).toBe('HARVEST_API_KEY not set');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ============================================
// TESTS: getPostComments
// ============================================

describe('getPostComments', () => {
  it('sends post URL as query param and parses response correctly', async () => {
    const mockComments = [
      {
        id: 'comment-1',
        linkedinUrl: 'https://linkedin.com/comment/1',
        commentary: 'Great post!',
        createdAt: '2026-02-20T10:00:00Z',
        createdAtTimestamp: 1771578000000,
        numComments: 0,
        reactionTypeCounts: [{ type: 'LIKE', count: 5 }],
        postId: 'post-1',
        actor: {
          id: 'actor-1',
          name: 'Jane Doe',
          linkedinUrl: 'https://linkedin.com/in/janedoe',
          position: 'VP Sales at Acme',
        },
        pinned: false,
        edited: false,
      },
    ];
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse(mockComments)));

    const postUrl = 'https://linkedin.com/feed/update/urn:li:activity:123456';
    const result = await getPostComments(postUrl, { sortBy: 'relevance', page: 1 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('post=' + encodeURIComponent(postUrl));
    expect(url).toContain('sortBy=relevance');
    expect(url).toContain('page=1');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].commentary).toBe('Great post!');
    expect(result.data[0].actor.name).toBe('Jane Doe');
    expect(result.data[0].pinned).toBe(false);
    expect(result.error).toBeNull();
  });

  it('works without optional params', async () => {
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse([])));

    const postUrl = 'https://linkedin.com/feed/update/urn:li:activity:789';
    await getPostComments(postUrl);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('post=' + encodeURIComponent(postUrl));
    expect(url).not.toContain('sortBy');
    expect(url).not.toContain('page');
  });
});

// ============================================
// TESTS: getPostReactions
// ============================================

describe('getPostReactions', () => {
  it('fetches reactions for a post', async () => {
    const mockReactions = [
      {
        id: 'reaction-1',
        reactionType: 'LIKE',
        postId: 'post-1',
        actor: {
          id: 'actor-1',
          name: 'John Smith',
          linkedinUrl: 'https://linkedin.com/in/johnsmith',
          position: 'CEO at Startup',
        },
      },
    ];
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse(mockReactions)));

    const postUrl = 'https://linkedin.com/feed/update/urn:li:activity:456';
    const result = await getPostReactions(postUrl, { page: 2 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('post=' + encodeURIComponent(postUrl));
    expect(url).toContain('page=2');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].reactionType).toBe('LIKE');
    expect(result.data[0].actor.name).toBe('John Smith');
    expect(result.error).toBeNull();
  });
});

// ============================================
// TESTS: getProfilePosts
// ============================================

describe('getProfilePosts', () => {
  it('fetches posts for a profile', async () => {
    const mockPosts = [
      { id: 'post-1', content: 'My post', linkedinUrl: 'https://linkedin.com/feed/update/1' },
    ];
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse(mockPosts)));

    const result = await getProfilePosts({
      profile: 'https://linkedin.com/in/janedoe',
      postedLimit: 'month',
      page: 1,
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/linkedin/profile-posts');
    expect(url).toContain('profile=' + encodeURIComponent('https://linkedin.com/in/janedoe'));
    expect(url).toContain('postedLimit=month');
    expect(result.data).toHaveLength(1);
    expect(result.error).toBeNull();
  });
});

// ============================================
// TESTS: getProfile (single object, not array)
// ============================================

describe('getProfile', () => {
  it('returns a single profile object (not array)', async () => {
    const mockProfile = {
      id: 'profile-1',
      publicIdentifier: 'janedoe',
      firstName: 'Jane',
      lastName: 'Doe',
      headline: 'VP Sales at Acme',
      about: 'Building the future of sales.',
      linkedinUrl: 'https://linkedin.com/in/janedoe',
      connectionsCount: 1500,
      followerCount: 3200,
      openToWork: false,
      hiring: true,
      location: {
        linkedinText: 'New York, NY',
        countryCode: 'US',
        parsed: {
          country: 'US',
          countryFull: 'United States',
          state: 'New York',
          city: 'New York',
        },
      },
      currentPosition: [{ companyName: 'Acme Corp' }],
      experience: [
        {
          companyName: 'Acme Corp',
          position: 'VP Sales',
          duration: '2y 3m',
          startDate: '2024-01',
        },
      ],
    };
    mockFetch.mockReturnValueOnce(mockOk(mockProfile));

    const result = await getProfile({ url: 'https://linkedin.com/in/janedoe', findEmail: true });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/linkedin/profile');
    expect(url).toContain('url=' + encodeURIComponent('https://linkedin.com/in/janedoe'));
    expect(url).toContain('findEmail=true');
    expect(options.headers['X-API-Key']).toBe(MOCK_API_KEY);

    // Single object, not wrapped in array
    expect(result.data).not.toBeNull();
    expect(Array.isArray(result.data)).toBe(false);
    expect(result.data?.firstName).toBe('Jane');
    expect(result.data?.lastName).toBe('Doe');
    expect(result.data?.headline).toBe('VP Sales at Acme');
    expect(result.data?.hiring).toBe(true);
    expect(result.data?.currentPosition?.[0].companyName).toBe('Acme Corp');
    expect(result.error).toBeNull();
  });

  it('returns null data when API key is not set', async () => {
    delete process.env.HARVEST_API_KEY;

    const result = await getProfile({ publicIdentifier: 'janedoe' });

    expect(result.data).toBeNull();
    expect(result.error).toBe('HARVEST_API_KEY not set');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('supports publicIdentifier param', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ id: 'p1', publicIdentifier: 'janedoe', firstName: 'Jane', lastName: 'Doe', headline: '', about: '', linkedinUrl: '' }));

    await getProfile({ publicIdentifier: 'janedoe' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('publicIdentifier=janedoe');
    expect(url).not.toContain('url=');
  });
});

// ============================================
// TESTS: getCompanyPosts
// ============================================

describe('getCompanyPosts', () => {
  it('fetches company posts', async () => {
    const mockPosts = [
      { id: 'cp-1', content: 'Company news', linkedinUrl: 'https://linkedin.com/feed/update/3' },
    ];
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse(mockPosts)));

    const result = await getCompanyPosts({
      company: 'https://linkedin.com/company/acme',
      postedLimit: 'week',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/linkedin/company-posts');
    expect(url).toContain('company=' + encodeURIComponent('https://linkedin.com/company/acme'));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].content).toBe('Company news');
    expect(result.error).toBeNull();
  });
});

// ============================================
// TESTS: searchJobs
// ============================================

describe('searchJobs', () => {
  it('fetches job search results', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        linkedinUrl: 'https://linkedin.com/jobs/view/1234',
        title: 'Sales Director',
        companyName: 'Acme Corp',
        postedDate: '2026-02-15',
        easyApply: true,
      },
    ];
    mockFetch.mockReturnValueOnce(mockOk(mockHarvestResponse(mockJobs)));

    const result = await searchJobs({ search: 'sales director', location: 'New York' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/linkedin/job-search');
    expect(url).toContain('search=sales+director');
    expect(url).toContain('location=New+York');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe('Sales Director');
    expect(result.error).toBeNull();
  });
});

// ============================================
// TESTS: Error handling
// ============================================

describe('error handling', () => {
  it('returns error message on HTTP 400 (bad request)', async () => {
    mockFetch.mockReturnValueOnce(mockError(400, 'Missing required parameter: search'));

    const result = await searchPosts({});

    expect(result.data).toEqual([]);
    expect(result.error).toBe('Harvest HTTP 400: Missing required parameter: search');
    expect(result.pagination).toBeUndefined();
  });

  it('returns error message on HTTP 401 (unauthorized)', async () => {
    mockFetch.mockReturnValueOnce(mockError(401, 'Invalid API key'));

    const result = await getPostComments('https://linkedin.com/post/1');

    expect(result.data).toEqual([]);
    expect(result.error).toBe('Harvest HTTP 401: Invalid API key');
  });

  it('returns error message on HTTP 429 (rate limited)', async () => {
    mockFetch.mockReturnValueOnce(mockError(429, 'Rate limit exceeded'));

    const result = await searchJobs({ search: 'test' });

    expect(result.data).toEqual([]);
    expect(result.error).toBe('Harvest HTTP 429: Rate limit exceeded');
  });

  it('returns error message on HTTP 500 (server error)', async () => {
    mockFetch.mockReturnValueOnce(mockError(500, 'Internal server error'));

    const result = await getProfilePosts({ profile: 'https://linkedin.com/in/test' });

    expect(result.data).toEqual([]);
    expect(result.error).toContain('Harvest HTTP 500');
  });

  it('handles harvestGetSingle errors (getProfile with 400)', async () => {
    mockFetch.mockReturnValueOnce(mockError(400, 'Invalid profile URL'));

    const result = await getProfile({ url: 'not-a-url' });

    expect(result.data).toBeNull();
    expect(result.error).toBe('Harvest HTTP 400: Invalid profile URL');
  });

  it('truncates long error messages to 200 chars', async () => {
    const longError = 'A'.repeat(500);
    mockFetch.mockReturnValueOnce(mockError(400, longError));

    const result = await searchPosts({ search: 'test' });

    expect(result.error).toBe(`Harvest HTTP 400: ${'A'.repeat(200)}`);
  });
});

// ============================================
// TESTS: Network failures
// ============================================

describe('network failures', () => {
  it('handles fetch throwing a network error (paginated endpoint)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const result = await searchPosts({ search: 'test' });

    expect(result.data).toEqual([]);
    expect(result.error).toBe('Network request failed');
    expect(result.pagination).toBeUndefined();
  });

  it('handles fetch throwing a network error (single endpoint)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('DNS resolution failed'));

    const result = await getProfile({ url: 'https://linkedin.com/in/janedoe' });

    expect(result.data).toBeNull();
    expect(result.error).toBe('DNS resolution failed');
  });

  it('handles fetch throwing a non-Error object', async () => {
    mockFetch.mockRejectedValueOnce('string error');

    const result = await searchPosts({ search: 'test' });

    expect(result.data).toEqual([]);
    expect(result.error).toBe('Unknown error');
  });

  it('handles fetch throwing a non-Error object (single endpoint)', async () => {
    mockFetch.mockRejectedValueOnce({ code: 'TIMEOUT' });

    const result = await getProfile({ url: 'https://linkedin.com/in/test' });

    expect(result.data).toBeNull();
    expect(result.error).toBe('Unknown error');
  });
});
