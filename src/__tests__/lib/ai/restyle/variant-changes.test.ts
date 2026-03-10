/**
 * @jest-environment node
 */
import { parseRestylePlan, buildRestylePrompt } from '@/lib/ai/restyle/plan-generator';

describe('RestylePlan variant changes', () => {
  describe('parseRestylePlan', () => {
    it('should parse sectionVariantChanges from AI response', () => {
      const json = JSON.stringify({
        styleDirection: 'Modern Grid',
        reasoning: 'Grid layouts feel more modern and structured',
        changes: [],
        sectionChanges: [],
        sectionVariantChanges: [
          {
            sectionId: 'section-abc-123',
            fromVariant: 'inline',
            toVariant: 'grid',
            reason: 'Grid layout better suits the corporate feel',
          },
          {
            sectionId: 'section-def-456',
            fromVariant: 'numbered',
            toVariant: 'timeline',
            reason: 'Timeline feels more modern',
          },
        ],
      });

      const plan = parseRestylePlan(json);
      expect(plan.sectionVariantChanges).toHaveLength(2);
      expect(plan.sectionVariantChanges![0]).toEqual({
        sectionId: 'section-abc-123',
        fromVariant: 'inline',
        toVariant: 'grid',
        reason: 'Grid layout better suits the corporate feel',
      });
      expect(plan.sectionVariantChanges![1].sectionId).toBe('section-def-456');
      expect(plan.sectionVariantChanges![1].toVariant).toBe('timeline');
    });

    it('should default sectionVariantChanges to empty array when missing', () => {
      const json = JSON.stringify({
        styleDirection: 'Minimal',
        reasoning: 'Clean and minimal',
        changes: [],
        sectionChanges: [],
      });

      const plan = parseRestylePlan(json);
      expect(plan.sectionVariantChanges).toEqual([]);
    });

    it('should filter out variant changes with missing sectionId', () => {
      const json = JSON.stringify({
        styleDirection: 'Test',
        reasoning: 'Test',
        changes: [],
        sectionChanges: [],
        sectionVariantChanges: [
          { sectionId: 'valid-id', fromVariant: 'inline', toVariant: 'grid', reason: 'ok' },
          { fromVariant: 'inline', toVariant: 'grid', reason: 'missing sectionId' },
        ],
      });

      const plan = parseRestylePlan(json);
      expect(plan.sectionVariantChanges).toHaveLength(1);
      expect(plan.sectionVariantChanges![0].sectionId).toBe('valid-id');
    });

    it('should filter out variant changes with missing toVariant', () => {
      const json = JSON.stringify({
        styleDirection: 'Test',
        reasoning: 'Test',
        changes: [],
        sectionChanges: [],
        sectionVariantChanges: [
          { sectionId: 'id-1', fromVariant: 'inline', toVariant: 'grid', reason: 'ok' },
          { sectionId: 'id-2', fromVariant: 'inline', reason: 'missing toVariant' },
        ],
      });

      const plan = parseRestylePlan(json);
      expect(plan.sectionVariantChanges).toHaveLength(1);
    });

    it('should filter out variant changes with missing reason', () => {
      const json = JSON.stringify({
        styleDirection: 'Test',
        reasoning: 'Test',
        changes: [],
        sectionChanges: [],
        sectionVariantChanges: [
          { sectionId: 'id-1', fromVariant: 'inline', toVariant: 'grid', reason: 'ok' },
          { sectionId: 'id-2', fromVariant: 'inline', toVariant: 'grid' },
        ],
      });

      const plan = parseRestylePlan(json);
      expect(plan.sectionVariantChanges).toHaveLength(1);
    });
  });

  describe('buildRestylePrompt', () => {
    it('should include available section variants in system message', () => {
      const result = buildRestylePrompt({
        stylePrompt: 'make it modern',
        currentFunnel: {
          theme: 'dark',
          primaryColor: '#8b5cf6',
          backgroundStyle: 'solid',
          fontFamily: null,
          fontUrl: null,
          logoUrl: null,
        },
        currentSections: [],
      });

      expect(result.systemMessage).toContain('Available Section Variants');
      expect(result.systemMessage).toContain('logo_bar: inline, grid');
      expect(result.systemMessage).toContain('steps: numbered, timeline, icon-cards');
      expect(result.systemMessage).toContain('testimonial: quote-card, highlight, avatar');
      expect(result.systemMessage).toContain('sectionVariantChanges');
    });
  });
});
