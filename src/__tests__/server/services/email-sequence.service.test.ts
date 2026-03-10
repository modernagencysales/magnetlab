/**
 * @jest-environment node
 */

// ─── Mock external deps ─────────────────────────────────────────────

const mockGetLeadMagnetByScope = jest.fn();
const mockGetBrandKitByScope = jest.fn();
const mockGetUserName = jest.fn();
const mockUpsertEmailSequence = jest.fn();

jest.mock('@/server/repositories/email-sequence.repo', () => ({
  getLeadMagnetByScope: (...args: unknown[]) => mockGetLeadMagnetByScope(...args),
  getBrandKitByScope: (...args: unknown[]) => mockGetBrandKitByScope(...args),
  getUserName: (...args: unknown[]) => mockGetUserName(...args),
  upsertEmailSequence: (...args: unknown[]) => mockUpsertEmailSequence(...args),
  getLeadMagnetTeamId: jest.fn(),
}));

const mockGenerateEmailSequence = jest.fn();
const mockGenerateDefaultEmailSequence = jest.fn();

jest.mock('@/lib/ai/email-sequence-generator', () => ({
  generateEmailSequence: (...args: unknown[]) => mockGenerateEmailSequence(...args),
  generateDefaultEmailSequence: (...args: unknown[]) => mockGenerateDefaultEmailSequence(...args),
}));

const mockSearchKnowledgeV2 = jest.fn();
const mockGetCachedPosition = jest.fn();

jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledgeV2: (...args: unknown[]) => mockSearchKnowledgeV2(...args),
  getCachedPosition: (...args: unknown[]) => mockGetCachedPosition(...args),
}));

jest.mock('@/lib/api/errors', () => ({
  logApiError: jest.fn(),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/services/edit-capture', () => ({
  captureAndClassifyEdit: jest.fn(),
}));

// ─── Test data ───────────────────────────────────────────────────────

const MOCK_SCOPE = { userId: 'user-1', teamId: 'team-1' };

const MOCK_LEAD_MAGNET = {
  id: 'lm-1',
  user_id: 'user-1',
  team_id: 'team-1',
  title: 'Cold Email Checklist',
  archetype: 'focused-toolkit',
  concept: {
    contents: 'Step-by-step cold email guide',
    deliveryFormat: 'checklist',
  },
  extracted_content: null,
};

const MOCK_LEAD_MAGNET_WITH_BRAIN = {
  ...MOCK_LEAD_MAGNET,
  concept: {
    contents: 'Step-by-step cold email guide',
    deliveryFormat: 'checklist',
    _brain_position: {
      thesis: 'Cold email works but requires proper infrastructure.',
      key_arguments: ['Infrastructure > copy', 'Multi-channel is essential'],
      unique_data_points: [{ claim: '1,500 emails, 3% reply rate', evidence_strength: 'measured' }],
      stories: [
        {
          hook: 'We burned $2K on Instantly',
          arc: 'Switched to PlusVibe',
          lesson: 'Infrastructure matters',
        },
      ],
      differentiators: ['Focuses on deliverability, not templates'],
      voice_markers: ['infrastructure matters more than copy'],
      specific_recommendations: [
        { recommendation: 'Use PlusVibe', reasoning: 'Better deliverability' },
      ],
      coverage_gaps: ['No warm-up benchmarks'],
    },
    _brain_entry_ids: ['e1', 'e2'],
  },
};

const MOCK_EMAILS = [
  { day: 0, subject: 'your checklist', body: 'Here it is', replyTrigger: 'Got it?' },
  { day: 1, subject: 'quick tip', body: 'Try this', replyTrigger: 'Thoughts?' },
  { day: 2, subject: 'resources', body: 'Check these', replyTrigger: 'Which one?' },
  { day: 3, subject: 'question', body: 'How goes?', replyTrigger: 'Any questions?' },
  { day: 4, subject: 'next steps', body: 'Stay tuned', replyTrigger: 'Topics?' },
];

const MOCK_SEARCH_ENTRIES = [
  {
    id: 'e1',
    content: 'PlusVibe deliverability is 3x better',
    knowledge_type: 'insight',
    quality_score: 4,
    topics: ['cold-email'],
  },
  {
    id: 'e2',
    content: 'Warm-up pools need 14 days minimum',
    knowledge_type: 'how_to',
    quality_score: 3,
    topics: ['cold-email'],
  },
];

const MOCK_CACHED_POSITION = {
  topic: 'Cold Email',
  topic_slug: 'cold-email',
  thesis: 'Deliverability is the real bottleneck.',
  key_arguments: ['Warm-up is essential'],
  unique_data_points: [{ claim: '14 days minimum warm-up', evidence_strength: 'measured' }],
  stories: [],
  differentiators: ['Data-driven approach'],
  voice_markers: ['warm-up matters'],
  specific_recommendations: [
    { recommendation: 'Start with 5 emails/day', reasoning: 'Avoid spam triggers' },
  ],
  coverage_gaps: [],
  contradictions: [],
  related_topics: [],
  supporting_entry_ids: ['e1'],
  entry_count: 5,
  synthesized_at: '2026-03-08T00:00:00Z',
  confidence: 0.8,
  stance_type: 'experiential',
};

const MOCK_SEQUENCE_ROW = {
  id: 'seq-1',
  lead_magnet_id: 'lm-1',
  user_id: 'user-1',
  emails: MOCK_EMAILS,
  status: 'draft',
  created_at: '2026-03-08T00:00:00Z',
  updated_at: '2026-03-08T00:00:00Z',
};

// ─── Import after mocks ──────────────────────────────────────────────

import * as emailSequenceService from '@/server/services/email-sequence.service';

// ─── Tests ───────────────────────────────────────────────────────────

