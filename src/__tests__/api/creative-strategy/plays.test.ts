/**
 * Tests for the Creative Strategy Plays, Templates, Config, Feedback, Assign API route handlers.
 * Validates auth (401), super-admin gating (403), validation (400), and happy paths.
 *
 * @jest-environment node
 */

// --- Mocks (must be before imports) ---

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/super-admin', () => ({
  isSuperAdmin: jest.fn(),
}));

jest.mock('@/server/services/cs-plays.service', () => ({
  listPlays: jest.fn(),
  getPlayById: jest.fn(),
  createPlay: jest.fn(),
  updatePlay: jest.fn(),
  deletePlay: jest.fn(),
  getPlayResults: jest.fn(),
  getFeedbackByPlayId: jest.fn(),
  submitFeedback: jest.fn(),
  assignPlay: jest.fn(),
  getTemplatesByPlayId: jest.fn(),
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  getStatusCode: jest.fn().mockReturnValue(500),
}));

jest.mock('@/server/services/cs-signals.service', () => ({
  listScrapeConfigs: jest.fn(),
  updateScrapeConfig: jest.fn(),
  getStatusCode: jest.fn().mockReturnValue(500),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

// --- Imports (after mocks) ---

import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as playsService from '@/server/services/cs-plays.service';
import * as signalsService from '@/server/services/cs-signals.service';

import { GET as getPlays, POST as postPlay } from '@/app/api/creative-strategy/plays/route';
import {
  GET as getPlayById,
  PATCH as patchPlay,
  DELETE as deletePlay,
} from '@/app/api/creative-strategy/plays/[id]/route';
import { GET as getPlayResults } from '@/app/api/creative-strategy/plays/[id]/results/route';
import {
  GET as getPlayFeedback,
  POST as postPlayFeedback,
} from '@/app/api/creative-strategy/plays/[id]/feedback/route';
import { POST as postAssignPlay } from '@/app/api/creative-strategy/plays/[id]/assign/route';
import {
  GET as getTemplates,
  POST as postTemplate,
} from '@/app/api/creative-strategy/templates/route';
import {
  PATCH as patchTemplate,
  DELETE as deleteTemplate,
} from '@/app/api/creative-strategy/templates/[id]/route';
import { GET as getConfig, PUT as putConfig } from '@/app/api/creative-strategy/config/route';

const mockAuth = auth as jest.Mock;
const mockIsSuperAdmin = isSuperAdmin as jest.Mock;
const mockListPlays = playsService.listPlays as jest.Mock;
const mockGetPlayById = playsService.getPlayById as jest.Mock;
const mockCreatePlay = playsService.createPlay as jest.Mock;
const mockUpdatePlay = playsService.updatePlay as jest.Mock;
const mockDeletePlay = playsService.deletePlay as jest.Mock;
const mockGetPlayResults = playsService.getPlayResults as jest.Mock;
const mockGetFeedback = playsService.getFeedbackByPlayId as jest.Mock;
const mockSubmitFeedback = playsService.submitFeedback as jest.Mock;
const mockAssignPlay = playsService.assignPlay as jest.Mock;
const mockGetTemplates = playsService.getTemplatesByPlayId as jest.Mock;
const mockCreateTemplate = playsService.createTemplate as jest.Mock;
const mockUpdateTemplate = playsService.updateTemplate as jest.Mock;
const mockDeleteTemplate = playsService.deleteTemplate as jest.Mock;
const mockPlaysGetStatusCode = playsService.getStatusCode as jest.Mock;
const mockListScrapeConfigs = signalsService.listScrapeConfigs as jest.Mock;
const mockUpdateScrapeConfig = signalsService.updateScrapeConfig as jest.Mock;
const _mockSignalsGetStatusCode = signalsService.getStatusCode as jest.Mock;

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

const mockPlayWithStats = {
  ...mockPlay,
  signal_count: 3,
  test_count: 5,
  avg_multiplier: 4.5,
  usage_count: 10,
  feedback_up: 8,
  feedback_down: 2,
  promotion_suggestion: null,
};

const mockTemplate = {
  id: 'tpl-1',
  play_id: 'play-1',
  name: 'Question Hook Carousel',
  structure: {
    hook_pattern: 'Open with a provocative question',
    body_format: 'Carousel slides with one point each',
    cta_style: 'Ask for thoughts in comments',
    line_count_range: [5, 10],
  },
  media_instructions: 'Use 5-7 slides',
  example_output: 'Example carousel content...',
  created_at: '2026-03-11T00:00:00Z',
};

const mockFeedback = {
  id: 'fb-1',
  play_id: 'play-1',
  user_id: 'user-1',
  rating: 'up',
  note: 'Worked great for my audience',
  created_at: '2026-03-11T00:00:00Z',
};

const mockAssignment = {
  id: 'assign-1',
  play_id: 'play-1',
  user_id: 'user-2',
  assigned_by: 'user-1',
  status: 'active',
  assigned_at: '2026-03-11T00:00:00Z',
  updated_at: '2026-03-11T00:00:00Z',
};

const mockScrapeConfig = {
  id: 'config-1',
  config_type: 'own_account',
  outlier_threshold_multiplier: 5,
  min_reactions: 50,
  min_comments: 10,
  target_niches: ['saas'],
  search_keywords: ['GTM'],
  active: true,
};

// --- Helpers ---

function buildRequest(url: string, body?: object, method = 'GET') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// --- Tests ---

describe('Creative Strategy Plays API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/creative-strategy/plays ───────────────────────────────────

  describe('GET /api/creative-strategy/plays', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await getPlays(buildRequest('http://localhost/api/creative-strategy/plays'));
      expect(response.status).toBe(401);
    });

    it('returns plays for authenticated super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListPlays.mockResolvedValue({
        plays: [mockPlay],
        total: 1,
        limit: 50,
        offset: 0,
      });

      const response = await getPlays(buildRequest('http://localhost/api/creative-strategy/plays'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.plays).toHaveLength(1);
      expect(body.total).toBe(1);
    });
  });

  // ─── POST /api/creative-strategy/plays ──────────────────────────────────

  describe('POST /api/creative-strategy/plays', () => {
    const validPlayInput = {
      title: 'Carousel Hook Pattern',
      thesis: 'Carousels with question hooks get 5x engagement',
      exploit_type: 'hook_pattern',
      format_instructions: 'Start with a question, use carousel format',
      signal_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    };

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await postPlay(
        buildRequest('http://localhost/api/creative-strategy/plays', validPlayInput, 'POST')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await postPlay(
        buildRequest('http://localhost/api/creative-strategy/plays', validPlayInput, 'POST')
      );
      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid body (missing required fields)', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const response = await postPlay(
        buildRequest('http://localhost/api/creative-strategy/plays', {}, 'POST')
      );
      expect(response.status).toBe(400);
    });

    it('creates play for valid input', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockCreatePlay.mockResolvedValue(mockPlay);

      const response = await postPlay(
        buildRequest('http://localhost/api/creative-strategy/plays', validPlayInput, 'POST')
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.id).toBe('play-1');
      expect(mockCreatePlay).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Carousel Hook Pattern' }),
        'user-1'
      );
    });

    it('returns service error status code on known error', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      const error = Object.assign(new Error('Signals not found'), {
        statusCode: 400,
      });
      mockCreatePlay.mockRejectedValue(error);
      mockPlaysGetStatusCode.mockReturnValue(400);

      const response = await postPlay(
        buildRequest('http://localhost/api/creative-strategy/plays', validPlayInput, 'POST')
      );
      expect(response.status).toBe(400);
    });
  });

  // ─── GET /api/creative-strategy/plays/[id] ─────────────────────────────

  describe('GET /api/creative-strategy/plays/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await getPlayById(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1'),
        makeParams('play-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns play with stats for authenticated user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockGetPlayById.mockResolvedValue(mockPlayWithStats);

      const response = await getPlayById(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1'),
        makeParams('play-1')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('play-1');
      expect(body.signal_count).toBe(3);
    });

    it('returns 404 when play not found', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockGetPlayById.mockResolvedValue(null);

      const response = await getPlayById(
        buildRequest('http://localhost/api/creative-strategy/plays/nonexistent'),
        makeParams('nonexistent')
      );
      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH /api/creative-strategy/plays/[id] ───────────────────────────

  describe('PATCH /api/creative-strategy/plays/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await patchPlay(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1',
          { status: 'proven' },
          'PATCH'
        ),
        makeParams('play-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await patchPlay(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1',
          { status: 'proven' },
          'PATCH'
        ),
        makeParams('play-1')
      );
      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid body', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const response = await patchPlay(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1',
          { status: 'invalid_status' },
          'PATCH'
        ),
        makeParams('play-1')
      );
      expect(response.status).toBe(400);
    });

    it('updates play for valid input', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockUpdatePlay.mockResolvedValue({ ...mockPlay, status: 'proven' });

      const response = await patchPlay(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1',
          { status: 'proven' },
          'PATCH'
        ),
        makeParams('play-1')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('proven');
    });
  });

  // ─── DELETE /api/creative-strategy/plays/[id] ──────────────────────────

  describe('DELETE /api/creative-strategy/plays/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await deletePlay(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1', undefined, 'DELETE'),
        makeParams('play-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await deletePlay(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1', undefined, 'DELETE'),
        makeParams('play-1')
      );
      expect(response.status).toBe(403);
    });

    it('deletes play for authenticated super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockDeletePlay.mockResolvedValue(undefined);

      const response = await deletePlay(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1', undefined, 'DELETE'),
        makeParams('play-1')
      );
      expect(response.status).toBe(204);
    });
  });

  // ─── GET /api/creative-strategy/plays/[id]/results ─────────────────────

  describe('GET /api/creative-strategy/plays/[id]/results', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await getPlayResults(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1/results'),
        makeParams('play-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns results for authenticated user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockGetPlayResults.mockResolvedValue({
        results: [],
        niche_breakdown: [],
      });

      const response = await getPlayResults(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1/results'),
        makeParams('play-1')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('results');
      expect(body).toHaveProperty('niche_breakdown');
    });
  });

  // ─── GET/POST /api/creative-strategy/plays/[id]/feedback ───────────────

  describe('GET /api/creative-strategy/plays/[id]/feedback', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await getPlayFeedback(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1/feedback'),
        makeParams('play-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns feedback for authenticated user', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockGetFeedback.mockResolvedValue([mockFeedback]);

      const response = await getPlayFeedback(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1/feedback'),
        makeParams('play-1')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(1);
    });
  });

  describe('POST /api/creative-strategy/plays/[id]/feedback', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await postPlayFeedback(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1/feedback',
          { rating: 'up' },
          'POST'
        ),
        makeParams('play-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid body', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

      const response = await postPlayFeedback(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1/feedback',
          { rating: 'invalid' },
          'POST'
        ),
        makeParams('play-1')
      );
      expect(response.status).toBe(400);
    });

    it('submits feedback for valid input', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockSubmitFeedback.mockResolvedValue(mockFeedback);

      const response = await postPlayFeedback(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1/feedback',
          { rating: 'up', note: 'Worked great for my audience' },
          'POST'
        ),
        makeParams('play-1')
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.rating).toBe('up');
      expect(mockSubmitFeedback).toHaveBeenCalledWith('play-1', 'user-1', {
        rating: 'up',
        note: 'Worked great for my audience',
      });
    });
  });

  // ─── POST /api/creative-strategy/plays/[id]/assign ─────────────────────

  describe('POST /api/creative-strategy/plays/[id]/assign', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await postAssignPlay(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1/assign',
          { user_id: 'user-2' },
          'POST'
        ),
        makeParams('play-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await postAssignPlay(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1/assign',
          { user_id: 'user-2' },
          'POST'
        ),
        makeParams('play-1')
      );
      expect(response.status).toBe(403);
    });

    it('returns 400 when user_id is missing', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const response = await postAssignPlay(
        buildRequest('http://localhost/api/creative-strategy/plays/play-1/assign', {}, 'POST'),
        makeParams('play-1')
      );
      expect(response.status).toBe(400);
    });

    it('assigns play for valid input', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockAssignPlay.mockResolvedValue(mockAssignment);

      const response = await postAssignPlay(
        buildRequest(
          'http://localhost/api/creative-strategy/plays/play-1/assign',
          { user_id: 'user-2' },
          'POST'
        ),
        makeParams('play-1')
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.user_id).toBe('user-2');
      expect(mockAssignPlay).toHaveBeenCalledWith('play-1', 'user-2', 'user-1');
    });
  });

  // ─── GET/POST /api/creative-strategy/templates ─────────────────────────

  describe('GET /api/creative-strategy/templates', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await getTemplates(
        buildRequest('http://localhost/api/creative-strategy/templates?play_id=play-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await getTemplates(
        buildRequest('http://localhost/api/creative-strategy/templates?play_id=play-1')
      );
      expect(response.status).toBe(403);
    });

    it('returns templates for super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockGetTemplates.mockResolvedValue([mockTemplate]);

      const response = await getTemplates(
        buildRequest('http://localhost/api/creative-strategy/templates?play_id=play-1')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(1);
    });

    it('returns 400 when play_id is missing', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const response = await getTemplates(
        buildRequest('http://localhost/api/creative-strategy/templates')
      );
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/creative-strategy/templates', () => {
    const validTemplateInput = {
      play_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Question Hook Carousel',
      structure: {
        hook_pattern: 'Open with a provocative question',
        body_format: 'Carousel slides with one point each',
        cta_style: 'Ask for thoughts in comments',
        line_count_range: [5, 10],
      },
      media_instructions: 'Use 5-7 slides',
      example_output: 'Example carousel content...',
    };

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await postTemplate(
        buildRequest('http://localhost/api/creative-strategy/templates', validTemplateInput, 'POST')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await postTemplate(
        buildRequest('http://localhost/api/creative-strategy/templates', validTemplateInput, 'POST')
      );
      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid body', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const response = await postTemplate(
        buildRequest('http://localhost/api/creative-strategy/templates', {}, 'POST')
      );
      expect(response.status).toBe(400);
    });

    it('creates template for valid input', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockCreateTemplate.mockResolvedValue(mockTemplate);

      const response = await postTemplate(
        buildRequest('http://localhost/api/creative-strategy/templates', validTemplateInput, 'POST')
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.id).toBe('tpl-1');
    });
  });

  // ─── PATCH/DELETE /api/creative-strategy/templates/[id] ────────────────

  describe('PATCH /api/creative-strategy/templates/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await patchTemplate(
        buildRequest(
          'http://localhost/api/creative-strategy/templates/tpl-1',
          { name: 'Updated' },
          'PATCH'
        ),
        makeParams('tpl-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await patchTemplate(
        buildRequest(
          'http://localhost/api/creative-strategy/templates/tpl-1',
          { name: 'Updated' },
          'PATCH'
        ),
        makeParams('tpl-1')
      );
      expect(response.status).toBe(403);
    });

    it('updates template for valid input', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockUpdateTemplate.mockResolvedValue({ ...mockTemplate, name: 'Updated' });

      const response = await patchTemplate(
        buildRequest(
          'http://localhost/api/creative-strategy/templates/tpl-1',
          { name: 'Updated' },
          'PATCH'
        ),
        makeParams('tpl-1')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Updated');
    });
  });

  describe('DELETE /api/creative-strategy/templates/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await deleteTemplate(
        buildRequest('http://localhost/api/creative-strategy/templates/tpl-1', undefined, 'DELETE'),
        makeParams('tpl-1')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await deleteTemplate(
        buildRequest('http://localhost/api/creative-strategy/templates/tpl-1', undefined, 'DELETE'),
        makeParams('tpl-1')
      );
      expect(response.status).toBe(403);
    });

    it('deletes template for authenticated super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockDeleteTemplate.mockResolvedValue(undefined);

      const response = await deleteTemplate(
        buildRequest('http://localhost/api/creative-strategy/templates/tpl-1', undefined, 'DELETE'),
        makeParams('tpl-1')
      );
      expect(response.status).toBe(204);
    });
  });

  // ─── GET/PUT /api/creative-strategy/config ─────────────────────────────

  describe('GET /api/creative-strategy/config', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await getConfig(
        buildRequest('http://localhost/api/creative-strategy/config')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await getConfig(
        buildRequest('http://localhost/api/creative-strategy/config')
      );
      expect(response.status).toBe(403);
    });

    it('returns configs for super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListScrapeConfigs.mockResolvedValue([mockScrapeConfig]);

      const response = await getConfig(
        buildRequest('http://localhost/api/creative-strategy/config')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(1);
    });
  });

  describe('PUT /api/creative-strategy/config', () => {
    const validConfigInput = {
      config_type: 'own_account',
      outlier_threshold_multiplier: 5,
      min_reactions: 50,
      min_comments: 10,
      target_niches: ['saas'],
      search_keywords: ['GTM'],
      active: true,
    };

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await putConfig(
        buildRequest('http://localhost/api/creative-strategy/config', validConfigInput, 'PUT')
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await putConfig(
        buildRequest('http://localhost/api/creative-strategy/config', validConfigInput, 'PUT')
      );
      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid body', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const response = await putConfig(
        buildRequest('http://localhost/api/creative-strategy/config', {}, 'PUT')
      );
      expect(response.status).toBe(400);
    });

    it('updates config for valid input', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockUpdateScrapeConfig.mockResolvedValue(mockScrapeConfig);

      const response = await putConfig(
        buildRequest('http://localhost/api/creative-strategy/config', validConfigInput, 'PUT')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.config_type).toBe('own_account');
    });
  });
});
