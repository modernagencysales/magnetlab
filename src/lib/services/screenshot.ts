/**
 * Screenshot service using ScreenshotOne API.
 * Simple HTTP calls — no browser dependencies, works on Vercel serverless.
 */

const SCREENSHOT_API_BASE = 'https://api.screenshotone.com/take';

export interface ScreenshotResult {
  type: 'hero' | 'section';
  sectionIndex?: number;
  sectionName?: string;
  buffer1200x627: Buffer;
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
    viewport_width: '1200',
    viewport_height: '800',
    device_scale_factor: '2',
    format: 'png',
    image_width: String(width),
    image_height: String(height),
    delay: String(delay),
    wait_until: 'networkidle0',
  });

  // For sections below the fold, use clip_y to scroll down
  if (scrollY > 0) {
    params.set('clip_x', '0');
    params.set('clip_y', String(scrollY));
    params.set('clip_width', '1200');
    params.set('clip_height', String(Math.round(height * (800 / width))));
  }

  const response = await fetch(`${SCREENSHOT_API_BASE}?${params.toString()}`, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`ScreenshotOne API error (${response.status}): ${text}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

  // Hero shot: top of page at both dimensions
  const [hero1200, hero1080] = await Promise.all([
    captureScreenshot(pageUrl, 1200, 627, 0, delay),
    captureScreenshot(pageUrl, 1080, 1080, 0, delay),
  ]);

  results.push({
    type: 'hero',
    buffer1200x627: hero1200,
    buffer1080x1080: hero1080,
  });

  // Section shots: estimate scroll position for each section
  // Each section is roughly one viewport height (800px) apart
  for (let i = 0; i < sectionCount; i++) {
    const scrollY = (i + 1) * 800;
    const sectionName = sectionNames?.[i] || `Section ${i + 1}`;

    const [sec1200, sec1080] = await Promise.all([
      captureScreenshot(pageUrl, 1200, 627, scrollY, delay),
      captureScreenshot(pageUrl, 1080, 1080, scrollY, delay),
    ]);

    results.push({
      type: 'section',
      sectionIndex: i,
      sectionName,
      buffer1200x627: sec1200,
      buffer1080x1080: sec1080,
    });
  }

  return results;
}

/** No-op — no browser to close with API approach */
export async function closeScreenshotBrowser(): Promise<void> {
  // No browser to close when using ScreenshotOne API
}
