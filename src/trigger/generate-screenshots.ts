import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

interface ScreenshotPayload {
  pageUrl: string;
  sectionCount: number;
  userId: string;
  leadMagnetId: string;
  polishedSectionNames?: string[];
}

interface ScreenshotUrl {
  type: 'hero' | 'section';
  sectionIndex?: number;
  sectionName?: string;
  url1080x1080: string;
}

const SCREENSHOT_API_BASE = 'https://api.screenshotone.com/take';

async function captureScreenshot(
  accessKey: string,
  pageUrl: string,
  width: number,
  height: number
): Promise<Buffer> {
  const params = new URLSearchParams({
    access_key: accessKey,
    url: pageUrl,
    viewport_width: String(width),
    viewport_height: String(height),
    format: 'png',
    image_quality: '100',
    delay: '3',
    wait_until: 'load',
  });

  // Retry up to 3 times on transient errors
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      logger.info(`Retry attempt ${attempt + 1} for ${width}x${height}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }

    const response = await fetch(`${SCREENSHOT_API_BASE}?${params.toString()}`);

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const text = await response.text().catch(() => 'Unknown error');
    lastError = new Error(`ScreenshotOne (${response.status}): ${text}`);

    if (response.status !== 500 && response.status !== 503 && response.status !== 429) {
      throw lastError;
    }
  }

  throw lastError!;
}

export const generateScreenshots = task({
  id: 'generate-screenshots',
  retry: { maxAttempts: 2 },
  run: async (payload: ScreenshotPayload) => {
    const { pageUrl, sectionCount, userId, leadMagnetId, polishedSectionNames } = payload;

    const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
    if (!accessKey) {
      throw new Error('SCREENSHOTONE_ACCESS_KEY env var not set');
    }

    const supabase = createSupabaseAdminClient();
    const screenshotUrls: ScreenshotUrl[] = [];

    // Hero shot (square only — optimized for social media)
    logger.info('Capturing hero screenshot', { pageUrl });
    const hero1080 = await captureScreenshot(accessKey, pageUrl, 1080, 1080);

    const heroUrl = await uploadScreenshot(supabase, userId, leadMagnetId, 'hero', hero1080);
    screenshotUrls.push({ type: 'hero', url1080x1080: heroUrl });

    // Section shots are skipped for now — hero is the primary use case
    // Sections would need full_page + clip_y which adds complexity
    for (let i = 0; i < Math.min(sectionCount, 3); i++) {
      const sectionName = polishedSectionNames?.[i] || `Section ${i + 1}`;
      logger.info(`Skipping section ${i} (${sectionName}) — hero-only for now`);
    }

    // Save screenshot URLs to lead_magnets table
    const { error: updateError } = await supabase
      .from('lead_magnets')
      .update({ screenshot_urls: screenshotUrls })
      .eq('id', leadMagnetId);

    if (updateError) {
      throw new Error(`Failed to save screenshot URLs: ${updateError.message}`);
    }

    logger.info('Screenshots generated and saved', { count: screenshotUrls.length });
    return { screenshotUrls };
  },
});

async function uploadScreenshot(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  leadMagnetId: string,
  prefix: string,
  buffer: Uint8Array
): Promise<string> {
  const path = `screenshots/${userId}/${leadMagnetId}/${prefix}-1080x1080.png`;

  const { error } = await supabase.storage
    .from('magnetlab')
    .upload(path, buffer, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Upload failed (${path}): ${error.message}`);

  const { data } = supabase.storage.from('magnetlab').getPublicUrl(path);
  return data.publicUrl;
}
