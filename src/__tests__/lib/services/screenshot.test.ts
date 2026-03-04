// Mock fetch for ScreenshotOne API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Set required env var
process.env.SCREENSHOTONE_ACCESS_KEY = 'test-access-key';

import {
  generateContentScreenshots,
  closeScreenshotBrowser,
} from '@/lib/services/screenshot';

describe('Screenshot Service (ScreenshotOne API)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
  });

  it('generates hero + section screenshots', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
      sectionCount: 2,
    });

    // Hero + 2 sections = 3 results
    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('hero');
    expect(results[1].type).toBe('section');
    expect(results[1].sectionIndex).toBe(0);
    expect(results[2].type).toBe('section');
    expect(results[2].sectionIndex).toBe(1);
  });

  it('returns buffer1080x1080 for each result', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
      sectionCount: 1,
    });

    expect(results[0].buffer1080x1080).toBeInstanceOf(Buffer);
    expect(results[1].buffer1080x1080).toBeInstanceOf(Buffer);
  });

  it('handles zero sections (hero only)', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
      sectionCount: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('hero');
  });

  it('passes correct params to ScreenshotOne API', async () => {
    await generateContentScreenshots({
      pageUrl: 'https://www.magnetlab.app/p/testuser/my-magnet/content',
      sectionCount: 0,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.origin).toBe('https://api.screenshotone.com');
    expect(url.pathname).toBe('/take');
    expect(url.searchParams.get('url')).toBe('https://www.magnetlab.app/p/testuser/my-magnet/content');
    expect(url.searchParams.get('viewport_width')).toBe('1080');
    expect(url.searchParams.get('viewport_height')).toBe('1080');
    expect(url.searchParams.get('format')).toBe('png');
    expect(url.searchParams.get('access_key')).toBe('test-access-key');
  });

  it('uses full_page + clip for sections below the fold', async () => {
    await generateContentScreenshots({
      pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
      sectionCount: 1,
    });

    // Second call is for section 0
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const sectionUrl = new URL(mockFetch.mock.calls[1][0]);
    expect(sectionUrl.searchParams.get('full_page')).toBe('true');
    expect(sectionUrl.searchParams.get('clip_y')).toBe('800');
    expect(sectionUrl.searchParams.get('clip_width')).toBe('1080');
    expect(sectionUrl.searchParams.get('clip_height')).toBe('1080');
  });

  it('retries on 500 errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    const results = await generateContentScreenshots({
      pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
      sectionCount: 0,
    });

    expect(results).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on non-retryable errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(
      generateContentScreenshots({
        pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
        sectionCount: 0,
      }),
    ).rejects.toThrow('ScreenshotOne API error (401)');

    // Should not retry on 401
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries on persistent 500', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    });

    await expect(
      generateContentScreenshots({
        pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
        sectionCount: 0,
      }),
    ).rejects.toThrow('ScreenshotOne API error (500)');

    // 3 attempts total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws when SCREENSHOTONE_ACCESS_KEY is not set', async () => {
    const original = process.env.SCREENSHOTONE_ACCESS_KEY;
    delete process.env.SCREENSHOTONE_ACCESS_KEY;

    await expect(
      generateContentScreenshots({
        pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
        sectionCount: 0,
      }),
    ).rejects.toThrow('SCREENSHOTONE_ACCESS_KEY');

    process.env.SCREENSHOTONE_ACCESS_KEY = original;
  });

  it('closeScreenshotBrowser is a no-op', async () => {
    // Should not throw
    await closeScreenshotBrowser();
  });

  it('uses custom section names when provided', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'https://www.magnetlab.app/p/user/slug/content',
      sectionCount: 2,
      sectionNames: ['Introduction', 'Key Insights'],
    });

    expect(results[1].sectionName).toBe('Introduction');
    expect(results[2].sectionName).toBe('Key Insights');
  });
});
