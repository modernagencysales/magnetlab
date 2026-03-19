/**
 * @jest-environment node
 */

import { fetchSubredditPosts, searchReddit } from '@/lib/scanners/reddit-fetcher';

// ─── Mock setup ──────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRedditPost(
  overrides: Partial<{
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
  }> = {}
) {
  return {
    data: {
      id: 'abc123',
      title: 'Interesting post title',
      selftext: 'This is the post body text.',
      score: 500,
      num_comments: 42,
      author: 'redditor123',
      permalink: '/r/ExperiencedDevs/comments/abc123/interesting_post_title/',
      url: 'https://www.reddit.com/r/ExperiencedDevs/comments/abc123/interesting_post_title/',
      created_utc: 1710000000,
      subreddit: 'ExperiencedDevs',
      is_self: true,
      over_18: false,
      ...overrides,
    },
  };
}

function makeListing(posts: ReturnType<typeof makeRedditPost>[]) {
  return {
    data: {
      children: posts,
      after: null,
    },
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

function mockHttpError(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.reject(new Error('no body')),
    text: () => Promise.resolve('error'),
  });
}

// ─── fetchSubredditPosts ──────────────────────────────────────────────────────

describe('fetchSubredditPosts', () => {
  it('fetches the correct URL with default options', async () => {
    mockFetch.mockReturnValueOnce(mockOk(makeListing([])));

    await fetchSubredditPosts('ExperiencedDevs');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toContain('https://www.reddit.com/r/ExperiencedDevs/hot.json');
    expect(url).toContain('limit=25');
    expect(url).toContain('t=day');
    expect(options.headers['User-Agent']).toBe('magnetlab-scanner/1.0');
    expect(options.headers['Accept']).toBe('application/json');
  });

  it('respects custom sort and timeframe options', async () => {
    mockFetch.mockReturnValueOnce(mockOk(makeListing([])));

    await fetchSubredditPosts('programming', { sort: 'top', timeframe: 'week', limit: 10 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/r/programming/top.json');
    expect(url).toContain('t=week');
    expect(url).toContain('limit=10');
  });

  it('maps posts to ScannedContent correctly', async () => {
    const post = makeRedditPost({
      title: 'How I learned TypeScript',
      selftext: 'Here is my story...',
      score: 1200,
      num_comments: 88,
      author: 'typescript_fan',
      permalink: '/r/typescript/comments/xyz/how_i_learned_typescript/',
      created_utc: 1710000000,
    });
    mockFetch.mockReturnValueOnce(mockOk(makeListing([post])));

    const results = await fetchSubredditPosts('typescript', { minScore: 0 });

    expect(results).toHaveLength(1);
    const item = results[0];
    expect(item.source_platform).toBe('reddit');
    expect(item.source_url).toBe(
      'https://www.reddit.com/r/typescript/comments/xyz/how_i_learned_typescript/'
    );
    expect(item.source_author).toBe('typescript_fan');
    expect(item.content_text).toBe('How I learned TypeScript\n\nHere is my story...');
    expect(item.engagement.likes).toBe(1200);
    expect(item.engagement.comments).toBe(88);
    expect(item.engagement.shares).toBe(0);
    expect(item.posted_at).toEqual(new Date(1710000000 * 1000));
  });

  it('uses only the title when selftext is empty', async () => {
    const post = makeRedditPost({ title: 'Link post title', selftext: '', is_self: false });
    mockFetch.mockReturnValueOnce(mockOk(makeListing([post])));

    const results = await fetchSubredditPosts('ExperiencedDevs', { minScore: 0 });

    expect(results[0].content_text).toBe('Link post title');
  });

  it('filters out NSFW posts', async () => {
    const safePost = makeRedditPost({
      score: 200,
      over_18: false,
      permalink: '/r/ExperiencedDevs/comments/safe_post/safe_title/',
    });
    const nsfwPost = makeRedditPost({
      score: 200,
      over_18: true,
      permalink: '/r/ExperiencedDevs/comments/nsfw_post/nsfw_title/',
    });
    mockFetch.mockReturnValueOnce(mockOk(makeListing([safePost, nsfwPost])));

    const results = await fetchSubredditPosts('all', { minScore: 0 });

    expect(results).toHaveLength(1);
    expect(results[0].source_url).toContain('safe_post');
  });

  it('filters posts below minScore', async () => {
    const highScore = makeRedditPost({ id: 'high', score: 500 });
    const lowScore = makeRedditPost({ id: 'low', score: 10 });
    mockFetch.mockReturnValueOnce(mockOk(makeListing([highScore, lowScore])));

    const results = await fetchSubredditPosts('ExperiencedDevs', { minScore: 50 });

    expect(results).toHaveLength(1);
    expect(results[0].engagement.likes).toBe(500);
  });

  it('returns empty array when fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const results = await fetchSubredditPosts('ExperiencedDevs');

    expect(results).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns empty array on HTTP error response', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(429));

    const results = await fetchSubredditPosts('ExperiencedDevs');

    expect(results).toEqual([]);
  });

  it('caps limit at 100', async () => {
    mockFetch.mockReturnValueOnce(mockOk(makeListing([])));

    await fetchSubredditPosts('programming', { limit: 500 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('limit=100');
  });

  it('returns empty array when all posts are filtered out', async () => {
    const nsfwPost = makeRedditPost({ over_18: true, score: 1000 });
    const lowScore = makeRedditPost({ score: 5 });
    mockFetch.mockReturnValueOnce(mockOk(makeListing([nsfwPost, lowScore])));

    const results = await fetchSubredditPosts('ExperiencedDevs', { minScore: 50 });

    expect(results).toEqual([]);
  });
});

// ─── searchReddit ─────────────────────────────────────────────────────────────

describe('searchReddit', () => {
  it('fetches the correct search URL with default options', async () => {
    mockFetch.mockReturnValueOnce(mockOk(makeListing([])));

    await searchReddit('typescript generics');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];

    expect(url).toContain('https://www.reddit.com/search.json');
    expect(url).toContain('q=typescript+generics');
    expect(url).toContain('sort=relevance');
    expect(url).toContain('t=week');
    expect(url).toContain('limit=25');
  });

  it('respects custom sort and timeframe', async () => {
    mockFetch.mockReturnValueOnce(mockOk(makeListing([])));

    await searchReddit('remote work', { sort: 'hot', timeframe: 'month', limit: 10 });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('sort=hot');
    expect(url).toContain('t=month');
    expect(url).toContain('limit=10');
  });

  it('returns mapped ScannedContent for search results', async () => {
    const post = makeRedditPost({
      title: 'Remote work is the future',
      selftext: 'Companies are embracing distributed teams.',
      score: 300,
      num_comments: 55,
      author: 'remote_advocate',
    });
    mockFetch.mockReturnValueOnce(mockOk(makeListing([post])));

    const results = await searchReddit('remote work', { minScore: 0 });

    expect(results).toHaveLength(1);
    expect(results[0].source_platform).toBe('reddit');
    expect(results[0].source_author).toBe('remote_advocate');
    expect(results[0].engagement.likes).toBe(300);
  });

  it('filters out NSFW posts from search results', async () => {
    const clean = makeRedditPost({ id: 'clean', score: 100, over_18: false });
    const nsfw = makeRedditPost({ id: 'nsfw', score: 100, over_18: true });
    mockFetch.mockReturnValueOnce(mockOk(makeListing([clean, nsfw])));

    const results = await searchReddit('query', { minScore: 0 });

    expect(results).toHaveLength(1);
  });

  it('filters results below minScore', async () => {
    const highScore = makeRedditPost({ id: 'high', score: 50 });
    const lowScore = makeRedditPost({ id: 'low', score: 5 });
    mockFetch.mockReturnValueOnce(mockOk(makeListing([highScore, lowScore])));

    const results = await searchReddit('query', { minScore: 20 });

    expect(results).toHaveLength(1);
    expect(results[0].engagement.likes).toBe(50);
  });

  it('returns empty array on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const results = await searchReddit('typescript');

    expect(results).toEqual([]);
  });

  it('returns empty array on HTTP error', async () => {
    mockFetch.mockReturnValueOnce(mockHttpError(503));

    const results = await searchReddit('typescript');

    expect(results).toEqual([]);
  });
});
