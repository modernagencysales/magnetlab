/**
 * @jest-environment node
 *
 * Tests for MOD-332: Imgur links and other non-direct image URLs
 * should be normalized to direct image URLs before storage.
 *
 * Root cause: Users paste Imgur gallery page URLs (https://imgur.com/abc123)
 * instead of direct image URLs (https://i.imgur.com/abc123.jpg).
 * Gallery URLs return HTML, not images, causing <img> tags to silently fail.
 *
 * The fix needs a normalizeImageUrl() utility that transforms common
 * image hosting URLs to their direct-image equivalents.
 */

import { updateFunnelSchema, sectionConfigSchemas } from '@/lib/validations/api';
import { normalizeImageUrl, normalizeSectionConfigImageUrls } from '@/lib/utils/normalize-image-url';

describe('MOD-332: Image URL normalization for external image hosts', () => {
  describe('normalizeImageUrl', () => {
    // -----------------------------------------------------------
    // Imgur URL normalization
    // -----------------------------------------------------------
    describe('Imgur URLs', () => {
      it('should convert imgur.com gallery URL to direct i.imgur.com image URL', () => {
        const input = 'https://imgur.com/abc1234';
        const result = normalizeImageUrl(input);
        expect(result).toBe('https://i.imgur.com/abc1234.jpg');
      });

      it('should convert www.imgur.com gallery URL to direct image URL', () => {
        const input = 'https://www.imgur.com/abc1234';
        const result = normalizeImageUrl(input);
        expect(result).toBe('https://i.imgur.com/abc1234.jpg');
      });

      it('should leave i.imgur.com direct URLs unchanged', () => {
        const input = 'https://i.imgur.com/abc1234.jpg';
        expect(normalizeImageUrl(input)).toBe('https://i.imgur.com/abc1234.jpg');
      });

      it('should leave i.imgur.com PNG URLs unchanged', () => {
        const input = 'https://i.imgur.com/abc1234.png';
        expect(normalizeImageUrl(input)).toBe('https://i.imgur.com/abc1234.png');
      });

      it('should leave i.imgur.com GIF URLs unchanged', () => {
        const input = 'https://i.imgur.com/abc1234.gif';
        expect(normalizeImageUrl(input)).toBe('https://i.imgur.com/abc1234.gif');
      });

      it('should leave i.imgur.com WebP URLs unchanged', () => {
        const input = 'https://i.imgur.com/abc1234.webp';
        expect(normalizeImageUrl(input)).toBe('https://i.imgur.com/abc1234.webp');
      });

      it('should handle i.imgur.com URLs without extension by adding .jpg', () => {
        const input = 'https://i.imgur.com/abc1234';
        const result = normalizeImageUrl(input);
        expect(result).toBe('https://i.imgur.com/abc1234.jpg');
      });

      it('should NOT convert imgur album URLs (cannot resolve to single image)', () => {
        const input = 'https://imgur.com/a/abc1234';
        // Album URLs should pass through unchanged — they can't be auto-resolved
        expect(normalizeImageUrl(input)).toBe(input);
      });

      it('should NOT convert imgur gallery URLs (cannot resolve to single image)', () => {
        const input = 'https://imgur.com/gallery/abc1234';
        expect(normalizeImageUrl(input)).toBe(input);
      });

      it('should handle HTTP imgur URLs by upgrading to HTTPS', () => {
        const input = 'http://imgur.com/abc1234';
        const result = normalizeImageUrl(input);
        expect(result).toBe('https://i.imgur.com/abc1234.jpg');
      });
    });

    // -----------------------------------------------------------
    // Non-Imgur URLs should pass through unchanged
    // -----------------------------------------------------------
    describe('non-Imgur URLs', () => {
      it('should leave Supabase storage URLs unchanged', () => {
        const input = 'https://xyz.supabase.co/storage/v1/object/public/logos/mylogo.png';
        expect(normalizeImageUrl(input)).toBe(input);
      });

      it('should leave direct image URLs from other hosts unchanged', () => {
        const input = 'https://example.com/images/logo.png';
        expect(normalizeImageUrl(input)).toBe(input);
      });

      it('should leave Google user content URLs unchanged', () => {
        const input = 'https://lh3.googleusercontent.com/a/photo123';
        expect(normalizeImageUrl(input)).toBe(input);
      });

      it('should leave LinkedIn media URLs unchanged', () => {
        const input = 'https://media.licdn.com/dms/image/v2/photo.jpg';
        expect(normalizeImageUrl(input)).toBe(input);
      });
    });

    // -----------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------
    describe('edge cases', () => {
      it('should handle empty string', () => {
        expect(normalizeImageUrl('')).toBe('');
      });

      it('should handle URLs with query parameters', () => {
        const input = 'https://imgur.com/abc1234?ref=share';
        const result = normalizeImageUrl(input);
        expect(result).toBe('https://i.imgur.com/abc1234.jpg');
      });

      it('should handle URLs with trailing slash', () => {
        const input = 'https://imgur.com/abc1234/';
        const result = normalizeImageUrl(input);
        expect(result).toBe('https://i.imgur.com/abc1234.jpg');
      });
    });
  });

  // ============================================================
  // Schema validation: Imgur URLs should be accepted
  // ============================================================
  describe('Zod schema acceptance of Imgur URLs', () => {
    it('updateFunnelSchema should accept direct Imgur image URL as logoUrl', () => {
      const result = updateFunnelSchema.safeParse({
        logoUrl: 'https://i.imgur.com/abc1234.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('updateFunnelSchema should accept Imgur gallery URL as logoUrl (valid URL format)', () => {
      // The gallery URL IS a valid URL, so Zod accepts it.
      // The problem is that it doesn't point to an image.
      const result = updateFunnelSchema.safeParse({
        logoUrl: 'https://imgur.com/abc1234',
      });
      expect(result.success).toBe(true);
    });

    it('logo_bar schema should accept direct Imgur image URLs', () => {
      const schema = sectionConfigSchemas.logo_bar;
      const result = schema.safeParse({
        logos: [
          { name: 'Partner Logo', imageUrl: 'https://i.imgur.com/abc1234.png' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('logo_bar schema should accept Imgur gallery URLs (valid URL format)', () => {
      // Gallery URLs pass Zod validation but won't render as images
      const schema = sectionConfigSchemas.logo_bar;
      const result = schema.safeParse({
        logos: [
          { name: 'Partner Logo', imageUrl: 'https://imgur.com/abc1234' },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // normalizeSectionConfigImageUrls
  // ============================================================
  describe('normalizeSectionConfigImageUrls', () => {
    it('should normalize imageUrls in logo_bar config', () => {
      const config = {
        logos: [
          { name: 'Partner A', imageUrl: 'https://imgur.com/abc1234' },
          { name: 'Partner B', imageUrl: 'https://i.imgur.com/def5678.png' },
          { name: 'Partner C', imageUrl: 'https://example.com/logo.svg' },
        ],
      };
      const result = normalizeSectionConfigImageUrls('logo_bar', config);
      expect(result).toEqual({
        logos: [
          { name: 'Partner A', imageUrl: 'https://i.imgur.com/abc1234.jpg' },
          { name: 'Partner B', imageUrl: 'https://i.imgur.com/def5678.png' },
          { name: 'Partner C', imageUrl: 'https://example.com/logo.svg' },
        ],
      });
    });

    it('should normalize imageUrl in marketing_block config', () => {
      const config = {
        blockType: 'feature',
        title: 'Test',
        imageUrl: 'https://imgur.com/xyz9876',
      };
      const result = normalizeSectionConfigImageUrls('marketing_block', config);
      expect(result).toEqual({
        blockType: 'feature',
        title: 'Test',
        imageUrl: 'https://i.imgur.com/xyz9876.jpg',
      });
    });

    it('should pass through non-image section configs unchanged', () => {
      const config = { quote: 'Great product!', author: 'Jane' };
      const result = normalizeSectionConfigImageUrls('testimonial', config);
      expect(result).toEqual(config);
    });

    it('should handle logo_bar with empty logos array', () => {
      const config = { logos: [] };
      const result = normalizeSectionConfigImageUrls('logo_bar', config);
      expect(result).toEqual({ logos: [] });
    });
  });
});
