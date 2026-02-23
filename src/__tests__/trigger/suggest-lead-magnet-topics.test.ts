/**
 * @jest-environment node
 */

// Mock Anthropic client
const mockMessagesCreate = jest.fn();
jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: () => ({ messages: { create: mockMessagesCreate } }),
  parseJsonResponse: (text: string) => JSON.parse(text),
}));

jest.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_SONNET_MODEL: 'claude-sonnet-test',
}));

// Mock knowledge brain
const mockListKnowledgeTopics = jest.fn();
const mockGetTopicDetail = jest.fn();
jest.mock('@/lib/services/knowledge-brain', () => ({
  listKnowledgeTopics: (...args: unknown[]) => mockListKnowledgeTopics(...args),
  getTopicDetail: (...args: unknown[]) => mockGetTopicDetail(...args),
}));

// Mock gap analyzer
const mockAnalyzeTopicGaps = jest.fn();
jest.mock('@/lib/ai/content-pipeline/knowledge-gap-analyzer', () => ({
  analyzeTopicGaps: (...args: unknown[]) => mockAnalyzeTopicGaps(...args),
}));

// Mock Supabase
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockInsert = jest.fn();

const mockSupabase = {
  from: mockFrom,
};

// Chain pattern
mockFrom.mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, is: jest.fn().mockReturnValue({ order: mockOrder }) });
mockOrder.mockReturnValue({ limit: mockLimit });
mockLimit.mockReturnValue({ data: [], error: null });

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => mockSupabase,
}));

