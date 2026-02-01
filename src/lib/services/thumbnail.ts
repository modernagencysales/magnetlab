// Thumbnail Generation Service using Playwright
// Generates LinkedIn-optimized thumbnails (1200x627)

import { chromium, type Browser, type Page } from 'playwright';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
  waitForSelector?: string;
  waitTime?: number;
}

const DEFAULT_OPTIONS: ThumbnailOptions = {
  width: 1200,
  height: 627, // LinkedIn optimal ratio
  deviceScaleFactor: 2, // Retina quality
  waitTime: 2000,
};

/**
 * Generate a thumbnail from HTML content (for custom layouts)
 */
export async function generateHtmlThumbnail(
  html: string,
  options: ThumbnailOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const browser = await getBrowser();

  let page: Page | null = null;

  try {
    page = await browser.newPage({
      viewport: {
        width: opts.width!,
        height: opts.height!,
      },
      deviceScaleFactor: opts.deviceScaleFactor,
    });

    // Set the HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle',
    });

    // Wait for fonts and images to load
    await page.waitForTimeout(opts.waitTime || 1000);

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
    });

    return screenshot;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Generate a branded lead magnet thumbnail with title overlay
 */
export async function generateBrandedThumbnail(
  title: string,
  subtitle?: string,
  backgroundColor = '#1a1a2e',
  accentColor = '#e94560'
): Promise<Buffer> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: 1200px;
          height: 627px;
          background: ${backgroundColor};
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 60px;
          font-family: 'Inter', sans-serif;
        }
        .container {
          text-align: center;
          max-width: 900px;
        }
        .badge {
          display: inline-block;
          background: ${accentColor};
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 30px;
        }
        h1 {
          color: white;
          font-size: 52px;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 20px;
        }
        .subtitle {
          color: rgba(255, 255, 255, 0.7);
          font-size: 24px;
          font-weight: 400;
        }
        .gradient-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 8px;
          background: linear-gradient(90deg, ${accentColor}, #0f3460);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">Free Resource</div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <div class="gradient-bar"></div>
    </body>
    </html>
  `;

  return generateHtmlThumbnail(html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Cleanup browser instance (call on server shutdown)
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
