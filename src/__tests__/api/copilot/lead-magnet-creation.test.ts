/**
 * Integration Tests — Copilot Lead Magnet Creation Action Chain.
 *
 * Tests the full action flow: start_lead_magnet_creation → submit_extraction_answers
 * → save_lead_magnet → generate_lead_magnet_posts, plus the existing list/get actions.
 * Validates that actions are registered, return correct displayHints, handle errors,
 * and that confirmation-requiring actions are flagged.
 *
 * @jest-environment node
 */

// ─── Mocks ──────────────────────────────────────────────────

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

const mockAnalyzeContextGaps = jest.fn();
const mockGenerateContent = jest.fn();
const mockGeneratePosts = jest.fn();

jest.mock('@/lib/ai/copilot/lead-magnet-creation', () => ({
  analyzeContextGaps: (...args: unknown[]) => mockAnalyzeContextGaps(...args),
  generateContent: (...args: unknown[]) => mockGenerateContent(...args),
  generatePosts: (...args: unknown[]) => mockGeneratePosts(...args),
}));

/**
 * Creates a chainable Supabase mock that routes different tables to different results.
 */
function createMockSupabase() {
  type TableResult = { data: unknown; error: unknown };
  const tableResults: Record<string, TableResult> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.select = jest.fn(() => chain);
    chain.insert = jest.fn(() => chain);
    chain.update = jest.fn(() => chain);
    chain.delete = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.range = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(() => {
      const result = tableResults[tableName] || { data: null, error: null };
      return Promise.resolve(result);
    });
    chain.single = jest.fn(() => {
      const result = tableResults[tableName] || { data: null, error: null };
      return Promise.resolve(result);
    });

    // Make chain thenable for queries without .single()
    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = tableResults[tableName] || { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      enumerable: false,
    });

    return chain;
  }

  const chains: Record<string, ReturnType<typeof createChain>> = {};
  const mockFrom = jest.fn((table: string) => {
    if (!chains[table]) chains[table] = createChain(table);
    return chains[table];
  });

  return {
    from: mockFrom,
    chains,
    setResult: (table: string, result: TableResult) => {
      tableResults[table] = result;
      // Reset chain so next call picks up new result
      delete chains[table];
    },
  };
}

const mockSupabase = createMockSupabase();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: mockSupabase.from,
  })),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn().mockResolvedValue({ type: 'user', userId: 'user-test-123' }),
  applyScope: jest.fn((query) => query),
}));

// ─── Imports (after mocks) ──────────────────────────────────

// Import actions module to trigger registration
import '@/lib/actions/lead-magnets';

import { getAction, getAllActions } from '@/lib/actions/registry';
import { executeAction, actionRequiresConfirmation } from '@/lib/actions/executor';
import type { ActionContext } from '@/lib/actions/types';

// ─── Fixtures ───────────────────────────────────────────────

const CTX: ActionContext = { scope: { type: 'user', userId: 'user-test-123', teamId: 'team-1' } };

const MOCK_GAP_RESULT = {
  questions: [
    { id: 'q1', question: 'Walk me through your system step by step.', required: true },
    { id: 'q2', question: 'What common mistakes do people make?', required: true },
  ],
  preAnsweredCount: 2,
  knowledgeContext: 'Brain context with relevant insights',
  gapSummary: 'Brain context answers 2 of 4 questions. 2 questions still need your input.',
  brainEntries: [{ content: 'Our system starts with ICP definition', category: 'insight' }],
};

const MOCK_EXTRACTED_CONTENT = {
  title: 'The 5-Step Client Acquisition System',
  format: 'Google Doc',
  structure: [
    { sectionName: 'Step 1: Define Your ICP', contents: ['Identify your ideal client profile'] },
    { sectionName: 'Step 2: Build Your Pipeline', contents: ['Create a repeatable process'] },
  ],
  nonObviousInsight: 'Most agencies skip the research phase',
  personalExperience: 'We tested this with 50 clients over 6 months',
  proof: '40% increase in qualified leads within 30 days',
  commonMistakes: ['Skipping the research phase', 'Not tracking metrics'],
  differentiation: 'We combine outbound and inbound strategies',
};

const MOCK_POST_RESULT = {
  variations: [
    {
      hookType: 'Result',
      post: 'I helped 50 agencies get 40% more leads...',
      whyThisAngle: 'Results hook',
    },
    {
      hookType: 'Contrarian',
      post: 'Everyone says cold outreach is dead...',
      whyThisAngle: 'Against common belief',
    },
  ],
  recommendation: 'Variation 1 performs best for B2B audiences',
  dmTemplate:
    'Hi {first_name}, saw your post about {{topic}} — I put together a guide that might help.',
  ctaWord: 'SEND',
};

