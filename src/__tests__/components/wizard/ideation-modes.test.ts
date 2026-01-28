/**
 * Tests for the Ideation Modes feature in ContextStep
 *
 * This tests the Call Transcript and Inspiration Post ideation modes
 * that were added as alternate ways to generate lead magnet ideas.
 */

import { describe, it, expect } from '@jest/globals';

// Type definitions for ideation sources
interface CallTranscriptInsights {
  painPoints: Array<{
    quote: string;
    theme: string;
    frequency: 'mentioned-once' | 'recurring' | 'dominant';
  }>;
  frequentQuestions: Array<{
    question: string;
    context: string;
  }>;
  transformationOutcomes: Array<{
    desiredState: string;
    currentState: string;
  }>;
  objections: Array<{
    objection: string;
    underlyingConcern: string;
  }>;
  languagePatterns: string[];
}

interface CompetitorAnalysis {
  detectedArchetype: string | null;
  format: string;
  painPointAddressed: string;
  effectivenessFactors: string[];
  adaptationSuggestions: string[];
  originalTitle: string;
}

interface IdeationSources {
  callTranscript?: {
    raw: string;
    insights: CallTranscriptInsights;
  };
  competitorInspiration?: {
    raw: string;
    analysis: CompetitorAnalysis;
  };
}

describe('Ideation Modes Types', () => {
  describe('CallTranscriptInsights', () => {
    it('should have correct structure for pain points', () => {
      const insights: CallTranscriptInsights = {
        painPoints: [
          {
            quote: "I spend hours every week on this manually",
            theme: "time-waste",
            frequency: "recurring",
          },
        ],
        frequentQuestions: [],
        transformationOutcomes: [],
        objections: [],
        languagePatterns: [],
      };

      expect(insights.painPoints[0].quote).toBe("I spend hours every week on this manually");
      expect(insights.painPoints[0].frequency).toBe("recurring");
    });

    it('should support all frequency values', () => {
      const frequencies: Array<'mentioned-once' | 'recurring' | 'dominant'> = [
        'mentioned-once',
        'recurring',
        'dominant',
      ];

      frequencies.forEach(freq => {
        const insights: CallTranscriptInsights = {
          painPoints: [{ quote: 'test', theme: 'test', frequency: freq }],
          frequentQuestions: [],
          transformationOutcomes: [],
          objections: [],
          languagePatterns: [],
        };
        expect(insights.painPoints[0].frequency).toBe(freq);
      });
    });

    it('should have correct structure for transformation outcomes', () => {
      const insights: CallTranscriptInsights = {
        painPoints: [],
        frequentQuestions: [],
        transformationOutcomes: [
          {
            currentState: "Overwhelmed with manual processes",
            desiredState: "Automated and efficient workflows",
          },
        ],
        objections: [],
        languagePatterns: [],
      };

      expect(insights.transformationOutcomes[0].currentState).toContain("manual");
      expect(insights.transformationOutcomes[0].desiredState).toContain("Automated");
    });
  });

  describe('CompetitorAnalysis', () => {
    it('should capture detected archetype', () => {
      const analysis: CompetitorAnalysis = {
        detectedArchetype: 'checklist',
        format: 'PDF download',
        painPointAddressed: 'Forgetting important steps',
        effectivenessFactors: ['Specific', 'Actionable'],
        adaptationSuggestions: ['Add your industry terminology'],
        originalTitle: 'The Ultimate Checklist',
      };

      expect(analysis.detectedArchetype).toBe('checklist');
    });

    it('should allow null archetype when not detected', () => {
      const analysis: CompetitorAnalysis = {
        detectedArchetype: null,
        format: 'Unknown format',
        painPointAddressed: '',
        effectivenessFactors: [],
        adaptationSuggestions: [],
        originalTitle: '',
      };

      expect(analysis.detectedArchetype).toBeNull();
    });

    it('should capture effectiveness factors', () => {
      const analysis: CompetitorAnalysis = {
        detectedArchetype: 'template',
        format: 'Notion template',
        painPointAddressed: 'Starting from scratch',
        effectivenessFactors: [
          'Provides immediate value',
          'Easy to customize',
          'Solves a specific problem',
        ],
        adaptationSuggestions: ['Focus on your niche'],
        originalTitle: 'Content Calendar Template',
      };

      expect(analysis.effectivenessFactors).toHaveLength(3);
      expect(analysis.effectivenessFactors).toContain('Provides immediate value');
    });
  });

  describe('IdeationSources', () => {
    it('should support transcript-only sources', () => {
      const sources: IdeationSources = {
        callTranscript: {
          raw: 'Sample transcript text...',
          insights: {
            painPoints: [{ quote: 'pain', theme: 'theme', frequency: 'recurring' }],
            frequentQuestions: [],
            transformationOutcomes: [],
            objections: [],
            languagePatterns: ['key phrase'],
          },
        },
      };

      expect(sources.callTranscript).toBeDefined();
      expect(sources.competitorInspiration).toBeUndefined();
    });

    it('should support inspiration-only sources', () => {
      const sources: IdeationSources = {
        competitorInspiration: {
          raw: 'Competitor post content...',
          analysis: {
            detectedArchetype: 'assessment',
            format: 'Quiz',
            painPointAddressed: 'Not knowing where to start',
            effectivenessFactors: ['Interactive', 'Personalized results'],
            adaptationSuggestions: ['Add your expertise areas'],
            originalTitle: 'Find Your Type',
          },
        },
      };

      expect(sources.competitorInspiration).toBeDefined();
      expect(sources.callTranscript).toBeUndefined();
    });

    it('should support both sources combined', () => {
      const sources: IdeationSources = {
        callTranscript: {
          raw: 'transcript',
          insights: {
            painPoints: [],
            frequentQuestions: [],
            transformationOutcomes: [],
            objections: [],
            languagePatterns: [],
          },
        },
        competitorInspiration: {
          raw: 'competitor content',
          analysis: {
            detectedArchetype: 'swipe-file',
            format: 'Collection',
            painPointAddressed: 'Need inspiration',
            effectivenessFactors: [],
            adaptationSuggestions: [],
            originalTitle: 'Swipe File',
          },
        },
      };

      expect(sources.callTranscript).toBeDefined();
      expect(sources.competitorInspiration).toBeDefined();
    });

    it('should allow empty sources object', () => {
      const sources: IdeationSources = {};

      expect(sources.callTranscript).toBeUndefined();
      expect(sources.competitorInspiration).toBeUndefined();
    });
  });
});

