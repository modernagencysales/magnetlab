/**
 * @jest-environment node
 */

import { aggregateEditPatterns } from '@/lib/services/style-evolution';

describe('style-evolution', () => {
  describe('aggregateEditPatterns', () => {
    it('aggregates duplicate patterns with counts', () => {
      const edits = [
        {
          auto_classified_changes: {
            patterns: [
              { pattern: 'made_conversational', description: 'Changed formal to casual' },
            ],
          },
          created_at: '2026-02-01T00:00:00Z',
        },
        {
          auto_classified_changes: {
            patterns: [
              { pattern: 'made_conversational', description: 'Softened the tone' },
            ],
          },
          created_at: '2026-02-02T00:00:00Z',
        },
        {
          auto_classified_changes: {
            patterns: [
              { pattern: 'made_conversational', description: 'Used more contractions' },
            ],
          },
          created_at: '2026-02-03T00:00:00Z',
        },
      ];

      const result = aggregateEditPatterns(edits);

      expect(result).toHaveLength(1);
      expect(result[0].pattern).toBe('made_conversational');
      expect(result[0].count).toBe(3);
    });

    it('sorts by count descending', () => {
      const edits = [
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'shortened_text', description: 'Made shorter' }],
          },
          created_at: '2026-02-01T00:00:00Z',
        },
        {
          auto_classified_changes: {
            patterns: [
              { pattern: 'added_cta', description: 'Added call to action' },
              { pattern: 'added_cta', description: 'Stronger CTA' },
            ],
          },
          created_at: '2026-02-02T00:00:00Z',
        },
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'added_cta', description: 'Rewrote CTA' }],
          },
          created_at: '2026-02-03T00:00:00Z',
        },
      ];

      const result = aggregateEditPatterns(edits);

      expect(result.length).toBe(2);
      expect(result[0].pattern).toBe('added_cta');
      expect(result[0].count).toBe(3);
      expect(result[1].pattern).toBe('shortened_text');
      expect(result[1].count).toBe(1);
    });

    it('caps confidence at 1.0 for 10+ occurrences', () => {
      const edits = Array.from({ length: 15 }, (_, i) => ({
        auto_classified_changes: {
          patterns: [{ pattern: 'tone_shift', description: `Desc ${i}` }],
        },
        created_at: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      const result = aggregateEditPatterns(edits);

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(15);
      expect(result[0].confidence).toBe(1);
    });

    it('calculates confidence proportionally below 10 occurrences', () => {
      const edits = Array.from({ length: 5 }, (_, i) => ({
        auto_classified_changes: {
          patterns: [{ pattern: 'vocab_swap', description: `Desc ${i}` }],
        },
        created_at: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      const result = aggregateEditPatterns(edits);

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.5);
    });

    it('handles empty edits array', () => {
      const result = aggregateEditPatterns([]);
      expect(result).toEqual([]);
    });

    it('handles edits with null auto_classified_changes', () => {
      const edits = [
        { auto_classified_changes: null, created_at: '2026-02-01T00:00:00Z' },
        { auto_classified_changes: null, created_at: '2026-02-02T00:00:00Z' },
      ];

      const result = aggregateEditPatterns(edits);
      expect(result).toEqual([]);
    });

    it('handles edits with empty patterns array', () => {
      const edits = [
        { auto_classified_changes: { patterns: [] }, created_at: '2026-02-01T00:00:00Z' },
      ];

      const result = aggregateEditPatterns(edits);
      expect(result).toEqual([]);
    });

    it('handles mixed null and valid auto_classified_changes', () => {
      const edits = [
        { auto_classified_changes: null, created_at: '2026-02-01T00:00:00Z' },
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'added_emoji', description: 'Added emoji' }],
          },
          created_at: '2026-02-02T00:00:00Z',
        },
        { auto_classified_changes: { patterns: [] }, created_at: '2026-02-03T00:00:00Z' },
      ];

      const result = aggregateEditPatterns(edits);

      expect(result).toHaveLength(1);
      expect(result[0].pattern).toBe('added_emoji');
      expect(result[0].count).toBe(1);
    });

    it('uses the latest description when multiple exist', () => {
      const edits = [
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'tone_shift', description: 'First description' }],
          },
          created_at: '2026-02-01T00:00:00Z',
        },
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'tone_shift', description: 'Second description' }],
          },
          created_at: '2026-02-02T00:00:00Z',
        },
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'tone_shift', description: 'Latest description' }],
          },
          created_at: '2026-02-03T00:00:00Z',
        },
      ];

      const result = aggregateEditPatterns(edits);

      expect(result[0].description).toBe('Latest description');
    });

    it('tracks first_seen and last_seen correctly', () => {
      const edits = [
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'structure_change', description: 'Desc 1' }],
          },
          created_at: '2026-02-10T00:00:00Z',
        },
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'structure_change', description: 'Desc 2' }],
          },
          created_at: '2026-02-01T00:00:00Z',
        },
        {
          auto_classified_changes: {
            patterns: [{ pattern: 'structure_change', description: 'Desc 3' }],
          },
          created_at: '2026-02-20T00:00:00Z',
        },
      ];

      const result = aggregateEditPatterns(edits);

      expect(result[0].first_seen).toBe('2026-02-01T00:00:00Z');
      expect(result[0].last_seen).toBe('2026-02-20T00:00:00Z');
    });

    it('handles multiple different patterns in one edit', () => {
      const edits = [
        {
          auto_classified_changes: {
            patterns: [
              { pattern: 'tone_shift', description: 'Changed tone' },
              { pattern: 'shortened_text', description: 'Made shorter' },
              { pattern: 'added_cta', description: 'Added CTA' },
            ],
          },
          created_at: '2026-02-01T00:00:00Z',
        },
      ];

      const result = aggregateEditPatterns(edits);

      expect(result).toHaveLength(3);
      // All have count 1, so order may vary but all should be present
      const patterns = result.map(r => r.pattern);
      expect(patterns).toContain('tone_shift');
      expect(patterns).toContain('shortened_text');
      expect(patterns).toContain('added_cta');
    });

    it('correctly computes confidence for exactly 10 occurrences', () => {
      const edits = Array.from({ length: 10 }, (_, i) => ({
        auto_classified_changes: {
          patterns: [{ pattern: 'exact_ten', description: `Desc ${i}` }],
        },
        created_at: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      const result = aggregateEditPatterns(edits);

      expect(result[0].confidence).toBe(1);
      expect(result[0].count).toBe(10);
    });
  });
});
