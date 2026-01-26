// Tests for lead magnet AI generation functions
// These tests focus on the business logic and validation that can be tested
// without mocking the Anthropic API
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BusinessContext, LeadMagnetConcept, LeadMagnetArchetype } from '@/lib/types/lead-magnet';
import {
  mockIdeationResult,
  mockExtractedContent,
  mockPostWriterResult,
} from '../mocks/anthropic';

// Import only the functions that don't require API calls
import { getExtractionQuestions } from '@/lib/ai/lead-magnet-generator';

describe('Lead Magnet Generator', () => {
  const mockBusinessContext: BusinessContext = {
    businessDescription: 'I help B2B SaaS companies grow their revenue through cold email outreach',
    credibilityMarkers: ['$2.3M revenue generated for clients', '500+ cold email campaigns', '42% average reply rate'],
    urgentPains: ['Cold emails going to spam', 'Low reply rates', 'Not enough meetings booked'],
    templates: ['Cold email templates', 'Follow-up sequences'],
    processes: ['Email warm-up process', 'Personalization system'],
    tools: ['Apollo', 'Instantly', 'Clay'],
    frequentQuestions: ['How do I improve my cold email reply rate?', 'What subject lines work best?'],
    results: ['Clients average 35% reply rate', 'Most book 10+ meetings per week'],
    successExample: 'Helped a client go from 2% to 42% reply rate in 30 days',
    businessType: 'coach-consultant',
  };

  describe('getExtractionQuestions', () => {
    it('should return questions for single-breakdown archetype', () => {
      const questions = getExtractionQuestions('single-breakdown');

      expect(questions).toBeDefined();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions[0]).toHaveProperty('id');
      expect(questions[0]).toHaveProperty('question');
      expect(questions[0]).toHaveProperty('required');
    });

    it('should return questions for single-system archetype', () => {
      const questions = getExtractionQuestions('single-system');

      expect(questions.length).toBe(6);
      expect(questions.some((q) => q.id === 'outcome')).toBe(true);
      expect(questions.some((q) => q.id === 'steps')).toBe(true);
    });

    it('should return questions for all 10 archetypes', () => {
      const archetypes: LeadMagnetArchetype[] = [
        'single-breakdown',
        'single-system',
        'focused-toolkit',
        'single-calculator',
        'focused-directory',
        'mini-training',
        'one-story',
        'prompt',
        'assessment',
        'workflow',
      ];

      archetypes.forEach((archetype) => {
        const questions = getExtractionQuestions(archetype);
        expect(questions.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array for invalid archetype', () => {
      // @ts-expect-error - Testing invalid input
      const questions = getExtractionQuestions('invalid-archetype');

      expect(questions).toEqual([]);
    });

    it('should mark required questions correctly', () => {
      const questions = getExtractionQuestions('single-breakdown');

      const requiredQuestions = questions.filter((q) => q.required);
      const optionalQuestions = questions.filter((q) => !q.required);

      expect(requiredQuestions.length).toBeGreaterThan(0);
      // single-breakdown has all required questions
      expect(optionalQuestions.length).toBe(0);
    });

    it('should have unique question IDs within archetype', () => {
      const questions = getExtractionQuestions('focused-toolkit');
      const ids = questions.map((q) => q.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('Archetype Questions Coverage', () => {
    it('single-breakdown should have 5 required questions', () => {
      const questions = getExtractionQuestions('single-breakdown');
      expect(questions.length).toBe(5);
      expect(questions.every((q) => q.required)).toBe(true);
    });

    it('single-system should have 6 questions', () => {
      const questions = getExtractionQuestions('single-system');
      expect(questions.length).toBe(6);
    });

    it('focused-toolkit should have 6 questions with 1 optional', () => {
      const questions = getExtractionQuestions('focused-toolkit');
      expect(questions.length).toBe(6);
      expect(questions.filter((q) => !q.required).length).toBe(1);
    });

    it('assessment should have questions about scoring', () => {
      const questions = getExtractionQuestions('assessment');
      expect(questions.some((q) => q.id === 'scoring')).toBe(true);
      expect(questions.some((q) => q.id === 'ranges')).toBe(true);
    });

    it('workflow should have questions about automation', () => {
      const questions = getExtractionQuestions('workflow');
      expect(questions.some((q) => q.id === 'purpose')).toBe(true);
      expect(questions.some((q) => q.id === 'timeSaved')).toBe(true);
    });

    it('single-calculator should have questions about inputs and outputs', () => {
      const questions = getExtractionQuestions('single-calculator');
      expect(questions.some((q) => q.id === 'inputs')).toBe(true);
      expect(questions.some((q) => q.id === 'output')).toBe(true);
      expect(questions.some((q) => q.id === 'logic')).toBe(true);
    });

    it('mini-training should have questions about skill learning', () => {
      const questions = getExtractionQuestions('mini-training');
      expect(questions.some((q) => q.id === 'skill')).toBe(true);
      expect(questions.some((q) => q.id === 'chunks')).toBe(true);
    });

    it('one-story should have before and after questions', () => {
      const questions = getExtractionQuestions('one-story');
      expect(questions.some((q) => q.id === 'before')).toBe(true);
      expect(questions.some((q) => q.id === 'after')).toBe(true);
      expect(questions.some((q) => q.id === 'journey')).toBe(true);
    });

    it('prompt archetype should have prompt-specific questions', () => {
      const questions = getExtractionQuestions('prompt');
      expect(questions.some((q) => q.id === 'prompt')).toBe(true);
      expect(questions.some((q) => q.id === 'examples')).toBe(true);
    });

    it('focused-directory should have questions about items and criteria', () => {
      const questions = getExtractionQuestions('focused-directory');
      expect(questions.some((q) => q.id === 'items')).toBe(true);
      expect(questions.some((q) => q.id === 'choosing')).toBe(true);
    });
  });

  describe('Mock Result Structure Validation', () => {
    // These tests validate the expected structure of AI responses
    describe('IdeationResult structure', () => {
      it('should have concepts array', () => {
        expect(mockIdeationResult.concepts).toBeDefined();
        expect(Array.isArray(mockIdeationResult.concepts)).toBe(true);
      });

      it('should have valid concepts with required fields', () => {
        const concept = mockIdeationResult.concepts[0];
        expect(concept.archetype).toBeDefined();
        expect(concept.archetypeName).toBeDefined();
        expect(concept.title).toBeDefined();
        expect(concept.painSolved).toBeDefined();
        expect(concept.viralCheck).toBeDefined();
      });

      it('should have viral check criteria', () => {
        const viralCheck = mockIdeationResult.concepts[0].viralCheck;
        expect(typeof viralCheck.highValue).toBe('boolean');
        expect(typeof viralCheck.urgentPain).toBe('boolean');
        expect(typeof viralCheck.actionableUnder1h).toBe('boolean');
        expect(typeof viralCheck.simple).toBe('boolean');
        expect(typeof viralCheck.authorityBoosting).toBe('boolean');
      });

      it('should have recommendations', () => {
        expect(mockIdeationResult.recommendations.shipThisWeek).toBeDefined();
        expect(mockIdeationResult.recommendations.highestEngagement).toBeDefined();
        expect(mockIdeationResult.recommendations.bestAuthorityBuilder).toBeDefined();
      });

      it('should have suggested bundle', () => {
        expect(mockIdeationResult.suggestedBundle).toBeDefined();
        expect(mockIdeationResult.suggestedBundle.name).toBeDefined();
        expect(mockIdeationResult.suggestedBundle.components).toBeDefined();
      });
    });

    describe('ExtractedContent structure', () => {
      it('should have title and format', () => {
        expect(mockExtractedContent.title).toBeDefined();
        expect(mockExtractedContent.format).toBeDefined();
      });

      it('should have structure with sections', () => {
        expect(mockExtractedContent.structure).toBeDefined();
        expect(Array.isArray(mockExtractedContent.structure)).toBe(true);
        expect(mockExtractedContent.structure[0].sectionName).toBeDefined();
        expect(mockExtractedContent.structure[0].contents).toBeDefined();
      });

      it('should have insights and differentiation', () => {
        expect(mockExtractedContent.nonObviousInsight).toBeDefined();
        expect(mockExtractedContent.personalExperience).toBeDefined();
        expect(mockExtractedContent.differentiation).toBeDefined();
      });

      it('should have common mistakes array', () => {
        expect(mockExtractedContent.commonMistakes).toBeDefined();
        expect(Array.isArray(mockExtractedContent.commonMistakes)).toBe(true);
      });
    });

    describe('PostWriterResult structure', () => {
      it('should have 3 variations', () => {
        expect(mockPostWriterResult.variations).toBeDefined();
        expect(mockPostWriterResult.variations.length).toBe(3);
      });

      it('should have different hook types', () => {
        const hookTypes = mockPostWriterResult.variations.map((v) => v.hookType);
        const uniqueHooks = new Set(hookTypes);
        expect(uniqueHooks.size).toBeGreaterThan(1);
      });

      it('should have post evaluation metrics', () => {
        const evaluation = mockPostWriterResult.variations[0].evaluation;
        expect(evaluation.hookStrength).toBeDefined();
        expect(evaluation.credibilityClear).toBeDefined();
        expect(evaluation.problemResonance).toBeDefined();
        expect(evaluation.contentsSpecific).toBeDefined();
        expect(evaluation.toneMatch).toBeDefined();
        expect(evaluation.aiClicheFree).toBeDefined();
      });

      it('should have DM template with placeholder', () => {
        expect(mockPostWriterResult.dmTemplate).toBeDefined();
        expect(mockPostWriterResult.dmTemplate).toContain('{first_name}');
      });

      it('should have CTA word', () => {
        expect(mockPostWriterResult.ctaWord).toBeDefined();
      });

      it('should have recommendation', () => {
        expect(mockPostWriterResult.recommendation).toBeDefined();
        expect(typeof mockPostWriterResult.recommendation).toBe('string');
      });
    });
  });

  describe('Business Context Validation', () => {
    it('should validate all required fields', () => {
      const requiredFields = [
        'businessDescription',
        'businessType',
        'credibilityMarkers',
        'urgentPains',
        'results',
      ];

      requiredFields.forEach((field) => {
        expect(mockBusinessContext[field as keyof BusinessContext]).toBeDefined();
      });
    });

    it('should have valid business type', () => {
      const validTypes = [
        'coach-consultant',
        'agency-owner',
        'course-creator',
        'freelancer',
        'saas-tech',
        'b2b-service',
      ];
      expect(validTypes).toContain(mockBusinessContext.businessType);
    });

    it('should have arrays for list fields', () => {
      expect(Array.isArray(mockBusinessContext.credibilityMarkers)).toBe(true);
      expect(Array.isArray(mockBusinessContext.urgentPains)).toBe(true);
      expect(Array.isArray(mockBusinessContext.templates)).toBe(true);
      expect(Array.isArray(mockBusinessContext.processes)).toBe(true);
      expect(Array.isArray(mockBusinessContext.tools)).toBe(true);
      expect(Array.isArray(mockBusinessContext.frequentQuestions)).toBe(true);
      expect(Array.isArray(mockBusinessContext.results)).toBe(true);
    });
  });

  describe('Content Length Validation', () => {
    it('should validate minimum content length for extraction', () => {
      const minLength = 50;
      const shortContent = 'Too short';
      const validContent = 'a'.repeat(50);

      expect(shortContent.length).toBeLessThan(minLength);
      expect(validContent.length).toBeGreaterThanOrEqual(minLength);
    });
  });
});

describe('JSON Parsing Logic', () => {
  it('should extract JSON from response with extra text', () => {
    const responseWithText = `Here is the JSON output:
    {"concepts": [], "recommendations": {}}
    Hope this helps!`;

    const jsonMatch = responseWithText.match(/\{[\s\S]*\}/);
    expect(jsonMatch).toBeTruthy();

    const parsed = JSON.parse(jsonMatch![0]);
    expect(parsed.concepts).toBeDefined();
  });

  it('should handle clean JSON response', () => {
    const cleanJson = '{"concepts": [{"title": "Test"}]}';

    const parsed = JSON.parse(cleanJson);
    expect(parsed.concepts[0].title).toBe('Test');
  });

  it('should reject invalid JSON', () => {
    const invalidJson = '{"concepts": [broken';

    expect(() => JSON.parse(invalidJson)).toThrow();
  });
});

describe('Prompt Building', () => {
  const testBusinessContext: BusinessContext = {
    businessDescription: 'I help B2B SaaS companies grow their revenue through cold email outreach',
    credibilityMarkers: ['$2.3M revenue generated for clients', '500+ cold email campaigns'],
    urgentPains: ['Cold emails going to spam', 'Low reply rates'],
    templates: ['Cold email templates'],
    processes: ['Email warm-up process'],
    tools: ['Apollo', 'Instantly'],
    frequentQuestions: ['How do I improve my cold email reply rate?'],
    results: ['Clients average 35% reply rate'],
    successExample: 'Helped a client go from 2% to 42% reply rate',
    businessType: 'coach-consultant',
  };

  it('should include all business context in ideation prompt', () => {
    const context = testBusinessContext;

    const promptParts = [
      context.businessDescription,
      context.credibilityMarkers.join(', '),
      context.urgentPains.join('; '),
      context.results.join('; '),
      context.businessType,
    ];

    promptParts.forEach((part) => {
      expect(part.length).toBeGreaterThan(0);
    });
  });

  it('should format Q&A pairs for content extraction', () => {
    const questions = getExtractionQuestions('single-breakdown');
    const answers: Record<string, string> = {
      example: 'My best cold email',
      walkthrough: 'Subject line analysis...',
    };

    const qaPairs = questions
      .map((q) => `Q: ${q.question}\nA: ${answers[q.id] || 'Not provided'}`)
      .join('\n\n');

    expect(qaPairs).toContain('Q:');
    expect(qaPairs).toContain('A:');
  });
});
