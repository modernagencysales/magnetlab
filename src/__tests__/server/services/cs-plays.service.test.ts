/**
 * Tests for cs-plays.service — business logic for play CRUD, results, feedback, assignments.
 * Mocks repository layers.
 *
 * @jest-environment node
 */

// --- Mocks (must be before imports) ---

jest.mock('@/server/repositories/cs-plays.repo', () => ({
  findPlays: jest.fn(),
  findPlayById: jest.fn(),
  createPlay: jest.fn(),
  updatePlay: jest.fn(),
  deletePlay: jest.fn(),
  linkSignalsToPlay: jest.fn(),
  countSignalsByPlayId: jest.fn(),
  findResultsByPlayId: jest.fn(),
  countPostsByPlayId: jest.fn(),
  countFeedbackByPlayId: jest.fn(),
  findTemplatesByPlayId: jest.fn(),
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  findFeedbackByPlayId: jest.fn(),
  upsertFeedback: jest.fn(),
  createAssignment: jest.fn(),
  findAssignmentsByUserId: jest.fn(),
  createPlayResult: jest.fn(),
}));

jest.mock('@/server/repositories/cs-signals.repo', () => ({
  findSignalById: jest.fn(),
  updateSignalStatus: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

// --- Imports (after mocks) ---

import * as playsRepo from '@/server/repositories/cs-plays.repo';
import * as signalsRepo from '@/server/repositories/cs-signals.repo';
import * as playsService from '@/server/services/cs-plays.service';

const mockFindPlayById = playsRepo.findPlayById as jest.Mock;
const mockCreatePlay = playsRepo.createPlay as jest.Mock;
const mockLinkSignalsToPlay = playsRepo.linkSignalsToPlay as jest.Mock;
const mockCountSignals = playsRepo.countSignalsByPlayId as jest.Mock;
const mockFindResults = playsRepo.findResultsByPlayId as jest.Mock;
const mockCountPosts = playsRepo.countPostsByPlayId as jest.Mock;
const mockCountFeedback = playsRepo.countFeedbackByPlayId as jest.Mock;
const mockFindSignalById = signalsRepo.findSignalById as jest.Mock;
const mockUpdateSignalStatus = signalsRepo.updateSignalStatus as jest.Mock;

// --- Test data ---

const mockPlay = {
  id: 'play-1',
  title: 'Carousel Hook Pattern',
  thesis: 'Carousels with question hooks get 5x engagement',
  exploit_type: 'hook_pattern',
  format_instructions: 'Start with a question, use carousel format',
  status: 'testing',
  visibility: 'internal',
  niches: ['saas', 'b2b'],
  last_used_at: null,
  created_by: 'user-1',
  created_at: '2026-03-11T00:00:00Z',
  updated_at: '2026-03-11T00:00:00Z',
};

const mockSignal = {
  id: 'sig-1',
  source: 'manual',
  content: 'Test signal',
  author_name: 'John',
  status: 'reviewed',
};

// --- Tests ---

describe('cs-plays.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── createPlay ─────────────────────────────────────────────────────────

  describe('createPlay', () => {
    it('creates play and links signals', async () => {
      mockFindSignalById.mockResolvedValue(mockSignal);
      mockCreatePlay.mockResolvedValue(mockPlay);
      mockLinkSignalsToPlay.mockResolvedValue(undefined);
      mockUpdateSignalStatus.mockResolvedValue(undefined);

      const result = await playsService.createPlay(
        {
          title: 'Carousel Hook Pattern',
          thesis: 'Carousels with question hooks get 5x engagement',
          exploit_type: 'hook_pattern',
          format_instructions: 'Start with a question, use carousel format',
          signal_ids: ['sig-1'],
        },
        'user-1'
      );

      expect(result).toEqual(mockPlay);
      expect(mockCreatePlay).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Carousel Hook Pattern',
          status: 'draft',
          visibility: 'internal',
          created_by: 'user-1',
        })
      );
      expect(mockLinkSignalsToPlay).toHaveBeenCalledWith('play-1', ['sig-1']);
    });

    it('throws 400 when signal not found', async () => {
      mockFindSignalById.mockResolvedValue(null);

      await expect(
        playsService.createPlay(
          {
            title: 'Missing Signal Play',
            thesis: 'Test',
            exploit_type: 'hook_pattern',
            format_instructions: 'Test',
            signal_ids: ['nonexistent'],
          },
          'user-1'
        )
      ).rejects.toMatchObject({
        message: expect.stringContaining('Signals not found'),
        statusCode: 400,
      });
    });
  });

  // ─── updatePlay ─────────────────────────────────────────────────────────

  describe('updatePlay', () => {
    it('throws 404 when play not found', async () => {
      mockFindPlayById.mockResolvedValue(null);

      await expect(
        playsService.updatePlay('nonexistent', { status: 'proven' })
      ).rejects.toMatchObject({
        message: 'Play not found',
        statusCode: 404,
      });
    });

    it('updates play for valid input', async () => {
      mockFindPlayById.mockResolvedValue(mockPlay);
      (playsRepo.updatePlay as jest.Mock).mockResolvedValue({
        ...mockPlay,
        status: 'proven',
      });

      const result = await playsService.updatePlay('play-1', { status: 'proven' });

      expect(result.status).toBe('proven');
    });
  });

  // ─── getPlayById ────────────────────────────────────────────────────────

  describe('getPlayById', () => {
    it('returns null when play not found', async () => {
      mockFindPlayById.mockResolvedValue(null);

      const result = await playsService.getPlayById('nonexistent');
      expect(result).toBeNull();
    });

    it('returns PlayWithStats with computed stats', async () => {
      mockFindPlayById.mockResolvedValue(mockPlay);
      mockCountSignals.mockResolvedValue(3);
      mockFindResults.mockResolvedValue([
        { multiplier: 4, niche: 'saas' },
        { multiplier: 5, niche: 'saas' },
        { multiplier: 6, niche: 'b2b' },
      ]);
      mockCountPosts.mockResolvedValue(10);
      mockCountFeedback.mockResolvedValue({ up: 8, down: 2 });

      const result = await playsService.getPlayById('play-1');

      expect(result).not.toBeNull();
      expect(result!.signal_count).toBe(3);
      expect(result!.test_count).toBe(3);
      expect(result!.avg_multiplier).toBe(5);
      expect(result!.usage_count).toBe(10);
      expect(result!.feedback_up).toBe(8);
      expect(result!.feedback_down).toBe(2);
    });

    it('promotion_suggestion is "promote" when testing + avg>=3 + low variance + >=5 results', async () => {
      mockFindPlayById.mockResolvedValue({ ...mockPlay, status: 'testing' });
      mockCountSignals.mockResolvedValue(2);
      mockFindResults.mockResolvedValue([
        { multiplier: 4, niche: 'saas' },
        { multiplier: 4, niche: 'saas' },
        { multiplier: 3.5, niche: 'b2b' },
        { multiplier: 3.5, niche: 'b2b' },
        { multiplier: 4, niche: 'saas' },
      ]);
      mockCountPosts.mockResolvedValue(5);
      mockCountFeedback.mockResolvedValue({ up: 3, down: 0 });

      const result = await playsService.getPlayById('play-1');

      expect(result!.promotion_suggestion).toBe('promote');
    });

    it('promotion_suggestion is "decline" when proven + recent avg < 1.0', async () => {
      mockFindPlayById.mockResolvedValue({ ...mockPlay, status: 'proven' });
      mockCountSignals.mockResolvedValue(2);
      mockFindResults.mockResolvedValue([
        { multiplier: 0.5, niche: 'saas' },
        { multiplier: 0.8, niche: 'saas' },
        { multiplier: 0.6, niche: 'b2b' },
        { multiplier: 0.4, niche: 'b2b' },
        { multiplier: 0.7, niche: 'saas' },
      ]);
      mockCountPosts.mockResolvedValue(5);
      mockCountFeedback.mockResolvedValue({ up: 1, down: 4 });

      const result = await playsService.getPlayById('play-1');

      expect(result!.promotion_suggestion).toBe('decline');
    });

    it('promotion_suggestion is null with < 5 results (minResultsForPromotion)', async () => {
      mockFindPlayById.mockResolvedValue({ ...mockPlay, status: 'testing' });
      mockCountSignals.mockResolvedValue(1);
      mockFindResults.mockResolvedValue([
        { multiplier: 10, niche: 'saas' },
        { multiplier: 10, niche: 'saas' },
        { multiplier: 10, niche: 'saas' },
        { multiplier: 10, niche: 'saas' },
      ]);
      mockCountPosts.mockResolvedValue(4);
      mockCountFeedback.mockResolvedValue({ up: 2, down: 0 });

      const result = await playsService.getPlayById('play-1');

      expect(result!.promotion_suggestion).toBeNull();
    });
  });

  // ─── getPlayResults ─────────────────────────────────────────────────────

  describe('getPlayResults', () => {
    it('throws 404 when play not found', async () => {
      mockFindPlayById.mockResolvedValue(null);

      await expect(playsService.getPlayResults('nonexistent')).rejects.toMatchObject({
        message: 'Play not found',
        statusCode: 404,
      });
    });

    it('computes niche breakdown', async () => {
      mockFindPlayById.mockResolvedValue(mockPlay);
      mockFindResults.mockResolvedValue([
        { multiplier: 4, niche: 'saas' },
        { multiplier: 6, niche: 'saas' },
        { multiplier: 3, niche: 'b2b' },
      ]);

      const result = await playsService.getPlayResults('play-1');

      expect(result.niche_breakdown).toHaveLength(2);
      const saas = result.niche_breakdown.find((n: { niche: string }) => n.niche === 'saas');
      expect(saas).toBeDefined();
      expect(saas!.count).toBe(2);
      expect(saas!.avg_multiplier).toBe(5);

      const b2b = result.niche_breakdown.find((n: { niche: string }) => n.niche === 'b2b');
      expect(b2b).toBeDefined();
      expect(b2b!.count).toBe(1);
      expect(b2b!.avg_multiplier).toBe(3);
    });
  });

  // ─── deletePlay ─────────────────────────────────────────────────────────

  describe('deletePlay', () => {
    it('throws 404 when play not found', async () => {
      mockFindPlayById.mockResolvedValue(null);

      await expect(playsService.deletePlay('nonexistent')).rejects.toMatchObject({
        message: 'Play not found',
        statusCode: 404,
      });
    });
  });

  // ─── getStatusCode ─────────────────────────────────────────────────────

  describe('getStatusCode', () => {
    it('returns statusCode from error object', () => {
      const err = Object.assign(new Error('test'), { statusCode: 404 });
      expect(playsService.getStatusCode(err)).toBe(404);
    });

    it('returns 500 for unknown errors', () => {
      expect(playsService.getStatusCode(new Error('unknown'))).toBe(500);
    });
  });
});
