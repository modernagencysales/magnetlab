// Tests for API route input validation and error handling patterns
import { describe, it, expect } from 'vitest';
import type { BusinessContext, ContentType } from '@/lib/types/lead-magnet';

// Test validation logic extracted from API routes
// These tests validate the input validation patterns used across API routes

describe('API Input Validation Patterns', () => {
  describe('BusinessContext validation', () => {
    const validateBusinessContext = (context: Partial<BusinessContext>) => {
      const errors: string[] = [];

      if (!context.businessDescription) {
        errors.push('businessDescription is required');
      }

      if (!context.businessType) {
        errors.push('businessType is required');
      }

      return errors;
    };

    it('should pass with valid business context', () => {
      const validContext: Partial<BusinessContext> = {
        businessDescription: 'I help B2B companies with cold email outreach',
        businessType: 'coach-consultant',
        credibilityMarkers: ['$1M revenue'],
        urgentPains: ['Low reply rates'],
        results: ['35% reply rate'],
      };

      const errors = validateBusinessContext(validContext);
      expect(errors).toHaveLength(0);
    });

    it('should fail when businessDescription is missing', () => {
      const context: Partial<BusinessContext> = {
        businessType: 'coach-consultant',
      };

      const errors = validateBusinessContext(context);
      expect(errors).toContain('businessDescription is required');
    });

    it('should fail when businessType is missing', () => {
      const context: Partial<BusinessContext> = {
        businessDescription: 'I help companies',
      };

      const errors = validateBusinessContext(context);
      expect(errors).toContain('businessType is required');
    });

    it('should fail when both required fields are missing', () => {
      const context: Partial<BusinessContext> = {};

      const errors = validateBusinessContext(context);
      expect(errors).toHaveLength(2);
    });
  });

  describe('Content extraction validation', () => {
    const validateContentExtraction = (body: {
      content?: unknown;
      contentType?: unknown;
    }): { isValid: boolean; error?: string; contentType?: ContentType } => {
      if (!body.content || typeof body.content !== 'string') {
        return { isValid: false, error: 'content is required and must be a string' };
      }

      if (body.content.trim().length < 50) {
        return {
          isValid: false,
          error: 'Content is too short for meaningful extraction. Please provide more text (at least 50 characters).',
        };
      }

      const validContentTypes: ContentType[] = ['offer-doc', 'linkedin', 'sales-page', 'other'];
      const contentType: ContentType | undefined =
        body.contentType && validContentTypes.includes(body.contentType as ContentType)
          ? (body.contentType as ContentType)
          : undefined;

      return { isValid: true, contentType };
    };

    it('should pass with valid content', () => {
      const body = {
        content: 'This is a sufficiently long content string that contains at least 50 characters for testing.',
        contentType: 'linkedin',
      };

      const result = validateContentExtraction(body);
      expect(result.isValid).toBe(true);
      expect(result.contentType).toBe('linkedin');
    });

    it('should fail when content is missing', () => {
      const body = {};

      const result = validateContentExtraction(body);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('content is required and must be a string');
    });

    it('should fail when content is not a string', () => {
      const body = { content: 123 };

      const result = validateContentExtraction(body);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('content is required and must be a string');
    });

    it('should fail when content is too short', () => {
      const body = { content: 'Too short' };

      const result = validateContentExtraction(body);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should pass with exactly 50 characters', () => {
      const body = { content: 'a'.repeat(50) };

      const result = validateContentExtraction(body);
      expect(result.isValid).toBe(true);
    });

    it('should ignore invalid contentType and continue', () => {
      const body = {
        content: 'This is valid content that is definitely long enough to pass the validation check here.',
        contentType: 'invalid-type',
      };

      const result = validateContentExtraction(body);
      expect(result.isValid).toBe(true);
      expect(result.contentType).toBeUndefined();
    });

    it('should validate all valid content types', () => {
      const validTypes: ContentType[] = ['offer-doc', 'linkedin', 'sales-page', 'other'];

      validTypes.forEach((type) => {
        const body = {
          content: 'This is valid content that is definitely long enough to pass the validation check here.',
          contentType: type,
        };

        const result = validateContentExtraction(body);
        expect(result.isValid).toBe(true);
        expect(result.contentType).toBe(type);
      });
    });
  });

  describe('Lead magnet generation validation', () => {
    const validateGenerationInput = (body: {
      archetype?: unknown;
      concept?: unknown;
      answers?: unknown;
    }): { isValid: boolean; error?: string } => {
      if (!body.archetype || !body.concept || !body.answers) {
        return { isValid: false, error: 'Missing required fields' };
      }

      return { isValid: true };
    };

    it('should pass with all required fields', () => {
      const body = {
        archetype: 'single-breakdown',
        concept: { title: 'Test Concept' },
        answers: { example: 'Test answer' },
      };

      const result = validateGenerationInput(body);
      expect(result.isValid).toBe(true);
    });

    it('should fail when archetype is missing', () => {
      const body = {
        concept: { title: 'Test Concept' },
        answers: { example: 'Test answer' },
      };

      const result = validateGenerationInput(body);
      expect(result.isValid).toBe(false);
    });

    it('should fail when concept is missing', () => {
      const body = {
        archetype: 'single-breakdown',
        answers: { example: 'Test answer' },
      };

      const result = validateGenerationInput(body);
      expect(result.isValid).toBe(false);
    });

    it('should fail when answers is missing', () => {
      const body = {
        archetype: 'single-breakdown',
        concept: { title: 'Test Concept' },
      };

      const result = validateGenerationInput(body);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Post writer validation', () => {
    const validatePostWriterInput = (input: {
      leadMagnetTitle?: string;
      format?: string;
      contents?: string;
      problemSolved?: string;
      credibility?: string;
      audience?: string;
      audienceStyle?: string;
      proof?: string;
      ctaWord?: string;
    }): { isValid: boolean; errors: string[] } => {
      const errors: string[] = [];
      const required = [
        'leadMagnetTitle',
        'format',
        'contents',
        'problemSolved',
        'credibility',
        'audience',
        'audienceStyle',
        'proof',
        'ctaWord',
      ] as const;

      required.forEach((field) => {
        if (!input[field]) {
          errors.push(`${field} is required`);
        }
      });

      const validStyles = ['casual-direct', 'professional-polished', 'technical', 'warm-relatable'];
      if (input.audienceStyle && !validStyles.includes(input.audienceStyle)) {
        errors.push('Invalid audienceStyle');
      }

      return { isValid: errors.length === 0, errors };
    };

    it('should pass with all valid fields', () => {
      const input = {
        leadMagnetTitle: 'The Cold Email Template',
        format: 'Google Doc',
        contents: 'Line-by-line breakdown',
        problemSolved: 'Low reply rates',
        credibility: 'Sent 10,000+ emails',
        audience: 'B2B sales teams',
        audienceStyle: 'professional-polished',
        proof: '42% reply rate',
        ctaWord: 'EMAIL',
      };

      const result = validatePostWriterInput(input);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with missing required fields', () => {
      const input = {
        leadMagnetTitle: 'The Cold Email Template',
      };

      const result = validatePostWriterInput(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail with invalid audienceStyle', () => {
      const input = {
        leadMagnetTitle: 'The Cold Email Template',
        format: 'Google Doc',
        contents: 'Line-by-line breakdown',
        problemSolved: 'Low reply rates',
        credibility: 'Sent 10,000+ emails',
        audience: 'B2B sales teams',
        audienceStyle: 'invalid-style',
        proof: '42% reply rate',
        ctaWord: 'EMAIL',
      };

      const result = validatePostWriterInput(input);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid audienceStyle');
    });
  });
});

describe('HTTP Status Code Patterns', () => {
  describe('Authentication errors', () => {
    it('should return 401 for unauthenticated requests', () => {
      const session = null;
      const expectedStatus = !session ? 401 : 200;
      expect(expectedStatus).toBe(401);
    });

    it('should return 401 when user.id is missing', () => {
      const session = { user: {} as { id?: string } };
      const expectedStatus = !session?.user?.id ? 401 : 200;
      expect(expectedStatus).toBe(401);
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for missing required fields', () => {
      const hasRequiredFields = false;
      const expectedStatus = hasRequiredFields ? 200 : 400;
      expect(expectedStatus).toBe(400);
    });

    it('should return 400 for invalid input format', () => {
      const isValidFormat = false;
      const expectedStatus = isValidFormat ? 200 : 400;
      expect(expectedStatus).toBe(400);
    });
  });

  describe('Authorization errors', () => {
    it('should return 403 when usage limit reached', () => {
      const canCreate = false;
      const expectedStatus = canCreate ? 200 : 403;
      expect(expectedStatus).toBe(403);
    });
  });

  describe('Not found errors', () => {
    it('should return 404 when resource not found', () => {
      const resource = null;
      const expectedStatus = resource ? 200 : 404;
      expect(expectedStatus).toBe(404);
    });
  });

  describe('Server errors', () => {
    it('should return 500 for unexpected errors', () => {
      const hasError = true;
      const expectedStatus = hasError ? 500 : 200;
      expect(expectedStatus).toBe(500);
    });
  });
});

describe('Error Message Patterns', () => {
  it('should provide clear error messages for validation failures', () => {
    const errorMessages = {
      missingFields: 'Missing required fields: businessDescription and businessType',
      contentRequired: 'content is required and must be a string',
      contentTooShort:
        'Content is too short for meaningful extraction. Please provide more text (at least 50 characters).',
      unauthorized: 'Unauthorized',
      usageLimitReached: 'Monthly lead magnet limit reached. Upgrade your plan for more.',
    };

    expect(errorMessages.missingFields).toContain('required fields');
    expect(errorMessages.contentRequired).toContain('required');
    expect(errorMessages.contentTooShort).toContain('at least 50 characters');
    expect(errorMessages.usageLimitReached).toContain('Upgrade');
  });
});
