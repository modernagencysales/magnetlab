/**
 * @jest-environment node
 */
import { hashApiKey, generateApiKey } from '@/lib/auth/api-key';

describe('API Key utilities', () => {
  describe('generateApiKey', () => {
    it('should return a key starting with ml_live_', () => {
      const { rawKey } = generateApiKey();
      expect(rawKey).toMatch(/^ml_live_/);
    });

    it('should return a hash and prefix', () => {
      const { rawKey, keyHash, keyPrefix } = generateApiKey();
      expect(keyHash).toBeTruthy();
      expect(keyPrefix).toBe(rawKey.slice(-4));
    });
  });

  describe('hashApiKey', () => {
    it('should produce consistent hashes', () => {
      const hash1 = hashApiKey('test-key');
      const hash2 = hashApiKey('test-key');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key-1');
      const hash2 = hashApiKey('key-2');
      expect(hash1).not.toBe(hash2);
    });
  });
});
