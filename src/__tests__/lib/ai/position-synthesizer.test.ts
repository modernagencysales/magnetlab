/**
 * @jest-environment node
 */

// Mock modules — must come before imports
jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn(),
  parseJsonResponse: jest.fn(),
}));

jest.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_SONNET_MODEL: 'claude-sonnet-test',
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { synthesizePosition } from '@/lib/ai/content-pipeline/position-synthesizer';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import type { KnowledgeEntry } from '@/lib/types/content-pipeline';

const mockGetAnthropic = getAnthropicClient as jest.Mock;
const mockParseJson = parseJsonResponse as jest.Mock;

function mockEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2, 8)}`,
    user_id: 'user-1',
    transcript_id: 'tx-1',
    category: 'insight',
    speaker: 'host',
    content: 'Test knowledge entry content',
    context: null,
    tags: [],
    transcript_type: 'coaching',
    knowledge_type: 'insight',
    quality_score: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as KnowledgeEntry;
}

const MOCK_POSITION_RESPONSE = {
  thesis: 'Cold email works but only with the right infrastructure.',
  stance_type: 'contrarian',
  confidence: 0.85,
  key_arguments: ['PlusVibe over Instantly', 'Multi-channel is essential'],
  unique_data_points: [
    { claim: '1,500 emails, 3% reply rate', evidence_strength: 'measured', source_entry_index: 0 },
  ],
  stories: [
    {
      hook: 'We burned $2K on Instantly',
      arc: 'Switched to PlusVibe',
      lesson: 'Infrastructure matters',
      source_entry_index: 1,
    },
  ],
  specific_recommendations: [
    { recommendation: 'Use PlusVibe', reasoning: 'Better deliverability', source_entry_index: 0 },
  ],
  voice_markers: ['infrastructure matters more than copy'],
  differentiators: ['Focuses on deliverability, not templates'],
  contradictions: [],
  related_topics: ['linkedin-outreach', 'lead-generation'],
  coverage_gaps: ['No deliverability metrics'],
};

describe('synthesizePosition', () => {
  beforeEach(() => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(MOCK_POSITION_RESPONSE) }],
    });
    mockGetAnthropic.mockReturnValue({ messages: { create: mockCreate } });
    mockParseJson.mockReturnValue(MOCK_POSITION_RESPONSE);
  });

  it('returns null when fewer than 3 entries', async () => {
    const result = await synthesizePosition([mockEntry(), mockEntry()], 'cold email', 'cold-email');
    expect(result).toBeNull();
  });

  it('returns Position with correct shape for valid entries', async () => {
    const entries = [mockEntry({ id: 'e1' }), mockEntry({ id: 'e2' }), mockEntry({ id: 'e3' })];
    const result = await synthesizePosition(entries, 'cold email', 'cold-email');

    expect(result).not.toBeNull();
    expect(result!.topic).toBe('cold email');
    expect(result!.topic_slug).toBe('cold-email');
    expect(result!.thesis).toBe('Cold email works but only with the right infrastructure.');
    expect(result!.stance_type).toBe('contrarian');
    expect(result!.confidence).toBe(0.85);
    expect(result!.key_arguments).toHaveLength(2);
    expect(result!.supporting_entry_ids).toEqual(['e1', 'e2', 'e3']);
    expect(result!.entry_count).toBe(3);
    expect(result!.synthesized_at).toBeTruthy();
  });

  it('resolves source_entry_index to actual entry IDs', async () => {
    const entries = [mockEntry({ id: 'e1' }), mockEntry({ id: 'e2' }), mockEntry({ id: 'e3' })];
    const result = await synthesizePosition(entries, 'cold email', 'cold-email');

    expect(result!.unique_data_points[0].source_entry_id).toBe('e1');
    expect(result!.stories[0].source_entry_id).toBe('e2');
  });

  it('clamps confidence to 0-1 range', async () => {
    mockParseJson.mockReturnValue({ ...MOCK_POSITION_RESPONSE, confidence: 1.5 });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.confidence).toBe(1);
  });

  it('defaults invalid stance_type to experiential', async () => {
    mockParseJson.mockReturnValue({ ...MOCK_POSITION_RESPONSE, stance_type: 'invalid' });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.stance_type).toBe('experiential');
  });

  it('defaults invalid evidence_strength to anecdotal', async () => {
    mockParseJson.mockReturnValue({
      ...MOCK_POSITION_RESPONSE,
      unique_data_points: [{ claim: 'test', evidence_strength: 'unknown', source_entry_index: 0 }],
    });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.unique_data_points[0].evidence_strength).toBe('anecdotal');
  });

  it('handles empty arrays in response gracefully', async () => {
    mockParseJson.mockReturnValue({
      thesis: 'Test',
      stance_type: 'nuanced',
      confidence: 0.5,
      key_arguments: [],
      unique_data_points: [],
      stories: [],
      specific_recommendations: [],
      voice_markers: [],
      differentiators: [],
      contradictions: [],
      related_topics: [],
      coverage_gaps: [],
    });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.key_arguments).toEqual([]);
    expect(result!.stories).toEqual([]);
  });

  it('caps arrays at their maximum lengths', async () => {
    mockParseJson.mockReturnValue({
      ...MOCK_POSITION_RESPONSE,
      key_arguments: Array(20).fill('arg'),
      voice_markers: Array(20).fill('marker'),
    });
    const entries = [mockEntry(), mockEntry(), mockEntry()];
    const result = await synthesizePosition(entries, 'test', 'test');
    expect(result!.key_arguments.length).toBeLessThanOrEqual(7);
    expect(result!.voice_markers.length).toBeLessThanOrEqual(10);
  });
});