describe('email-sequence.service — brain enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBrandKitByScope.mockResolvedValue(null);
    mockGetUserName.mockResolvedValue('Tim');
    mockGenerateEmailSequence.mockResolvedValue(MOCK_EMAILS);
    mockGenerateDefaultEmailSequence.mockReturnValue(MOCK_EMAILS);
    mockUpsertEmailSequence.mockResolvedValue({ data: MOCK_SEQUENCE_ROW, error: null });
    mockSearchKnowledgeV2.mockResolvedValue({ entries: [] });
    mockGetCachedPosition.mockResolvedValue(null);
  });

  it('passes brain position from concept to AI generator', async () => {
    mockGetLeadMagnetByScope.mockResolvedValue({ data: MOCK_LEAD_MAGNET_WITH_BRAIN, error: null });
    mockSearchKnowledgeV2.mockResolvedValue({ entries: MOCK_SEARCH_ENTRIES });

    await emailSequenceService.generate('lm-1', true, MOCK_SCOPE);

    // Verify AI generator was called with brain context
    expect(mockGenerateEmailSequence).toHaveBeenCalledTimes(1);
    const { context } = mockGenerateEmailSequence.mock.calls[0][0];
    expect(context.brainPosition).toBeDefined();
    expect(context.brainPosition.thesis).toBe(
      'Cold email works but requires proper infrastructure.'
    );
    expect(context.brainPosition.differentiators).toContain(
      'Focuses on deliverability, not templates'
    );
  });

  it('passes knowledge entries to AI generator', async () => {
    mockGetLeadMagnetByScope.mockResolvedValue({ data: MOCK_LEAD_MAGNET_WITH_BRAIN, error: null });
    mockSearchKnowledgeV2.mockResolvedValue({ entries: MOCK_SEARCH_ENTRIES });

    await emailSequenceService.generate('lm-1', true, MOCK_SCOPE);

    const { context } = mockGenerateEmailSequence.mock.calls[0][0];
    expect(context.brainEntries).toHaveLength(2);
    expect(context.brainEntries[0].content).toBe('PlusVibe deliverability is 3x better');
    expect(context.brainEntries[0].knowledge_type).toBe('insight');
  });

  it('searches knowledge with lead magnet title', async () => {
    mockGetLeadMagnetByScope.mockResolvedValue({ data: MOCK_LEAD_MAGNET, error: null });

    await emailSequenceService.generate('lm-1', true, MOCK_SCOPE);

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        query: 'Cold Email Checklist',
        limit: 8,
        minQuality: 2,
        teamId: 'team-1',
      })
    );
  });

  it('falls back to cached position when concept has no brain position', async () => {
    mockGetLeadMagnetByScope.mockResolvedValue({ data: MOCK_LEAD_MAGNET, error: null });
    mockSearchKnowledgeV2.mockResolvedValue({ entries: MOCK_SEARCH_ENTRIES });
    mockGetCachedPosition.mockResolvedValue(MOCK_CACHED_POSITION);

    await emailSequenceService.generate('lm-1', true, MOCK_SCOPE);

    // Should have tried cached position for dominant topic
    expect(mockGetCachedPosition).toHaveBeenCalledWith('user-1', 'cold-email', {
      teamId: 'team-1',
    });

    const { context } = mockGenerateEmailSequence.mock.calls[0][0];
    expect(context.brainPosition).toBeDefined();
    expect(context.brainPosition.thesis).toBe('Deliverability is the real bottleneck.');
  });

  it('does not search brain when useAI is false', async () => {
    mockGetLeadMagnetByScope.mockResolvedValue({ data: MOCK_LEAD_MAGNET, error: null });

    await emailSequenceService.generate('lm-1', false, MOCK_SCOPE);

    expect(mockSearchKnowledgeV2).not.toHaveBeenCalled();
    expect(mockGetCachedPosition).not.toHaveBeenCalled();
    expect(mockGenerateDefaultEmailSequence).toHaveBeenCalled();
  });

  it('continues without brain when search fails', async () => {
    mockGetLeadMagnetByScope.mockResolvedValue({ data: MOCK_LEAD_MAGNET, error: null });
    mockSearchKnowledgeV2.mockRejectedValue(new Error('Search unavailable'));

    const result = await emailSequenceService.generate('lm-1', true, MOCK_SCOPE);

    // Should still succeed with AI generation (no brain context)
    expect(result.success).toBe(true);
    expect(mockGenerateEmailSequence).toHaveBeenCalledTimes(1);
    const { context } = mockGenerateEmailSequence.mock.calls[0][0];
    expect(context.brainPosition).toBeUndefined();
    expect(context.brainEntries).toBeUndefined();
  });

  it('does not call getCachedPosition when concept already has brain position', async () => {
    mockGetLeadMagnetByScope.mockResolvedValue({ data: MOCK_LEAD_MAGNET_WITH_BRAIN, error: null });
    mockSearchKnowledgeV2.mockResolvedValue({ entries: MOCK_SEARCH_ENTRIES });

    await emailSequenceService.generate('lm-1', true, MOCK_SCOPE);

    // Should NOT call getCachedPosition since concept already has _brain_position
    expect(mockGetCachedPosition).not.toHaveBeenCalled();
  });

  it('does not call getCachedPosition when no entries have topics', async () => {
    mockGetLeadMagnetByScope.mockResolvedValue({ data: MOCK_LEAD_MAGNET, error: null });
    mockSearchKnowledgeV2.mockResolvedValue({
      entries: [{ id: 'e1', content: 'Some insight', knowledge_type: 'insight', quality_score: 3 }],
    });

    await emailSequenceService.generate('lm-1', true, MOCK_SCOPE);

    // No topics → no dominant topic → no cached position lookup
    expect(mockGetCachedPosition).not.toHaveBeenCalled();
  });
});
