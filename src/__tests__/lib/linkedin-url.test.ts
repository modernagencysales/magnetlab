/**
 * @jest-environment node
 */
import { normalizePostUrl, extractLinkedInUsername } from '@/lib/utils/linkedin-url';

describe('normalizePostUrl', () => {
  it('normalizes feed/update URL', () => {
    expect(
      normalizePostUrl('https://www.linkedin.com/feed/update/urn:li:activity:7123456789')
    ).toBe('urn:li:activity:7123456789');
  });

  it('normalizes posts/username URL', () => {
    expect(
      normalizePostUrl(
        'https://www.linkedin.com/posts/timkeen_gtm-now-runs-activity-7123456789-abcd'
      )
    ).toBe('urn:li:activity:7123456789');
  });

  it('normalizes URL without www', () => {
    expect(normalizePostUrl('https://linkedin.com/feed/update/urn:li:activity:7123456789')).toBe(
      'urn:li:activity:7123456789'
    );
  });

  it('handles URL with query params', () => {
    expect(
      normalizePostUrl(
        'https://www.linkedin.com/feed/update/urn:li:activity:7123456789?utm_source=share'
      )
    ).toBe('urn:li:activity:7123456789');
  });

  it('returns raw URN if already normalized', () => {
    expect(normalizePostUrl('urn:li:activity:7123456789')).toBe('urn:li:activity:7123456789');
  });

  it('returns null for non-LinkedIn URLs', () => {
    expect(normalizePostUrl('https://example.com/post/123')).toBeNull();
  });
});

describe('extractLinkedInUsername', () => {
  it('extracts username from full URL', () => {
    expect(extractLinkedInUsername('https://www.linkedin.com/in/vladtiminski')).toBe(
      'vladtiminski'
    );
  });

  it('extracts username with trailing slash', () => {
    expect(extractLinkedInUsername('https://www.linkedin.com/in/vladtiminski/')).toBe(
      'vladtiminski'
    );
  });

  it('handles URL without www', () => {
    expect(extractLinkedInUsername('https://linkedin.com/in/vladtiminski')).toBe('vladtiminski');
  });

  it('returns null for non-profile URLs', () => {
    expect(extractLinkedInUsername('https://www.linkedin.com/company/magnetlab')).toBeNull();
  });
});
