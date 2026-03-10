/**
 * @jest-environment node
 */

// --- Mocks ---

const mockMessagesCreate = jest.fn();
jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

jest.mock('@/lib/services/knowledge-brain', () => ({
  getRelevantContext: jest.fn(),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({
    compiledContext: 'mock compiled context',
    relevantInsights: [],
    relevantQuestions: [],
    relevantProductIntel: [],
    suggestedAngles: [],
    topic: 'test',
    topicReadiness: 0.5,
    topKnowledgeTypes: [],
    position: null,
  }),
}));

jest.mock('@/lib/ai/lead-magnet-generator', () => ({
  getExtractionQuestions: jest.fn(),
  getContextAwareExtractionQuestions: jest.fn(),
  processContentExtraction: jest.fn(),
  generatePostVariations: jest.fn(),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

// --- Imports ---

import {
  analyzeContextGaps,
  generateContent,
  generatePosts,
} from '@/lib/ai/copilot/lead-magnet-creation';
import type { GapAnalysisInput } from '@/lib/ai/copilot/lead-magnet-creation';
import type {
  ContentExtractionQuestion,
  LeadMagnetConcept,
  ExtractedContent,
} from '@/lib/types/lead-magnet';

import { getRelevantContext } from '@/lib/services/knowledge-brain';
import {
  getExtractionQuestions,
  getContextAwareExtractionQuestions,
  processContentExtraction,
  generatePostVariations,
} from '@/lib/ai/lead-magnet-generator';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const mockGetRelevantContext = getRelevantContext as jest.Mock;
const mockGetExtractionQuestions = getExtractionQuestions as jest.Mock;
const mockGetContextAwareExtractionQuestions = getContextAwareExtractionQuestions as jest.Mock;
const mockProcessContentExtraction = processContentExtraction as jest.Mock;
const mockGeneratePostVariations = generatePostVariations as jest.Mock;
const mockCreateSupabaseAdminClient = createSupabaseAdminClient as jest.Mock;

// --- Fixtures ---

const MOCK_CONCEPT: LeadMagnetConcept = {
  archetype: 'single-system',
  archetypeName: 'The Single System',
  title: 'The 5-Step Client Acquisition System',
  painSolved: 'Inconsistent client pipeline',
  whyNowHook: 'Market is shifting to outbound',
  contents: 'A step-by-step system for acquiring clients',
  deliveryFormat: 'PDF Guide',
  viralCheck: {
    highValue: true,
    urgentPain: true,
    actionableUnder1h: true,
    simple: true,
    authorityBoosting: true,
  },
  creationTimeEstimate: '2 hours',
  bundlePotential: ['toolkit'],
};

const MOCK_QUESTIONS: ContentExtractionQuestion[] = [
  { id: 'system', question: 'Walk me through your system step by step.', required: true },
  { id: 'results', question: 'What results have you gotten?', required: true },
  { id: 'mistakes', question: 'What common mistakes do people make?', required: true },
  { id: 'timeline', question: 'How long does implementation take?', required: false },
];

const MOCK_INPUT: GapAnalysisInput = {
  userId: 'user-123',
  archetype: 'single-system',
  concept: MOCK_CONCEPT,
  businessContext: {
    businessDescription: 'B2B consulting firm',
    businessType: 'coach-consultant',
    credibilityMarkers: ['10 years experience'],
    urgentPains: ['inconsistent pipeline'],
    results: ['40% increase in leads'],
  },
};

const MOCK_BRAIN_ENTRIES = [
  { content: 'Our 5-step system starts with ICP definition', category: 'insight', similarity: 0.9 },
  {
    content: 'Clients typically see 40% more leads in 30 days',
    category: 'product_intel',
    similarity: 0.85,
  },
  { content: 'How long does it take to set up?', category: 'question', similarity: 0.8 },
  {
    content: 'The biggest mistake is skipping the research phase',
    category: 'insight',
    similarity: 0.75,
  },
];

// --- Setup ---

function setupSupabaseMock(data: unknown, error: unknown = null) {
  const mockSingle = jest.fn().mockResolvedValue({ data, error });
  const mockEq = jest.fn().mockReturnThis();
  const mockSelect = jest.fn().mockReturnThis();

  const chainable = {
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    from: jest.fn(),
  };

  mockEq.mockReturnValue(chainable);
  mockSelect.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);

  mockCreateSupabaseAdminClient.mockReturnValue(chainable);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetExtractionQuestions.mockReturnValue(MOCK_QUESTIONS);
  mockGetContextAwareExtractionQuestions.mockResolvedValue(MOCK_QUESTIONS);
  mockGetRelevantContext.mockResolvedValue({ entries: [], error: undefined });
  setupSupabaseMock(null);
});

// --- Tests ---

describe('analyzeContextGaps', () => {
  it('returns full question set when no Brain context', async () => {
    mockGetRelevantContext.mockResolvedValue({ entries: [] });

    const result = await analyzeContextGaps(MOCK_INPUT);

    expect(result.questions).toHaveLength(MOCK_QUESTIONS.length);
    expect(result.preAnsweredCount).toBe(0);
    expect(result.knowledgeContext).toBe('');
    expect(result.brainEntries).toHaveLength(0);
    expect(result.gapSummary).toContain('No Brain context');
  });

  it('returns fewer questions when Brain has rich context and AI identifies answered ones', async () => {
    mockGetRelevantContext.mockResolvedValue({ entries: MOCK_BRAIN_ENTRIES });

    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis: [
              {
                questionId: 'system',
                answered: true,
                confidence: 0.9,
                evidence: '5-step system starts with ICP',
              },
              {
                questionId: 'results',
                answered: true,
                confidence: 0.85,
                evidence: '40% more leads in 30 days',
              },
              { questionId: 'mistakes', answered: false, confidence: 0.3, evidence: '' },
              { questionId: 'timeline', answered: false, confidence: 0.2, evidence: '' },
            ],
          }),
        },
      ],
    });

    const result = await analyzeContextGaps(MOCK_INPUT);

    expect(result.preAnsweredCount).toBe(2);
    expect(result.questions).toHaveLength(2);
    expect(result.questions.map((q) => q.id)).toEqual(['mistakes', 'timeline']);
    expect(result.brainEntries).toHaveLength(4);
    expect(result.knowledgeContext).toContain('INSIGHTS');
    expect(result.gapSummary).toContain('2 of 4');
  });

  it('returns all questions when Brain has entries but AI gap analysis fails', async () => {
    mockGetRelevantContext.mockResolvedValue({ entries: MOCK_BRAIN_ENTRIES });
    mockMessagesCreate.mockRejectedValueOnce(new Error('API timeout'));

    const result = await analyzeContextGaps(MOCK_INPUT);

    expect(result.questions).toHaveLength(MOCK_QUESTIONS.length);
    expect(result.preAnsweredCount).toBe(0);
    expect(result.brainEntries).toHaveLength(4);
    expect(result.knowledgeContext).not.toBe('');
  });

  it('handles Brain search failure gracefully', async () => {
    mockGetRelevantContext.mockRejectedValue(new Error('Brain search crashed'));

    const result = await analyzeContextGaps(MOCK_INPUT);

    expect(result.questions).toHaveLength(MOCK_QUESTIONS.length);
    expect(result.preAnsweredCount).toBe(0);
    expect(result.knowledgeContext).toBe('');
    expect(result.brainEntries).toHaveLength(0);
  });

  it('loads brand kit from DB when businessContext not provided', async () => {
    const inputWithoutContext: GapAnalysisInput = {
      userId: 'user-123',
      archetype: 'single-system',
      concept: MOCK_CONCEPT,
    };

    setupSupabaseMock({
      business_description: 'My consulting business',
      business_type: 'coach-consultant',
      credibility_markers: ['5 years'],
      urgent_pains: ['no leads'],
      templates: [],
      processes: [],
      tools: [],
      frequent_questions: [],
      results: ['20% growth'],
      success_example: null,
      audience_tools: [],
    });

    mockGetRelevantContext.mockResolvedValue({ entries: [] });

    const result = await analyzeContextGaps(inputWithoutContext);

    const supabaseClient = mockCreateSupabaseAdminClient();
    expect(supabaseClient.from).toHaveBeenCalledWith('brand_kits');
    expect(result.questions).toHaveLength(MOCK_QUESTIONS.length);
  });

  it('skips gap analysis when Brain has fewer than 3 entries', async () => {
    mockGetRelevantContext.mockResolvedValue({
      entries: [
        { content: 'Only one entry', category: 'insight', similarity: 0.9 },
        { content: 'Two entries', category: 'question', similarity: 0.8 },
      ],
    });

    const result = await analyzeContextGaps(MOCK_INPUT);

    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(result.questions).toHaveLength(MOCK_QUESTIONS.length);
    expect(result.preAnsweredCount).toBe(0);
  });

  it('does not filter questions when confidence is below threshold', async () => {
    mockGetRelevantContext.mockResolvedValue({ entries: MOCK_BRAIN_ENTRIES });

    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis: [
              { questionId: 'system', answered: true, confidence: 0.5, evidence: 'weak' },
              { questionId: 'results', answered: true, confidence: 0.4, evidence: 'weak' },
              { questionId: 'mistakes', answered: false, confidence: 0.1, evidence: '' },
              { questionId: 'timeline', answered: false, confidence: 0.1, evidence: '' },
            ],
          }),
        },
      ],
    });

    const result = await analyzeContextGaps(MOCK_INPUT);

    expect(result.preAnsweredCount).toBe(0);
    expect(result.questions).toHaveLength(4);
  });
});

