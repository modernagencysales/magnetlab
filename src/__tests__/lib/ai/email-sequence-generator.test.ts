/**
 * @jest-environment node
 */

import { generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';

describe('generateDefaultEmailSequence', () => {
  it('uses [DOWNLOAD LINK] placeholder when no resourceUrl provided', () => {
    const emails = generateDefaultEmailSequence('Test Lead Magnet', 'John');
    const email1 = emails.find((e) => e.day === 0);
    expect(email1).toBeDefined();
    expect(email1!.body).toContain('[DOWNLOAD LINK]');
    expect(email1!.body).not.toContain('https://');
  });

  it('replaces [DOWNLOAD LINK] with actual URL when resourceUrl provided', () => {
    const url = 'https://www.magnetlab.app/p/john/test-slug/content';
    const emails = generateDefaultEmailSequence('Test Lead Magnet', 'John', url);
    const email1 = emails.find((e) => e.day === 0);
    expect(email1).toBeDefined();
    expect(email1!.body).not.toContain('[DOWNLOAD LINK]');
    expect(email1!.body).toContain(url);
  });

  it('returns 5 emails with correct days', () => {
    const emails = generateDefaultEmailSequence('Test', 'Jane');
    expect(emails).toHaveLength(5);
    expect(emails.map((e) => e.day)).toEqual([0, 1, 2, 3, 4]);
  });

  it('uses external URL when provided as resourceUrl', () => {
    const externalUrl = 'https://notion.so/my-resource';
    const emails = generateDefaultEmailSequence('Test', 'Jane', externalUrl);
    const email1 = emails.find((e) => e.day === 0);
    expect(email1!.body).toContain(externalUrl);
  });
});
