/**
 * @jest-environment node
 */

import type {
  EmailFinderProvider,
  EmailValidatorProvider,
  EmailFinderParams,
} from '@/lib/integrations/enrichment/types';

// Mock the index module so we can control which finders/validators are returned
const mockGetConfiguredFinders = jest.fn<EmailFinderProvider[], []>();
const mockGetValidator = jest.fn<EmailValidatorProvider | null, []>();

jest.mock('@/lib/integrations/enrichment/index', () => ({
  getConfiguredFinders: () => mockGetConfiguredFinders(),
  getValidator: () => mockGetValidator(),
}));

// Import AFTER mocking
import { waterfallEmailFind } from '@/lib/integrations/enrichment/waterfall';

// Helper to create a mock EmailFinderProvider
function createMockFinder(
  name: string,
  findEmailImpl: EmailFinderProvider['findEmail']
): EmailFinderProvider {
  return {
    name,
    findEmail: jest.fn(findEmailImpl),
    isConfigured: jest.fn(() => true),
  };
}

// Helper to create a mock EmailValidatorProvider
function createMockValidator(
  validateImpl: EmailValidatorProvider['validateEmail']
): EmailValidatorProvider {
  return {
    name: 'ZeroBounce',
    validateEmail: jest.fn(validateImpl),
    isConfigured: jest.fn(() => true),
  };
}

const testParams: EmailFinderParams = {
  firstName: 'John',
  lastName: 'Doe',
  domain: 'acme.com',
  linkedinUrl: 'https://linkedin.com/in/johndoe',
};