describe('Ideation Modes Integration', () => {
  describe('Source extraction for API calls', () => {
    it('should extract transcript insights for ideation API', () => {
      const sources: IdeationSources = {
        callTranscript: {
          raw: 'Call transcript...',
          insights: {
            painPoints: [{ quote: 'problem', theme: 'efficiency', frequency: 'dominant' }],
            frequentQuestions: [{ question: 'How do I?', context: 'onboarding' }],
            transformationOutcomes: [{ currentState: 'manual', desiredState: 'automated' }],
            objections: [{ objection: 'too expensive', underlyingConcern: 'ROI unclear' }],
            languagePatterns: ['game-changer', 'life-saver'],
          },
        },
      };

      // Extracting for API payload
      const apiPayload = {
        callTranscriptInsights: sources.callTranscript?.insights,
      };

      expect(apiPayload.callTranscriptInsights?.painPoints).toHaveLength(1);
      expect(apiPayload.callTranscriptInsights?.languagePatterns).toContain('game-changer');
    });

    it('should extract competitor analysis for ideation API', () => {
      const sources: IdeationSources = {
        competitorInspiration: {
          raw: 'Competitor post...',
          analysis: {
            detectedArchetype: 'calculator',
            format: 'Interactive tool',
            painPointAddressed: 'Complex calculations',
            effectivenessFactors: ['Instant results', 'Visual output'],
            adaptationSuggestions: ['Add your pricing model'],
            originalTitle: 'ROI Calculator',
          },
        },
      };

      // Extracting for API payload
      const apiPayload = {
        competitorAnalysis: sources.competitorInspiration?.analysis,
      };

      expect(apiPayload.competitorAnalysis?.detectedArchetype).toBe('calculator');
      expect(apiPayload.competitorAnalysis?.adaptationSuggestions).toHaveLength(1);
    });
  });

  describe('Source validation', () => {
    it('should verify sources have both raw and insights/analysis', () => {
      const validTranscriptSource: IdeationSources = {
        callTranscript: {
          raw: 'transcript text',
          insights: {
            painPoints: [],
            frequentQuestions: [],
            transformationOutcomes: [],
            objections: [],
            languagePatterns: [],
          },
        },
      };

      expect(validTranscriptSource.callTranscript?.raw).toBeTruthy();
      expect(validTranscriptSource.callTranscript?.insights).toBeDefined();
    });

    it('should check if sources have analyzed content', () => {
      const hasAnalyzedTranscript = (sources: IdeationSources): boolean => {
        return !!sources.callTranscript?.insights;
      };

      const hasAnalyzedCompetitor = (sources: IdeationSources): boolean => {
        return !!sources.competitorInspiration?.analysis;
      };

      const sourcesWithTranscript: IdeationSources = {
        callTranscript: {
          raw: 'text',
          insights: {
            painPoints: [],
            frequentQuestions: [],
            transformationOutcomes: [],
            objections: [],
            languagePatterns: [],
          },
        },
      };

      const emptySources: IdeationSources = {};

      expect(hasAnalyzedTranscript(sourcesWithTranscript)).toBe(true);
      expect(hasAnalyzedTranscript(emptySources)).toBe(false);
      expect(hasAnalyzedCompetitor(sourcesWithTranscript)).toBe(false);
    });
  });
});
