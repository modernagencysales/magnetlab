/**
 * @jest-environment node
 */

// Mock the classifier — must come before imports
jest.mock('@/lib/ai/content-pipeline/edit-classifier', () => ({
  classifyEditPatterns: jest.fn(),
}));

import {
  isSignificantEdit,
  computeEditDiff,
  buildEditRecord,
  captureEdit,
  captureAndClassifyEdit,
  type EditRecordInput,
} from '@/lib/services/edit-capture';

import { classifyEditPatterns } from '@/lib/ai/content-pipeline/edit-classifier';

const mockClassify = classifyEditPatterns as jest.Mock;

describe('edit-capture', () => {
  // ----------------------------------------------------------------
  // isSignificantEdit
  // ----------------------------------------------------------------
  describe('isSignificantEdit', () => {
    it('returns false for identical text', () => {
      const text = 'This is a complete sentence about marketing strategies.';
      expect(isSignificantEdit(text, text)).toBe(false);
    });

    it('returns false for whitespace-only differences', () => {
      const original = 'Hello   world';
      const edited = 'Hello world';
      expect(isSignificantEdit(original, edited)).toBe(false);
    });

    it('returns false for leading/trailing whitespace differences', () => {
      const original = '  Hello world  ';
      const edited = 'Hello world';
      expect(isSignificantEdit(original, edited)).toBe(false);
    });

    it('returns false for trivial typo fix (below 5% threshold)', () => {
      // Single word swap: "oak" → "pine" = 2 unique changed words.
      // Need 41+ unique words so 2/41 = 4.88% < 5%.
      const original =
        'The quick brown fox jumps over a lazy dog and then runs across wide green fields to find some tasty food for the long evening meal near the calm river bank by an old oak tree in the beautiful countryside during autumn';
      const edited =
        'The quick brown fox jumps over a lazy dog and then runs across wide green fields to find some tasty food for the long evening meal near the calm river bank by an old pine tree in the beautiful countryside during autumn';
      expect(isSignificantEdit(original, edited)).toBe(false);
    });

    it('returns true for a meaningful edit', () => {
      const original = 'Our product helps businesses grow their revenue through automation.';
      const edited = 'Our platform empowers agencies to scale their client acquisition through AI-driven outreach.';
      expect(isSignificantEdit(original, edited)).toBe(true);
    });

    it('returns true when text is substantially rewritten', () => {
      const original = 'This is the first draft of the post.';
      const edited = 'Here is a completely rewritten version with new ideas.';
      expect(isSignificantEdit(original, edited)).toBe(true);
    });

    it('returns true for empty original with non-empty edited', () => {
      expect(isSignificantEdit('', 'Brand new content added here.')).toBe(true);
    });

    it('returns false for both empty strings', () => {
      expect(isSignificantEdit('', '')).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // computeEditDiff
  // ----------------------------------------------------------------
  describe('computeEditDiff', () => {
    it('computes word-level additions', () => {
      const original = 'Hello world';
      const edited = 'Hello beautiful world today';
      const diff = computeEditDiff(original, edited);

      expect(diff.added).toContain('beautiful');
      expect(diff.added).toContain('today');
      expect(diff.removed).toEqual([]);
    });

    it('computes word-level removals', () => {
      const original = 'The quick brown fox';
      const edited = 'The fox';
      const diff = computeEditDiff(original, edited);

      expect(diff.removed).toContain('quick');
      expect(diff.removed).toContain('brown');
      expect(diff.added).toEqual([]);
    });

    it('computes both additions and removals', () => {
      const original = 'I love dogs';
      const edited = 'I adore cats';
      const diff = computeEditDiff(original, edited);

      expect(diff.added).toContain('adore');
      expect(diff.added).toContain('cats');
      expect(diff.removed).toContain('love');
      expect(diff.removed).toContain('dogs');
    });

    it('calculates change ratio correctly', () => {
      const original = 'one two three four';
      const edited = 'one two three five';
      const diff = computeEditDiff(original, edited);

      // Changed words: "four" removed, "five" added = 2 unique changed words
      // Total words: max(4, 4) = 4
      // Ratio: 2/4 = 0.5
      expect(diff.changeRatio).toBeCloseTo(0.5, 1);
    });

    it('reports word counts before and after', () => {
      const original = 'Hello world';
      const edited = 'Hello beautiful world today';
      const diff = computeEditDiff(original, edited);

      expect(diff.wordCountBefore).toBe(2);
      expect(diff.wordCountAfter).toBe(4);
    });

    it('handles empty original', () => {
      const diff = computeEditDiff('', 'Brand new content');
      expect(diff.wordCountBefore).toBe(0);
      expect(diff.wordCountAfter).toBe(3);
      expect(diff.added.length).toBeGreaterThan(0);
      expect(diff.changeRatio).toBe(1);
    });

    it('handles empty edited', () => {
      const diff = computeEditDiff('Existing content here', '');
      expect(diff.wordCountBefore).toBe(3);
      expect(diff.wordCountAfter).toBe(0);
      expect(diff.removed.length).toBeGreaterThan(0);
      expect(diff.changeRatio).toBe(1);
    });

    it('deduplicates repeated words in added/removed', () => {
      const original = 'the cat sat on the mat';
      const edited = 'a dog played on a rug';
      const diff = computeEditDiff(original, edited);

      // "the" appears twice in original but should only appear once in removed
      const theCount = diff.removed.filter((w) => w === 'the').length;
      expect(theCount).toBeLessThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------------
  // buildEditRecord
  // ----------------------------------------------------------------
  describe('buildEditRecord', () => {
    const baseInput: EditRecordInput = {
      teamId: 'team-123',
      profileId: 'profile-456',
      contentType: 'post',
      contentId: 'post-789',
      fieldName: 'body',
      originalText: 'Our product helps businesses grow.',
      editedText: 'Our platform empowers agencies to scale through AI-driven outreach and automation.',
      editTags: ['tone_change'],
      ceoNote: 'Made it more specific to our ICP',
    };

    it('returns a complete record for a significant edit', () => {
      const record = buildEditRecord(baseInput);

      expect(record).not.toBeNull();
      expect(record!.team_id).toBe('team-123');
      expect(record!.profile_id).toBe('profile-456');
      expect(record!.content_type).toBe('post');
      expect(record!.content_id).toBe('post-789');
      expect(record!.field_name).toBe('body');
      expect(record!.original_text).toBe(baseInput.originalText);
      expect(record!.edited_text).toBe(baseInput.editedText);
      expect(record!.edit_diff).toBeDefined();
      expect(record!.edit_diff.changeRatio).toBeGreaterThan(0);
      expect(record!.edit_tags).toEqual(['tone_change']);
      expect(record!.ceo_note).toBe('Made it more specific to our ICP');
    });

    it('returns null for an insignificant edit', () => {
      const record = buildEditRecord({
        ...baseInput,
        originalText: 'Hello world',
        editedText: 'Hello  world',
      });

      expect(record).toBeNull();
    });

    it('defaults edit_tags to empty array when not provided', () => {
      const { editTags: _editTags, ...inputWithoutTags } = baseInput;
      const record = buildEditRecord(inputWithoutTags);

      expect(record).not.toBeNull();
      expect(record!.edit_tags).toEqual([]);
    });

    it('defaults ceo_note to null when not provided', () => {
      const { ceoNote: _ceoNote, ...inputWithoutNote } = baseInput;
      const record = buildEditRecord(inputWithoutNote);

      expect(record).not.toBeNull();
      expect(record!.ceo_note).toBeNull();
    });

    it('handles null profileId', () => {
      const record = buildEditRecord({ ...baseInput, profileId: null });

      expect(record).not.toBeNull();
      expect(record!.profile_id).toBeNull();
    });

    it('includes edit_diff with added and removed words', () => {
      const record = buildEditRecord(baseInput);

      expect(record).not.toBeNull();
      expect(Array.isArray(record!.edit_diff.added)).toBe(true);
      expect(Array.isArray(record!.edit_diff.removed)).toBe(true);
      expect(record!.edit_diff.wordCountBefore).toBeGreaterThan(0);
      expect(record!.edit_diff.wordCountAfter).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------
  // captureEdit
  // ----------------------------------------------------------------
  describe('captureEdit', () => {
    const mockInsert = jest.fn();
    const mockSupabase = {
      from: jest.fn().mockReturnValue({
        insert: mockInsert,
      }),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockSupabase.from.mockReturnValue({ insert: mockInsert });
      mockInsert.mockResolvedValue({ error: null });
    });

    const significantInput: EditRecordInput = {
      teamId: 'team-123',
      profileId: 'profile-456',
      contentType: 'post',
      contentId: 'post-789',
      fieldName: 'body',
      originalText: 'Our product helps businesses grow.',
      editedText: 'Our platform empowers agencies to scale through AI-driven outreach and automation.',
    };

    it('inserts a record for a significant edit', async () => {
      await captureEdit(mockSupabase, significantInput);

      expect(mockSupabase.from).toHaveBeenCalledWith('cp_edit_history');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          team_id: 'team-123',
          profile_id: 'profile-456',
          content_type: 'post',
          content_id: 'post-789',
          field_name: 'body',
        })
      );
    });

    it('does not insert for an insignificant edit', async () => {
      await captureEdit(mockSupabase, {
        ...significantInput,
        originalText: 'Hello world',
        editedText: 'Hello  world',
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('logs error on insert failure but does not throw', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockInsert.mockResolvedValue({ error: { message: 'insert failed' } });

      await expect(captureEdit(mockSupabase, significantInput)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[edit-capture] Failed to save edit:',
        expect.objectContaining({ message: 'insert failed' })
      );
      consoleSpy.mockRestore();
    });
  });

  // ----------------------------------------------------------------
  // captureAndClassifyEdit
  // ----------------------------------------------------------------
  describe('captureAndClassifyEdit', () => {
    const mockSelect = jest.fn();
    const mockSingle = jest.fn();
    const mockInsert2 = jest.fn();
    const mockUpdate = jest.fn();
    const mockEq = jest.fn();
    const mockUpdateThen = jest.fn();

    const mockSupabase2 = {
      from: jest.fn(),
    };

    const significantInput: EditRecordInput = {
      teamId: 'team-123',
      profileId: 'profile-456',
      contentType: 'post',
      contentId: 'post-789',
      fieldName: 'body',
      originalText: 'Our product helps businesses grow.',
      editedText: 'Our platform empowers agencies to scale through AI-driven outreach and automation.',
    };

    beforeEach(() => {
      jest.clearAllMocks();

      // Chain: from('cp_edit_history').insert(record).select('id').single()
      mockSingle.mockResolvedValue({ data: { id: 'edit-abc' }, error: null });
      mockSelect.mockReturnValue({ single: mockSingle });
      mockInsert2.mockReturnValue({ select: mockSelect });

      // Chain for update: from('cp_edit_history').update({...}).eq('id', ...)
      mockUpdateThen.mockResolvedValue({ error: null });
      mockEq.mockReturnValue({ then: mockUpdateThen });
      mockUpdate.mockReturnValue({ eq: mockEq });

      mockSupabase2.from.mockImplementation(() => ({
        insert: mockInsert2,
        update: mockUpdate,
      }));

      mockClassify.mockResolvedValue({ patterns: [] });
    });

    it('returns the edit ID on successful insert', async () => {
      const id = await captureAndClassifyEdit(mockSupabase2, significantInput);

      expect(id).toBe('edit-abc');
      expect(mockSupabase2.from).toHaveBeenCalledWith('cp_edit_history');
    });

    it('returns null for an insignificant edit', async () => {
      const id = await captureAndClassifyEdit(mockSupabase2, {
        ...significantInput,
        originalText: 'Hello world',
        editedText: 'Hello  world',
      });

      expect(id).toBeNull();
      expect(mockSupabase2.from).not.toHaveBeenCalled();
    });

    it('returns null on insert failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

      const id = await captureAndClassifyEdit(mockSupabase2, significantInput);

      expect(id).toBeNull();
      consoleSpy.mockRestore();
    });

    it('calls classifyEditPatterns after insert', async () => {
      mockClassify.mockResolvedValue({
        patterns: [{ pattern: 'made_conversational', description: 'Changed tone' }],
      });

      await captureAndClassifyEdit(mockSupabase2, significantInput);

      // Allow async fire-and-forget to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockClassify).toHaveBeenCalledWith({
        originalText: significantInput.originalText,
        editedText: significantInput.editedText,
        contentType: 'post',
        fieldName: 'body',
      });
    });

    it('does not update DB when classification returns no patterns', async () => {
      mockClassify.mockResolvedValue({ patterns: [] });

      await captureAndClassifyEdit(mockSupabase2, significantInput);

      // Allow async fire-and-forget to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      // from() is called once for the insert; should not be called again for update
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('does not throw if classification fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockClassify.mockRejectedValue(new Error('Classification failed'));

      const id = await captureAndClassifyEdit(mockSupabase2, significantInput);

      // Allow async fire-and-forget to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(id).toBe('edit-abc');
      consoleSpy.mockRestore();
    });
  });
});
