import { buildIClosedUrl, normalizePhone } from '@/lib/utils/iclosed-helpers';

describe('normalizePhone', () => {
  it('returns undefined for empty input', () => {
    expect(normalizePhone(undefined)).toBeUndefined();
    expect(normalizePhone('')).toBeUndefined();
  });

  it('passes through numbers with + prefix', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671');
  });

  it('prepends +1 to 10-digit US numbers', () => {
    expect(normalizePhone('4155552671')).toBe('+14155552671');
  });

  it('prepends + to 11-digit numbers starting with 1', () => {
    expect(normalizePhone('14155552671')).toBe('+14155552671');
  });

  it('strips non-digit characters', () => {
    expect(normalizePhone('(415) 555-2671')).toBe('+14155552671');
  });
});

describe('buildIClosedUrl', () => {
  const baseUrl = 'https://app.iclosed.io/e/timkeen/li-growth';

  it('returns empty string for empty url', () => {
    expect(buildIClosedUrl('')).toBe('');
  });

  it('returns base url when no options', () => {
    expect(buildIClosedUrl(baseUrl)).toBe(baseUrl);
  });

  it('adds lead name and email', () => {
    const url = buildIClosedUrl(baseUrl, {
      leadName: 'John Doe',
      leadEmail: 'john@example.com',
    });
    expect(url).toContain('iclosedName=John+Doe');
    expect(url).toContain('iclosedEmail=john%40example.com');
  });

  it('adds phone in E.164 format', () => {
    const url = buildIClosedUrl(baseUrl, { leadPhone: '4155552671' });
    expect(url).toContain('iclosedPhone=%2B14155552671');
  });

  it('adds survey answers as custom fields', () => {
    const url = buildIClosedUrl(baseUrl, {
      surveyAnswers: { monthlyrevenue: '$50k-$100k', businesstype: 'Agency' },
    });
    expect(url).toContain('monthlyrevenue=');
    expect(url).toContain('businesstype=Agency');
  });

  it('combines all params', () => {
    const url = buildIClosedUrl(baseUrl, {
      leadName: 'Jane',
      leadEmail: 'jane@co.com',
      leadPhone: '+14155550000',
      surveyAnswers: { businesstype: 'SaaS' },
    });
    expect(url).toContain('iclosedName=Jane');
    expect(url).toContain('iclosedEmail=');
    expect(url).toContain('iclosedPhone=');
    expect(url).toContain('businesstype=SaaS');
  });

  it('handles invalid URLs gracefully', () => {
    expect(buildIClosedUrl('not-a-url', { leadName: 'Test' })).toBe('not-a-url');
  });
});
