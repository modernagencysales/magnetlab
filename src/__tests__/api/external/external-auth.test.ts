/**
 * @jest-environment node
 */

import { authenticateExternalRequest } from '@/lib/api/external-auth';

describe('authenticateExternalRequest', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, EXTERNAL_API_KEY: 'test-secret-key-123' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns true for valid Bearer token', () => {
    const request = new Request('http://localhost/api/external/test', {
      headers: { Authorization: 'Bearer test-secret-key-123' },
    });
    expect(authenticateExternalRequest(request)).toBe(true);
  });

  it('returns false for missing Authorization header', () => {
    const request = new Request('http://localhost/api/external/test');
    expect(authenticateExternalRequest(request)).toBe(false);
  });

  it('returns false for non-Bearer auth scheme', () => {
    const request = new Request('http://localhost/api/external/test', {
      headers: { Authorization: 'Basic abc123' },
    });
    expect(authenticateExternalRequest(request)).toBe(false);
  });

  it('returns false for wrong token', () => {
    const request = new Request('http://localhost/api/external/test', {
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(authenticateExternalRequest(request)).toBe(false);
  });

  it('returns false for different length token', () => {
    const request = new Request('http://localhost/api/external/test', {
      headers: { Authorization: 'Bearer short' },
    });
    expect(authenticateExternalRequest(request)).toBe(false);
  });

  it('returns false when EXTERNAL_API_KEY env var is not set', () => {
    delete process.env.EXTERNAL_API_KEY;
    const request = new Request('http://localhost/api/external/test', {
      headers: { Authorization: 'Bearer test-secret-key-123' },
    });
    expect(authenticateExternalRequest(request)).toBe(false);
  });

  it('returns false for empty Bearer token', () => {
    const request = new Request('http://localhost/api/external/test', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(authenticateExternalRequest(request)).toBe(false);
  });
});