// ─── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock results
  mockAnalyzeContextGaps.mockResolvedValue(MOCK_GAP_RESULT);
  mockGenerateContent.mockResolvedValue(MOCK_EXTRACTED_CONTENT);
  mockGeneratePosts.mockResolvedValue(MOCK_POST_RESULT);

  // Default Supabase: lead_magnets insert/select returns a new record
  mockSupabase.setResult('lead_magnets', {
    data: {
      id: 'lm-new-1',
      title: 'The 5-Step Client Acquisition System',
      archetype: 'single-system',
      status: 'draft',
      created_at: '2026-03-10T00:00:00Z',
    },
    error: null,
  });
});

// ─── Tests: Action Registration ─────────────────────────────

describe('lead magnet action registration', () => {
  const EXPECTED_ACTIONS = [
    'list_lead_magnets',
    'get_lead_magnet',
    'start_lead_magnet_creation',
    'submit_extraction_answers',
    'save_lead_magnet',
    'generate_lead_magnet_posts',
  ];

  it.each(EXPECTED_ACTIONS)('registers "%s" action in the registry', (actionName) => {
    const action = getAction(actionName);
    expect(action).toBeDefined();
    expect(action!.name).toBe(actionName);
    expect(action!.description).toBeTruthy();
    expect(action!.handler).toBeInstanceOf(Function);
  });

  it('registers all 6 lead magnet actions', () => {
    const allActions = getAllActions();
    const lmActions = allActions.filter((a) => EXPECTED_ACTIONS.includes(a.name));
    expect(lmActions).toHaveLength(6);
  });
});

// ─── Tests: start_lead_magnet_creation ──────────────────────

describe('start_lead_magnet_creation', () => {
  it('returns gap-filling questions from analyzeContextGaps', async () => {
    const result = await executeAction(CTX, 'start_lead_magnet_creation', {
      topic: 'Client Acquisition System',
    });

    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('text');

    const data = result.data as Record<string, unknown>;
    expect(data.questions).toEqual(MOCK_GAP_RESULT.questions);
    expect(data.preAnsweredCount).toBe(2);
    expect(data.gapSummary).toContain('2 of 4');
    expect(data.archetype).toBe('single-system'); // default archetype
    expect(data.concept).toBeDefined();
  });

  it('passes archetype and pasted_content through to analyzeContextGaps', async () => {
    await executeAction(CTX, 'start_lead_magnet_creation', {
      topic: 'My System',
      archetype: 'single-system',
      target_audience: 'B2B agency owners',
      pasted_content: 'Here is my transcript...',
    });

    expect(mockAnalyzeContextGaps).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: CTX.scope.userId,
        teamId: CTX.scope.teamId,
        archetype: 'single-system',
        pastedContent: 'Here is my transcript...',
        concept: expect.objectContaining({
          title: 'My System',
          painSolved: 'B2B agency owners',
        }),
      })
    );
  });

  it('defaults archetype to "single-system" when not specified', async () => {
    await executeAction(CTX, 'start_lead_magnet_creation', {
      topic: 'Quick Guide',
    });

    expect(mockAnalyzeContextGaps).toHaveBeenCalledWith(
      expect.objectContaining({
        archetype: 'single-system',
      })
    );
  });

  it('handles analyzeContextGaps failure gracefully', async () => {
    mockAnalyzeContextGaps.mockRejectedValueOnce(new Error('AI service timeout'));

    const result = await executeAction(CTX, 'start_lead_magnet_creation', {
      topic: 'Test Topic',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('AI service timeout');
  });

  it('does not require confirmation', () => {
    expect(actionRequiresConfirmation('start_lead_magnet_creation')).toBe(false);
  });
});

// ─── Tests: submit_extraction_answers ───────────────────────

