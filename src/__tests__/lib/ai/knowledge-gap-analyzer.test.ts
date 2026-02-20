/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';
import { analyzeTopicGaps } from '@/lib/ai/content-pipeline/knowledge-gap-analyzer';

describe('analyzeTopicGaps', () => {
  it('returns full coverage when all 8 types present', () => {
    const breakdown = {
      how_to: 3, insight: 2, story: 1, question: 2,
      objection: 1, mistake: 1, decision: 1, market_intel: 1,
    };
    const result = analyzeTopicGaps('cold-email', 'Cold Email', breakdown, 4.0, '2026-02-01');

    expect(result.coverage_score).toBe(1.0);
    expect(result.missing_types).toEqual([]);
    expect(result.entry_count).toBe(12);
    expect(result.topic_slug).toBe('cold-email');
    expect(result.topic_name).toBe('Cold Email');
    expect(result.avg_quality).toBe(4.0);
  });

  it('returns correct coverage score for partial types', () => {
    const breakdown = { insight: 5, question: 3 };
    const result = analyzeTopicGaps('sales', 'Sales', breakdown, 3.0, null);

    expect(result.coverage_score).toBe(2 / 8);
    expect(result.missing_types).toEqual(
      expect.arrayContaining(['how_to', 'story', 'objection', 'mistake', 'decision', 'market_intel'])
    );
    expect(result.missing_types).toHaveLength(6);
    expect(result.entry_count).toBe(8);
  });

  it('returns zero coverage for empty breakdown', () => {
    const result = analyzeTopicGaps('empty', 'Empty', {}, null, null);

    expect(result.coverage_score).toBe(0);
    expect(result.missing_types).toHaveLength(8);
    expect(result.entry_count).toBe(0);
    expect(result.gap_patterns).toEqual([]);
  });

  it('detects "asked but not answered" pattern', () => {
    const breakdown = { question: 5, insight: 2 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 3.0, null);

    expect(result.gap_patterns).toContain(
      'Asked but not answered — many questions, no how-to processes documented'
    );
  });

  it('does NOT trigger "asked but not answered" when how_to exists', () => {
    const breakdown = { question: 5, how_to: 1 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 3.0, null);

    expect(result.gap_patterns).not.toContain(
      'Asked but not answered — many questions, no how-to processes documented'
    );
  });

  it('does NOT trigger "asked but not answered" when questions <= 3', () => {
    const breakdown = { question: 3 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 3.0, null);

    expect(result.gap_patterns).not.toContain(
      'Asked but not answered — many questions, no how-to processes documented'
    );
  });

  it('detects "theory without proof" pattern', () => {
    const breakdown = { insight: 5 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 3.5, null);

    expect(result.gap_patterns).toContain(
      'Theory without proof — insights but no case studies or stories'
    );
  });

  it('does NOT trigger "theory without proof" when stories exist', () => {
    const breakdown = { insight: 5, story: 1 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 3.5, null);

    expect(result.gap_patterns).not.toContain(
      'Theory without proof — insights but no case studies or stories'
    );
  });

  it('detects "all talk, no process" pattern', () => {
    const breakdown = { insight: 8, question: 3 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 3.0, null);

    expect(result.gap_patterns).toContain(
      'All talk, no process — lots of knowledge but no documented SOPs'
    );
  });

  it('detects stale knowledge pattern (>90 days)', () => {
    const staleDate = new Date(Date.now() - 100 * 86400000).toISOString();
    const result = analyzeTopicGaps('topic', 'Topic', { insight: 1 }, 3.0, staleDate);

    const stalePattern = result.gap_patterns.find(p => p.startsWith('Stale knowledge'));
    expect(stalePattern).toBeDefined();
    expect(stalePattern).toMatch(/last entry was \d+ days ago/);
  });

  it('does NOT flag stale for recent entries (<90 days)', () => {
    const recentDate = new Date(Date.now() - 30 * 86400000).toISOString();
    const result = analyzeTopicGaps('topic', 'Topic', { insight: 1 }, 3.0, recentDate);

    const stalePattern = result.gap_patterns.find(p => p.startsWith('Stale knowledge'));
    expect(stalePattern).toBeUndefined();
  });

  it('detects "thin but trending" pattern (2-5 entries)', () => {
    const breakdown = { insight: 2, how_to: 1 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 3.0, null);

    expect(result.gap_patterns).toContain(
      "Thin but trending — a few more calls and you'll have enough"
    );
  });

  it('does NOT flag "thin but trending" for 0-1 or 6+ entries', () => {
    const oneEntry = analyzeTopicGaps('t', 'T', { insight: 1 }, 3.0, null);
    expect(oneEntry.gap_patterns).not.toContain(
      "Thin but trending — a few more calls and you'll have enough"
    );

    const sixEntries = analyzeTopicGaps('t', 'T', { insight: 3, how_to: 3 }, 3.0, null);
    expect(sixEntries.gap_patterns).not.toContain(
      "Thin but trending — a few more calls and you'll have enough"
    );
  });

  it('can trigger multiple patterns simultaneously', () => {
    // 11 entries, no how_to, >3 questions, >3 insights, no stories
    const breakdown = { question: 5, insight: 6 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 2.0, null);

    expect(result.gap_patterns).toContain(
      'Asked but not answered — many questions, no how-to processes documented'
    );
    expect(result.gap_patterns).toContain(
      'Theory without proof — insights but no case studies or stories'
    );
    expect(result.gap_patterns).toContain(
      'All talk, no process — lots of knowledge but no documented SOPs'
    );
  });

  it('normalizes type_breakdown to include all 8 types with zero defaults', () => {
    const breakdown = { insight: 3 };
    const result = analyzeTopicGaps('topic', 'Topic', breakdown, 3.0, null);

    expect(result.type_breakdown).toEqual({
      how_to: 0, insight: 3, story: 0, question: 0,
      objection: 0, mistake: 0, decision: 0, market_intel: 0,
    });
  });

  it('passes through avg_quality and last_entry_date', () => {
    const result = analyzeTopicGaps('topic', 'Topic', {}, 4.2, '2026-01-15T00:00:00Z');

    expect(result.avg_quality).toBe(4.2);
    expect(result.last_entry_date).toBe('2026-01-15T00:00:00Z');
  });

  it('handles null avg_quality and last_entry_date', () => {
    const result = analyzeTopicGaps('topic', 'Topic', {}, null, null);

    expect(result.avg_quality).toBeNull();
    expect(result.last_entry_date).toBeNull();
  });
});
