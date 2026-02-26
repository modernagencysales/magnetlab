/**
 * Normalizes image hosting URLs to their direct-image equivalents.
 *
 * Problem: Users paste gallery/page URLs (e.g., https://imgur.com/abc123)
 * instead of direct image URLs (https://i.imgur.com/abc123.jpg).
 * Gallery URLs return HTML, so <img src="..."> silently fails.
 *
 * This utility converts common patterns to direct image URLs.
 */

const IMGUR_SINGLE_IMAGE_RE =
  /^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]{5,10})\/?(?:\?.*)?$/;

const IMGUR_DIRECT_RE =
  /^https?:\/\/i\.imgur\.com\/([a-zA-Z0-9]+)(\.[a-zA-Z]+)?$/;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']);

/**
 * Converts common image hosting URLs to direct-image URLs.
 *
 * Supported transformations:
 * - `https://imgur.com/abc1234`       → `https://i.imgur.com/abc1234.jpg`
 * - `https://www.imgur.com/abc1234`   → `https://i.imgur.com/abc1234.jpg`
 * - `https://i.imgur.com/abc1234`     → `https://i.imgur.com/abc1234.jpg` (adds extension)
 * - `https://imgur.com/a/...`         → unchanged (album, can't resolve)
 * - `https://imgur.com/gallery/...`   → unchanged (gallery, can't resolve)
 * - Any non-Imgur URL                 → unchanged
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return url;

  // Check for Imgur gallery page URL (imgur.com/ID, not /a/ or /gallery/)
  const singleMatch = url.match(IMGUR_SINGLE_IMAGE_RE);
  if (singleMatch) {
    const imageId = singleMatch[1];
    return `https://i.imgur.com/${imageId}.jpg`;
  }

  // Check for i.imgur.com URL without extension
  const directMatch = url.match(IMGUR_DIRECT_RE);
  if (directMatch) {
    const imageId = directMatch[1];
    const ext = directMatch[2];
    if (!ext || !IMAGE_EXTENSIONS.has(ext.toLowerCase())) {
      return `https://i.imgur.com/${imageId}.jpg`;
    }
    // Already has a valid image extension — return as-is
    return url;
  }

  return url;
}

/**
 * Normalizes image URLs within a section config object.
 * Handles logo_bar (array of logos) and marketing_block (single imageUrl).
 */
export function normalizeSectionConfigImageUrls(
  sectionType: string,
  config: Record<string, unknown>
): Record<string, unknown> {
  if (sectionType === 'logo_bar' && Array.isArray(config.logos)) {
    return {
      ...config,
      logos: config.logos.map((logo: { name: string; imageUrl: string }) => ({
        ...logo,
        imageUrl: normalizeImageUrl(logo.imageUrl),
      })),
    };
  }

  if (sectionType === 'marketing_block' && typeof config.imageUrl === 'string') {
    return {
      ...config,
      imageUrl: normalizeImageUrl(config.imageUrl),
    };
  }

  return config;
}
