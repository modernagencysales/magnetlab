/**
 * Tests for cs-signals.service — business logic for signal ingestion and review.
 * Mocks the repository layer and trigger.dev SDK.
 *
 * @jest-environment node
 */

// --- Mocks (must be before imports) ---

jest.mock('@/server/repositories/cs-signals.repo', () => ({
  findSignals: jest.fn(),
  findSignalById: jest.fn(),
  findSignalByUrl: jest.fn(),
  createSignal: jest.fn(),
  updateSignalStatus: jest.fn(),
  findScrapeConfigs: jest.fn(),
  upsertScrapeConfig: jest.fn(),
}));

jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: {
    trigger: jest.fn(),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

// --- Imports (after mocks) ---

import * as signalsRepo from '@/server/repositories/cs-signals.repo';
import * as signalsService from '@/server/services/cs-signals.service';

const mockFindSignals = signalsRepo.findSignals as jest.Mock;
const mockFindSignalById = signalsRepo.findSignalById as jest.Mock;
const mockFindSignalByUrl = signalsRepo.findSignalByUrl as jest.Mock;
const mockCreateSignal = signalsRepo.createSignal as jest.Mock;
const mockUpdateSignalStatus = signalsRepo.updateSignalStatus as jest.Mock;

// --- Test data ---

const mockSignal = {
  id: 'sig-1',
  source: 'manual',
  source_account_id: null,
  linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
  content: 'Test post about GTM strategy',
  author_name: 'John Doe',
  author_headline: null,
  author_follower_count: null,
  media_type: 'none',
  media_description: null,
  media_urls: [],
  impressions: null,
  likes: 100,
  comments: 20,
  shares: null,
  engagement_multiplier: null,
  niche: null,
  status: 'pending',
  ai_analysis: null,
  submitted_by: 'user-1',
  created_at: '2026-03-11T00:00:00Z',
};

// --- Tests ---

describe('cs-signals.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── listSignals ────────────────────────────────────────────────────────

  describe('listSignals', () => {
    it('delegates to repo and returns formatted result', async () => {
      mockFindSignals.mockResolvedValue({
        data: [mockSignal],
        count: 1,
      });

      const result = await signalsService.listSignals({ limit: 10, offset: 0 });

      expect(result).toEqual({
        signals: [mockSignal],
        total: 1,
        limit: 10,
        offset: 0,
      });
      expect(mockFindSignals).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    });

    it('uses default limit and offset', async () => {
      mockFindSignals.mockResolvedValue({ data: [], count: 0 });

      const result = await signalsService.listSignals({});

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });
  });

  // ─── submitSignal ──────────────────────────────────────────────────────

  describe('submitSignal', () => {
    it('creates signal and triggers analysis', async () => {
      mockFindSignalByUrl.mockResolvedValue(null);
      mockCreateSignal.mockResolvedValue(mockSignal);

      const result = await signalsService.submitSignal(
        {
          linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
          content: 'Test post',
          author_name: 'John Doe',
        },
        'user-1'
      );

      expect(result).toEqual(mockSignal);
      expect(mockCreateSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'manual',
          linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
          content: 'Test post',
          author_name: 'John Doe',
          status: 'pending',
          submitted_by: 'user-1',
        })
      );
    });

    it('throws 409 when URL already exists', async () => {
      mockFindSignalByUrl.mockResolvedValue(mockSignal);

      await expect(
        signalsService.submitSignal(
          {
            linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
            content: 'Duplicate',
            author_name: 'John',
          },
          'user-1'
        )
      ).rejects.toMatchObject({
        message: 'Signal with this URL already exists',
        statusCode: 409,
      });

      expect(mockCreateSignal).not.toHaveBeenCalled();
    });
  });

  // ─── reviewSignal ──────────────────────────────────────────────────────

  describe('reviewSignal', () => {
    it('throws 400 for invalid review status', async () => {
      await expect(signalsService.reviewSignal('sig-1', 'pending' as never)).rejects.toMatchObject({
        message: 'Invalid review status',
        statusCode: 400,
      });
    });

    it('throws 404 when signal not found', async () => {
      mockFindSignalById.mockResolvedValue(null);

      await expect(signalsService.reviewSignal('nonexistent', 'reviewed')).rejects.toMatchObject({
        message: 'Signal not found',
        statusCode: 404,
      });
    });

    it('updates signal status for valid review', async () => {
      mockFindSignalById.mockResolvedValue(mockSignal);
      mockUpdateSignalStatus.mockResolvedValue({ ...mockSignal, status: 'dismissed' });

      const result = await signalsService.reviewSignal('sig-1', 'dismissed');

      expect(result.status).toBe('dismissed');
      expect(mockUpdateSignalStatus).toHaveBeenCalledWith('sig-1', 'dismissed');
    });
  });

  // ─── getStatusCode ────────────────────────────────────────────────────

  describe('getStatusCode', () => {
    it('returns statusCode from error object', () => {
      const err = Object.assign(new Error('test'), { statusCode: 409 });
      expect(signalsService.getStatusCode(err)).toBe(409);
    });

    it('returns 500 for unknown errors', () => {
      expect(signalsService.getStatusCode(new Error('unknown'))).toBe(500);
      expect(signalsService.getStatusCode(null)).toBe(500);
    });
  });
});