describe('generateContent', () => {
  it('delegates to processContentExtraction', async () => {
    const mockExtracted: ExtractedContent = {
      title: 'Test System',
      format: 'PDF',
      structure: [{ sectionName: 'Intro', contents: ['content'] }],
      nonObviousInsight: 'insight',
      personalExperience: 'experience',
      proof: 'proof',
      commonMistakes: ['mistake1'],
      differentiation: 'differentiation',
    };

    mockProcessContentExtraction.mockResolvedValue(mockExtracted);

    const answers = { system: 'My system works like this...', results: '40% growth' };
    const result = await generateContent(
      { archetype: 'single-system', concept: MOCK_CONCEPT, userId: 'user-123' },
      answers
    );

    expect(mockProcessContentExtraction).toHaveBeenCalledWith(
      'single-system',
      MOCK_CONCEPT,
      answers,
      undefined,
      'user-123'
    );
    expect(result).toEqual(mockExtracted);
  });

  it('propagates errors from processContentExtraction', async () => {
    mockProcessContentExtraction.mockRejectedValue(new Error('Missing required parameters'));

    await expect(
      generateContent({ archetype: 'single-system', concept: MOCK_CONCEPT }, {})
    ).rejects.toThrow('Missing required parameters');
  });
});

describe('generatePosts', () => {
  it('loads lead magnet and calls generatePostVariations', async () => {
    const mockLm = {
      id: 'lm-1',
      user_id: 'user-123',
      title: 'Test System',
      archetype: 'single-system',
      concept: MOCK_CONCEPT,
      extracted_content: {
        title: 'Test System',
        format: 'PDF',
        structure: [],
        nonObviousInsight: '',
        personalExperience: '',
        proof: 'We helped 50 clients',
        commonMistakes: [],
        differentiation: '',
      },
      status: 'draft',
    };

    setupSupabaseMock(mockLm);

    const mockPostResult = {
      variations: [{ hookType: 'result', post: 'Post 1', whyThisAngle: 'reason', evaluation: {} }],
      recommendation: 'Use variation 1',
      dmTemplate: 'Hey {first_name}',
      ctaWord: 'SEND',
    };
    mockGeneratePostVariations.mockResolvedValue(mockPostResult);

    const result = await generatePosts('user-123', 'lm-1');

    expect(mockGeneratePostVariations).toHaveBeenCalled();
    expect(result).toEqual(mockPostResult);
  });

  it('throws 404 when lead magnet not found', async () => {
    setupSupabaseMock(null, { message: 'not found', code: 'PGRST116' });

    await expect(generatePosts('user-123', 'nonexistent')).rejects.toThrow('Lead magnet not found');
  });

  it('throws 400 when lead magnet missing concept', async () => {
    setupSupabaseMock({
      id: 'lm-1',
      user_id: 'user-123',
      title: 'Incomplete',
      archetype: 'single-system',
      concept: null,
      extracted_content: null,
      status: 'draft',
    });

    await expect(generatePosts('user-123', 'lm-1')).rejects.toThrow(
      'missing concept or extracted content'
    );
  });
});