// Mock Trigger.dev logger
jest.mock('@trigger.dev/sdk/v3', () => ({
  task: (config: { run: Function }) => ({ ...config, trigger: jest.fn() }),
  schedules: { task: (config: { run: Function }) => config },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import AFTER mocks are set up
import { suggestLeadMagnetTopics } from '@/trigger/suggest-lead-magnet-topics';

describe('suggestLeadMagnetTopics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset chain defaults
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, is: jest.fn().mockReturnValue({ order: mockOrder }) });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ data: [], error: null });
  });

  const sampleTopics = [
    { id: 't1', user_id: 'u1', slug: 'cold-outreach', display_name: 'Cold Outreach', entry_count: 15, avg_quality: 4.2, last_seen: '2026-02-20T00:00:00Z', team_id: null, description: null, first_seen: '2026-01-01T00:00:00Z', parent_id: null, created_at: '2026-01-01T00:00:00Z' },
    { id: 't2', user_id: 'u1', slug: 'linkedin-strategy', display_name: 'LinkedIn Strategy', entry_count: 8, avg_quality: 3.5, last_seen: '2026-02-18T00:00:00Z', team_id: null, description: null, first_seen: '2026-01-10T00:00:00Z', parent_id: null, created_at: '2026-01-10T00:00:00Z' },
  ];

  const sampleSuggestions = [
    { title: 'Cold Outreach Automation Checklist', core_insight: 'Step-by-step automation', why_post_worthy: 'Solves manual outreach pain', content_type: 'lead_magnet' },
    { title: 'LinkedIn Content Calendar Template', core_insight: 'Consistent posting framework', why_post_worthy: 'Addresses content consistency gap', content_type: 'lead_magnet' },
    { title: 'B2B Sales Playbook', core_insight: 'Proven playbook framework', why_post_worthy: 'Combines best insights', content_type: 'lead_magnet' },
  ];

  it('returns early with no_topics when no knowledge topics exist', async () => {
    mockListKnowledgeTopics.mockResolvedValue([]);

    const result = await suggestLeadMagnetTopics.run({
      userId: 'user-1',
      teamId: 'team-1',
    });

    expect(result).toEqual({ suggestions: 0, reason: 'no_topics' });
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('queries recent published posts from cp_pipeline_posts', async () => {
    mockListKnowledgeTopics.mockResolvedValue(sampleTopics);
    mockGetTopicDetail.mockResolvedValue({ type_breakdown: { insight: 5, story: 3 }, topic: sampleTopics[0], top_entries: {}, corroboration_count: 0 });
    mockAnalyzeTopicGaps.mockReturnValue({ topic_slug: 'cold-outreach', coverage_score: 0.5, missing_types: ['how_to'], gap_patterns: [], entry_count: 15, avg_quality: 4.2, last_entry_date: null, type_breakdown: {} });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(sampleSuggestions) }],
    });

    // Mock insert to succeed
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cp_content_ideas') {
        return { insert: mockInsert };
      }
      return { select: mockSelect };
    });
    mockInsert.mockReturnValue({ error: null });

    await suggestLeadMagnetTopics.run({ userId: 'user-1' });

    // Should have called from('cp_pipeline_posts')
    expect(mockFrom).toHaveBeenCalledWith('cp_pipeline_posts');
  });

  it('calls Claude with knowledge topics and gap analysis', async () => {
    mockListKnowledgeTopics.mockResolvedValue(sampleTopics);
    mockGetTopicDetail.mockResolvedValue({ type_breakdown: { insight: 5, story: 3 }, topic: sampleTopics[0], top_entries: {}, corroboration_count: 0 });
    mockAnalyzeTopicGaps.mockReturnValue({ topic_slug: 'cold-outreach', coverage_score: 0.5, missing_types: ['how_to'], gap_patterns: [], entry_count: 15, avg_quality: 4.2, last_entry_date: null, type_breakdown: {} });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(sampleSuggestions) }],
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cp_content_ideas') {
        return { insert: mockInsert };
      }
      return { select: mockSelect };
    });
    mockInsert.mockReturnValue({ error: null });

    await suggestLeadMagnetTopics.run({ userId: 'user-1', teamId: 'team-1' });

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Cold Outreach');
    expect(prompt).toContain('LinkedIn Strategy');
    expect(prompt).toContain('lead magnet');
    expect(prompt).toContain('B2B pain point');
  });

  it('stores suggestions in cp_content_ideas with content_type=lead_magnet', async () => {
    mockListKnowledgeTopics.mockResolvedValue(sampleTopics);
    mockGetTopicDetail.mockResolvedValue({ type_breakdown: { insight: 5 }, topic: sampleTopics[0], top_entries: {}, corroboration_count: 0 });
    mockAnalyzeTopicGaps.mockReturnValue({ topic_slug: 'cold-outreach', coverage_score: 0.5, missing_types: [], gap_patterns: [], entry_count: 15, avg_quality: 4.2, last_entry_date: null, type_breakdown: {} });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(sampleSuggestions) }],
    });

    const insertCalls: unknown[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cp_content_ideas') {
        return {
          insert: (data: unknown) => {
            insertCalls.push(data);
            return { error: null };
          },
        };
      }
      return { select: mockSelect };
    });

    const result = await suggestLeadMagnetTopics.run({
      userId: 'user-1',
      profileId: 'profile-1',
    });

    expect(result).toEqual({ suggestions: 3 });
    expect(insertCalls).toHaveLength(3);

    // Verify each insert has the right shape
    for (const call of insertCalls) {
      const row = call as Record<string, unknown>;
      expect(row.user_id).toBe('user-1');
      expect(row.team_profile_id).toBe('profile-1');
      expect(row.content_type).toBe('lead_magnet');
      expect(row.status).toBe('extracted');
      expect(row.title).toBeDefined();
      expect(row.core_insight).toBeDefined();
      expect(row.why_post_worthy).toBeDefined();
    }
  });

  it('returns parse_failed when Claude returns invalid JSON', async () => {
    mockListKnowledgeTopics.mockResolvedValue(sampleTopics);
    mockGetTopicDetail.mockResolvedValue({ type_breakdown: {}, topic: sampleTopics[0], top_entries: {}, corroboration_count: 0 });
    mockAnalyzeTopicGaps.mockReturnValue({ topic_slug: 'cold-outreach', coverage_score: 0, missing_types: [], gap_patterns: [], entry_count: 0, avg_quality: null, last_entry_date: null, type_breakdown: {} });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json' }],
    });

    // parseJsonResponse mock will throw on invalid JSON
    await expect(
      suggestLeadMagnetTopics.run({ userId: 'user-1' })
    ).rejects.toThrow();
  });

  it('handles insert errors gracefully and still returns count of successful inserts', async () => {
    mockListKnowledgeTopics.mockResolvedValue(sampleTopics);
    mockGetTopicDetail.mockResolvedValue({ type_breakdown: { insight: 3 }, topic: sampleTopics[0], top_entries: {}, corroboration_count: 0 });
    mockAnalyzeTopicGaps.mockReturnValue({ topic_slug: 'cold-outreach', coverage_score: 0.3, missing_types: [], gap_patterns: [], entry_count: 3, avg_quality: 3.0, last_entry_date: null, type_breakdown: {} });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(sampleSuggestions) }],
    });

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cp_content_ideas') {
        return {
          insert: () => {
            callCount++;
            // First insert fails, rest succeed
            if (callCount === 1) {
              return { error: { message: 'check constraint violation' } };
            }
            return { error: null };
          },
        };
      }
      return { select: mockSelect };
    });

    const result = await suggestLeadMagnetTopics.run({ userId: 'user-1' });

    // 2 out of 3 succeeded
    expect(result).toEqual({ suggestions: 2 });
  });

  it('passes teamId to listKnowledgeTopics and getTopicDetail', async () => {
    mockListKnowledgeTopics.mockResolvedValue([]);

    await suggestLeadMagnetTopics.run({ userId: 'user-1', teamId: 'team-abc' });

    expect(mockListKnowledgeTopics).toHaveBeenCalledWith('user-1', { teamId: 'team-abc', limit: 30 });
  });

  it('sets team_profile_id to null when profileId is not provided', async () => {
    mockListKnowledgeTopics.mockResolvedValue(sampleTopics);
    mockGetTopicDetail.mockResolvedValue({ type_breakdown: {}, topic: sampleTopics[0], top_entries: {}, corroboration_count: 0 });
    mockAnalyzeTopicGaps.mockReturnValue({ topic_slug: 'cold-outreach', coverage_score: 0, missing_types: [], gap_patterns: [], entry_count: 0, avg_quality: null, last_entry_date: null, type_breakdown: {} });

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(sampleSuggestions) }],
    });

    const insertCalls: unknown[] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cp_content_ideas') {
        return {
          insert: (data: unknown) => {
            insertCalls.push(data);
            return { error: null };
          },
        };
      }
      return { select: mockSelect };
    });

    await suggestLeadMagnetTopics.run({ userId: 'user-1' });

    for (const call of insertCalls) {
      expect((call as Record<string, unknown>).team_profile_id).toBeNull();
    }
  });
});