describe('waterfallEmailFind', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetValidator.mockReturnValue(null); // No validator by default
  });

  describe('provider waterfall logic', () => {
    it('returns email from the first provider when found', async () => {
      const leadmagic = createMockFinder('LeadMagic', async () => ({
        email: 'john@acme.com',
        confidence: 95,
      }));
      const prospeo = createMockFinder('Prospeo', async () => ({
        email: 'john@acme.com',
        confidence: 80,
      }));

      mockGetConfiguredFinders.mockReturnValue([leadmagic, prospeo]);

      const result = await waterfallEmailFind(testParams);

      expect(result.email).toBe('john@acme.com');
      expect(result.provider).toBe('LeadMagic');
      expect(result.confidence).toBe(95);
      expect(result.validated).toBe(false);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]).toEqual({
        provider: 'LeadMagic',
        email: 'john@acme.com',
      });

      // First provider was called
      expect(leadmagic.findEmail).toHaveBeenCalledWith(testParams);
      // Second provider was NOT called (short-circuit)
      expect(prospeo.findEmail).not.toHaveBeenCalled();
    });

    it('falls through to second provider when first returns null', async () => {
      const leadmagic = createMockFinder('LeadMagic', async () => ({
        email: null,
        confidence: 0,
      }));
      const prospeo = createMockFinder('Prospeo', async () => ({
        email: 'john.doe@acme.com',
        confidence: 80,
      }));
      const blitzapi = createMockFinder('BlitzAPI', async () => ({
        email: 'jdoe@acme.com',
        confidence: 70,
      }));

      mockGetConfiguredFinders.mockReturnValue([leadmagic, prospeo, blitzapi]);

      const result = await waterfallEmailFind(testParams);

      expect(result.email).toBe('john.doe@acme.com');
      expect(result.provider).toBe('Prospeo');
      expect(result.confidence).toBe(80);
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0]).toEqual({
        provider: 'LeadMagic',
        email: null,
      });
      expect(result.attempts[1]).toEqual({
        provider: 'Prospeo',
        email: 'john.doe@acme.com',
      });

      expect(leadmagic.findEmail).toHaveBeenCalledTimes(1);
      expect(prospeo.findEmail).toHaveBeenCalledTimes(1);
      // Third provider was NOT called
      expect(blitzapi.findEmail).not.toHaveBeenCalled();
    });

    it('falls through to third provider when first two fail', async () => {
      const leadmagic = createMockFinder('LeadMagic', async () => ({
        email: null,
        confidence: 0,
      }));
      const prospeo = createMockFinder('Prospeo', async () => {
        throw new Error('API rate limited');
      });
      const blitzapi = createMockFinder('BlitzAPI', async () => ({
        email: 'j.doe@acme.com',
        confidence: 60,
      }));

      mockGetConfiguredFinders.mockReturnValue([leadmagic, prospeo, blitzapi]);

      const result = await waterfallEmailFind(testParams);

      expect(result.email).toBe('j.doe@acme.com');
      expect(result.provider).toBe('BlitzAPI');
      expect(result.confidence).toBe(60);
      expect(result.attempts).toHaveLength(3);

      // First: returned null email
      expect(result.attempts[0]).toEqual({
        provider: 'LeadMagic',
        email: null,
      });
      // Second: threw an error
      expect(result.attempts[1]).toEqual({
        provider: 'Prospeo',
        email: null,
        error: 'API rate limited',
      });
      // Third: found the email
      expect(result.attempts[2]).toEqual({
        provider: 'BlitzAPI',
        email: 'j.doe@acme.com',
      });

      expect(leadmagic.findEmail).toHaveBeenCalledTimes(1);
      expect(prospeo.findEmail).toHaveBeenCalledTimes(1);
      expect(blitzapi.findEmail).toHaveBeenCalledTimes(1);
    });

    it('returns null when all providers are exhausted', async () => {
      const leadmagic = createMockFinder('LeadMagic', async () => ({
        email: null,
        confidence: 0,
      }));
      const prospeo = createMockFinder('Prospeo', async () => {
        throw new Error('Timeout');
      });
      const blitzapi = createMockFinder('BlitzAPI', async () => ({
        email: null,
        confidence: 0,
      }));

      mockGetConfiguredFinders.mockReturnValue([leadmagic, prospeo, blitzapi]);

      const result = await waterfallEmailFind(testParams);

      expect(result.email).toBeNull();
      expect(result.provider).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.validated).toBe(false);
      expect(result.attempts).toHaveLength(3);

      expect(result.attempts[0]).toEqual({ provider: 'LeadMagic', email: null });
      expect(result.attempts[1]).toEqual({ provider: 'Prospeo', email: null, error: 'Timeout' });
      expect(result.attempts[2]).toEqual({ provider: 'BlitzAPI', email: null });
    });

    it('returns null when no finders are configured', async () => {
      mockGetConfiguredFinders.mockReturnValue([]);

      const result = await waterfallEmailFind(testParams);

      expect(result.email).toBeNull();
      expect(result.provider).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.attempts).toHaveLength(0);
    });
  });

  describe('ZeroBounce validation', () => {
    it('validates email with ZeroBounce and returns validated result', async () => {
      const finder = createMockFinder('LeadMagic', async () => ({
        email: 'john@acme.com',
        confidence: 95,
      }));
      const validator = createMockValidator(async (email) => ({
        email,
        status: 'valid',
        is_valid: true,
        provider: 'ZeroBounce',
      }));

      mockGetConfiguredFinders.mockReturnValue([finder]);
      mockGetValidator.mockReturnValue(validator);

      const result = await waterfallEmailFind(testParams);

      expect(result.email).toBe('john@acme.com');
      expect(result.provider).toBe('LeadMagic');
      expect(result.validated).toBe(true);
      expect(result.validation_status).toBe('valid');
      expect(result.confidence).toBe(95);
      expect(validator.validateEmail).toHaveBeenCalledWith('john@acme.com');
    });

    it('continues to next provider when validation fails', async () => {
      const leadmagic = createMockFinder('LeadMagic', async () => ({
        email: 'john@acme.com',
        confidence: 95,
      }));
      const prospeo = createMockFinder('Prospeo', async () => ({
        email: 'jdoe@acme.com',
        confidence: 80,
      }));

      const validator = createMockValidator(async (email) => {
        if (email === 'john@acme.com') {
          return {
            email,
            status: 'invalid',
            is_valid: false,
            provider: 'ZeroBounce',
          };
        }
        return {
          email,
          status: 'valid',
          is_valid: true,
          provider: 'ZeroBounce',
        };
      });

      mockGetConfiguredFinders.mockReturnValue([leadmagic, prospeo]);
      mockGetValidator.mockReturnValue(validator);

      const result = await waterfallEmailFind(testParams);

      // Should skip LeadMagic's invalid email and return Prospeo's valid one
      expect(result.email).toBe('jdoe@acme.com');
      expect(result.provider).toBe('Prospeo');
      expect(result.validated).toBe(true);
      expect(result.validation_status).toBe('valid');
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].error).toBe('validation_failed:invalid');
      expect(result.attempts[1].email).toBe('jdoe@acme.com');
    });

    it('returns null when all emails fail validation', async () => {
      const leadmagic = createMockFinder('LeadMagic', async () => ({
        email: 'john@acme.com',
        confidence: 95,
      }));
      const prospeo = createMockFinder('Prospeo', async () => ({
        email: 'jdoe@acme.com',
        confidence: 80,
      }));

      const validator = createMockValidator(async (email) => ({
        email,
        status: 'invalid',
        is_valid: false,
        provider: 'ZeroBounce',
      }));

      mockGetConfiguredFinders.mockReturnValue([leadmagic, prospeo]);
      mockGetValidator.mockReturnValue(validator);

      const result = await waterfallEmailFind(testParams);

      expect(result.email).toBeNull();
      expect(result.provider).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.validated).toBe(false);
      expect(result.validation_status).toBeUndefined();
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].error).toBe('validation_failed:invalid');
      expect(result.attempts[1].error).toBe('validation_failed:invalid');
    });

    it('accepts email without validation when no validator is configured', async () => {
      const finder = createMockFinder('LeadMagic', async () => ({
        email: 'john@acme.com',
        confidence: 90,
      }));

      mockGetConfiguredFinders.mockReturnValue([finder]);
      mockGetValidator.mockReturnValue(null);

      const result = await waterfallEmailFind(testParams);

      expect(result.email).toBe('john@acme.com');
      expect(result.validated).toBe(false);
      expect(result.validation_status).toBeUndefined();
    });
  });

  describe('attempt recording', () => {
    it('records all attempts including errors', async () => {
      const leadmagic = createMockFinder('LeadMagic', async () => {
        throw new Error('Network error');
      });
      const prospeo = createMockFinder('Prospeo', async () => ({
        email: null,
        confidence: 0,
      }));
      const blitzapi = createMockFinder('BlitzAPI', async () => ({
        email: 'john@acme.com',
        confidence: 75,
      }));

      mockGetConfiguredFinders.mockReturnValue([leadmagic, prospeo, blitzapi]);

      const result = await waterfallEmailFind(testParams);

      expect(result.attempts).toHaveLength(3);
      expect(result.attempts).toEqual([
        { provider: 'LeadMagic', email: null, error: 'Network error' },
        { provider: 'Prospeo', email: null },
        { provider: 'BlitzAPI', email: 'john@acme.com' },
      ]);
    });

    it('records non-Error thrown values as strings', async () => {
      const finder = createMockFinder('LeadMagic', async () => {
        throw 'unexpected string error';
      });

      mockGetConfiguredFinders.mockReturnValue([finder]);

      const result = await waterfallEmailFind(testParams);

      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].error).toBe('unexpected string error');
    });

    it('records validation failure errors in attempts', async () => {
      const finder = createMockFinder('LeadMagic', async () => ({
        email: 'john@acme.com',
        confidence: 90,
      }));
      const validator = createMockValidator(async (email) => ({
        email,
        status: 'spamtrap',
        is_valid: false,
        provider: 'ZeroBounce',
      }));

      mockGetConfiguredFinders.mockReturnValue([finder]);
      mockGetValidator.mockReturnValue(validator);

      const result = await waterfallEmailFind(testParams);

      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0]).toEqual({
        provider: 'LeadMagic',
        email: 'john@acme.com',
        error: 'validation_failed:spamtrap',
      });
    });
  });
});
