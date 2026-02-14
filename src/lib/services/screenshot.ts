import { chromium, type Browser, type Page } from 'playwright';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

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
  waitTime?: number;
}

/**
 * Generate multiple screenshots of a content page at different scroll positions.
 * Returns hero shot + one per section.
 */
export async function generateContentScreenshots(
  options: ScreenshotOptions
): Promise<ScreenshotResult[]> {
  const { pageUrl, sectionCount, waitTime = 3000 } = options;
  const b = await getBrowser();
  const results: ScreenshotResult[] = [];

  const page = await b.newPage({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2,
  });

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(waitTime);

    // Hero shot: top of page
    results.push({
      type: 'hero',
      buffer1200x627: await captureClip(page, 1200, 627),
      buffer1080x1080: await captureClip(page, 1080, 1080),
    });

    // Section shots: scroll to each section heading
    for (let i = 0; i < sectionCount; i++) {
      const sectionEl = await page.$(`[data-section-index="${i}"]`);

      if (sectionEl) {
        await sectionEl.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        const sectionName = await sectionEl.getAttribute('data-section-name') || `Section ${i + 1}`;

        results.push({
          type: 'section',
          sectionIndex: i,
          sectionName,
          buffer1200x627: await captureClip(page, 1200, 627),
          buffer1080x1080: await captureClip(page, 1080, 1080),
        });
      }
    }
  } finally {
    await page.close();
  }

  return results;
}

async function captureClip(page: Page, width: number, height: number): Promise<Buffer> {
  return await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width, height },
  }) as Buffer;
}

export async function closeScreenshotBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
