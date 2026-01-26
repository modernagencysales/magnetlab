// Anthropic mock for testing
import { vi } from 'vitest';
import type { IdeationResult, ExtractedContent, PostWriterResult } from '@/lib/types/lead-magnet';

// Mock ideation result
export const mockIdeationResult: IdeationResult = {
  concepts: [
    {
      archetype: 'single-breakdown',
      archetypeName: 'The Single Breakdown',
      title: 'The Cold Email That Got 42% Reply Rate—Reverse-Engineered',
      painSolved: 'Cold emails going ignored',
      whyNowHook: 'LinkedIn algorithm changes mean DMs get less reach',
      linkedinPost: 'I sent 1,000 cold emails last year...',
      contents: 'Line-by-line breakdown of the winning email',
      deliveryFormat: 'Google Doc',
      viralCheck: {
        highValue: true,
        urgentPain: true,
        actionableUnder1h: true,
        simple: true,
        authorityBoosting: true,
      },
      creationTimeEstimate: '2 hours',
      bundlePotential: ['Cold Email Templates', 'Follow-up Sequences'],
    },
    {
      archetype: 'single-system',
      archetypeName: 'The Single System',
      title: 'The 5-Step Client Acquisition System',
      painSolved: 'Inconsistent lead flow',
      whyNowHook: 'Q1 is when buyers have fresh budgets',
      linkedinPost: 'Most consultants chase clients...',
      contents: 'Complete 5-step process with templates',
      deliveryFormat: 'Notion Template',
      viralCheck: {
        highValue: true,
        urgentPain: true,
        actionableUnder1h: true,
        simple: true,
        authorityBoosting: true,
      },
      creationTimeEstimate: '4 hours',
      bundlePotential: ['CRM Setup Guide', 'Discovery Call Script'],
    },
  ],
  recommendations: {
    shipThisWeek: {
      conceptIndex: 0,
      reason: 'Quickest to create with existing assets',
    },
    highestEngagement: {
      conceptIndex: 1,
      reason: 'Systems posts get high saves and shares',
    },
    bestAuthorityBuilder: {
      conceptIndex: 0,
      reason: 'Shows deep expertise through analysis',
    },
  },
  suggestedBundle: {
    name: 'The Complete Cold Outreach Kit',
    components: ['Cold Email Breakdown', 'Follow-up Templates'],
    combinedValue: '$497',
    releaseStrategy: 'Launch emails first, then bundle',
  },
};

// Mock extracted content
export const mockExtractedContent: ExtractedContent = {
  title: 'The Cold Email That Got 42% Reply Rate',
  format: 'Google Doc',
  structure: [
    {
      sectionName: 'The Email',
      contents: ['Full email text', 'Subject line analysis'],
    },
    {
      sectionName: 'Line-by-Line Breakdown',
      contents: ['Opening hook analysis', 'Value proposition', 'CTA breakdown'],
    },
  ],
  nonObviousInsight: 'The power is in the PS line, not the opening',
  personalExperience: 'Tested across 50+ industries over 3 years',
  proof: '42% reply rate vs 2% industry average',
  commonMistakes: ['Writing too much', 'Weak subject lines', 'No clear ask'],
  differentiation: 'Based on 10,000+ emails sent, not theory',
};