describe('submit_extraction_answers', () => {
  it('generates content with content_review displayHint', async () => {
    const result = await executeAction(CTX, 'submit_extraction_answers', {
      archetype: 'single-system',
      concept_title: 'Client Acquisition System',
      concept_pain: 'Inconsistent pipeline',
      answers: {
        q1: 'Our system starts with ICP definition, then outreach, then qualification.',
        q2: 'The biggest mistake is skipping the research phase.',
      },
    });

    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('content_review');
    expect(result.data).toEqual(MOCK_EXTRACTED_CONTENT);
  });

  it('passes correct parameters to generateContent', async () => {
    const answers = { system: 'Step 1 is...', results: '40% growth' };

    await executeAction(CTX, 'submit_extraction_answers', {
      archetype: 'single-system',
      concept_title: 'My Guide',
      concept_pain: 'No leads',
      answers,
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        archetype: 'single-system',
        userId: CTX.scope.userId,
        concept: expect.objectContaining({
          title: 'My Guide',
          painSolved: 'No leads',
        }),
      }),
      answers
    );
  });

  it('defaults concept_title and concept_pain when omitted', async () => {
    await executeAction(CTX, 'submit_extraction_answers', {
      archetype: 'single-system',
      answers: { q1: 'answer' },
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        concept: expect.objectContaining({
          title: 'Untitled Lead Magnet',
          painSolved: '',
        }),
      }),
      { q1: 'answer' }
    );
  });

  it('handles content generation failure gracefully', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Missing required parameters'));

    const result = await executeAction(CTX, 'submit_extraction_answers', {
      archetype: 'single-system',
      answers: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameters');
  });

  it('does not require confirmation', () => {
    expect(actionRequiresConfirmation('submit_extraction_answers')).toBe(false);
  });
});

// ─── Tests: save_lead_magnet ────────────────────────────────

