import { sanitizePixelId, sanitizePartnerId } from '@/components/funnel/public/PixelScripts';

describe('Pixel ID sanitization', () => {
  it('allows numeric pixel IDs', () => {
    expect(sanitizePixelId('1234567890')).toBe('1234567890');
  });

  it('strips non-numeric characters from pixel IDs', () => {
    expect(sanitizePixelId('123<script>alert(1)</script>')).toBe('1231');
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizePixelId('')).toBe('');
    expect(sanitizePixelId(undefined as unknown as string)).toBe('');
  });

  it('allows alphanumeric partner IDs', () => {
    expect(sanitizePartnerId('abc123')).toBe('abc123');
  });

  it('strips injection attempts from partner IDs', () => {
    expect(sanitizePartnerId('abc";alert(1)//')).toBe('abcalert1');
  });
});