// Mock post writer result
export const mockPostWriterResult: PostWriterResult = {
  variations: [
    {
      hookType: 'Specific Result',
      post: 'This cold email got a 42% reply rate.\n\nMost get 2%.\n\nHere\'s exactly why it worked...',
      whyThisAngle: 'Specific numbers grab attention and build credibility immediately',
      evaluation: {
        hookStrength: 'strong',
        credibilityClear: true,
        problemResonance: 'high',
        contentsSpecific: true,
        toneMatch: 'aligned',
        aiClicheFree: true,
      },
    },
    {
      hookType: 'Price Anchoring',
      post: 'I charge $5,000 to write cold emails.\n\nToday, I\'m giving away my best one for free...',
      whyThisAngle: 'Price anchoring establishes value before the give',
      evaluation: {
        hookStrength: 'strong',
        credibilityClear: true,
        problemResonance: 'high',
        contentsSpecific: true,
        toneMatch: 'aligned',
        aiClicheFree: true,
      },
    },
    {
      hookType: 'Contrarian',
      post: 'Cold email isn\'t dead.\n\nYour cold emails are just bad...',
      whyThisAngle: 'Contrarian hooks challenge assumptions and spark debate',
      evaluation: {
        hookStrength: 'medium',
        credibilityClear: true,
        problemResonance: 'medium',
        contentsSpecific: true,
        toneMatch: 'partial',
        aiClicheFree: true,
      },
    },
  ],
  recommendation: 'Use Variation 1 for highest engagement. The specific result hook is proven.',
  dmTemplate: 'Hey {first_name}, saw you commented on my cold email post. Here\'s the link: [LINK]',
  ctaWord: 'EMAIL',
};

// Create mock Anthropic client
export const createMockAnthropicClient = (overrides?: {
  ideationResult?: IdeationResult;
  extractedContent?: ExtractedContent;
  postResult?: PostWriterResult;
}) => {
  const results = {
    ideationResult: overrides?.ideationResult || mockIdeationResult,
    extractedContent: overrides?.extractedContent || mockExtractedContent,
    postResult: overrides?.postResult || mockPostWriterResult,
  };

  return {
    messages: {
      create: vi.fn().mockImplementation(async ({ messages }) => {
        // Determine which type of response based on the prompt content
        const prompt = messages[0]?.content || '';

        let responseText: string;
        if (prompt.includes('Generate 10 lead magnet concepts')) {
          responseText = JSON.stringify(results.ideationResult);
        } else if (prompt.includes('structure the content for this lead magnet')) {
          responseText = JSON.stringify(results.extractedContent);
        } else if (prompt.includes('Generate 3 distinct post variations')) {
          responseText = JSON.stringify(results.postResult);
        } else if (prompt.includes('Extract the following fields')) {
          responseText = JSON.stringify({
            extracted: {
              businessDescription: 'Test business description',
              businessType: 'coach-consultant',
              credibilityMarkers: ['$1M revenue', '100+ clients'],
              urgentPains: ['Not enough leads', 'Inconsistent income'],
              results: ['Doubled revenue', 'Tripled leads'],
              templates: ['Proposal template', 'Email scripts'],
              processes: ['Sales process', 'Onboarding system'],
              tools: ['Notion', 'Calendly'],
              frequentQuestions: ['How do I get more clients?'],
              successExample: 'Helped client 3x their revenue in 90 days',
            },
            confidence: {
              businessDescription: 'high',
              businessType: 'medium',
              credibilityMarkers: 'high',
              urgentPains: 'high',
              results: 'high',
              templates: 'medium',
              processes: 'medium',
              tools: 'high',
              frequentQuestions: 'low',
              successExample: 'high',
            },
            suggestions: ['Add more specific revenue numbers'],
          });
        } else {
          responseText = 'This is a test response from the mock Anthropic client.';
        }

        return {
          content: [{ type: 'text', text: responseText }],
          usage: { input_tokens: 100, output_tokens: 500 },
        };
      }),
    },
  };
};

// Mock for error scenarios
export const createMockAnthropicClientWithError = (errorMessage: string) => {
  return {
    messages: {
      create: vi.fn().mockRejectedValue(new Error(errorMessage)),
    },
  };
};

// Mock for invalid JSON response
export const createMockAnthropicClientWithInvalidJson = () => {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'This is not valid JSON {broken' }],
      }),
    },
  };
};

// Mock for empty response
export const createMockAnthropicClientWithEmptyResponse = () => {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [],
      }),
    },
  };
};
