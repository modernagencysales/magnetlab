/**
 * @jest-environment node
 */

// Store original env and fetch
const originalEnv = process.env;
const originalFetch = global.fetch;

import {
  generateContentScreenshots,
  closeScreenshotBrowser,
} from '@/lib/services/screenshot';

describe('Screenshot Service (ScreenshotOne API)', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    // Set env var
    process.env = { ...originalEnv, SCREENSHOTONE_ACCESS_KEY: 'test-key' };

    // Mock fetch to return fake PNG buffer
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new Uint8Array([137, 80, 78, 71]).buffer),
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('generates hero + section screenshots', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 2,
    });

    // Hero + 2 sections = 3 results
    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('hero');
    expect(results[1].type).toBe('section');
    expect(results[1].sectionIndex).toBe(0);
    expect(results[1].sectionName).toBe('Section 1');
    expect(results[2].type).toBe('section');
    expect(results[2].sectionIndex).toBe(1);
    expect(results[2].sectionName).toBe('Section 2');
  });

  it('returns buffer for 1080x1080 size', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 1,
    });

    expect(results[0].buffer1080x1080).toBeInstanceOf(Buffer);
    expect(results[0].buffer1080x1080.length).toBeGreaterThan(0);
  });

  it('passes correct URL params to ScreenshotOne API', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/testuser/my-magnet/content',
      sectionCount: 0,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;

    expect(calledUrl).toContain('https://api.screenshotone.com/take?');
    expect(calledUrl).toContain('access_key=test-key');
    expect(calledUrl).toContain(encodeURIComponent('http://localhost:3000/p/testuser/my-magnet/content'));
    expect(calledUrl).toContain('viewport_width=1080');
    expect(calledUrl).toContain('viewport_height=1080');
    expect(calledUrl).toContain('format=png');
  });

  it('handles zero sections (hero only)', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('hero');
  });

  it('uses custom section names when provided', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 2,
      sectionNames: ['Introduction', 'Conclusion'],
    });

    expect(results[1].sectionName).toBe('Introduction');
    expect(results[2].sectionName).toBe('Conclusion');
  });

  it('falls back to default section names when not provided', async () => {
    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 1,
    });

    expect(results[1].sectionName).toBe('Section 1');
  });

  it('uses custom wait time converted to delay seconds', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
      waitTime: 5000,
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('delay=5');
  });

  it('uses default delay of 3 seconds', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('delay=3');
  });

  it('sets full_page and clip params for sections (scrollY > 0)', async () => {
    await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 1,
    });

    // Second call is for section 0 with scrollY = 800
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const sectionUrl = mockFetch.mock.calls[1][0] as string;
    expect(sectionUrl).toContain('full_page=true');
    expect(sectionUrl).toContain('clip_y=800');
    expect(sectionUrl).toContain('clip_width=1080');
    expect(sectionUrl).toContain('clip_height=1080');
  });

  it('throws when SCREENSHOTONE_ACCESS_KEY is not set', async () => {
    delete process.env.SCREENSHOTONE_ACCESS_KEY;

    await expect(
      generateContentScreenshots({
        pageUrl: 'http://localhost:3000/p/user/slug/content',
        sectionCount: 0,
      })
    ).rejects.toThrow('SCREENSHOTONE_ACCESS_KEY');
  });

  it('throws on non-retryable API errors (e.g. 400)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    });

    await expect(
      generateContentScreenshots({
        pageUrl: 'http://localhost:3000/p/user/slug/content',
        sectionCount: 0,
      })
    ).rejects.toThrow('ScreenshotOne API error (400)');

    // Should NOT retry on 400
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on transient 500 errors up to 3 attempts', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

    await expect(
      generateContentScreenshots({
        pageUrl: 'http://localhost:3000/p/user/slug/content',
        sectionCount: 0,
      })
    ).rejects.toThrow('ScreenshotOne API error (500)');

    // 3 attempts total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  }, 15000);

  it('succeeds on retry after transient failure', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service unavailable'),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([137, 80, 78, 71]).buffer),
      });

    const results = await generateContentScreenshots({
      pageUrl: 'http://localhost:3000/p/user/slug/content',
      sectionCount: 0,
    });

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('hero');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 15000);

  it('closeScreenshotBrowser is a no-op (API approach)', async () => {
    // Should not throw
    await closeScreenshotBrowser();
  });
});
