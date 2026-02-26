/**
 * @jest-environment node
 */

import {
  buildReviewPayload,
  parseReviewResults,
} from '@/lib/ai/content-pipeline/content-reviewer';
import type { ReviewablePost } from '@/lib/ai/content-pipeline/content-reviewer';

describe('content-reviewer', () => {
  // ============================================
  // buildReviewPayload
  // ============================================

  describe('buildReviewPayload', () => {
    it('formats posts with required fields', () => {
      const posts: ReviewablePost[] = [
        { id: 'post-1', final_content: 'Great post content', hook_score: 8 },
        { id: 'post-2', final_content: 'Another post', hook_score: 6 },
      ];

      const result = JSON.parse(buildReviewPayload(posts));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'post-1',
        content: 'Great post content',
        hook_score: 8,
      });
      expect(result[1]).toEqual({
        id: 'post-2',
        content: 'Another post',
        hook_score: 6,
      });
    });

    it('falls back to draft_content when final_content is null', () => {
      const posts: ReviewablePost[] = [
        { id: 'post-1', final_content: null, draft_content: 'Draft version here' },
      ];

      const result = JSON.parse(buildReviewPayload(posts));

      expect(result[0].content).toBe('Draft version here');
    });

    it('uses empty string when both final_content and draft_content are null', () => {
      const posts: ReviewablePost[] = [
        { id: 'post-1', final_content: null, draft_content: null },
      ];

      const result = JSON.parse(buildReviewPayload(posts));

      expect(result[0].content).toBe('');
    });

    it('sets hook_score to null when not provided', () => {
      const posts: ReviewablePost[] = [
        { id: 'post-1', final_content: 'Content' },
      ];

      const result = JSON.parse(buildReviewPayload(posts));

      expect(result[0].hook_score).toBeNull();
    });

    it('prefers final_content over draft_content', () => {
      const posts: ReviewablePost[] = [
        { id: 'post-1', final_content: 'Final version', draft_content: 'Draft version' },
      ];

      const result = JSON.parse(buildReviewPayload(posts));

      expect(result[0].content).toBe('Final version');
    });
  });

  // ============================================
  // parseReviewResults
  // ============================================

  describe('parseReviewResults', () => {
    it('parses valid review JSON', () => {
      const raw = JSON.stringify([
        {
          post_id: 'post-1',
          review_score: 8.5,
          review_category: 'excellent',
          review_notes: ['Strong hook', 'Good CTA'],
          consistency_flags: [],
        },
        {
          post_id: 'post-2',
          review_score: 5,
          review_category: 'good_with_edits',
          review_notes: ['Weak hook'],
          consistency_flags: ['Reuses same hook pattern as post-1'],
        },
      ]);

      const results = parseReviewResults(raw);

      expect(results).toHaveLength(2);
      expect(results[0].post_id).toBe('post-1');
      expect(results[0].review_score).toBe(8.5);
      expect(results[0].review_category).toBe('excellent');
      expect(results[0].review_notes).toEqual(['Strong hook', 'Good CTA']);
      expect(results[0].consistency_flags).toEqual([]);
      expect(results[1].consistency_flags).toEqual(['Reuses same hook pattern as post-1']);
    });

    it('parses JSON inside markdown code blocks', () => {
      const raw = '```json\n[{"post_id":"p1","review_score":7,"review_category":"good_with_edits","review_notes":["Needs work"],"consistency_flags":[]}]\n```';

      const results = parseReviewResults(raw);

      expect(results).toHaveLength(1);
      expect(results[0].post_id).toBe('p1');
      expect(results[0].review_score).toBe(7);
    });

    it('clamps scores below 1 to 1', () => {
      const raw = JSON.stringify([
        {
          post_id: 'post-1',
          review_score: -5,
          review_category: 'delete',
          review_notes: [],
          consistency_flags: [],
        },
      ]);

      const results = parseReviewResults(raw);

      expect(results[0].review_score).toBe(1);
    });

    it('clamps scores above 10 to 10', () => {
      const raw = JSON.stringify([
        {
          post_id: 'post-1',
          review_score: 15,
          review_category: 'excellent',
          review_notes: [],
          consistency_flags: [],
        },
      ]);

      const results = parseReviewResults(raw);

      expect(results[0].review_score).toBe(10);
    });

    it('falls back to score-based category for invalid review_category', () => {
      const raw = JSON.stringify([
        {
          post_id: 'post-1',
          review_score: 9,
          review_category: 'amazing',
          review_notes: [],
          consistency_flags: [],
        },
        {
          post_id: 'post-2',
          review_score: 6,
          review_category: 'meh',
          review_notes: [],
          consistency_flags: [],
        },
        {
          post_id: 'post-3',
          review_score: 3,
          review_category: 'bad',
          review_notes: [],
          consistency_flags: [],
        },
        {
          post_id: 'post-4',
          review_score: 1,
          review_category: 'terrible',
          review_notes: [],
          consistency_flags: [],
        },
      ]);

      const results = parseReviewResults(raw);

      expect(results[0].review_category).toBe('excellent');     // score 9 -> excellent
      expect(results[1].review_category).toBe('good_with_edits'); // score 6 -> good_with_edits
      expect(results[2].review_category).toBe('needs_rewrite');   // score 3 -> needs_rewrite
      expect(results[3].review_category).toBe('delete');          // score 1 -> delete
    });

    it('returns empty array for completely invalid JSON', () => {
      const results = parseReviewResults('this is not json at all');

      expect(results).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const results = parseReviewResults('{"not":"an array"}');

      expect(results).toEqual([]);
    });

    it('filters out non-string entries from review_notes and consistency_flags', () => {
      const raw = JSON.stringify([
        {
          post_id: 'post-1',
          review_score: 7,
          review_category: 'good_with_edits',
          review_notes: ['Valid note', 123, null, 'Another valid note'],
          consistency_flags: ['Valid flag', false],
        },
      ]);

      const results = parseReviewResults(raw);

      expect(results[0].review_notes).toEqual(['Valid note', 'Another valid note']);
      expect(results[0].consistency_flags).toEqual(['Valid flag']);
    });

    it('defaults score to 5 when review_score is not a number', () => {
      const raw = JSON.stringify([
        {
          post_id: 'post-1',
          review_score: 'high',
          review_category: 'excellent',
          review_notes: [],
          consistency_flags: [],
        },
      ]);

      const results = parseReviewResults(raw);

      expect(results[0].review_score).toBe(5);
    });
  });
});
