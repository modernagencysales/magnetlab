/**
 * @jest-environment node
 */

// Build chainable mock
const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();
const mockUpsert = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockFrom = jest.fn();

// Set up chaining — mockFrom returns different shapes depending on table
mockFrom.mockReturnValue({
  update: mockUpdate,
  select: mockSelect,
  upsert: mockUpsert,
});
mockUpdate.mockReturnValue({ eq: mockEq });
mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
mockSelect.mockReturnValue({ eq: mockEq });
mockSingle.mockReturnValue({ data: null, error: null });

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import {
  checkForDuplicate,
  supersedeEntry,
  recordCorroboration,
} from '@/lib/services/knowledge-dedup';
import { logError } from '@/lib/utils/logger';

describe('knowledge-dedup', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Re-wire mock chain after clearAllMocks
    mockFrom.mockReturnValue({
      update: mockUpdate,
      select: mockSelect,
      upsert: mockUpsert,
    });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockSingle.mockReturnValue({ data: null, error: null });
  });

  // ----------------------------------------------------------------
  // checkForDuplicate
  // ----------------------------------------------------------------
  describe('checkForDuplicate', () => {
    it('returns insert when RPC returns no matches (empty data array)', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const result = await checkForDuplicate('user-1', [0.1, 0.2], 'Alice');

      expect(result).toEqual({ action: 'insert' });
    });

    it('returns insert when RPC returns an error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      const result = await checkForDuplicate('user-1', [0.1, 0.2], 'Alice');

      expect(result).toEqual({ action: 'insert' });
    });

    it('returns supersede with existingEntryId when similarity > 0.90 and same speaker', async () => {
      mockRpc.mockResolvedValue({
        data: [{ id: 'entry-42', similarity: 0.95, speaker: 'Alice' }],
        error: null,
      });

      const result = await checkForDuplicate('user-1', [0.1, 0.2], 'Alice');

      expect(result).toEqual({
        action: 'supersede',
        existingEntryId: 'entry-42',
      });
    });

    it('returns corroborate with existingEntryId when similarity > 0.90 and different speaker', async () => {
      mockRpc.mockResolvedValue({
        data: [{ id: 'entry-42', similarity: 0.95, speaker: 'Alice' }],
        error: null,
      });

      const result = await checkForDuplicate('user-1', [0.1, 0.2], 'Bob');

      expect(result).toEqual({
        action: 'corroborate',
        existingEntryId: 'entry-42',
      });
    });

    it('returns insert when similarity is in the 0.85-0.90 gap zone', async () => {
      mockRpc.mockResolvedValue({
        data: [{ id: 'entry-42', similarity: 0.88, speaker: 'Alice' }],
        error: null,
      });

      const result = await checkForDuplicate('user-1', [0.1, 0.2], 'Alice');

      expect(result).toEqual({ action: 'insert' });
    });

    it('passes correct arguments to RPC', async () => {
      const embedding = [0.1, 0.2, 0.3];
      mockRpc.mockResolvedValue({ data: [], error: null });

      await checkForDuplicate('user-123', embedding, 'Alice');

      expect(mockRpc).toHaveBeenCalledWith('cp_match_knowledge_entries', {
        query_embedding: JSON.stringify(embedding),
        p_user_id: 'user-123',
        threshold: 0.85,
        match_count: 5,
      });
    });
  });

  // ----------------------------------------------------------------
  // supersedeEntry
  // ----------------------------------------------------------------
  describe('supersedeEntry', () => {
    it('calls update with superseded_by on correct table with both eq filters', async () => {
      // The final .eq in the chain must resolve (no error)
      mockEq.mockReturnValue({ eq: mockEq, error: null });

      await supersedeEntry('user-1', 'old-entry', 'new-entry');

      expect(mockFrom).toHaveBeenCalledWith('cp_knowledge_entries');
      expect(mockUpdate).toHaveBeenCalledWith({ superseded_by: 'new-entry' });
      // Two .eq calls: .eq('id', oldEntryId) and .eq('user_id', userId)
      expect(mockEq).toHaveBeenCalledWith('id', 'old-entry');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('calls logError when update fails', async () => {
      mockEq.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          error: { message: 'update failed' },
        }),
      });

      await supersedeEntry('user-1', 'old-entry', 'new-entry');

      expect(logError).toHaveBeenCalledWith(
        'services/knowledge-dedup',
        expect.any(Error),
        { oldEntryId: 'old-entry', newEntryId: 'new-entry' }
      );
    });
  });

  // ----------------------------------------------------------------
  // recordCorroboration
  // ----------------------------------------------------------------
  describe('recordCorroboration', () => {
    it('verifies entry ownership before upsert (calls select/eq/single)', async () => {
      // Entry found
      mockSingle.mockReturnValue({ data: { id: 'entry-1' }, error: null });
      // Upsert succeeds
      mockUpsert.mockReturnValue({ error: null });

      await recordCorroboration('user-1', 'entry-1', 'corr-entry');

      // First call: select ownership check
      expect(mockFrom).toHaveBeenCalledWith('cp_knowledge_entries');
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith('id', 'entry-1');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSingle).toHaveBeenCalled();
    });

    it('does NOT upsert when entry not found', async () => {
      // Entry NOT found
      mockSingle.mockReturnValue({ data: null, error: null });

      await recordCorroboration('user-1', 'entry-1', 'corr-entry');

      // from() is called once for the select, but upsert should NOT be called
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('calls upsert with correct conflict key when entry is found', async () => {
      // Entry found
      mockSingle.mockReturnValue({ data: { id: 'entry-1' }, error: null });
      // Upsert succeeds
      mockUpsert.mockReturnValue({ error: null });

      await recordCorroboration('user-1', 'entry-1', 'corr-entry');

      // Second from() call is for the upsert
      expect(mockFrom).toHaveBeenCalledWith('cp_knowledge_corroborations');
      expect(mockUpsert).toHaveBeenCalledWith(
        { entry_id: 'entry-1', corroborated_by: 'corr-entry' },
        { onConflict: 'entry_id,corroborated_by' }
      );
    });

    it('calls logError when upsert fails', async () => {
      // Entry found
      mockSingle.mockReturnValue({ data: { id: 'entry-1' }, error: null });
      // Upsert fails
      mockUpsert.mockReturnValue({ error: { message: 'upsert failed' } });

      await recordCorroboration('user-1', 'entry-1', 'corr-entry');

      expect(logError).toHaveBeenCalledWith(
        'services/knowledge-dedup',
        expect.any(Error),
        { entryId: 'entry-1', corroboratedById: 'corr-entry' }
      );
    });
  });
});
