/**
 * Screenshot service using ScreenshotOne API.
 * Simple HTTP calls — no browser dependencies, works on Vercel serverless.
 */

const SCREENSHOT_API_BASE = 'https://api.screenshotone.com/take';

export interface ScreenshotResult {
  type: 'hero' | 'section';
  sectionIndex?: number;
  sectionName?: string;
  buffer1080x1080: Buffer;
}

export interface ScreenshotOptions {
  pageUrl: string;
  sectionCount: number;
  sectionNames?: string[];
  waitTime?: number;
}

/**
 * Capture a screenshot via ScreenshotOne API.
 * Returns a PNG buffer of the specified dimensions.
 */
async function captureScreenshot(
  pageUrl: string,
  width: number,
  height: number,
  scrollY: number = 0,
  delay: number = 3
): Promise<Buffer> {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) {
    throw new Error('SCREENSHOTONE_ACCESS_KEY environment variable is not set');
  }

  const params = new URLSearchParams({
    access_key: accessKey,
    url: pageUrl,
    viewport_width: String(width),
    viewport_height: String(height),
    format: 'png',
    image_quality: '100',
    delay: String(delay),
    wait_until: 'load',
    full_page: 'false',
  });

  // For sections below the fold, capture full page and clip
  if (scrollY > 0) {
    params.set('full_page', 'true');
    params.set('clip_x', '0');
    params.set('clip_y', String(scrollY));
    params.set('clip_width', String(width));
    params.set('clip_height', String(height));
  }

  // Retry up to 2 times on transient 500 errors
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));

    const response = await fetch(`${SCREENSHOT_API_BASE}?${params.toString()}`, {
      signal: AbortSignal.timeout(45000),
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const text = await response.text().catch(() => 'Unknown error');
    lastError = new Error(`ScreenshotOne API error (${response.status}): ${text}`);

    // Only retry on transient errors
    if (response.status !== 500 && response.status !== 503 && response.status !== 429) throw lastError;
  }

  throw lastError!;
}

/**
 * Generate screenshots of a content page.
 * Hero shot (top of page) + one per section.
 */
export async function generateContentScreenshots(
  options: ScreenshotOptions
): Promise<ScreenshotResult[]> {
  const { pageUrl, sectionCount, sectionNames, waitTime } = options;
  const delay = waitTime ? Math.ceil(waitTime / 1000) : 3;
  const results: ScreenshotResult[] = [];

  // Hero shot: square format optimized for social media
  const hero1080 = await captureScreenshot(pageUrl, 1080, 1080, 0, delay);

  results.push({
    type: 'hero',
    buffer1080x1080: hero1080,
  });

  // Section shots: estimate scroll position for each section
  // Each section is roughly one viewport height (800px) apart
  for (let i = 0; i < sectionCount; i++) {
    const scrollY = (i + 1) * 800;
    const sectionName = sectionNames?.[i] || `Section ${i + 1}`;

    const sec1080 = await captureScreenshot(pageUrl, 1080, 1080, scrollY, delay);

    results.push({
      type: 'section',
      sectionIndex: i,
      sectionName,
      buffer1080x1080: sec1080,
    });
  }

  return results;
}

/** No-op — no browser to close with API approach */
export async function closeScreenshotBrowser(): Promise<void> {
  // No browser to close when using ScreenshotOne API
}