describe('save_lead_magnet', () => {
  it('requires confirmation', () => {
    expect(actionRequiresConfirmation('save_lead_magnet')).toBe(true);
  });

  it('creates a draft lead magnet and returns the record', async () => {
    const result = await executeAction(CTX, 'save_lead_magnet', {
      title: 'The 5-Step Client Acquisition System',
      archetype: 'single-system',
      content_blocks: MOCK_EXTRACTED_CONTENT,
    });

    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('text');

    const data = result.data as Record<string, unknown>;
    expect(data.id).toBe('lm-new-1');
    expect(data.title).toBe('The 5-Step Client Acquisition System');
    expect(data.status).toBe('draft');
  });

  it('calls Supabase insert with correct fields', async () => {
    await executeAction(CTX, 'save_lead_magnet', {
      title: 'Test LM',
      archetype: 'single-system',
      content_blocks: { structure: [] },
      extraction_data: { source: 'copilot' },
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('lead_magnets');
  });

  it('handles Supabase insert error', async () => {
    mockSupabase.setResult('lead_magnets', {
      data: null,
      error: { message: 'Row-level security violation' },
    });

    const result = await executeAction(CTX, 'save_lead_magnet', {
      title: 'Test',
      archetype: 'single-system',
      content_blocks: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Row-level security violation');
  });
});

// ─── Tests: generate_lead_magnet_posts ──────────────────────

describe('generate_lead_magnet_posts', () => {
  it('returns post variations with post_preview displayHint', async () => {
    const result = await executeAction(CTX, 'generate_lead_magnet_posts', {
      lead_magnet_id: 'lm-1',
    });

    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('post_preview');

    const data = result.data as Record<string, unknown>;
    const variations = data.variations as Array<Record<string, unknown>>;
    expect(variations).toHaveLength(2);
    expect(variations[0].hookType).toBe('Result');
    expect(data.recommendation).toContain('Variation 1');
    expect(data.dmTemplate).toContain('{first_name}');
    expect(data.ctaWord).toBe('SEND');
  });

  it('passes userId and lead_magnet_id to generatePosts', async () => {
    await executeAction(CTX, 'generate_lead_magnet_posts', {
      lead_magnet_id: 'lm-42',
    });

    expect(mockGeneratePosts).toHaveBeenCalledWith(CTX.scope.userId, 'lm-42');
  });

  it('handles generatePosts failure gracefully', async () => {
    mockGeneratePosts.mockRejectedValueOnce(
      Object.assign(new Error('Lead magnet not found: lm-999'), { statusCode: 404 })
    );

    const result = await executeAction(CTX, 'generate_lead_magnet_posts', {
      lead_magnet_id: 'lm-999',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Lead magnet not found');
  });

  it('does not require confirmation', () => {
    expect(actionRequiresConfirmation('generate_lead_magnet_posts')).toBe(false);
  });
});

// ─── Tests: list_lead_magnets ───────────────────────────────

describe('list_lead_magnets', () => {
  it('returns lead magnets with text displayHint', async () => {
    mockSupabase.setResult('lead_magnets', {
      data: [
        {
          id: 'lm-1',
          title: 'Guide 1',
          status: 'draft',
          archetype: 'single-system',
          created_at: '2026-03-01',
          updated_at: '2026-03-09',
        },
        {
          id: 'lm-2',
          title: 'Toolkit',
          status: 'published',
          archetype: 'focused-toolkit',
          created_at: '2026-02-15',
          updated_at: '2026-03-08',
        },
      ],
      error: null,
    });

    const result = await executeAction(CTX, 'list_lead_magnets', {});

    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('text');

    const data = result.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe('Guide 1');
  });

  it('handles Supabase query error', async () => {
    mockSupabase.setResult('lead_magnets', {
      data: null,
      error: { message: 'Connection refused' },
    });

    const result = await executeAction(CTX, 'list_lead_magnets', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  it('does not require confirmation', () => {
    expect(actionRequiresConfirmation('list_lead_magnets')).toBe(false);
  });
});

// ─── Tests: get_lead_magnet ─────────────────────────────────

describe('get_lead_magnet', () => {
  it('returns lead magnet details with text displayHint', async () => {
    mockSupabase.setResult('lead_magnets', {
      data: {
        id: 'lm-1',
        title: 'My Guide',
        archetype: 'single-system',
        status: 'draft',
        content_blocks: MOCK_EXTRACTED_CONTENT,
        extraction_data: null,
        created_at: '2026-03-01',
      },
      error: null,
    });

    const result = await executeAction(CTX, 'get_lead_magnet', { id: 'lm-1' });

    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('text');

    const data = result.data as Record<string, unknown>;
    expect(data.id).toBe('lm-1');
    expect(data.content_blocks).toEqual(MOCK_EXTRACTED_CONTENT);
  });

  it('returns error when lead magnet not found', async () => {
    mockSupabase.setResult('lead_magnets', {
      data: null,
      error: { message: 'not found', code: 'PGRST116' },
    });

    const result = await executeAction(CTX, 'get_lead_magnet', { id: 'nonexistent' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Lead magnet not found');
  });

  it('does not require confirmation', () => {
    expect(actionRequiresConfirmation('get_lead_magnet')).toBe(false);
  });
});

// ─── Tests: Unknown Action ──────────────────────────────────

describe('unknown action handling', () => {
  it('returns error for unknown action name', async () => {
    const result = await executeAction(CTX, 'nonexistent_action', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });
});

// ─── Tests: Full Creation Flow ──────────────────────────────

describe('full copilot creation flow (end-to-end chain)', () => {
  it('runs the complete creation pipeline: start → answer → save → posts', async () => {
    // Step 1: Start creation — get questions
    const startResult = await executeAction(CTX, 'start_lead_magnet_creation', {
      topic: 'Client Acquisition System',
      archetype: 'single-system',
    });

    expect(startResult.success).toBe(true);
    const startData = startResult.data as Record<string, unknown>;
    expect(startData.questions).toBeDefined();
    expect(startData.archetype).toBe('single-system');

    // Step 2: Submit answers — get extracted content
    const submitResult = await executeAction(CTX, 'submit_extraction_answers', {
      archetype: 'single-system',
      concept_title: 'Client Acquisition System',
      concept_pain: 'Inconsistent pipeline',
      answers: {
        q1: 'Our system has 5 steps starting with ICP definition.',
        q2: 'Biggest mistake is skipping the research phase.',
      },
    });

    expect(submitResult.success).toBe(true);
    expect(submitResult.displayHint).toBe('content_review');
    expect(submitResult.data).toEqual(MOCK_EXTRACTED_CONTENT);

    // Step 3: Save the lead magnet
    mockSupabase.setResult('lead_magnets', {
      data: {
        id: 'lm-saved-1',
        title: 'Client Acquisition System',
        archetype: 'single-system',
        status: 'draft',
        created_at: '2026-03-10T00:00:00Z',
      },
      error: null,
    });

    const saveResult = await executeAction(CTX, 'save_lead_magnet', {
      title: 'Client Acquisition System',
      archetype: 'single-system',
      content_blocks: MOCK_EXTRACTED_CONTENT,
    });

    expect(saveResult.success).toBe(true);
    const saveData = saveResult.data as Record<string, unknown>;
    expect(saveData.id).toBe('lm-saved-1');
    expect(saveData.status).toBe('draft');

    // Step 4: Generate posts for the saved lead magnet
    const postsResult = await executeAction(CTX, 'generate_lead_magnet_posts', {
      lead_magnet_id: 'lm-saved-1',
    });

    expect(postsResult.success).toBe(true);
    expect(postsResult.displayHint).toBe('post_preview');
    const postsData = postsResult.data as Record<string, unknown>;
    const variations = postsData.variations as Array<Record<string, unknown>>;
    expect(variations.length).toBeGreaterThanOrEqual(1);
  });
});
