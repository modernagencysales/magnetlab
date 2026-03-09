/**
 * @jest-environment node
 */
import { buildRestylePrompt, buildVisionPrompt, parseRestylePlan } from '@/lib/ai/restyle/plan-generator';

describe('plan-generator', () => {
  describe('buildRestylePrompt', () => {
    it('should include the style prompt in the user message', () => {
      const result = buildRestylePrompt({
        stylePrompt: 'make it more corporate',
        currentFunnel: {
          theme: 'dark', primaryColor: '#8b5cf6', backgroundStyle: 'solid',
          fontFamily: null, fontUrl: null, logoUrl: null,
        },
        currentSections: [],
      });
      expect(result.userMessage).toContain('make it more corporate');
      expect(result.systemMessage).toContain('theme');
    });

    it('should include vision analysis when provided', () => {
      const result = buildRestylePrompt({
        stylePrompt: 'like this',
        currentFunnel: {
          theme: 'dark', primaryColor: '#8b5cf6', backgroundStyle: 'solid',
          fontFamily: null, fontUrl: null, logoUrl: null,
        },
        currentSections: [],
        visionAnalysis: 'Navy palette, serif fonts',
      });
      expect(result.userMessage).toContain('Navy palette, serif fonts');
    });

    it('should include current sections in system message', () => {
      const result = buildRestylePrompt({
        stylePrompt: 'minimal',
        currentFunnel: {
          theme: 'dark', primaryColor: '#8b5cf6', backgroundStyle: 'solid',
          fontFamily: 'Inter', fontUrl: null, logoUrl: null,
        },
        currentSections: [{ sectionType: 'logo_bar', pageLocation: 'optin', sortOrder: 0 }],
      });
      expect(result.systemMessage).toContain('logo_bar');
      expect(result.systemMessage).toContain('Inter');
    });
  });

  describe('buildVisionPrompt', () => {
    it('should return a prompt string mentioning key analysis areas', () => {
      const prompt = buildVisionPrompt();
      expect(prompt).toContain('Color palette');
      expect(prompt).toContain('Typography');
      expect(prompt).toContain('Layout density');
      expect(prompt).toContain('Visual tone');
      expect(prompt).toContain('Section patterns');
    });
  });

  describe('parseRestylePlan', () => {
    it('should parse valid JSON into a RestylePlan', () => {
      const json = JSON.stringify({
        styleDirection: 'Corporate',
        reasoning: 'Navy palette conveys trust',
        changes: [
          { field: 'primaryColor', from: '#8b5cf6', to: '#1e3a5f', reason: 'Navy is professional' },
        ],
        sectionChanges: [],
      });
      const plan = parseRestylePlan(json);
      expect(plan.styleDirection).toBe('Corporate');
      expect(plan.changes).toHaveLength(1);
      expect(plan.changes[0].field).toBe('primaryColor');
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseRestylePlan('not json')).toThrow();
    });

    it('should filter out changes with invalid fields', () => {
      const json = JSON.stringify({
        styleDirection: 'Test',
        reasoning: 'Test',
        changes: [
          { field: 'primaryColor', from: '#000', to: '#fff', reason: 'ok' },
          { field: 'invalidField', from: 'a', to: 'b', reason: 'bad' },
        ],
        sectionChanges: [],
      });
      const plan = parseRestylePlan(json);
      expect(plan.changes).toHaveLength(1);
    });

    it('should filter out section changes with invalid types', () => {
      const json = JSON.stringify({
        styleDirection: 'Test',
        reasoning: 'Test',
        changes: [],
        sectionChanges: [
          { action: 'add', sectionType: 'logo_bar', pageLocation: 'optin', reason: 'ok' },
          { action: 'add', sectionType: 'invalid_type', reason: 'bad' },
        ],
      });
      const plan = parseRestylePlan(json);
      expect(plan.sectionChanges).toHaveLength(1);
    });

    it('should strip markdown code fences', () => {
      const wrapped = '```json\n{"styleDirection":"Test","reasoning":"Test","changes":[],"sectionChanges":[]}\n```';
      const plan = parseRestylePlan(wrapped);
      expect(plan.styleDirection).toBe('Test');
    });

    it('should throw if styleDirection missing', () => {
      const json = JSON.stringify({ reasoning: 'Test', changes: [], sectionChanges: [] });
      expect(() => parseRestylePlan(json)).toThrow('styleDirection');
    });
  });
});
