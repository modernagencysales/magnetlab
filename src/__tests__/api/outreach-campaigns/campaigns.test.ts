/**
 * @jest-environment node
 *
 * API route tests for outreach campaigns.
 * Mocks the service layer — tests that routes wire params correctly and handle service results.
 */

import { NextRequest } from 'next/server';

// ─── Auth mock ───────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

// ─── Service mock ─────────────────────────────────────────────────────────────

jest.mock('@/server/services/outreach-campaigns.service', () => ({
  listCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  getCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaign: jest.fn(),
  activateCampaign: jest.fn(),
  pauseCampaign: jest.fn(),
  listLeads: jest.fn(),
  addLeads: jest.fn(),
  getLead: jest.fn(),
  skipLead: jest.fn(),
  getStatusCode: jest.fn(() => 500),
}));

// ─── Queue repo mock (for linkedin-activity) ─────────────────────────────────

jest.mock('@/server/repositories/linkedin-action-queue.repo', () => ({
  listActivityLog: jest.fn(),
}));

// ─── Logger mock ─────────────────────────────────────────────────────────────

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { auth } from '@/lib/auth';
import * as service from '@/server/services/outreach-campaigns.service';
import * as queueRepo from '@/server/repositories/linkedin-action-queue.repo';

import { GET as listCampaigns, POST as createCampaign } from '@/app/api/outreach-campaigns/route';
import {
  GET as getCampaign,
  PATCH as updateCampaign,
  DELETE as deleteCampaign,
} from '@/app/api/outreach-campaigns/[id]/route';
import { POST as activateCampaign } from '@/app/api/outreach-campaigns/[id]/activate/route';
import { POST as pauseCampaign } from '@/app/api/outreach-campaigns/[id]/pause/route';
import { GET as listLeads, POST as addLeads } from '@/app/api/outreach-campaigns/[id]/leads/route';
import { GET as getLead } from '@/app/api/outreach-campaigns/[id]/leads/[leadId]/route';
import { POST as skipLead } from '@/app/api/outreach-campaigns/[id]/leads/[leadId]/skip/route';
import { GET as getActivity } from '@/app/api/linkedin-activity/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SESSION = { user: { id: 'user-123' } };

function makeRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(url, options);
}

function routeParams(p: Record<string, string>) {
  return { params: Promise.resolve(p) };
}

const mockCampaign = {
  id: 'camp-1',
  user_id: 'user-123',
  team_id: null,
  name: 'Test Campaign',
  preset: 'warm_connect' as const,
  unipile_account_id: 'acct-1',
  connect_message: null,
  first_message_template: 'Hi {{name}}',
  follow_up_template: null,
  follow_up_delay_days: 3,
  withdraw_delay_days: 14,
  status: 'draft' as const,
  created_at: '2026-03-19T00:00:00Z',
  updated_at: '2026-03-19T00:00:00Z',
};

const mockLead = {
  id: 'lead-1',
  user_id: 'user-123',
  campaign_id: 'camp-1',
  linkedin_url: 'https://linkedin.com/in/janesmith',
  linkedin_username: 'janesmith',
  unipile_provider_id: null,
  name: 'Jane Smith',
  company: 'Acme Corp',
  current_step_order: 1,
  status: 'pending' as const,
  step_completed_at: null,
  viewed_at: null,
  connect_sent_at: null,
  connected_at: null,
  messaged_at: null,
  follow_up_sent_at: null,
  withdrawn_at: null,
  error: null,
  created_at: '2026-03-19T00:00:00Z',
  updated_at: '2026-03-19T00:00:00Z',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Outreach Campaigns API', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── GET /api/outreach-campaigns ─────────────────────────────────────────

  describe('GET /api/outreach-campaigns', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const res = await listCampaigns(makeRequest('http://localhost/api/outreach-campaigns'));
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
    });

    it('returns 200 with campaigns array', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.listCampaigns as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockCampaign],
      });
      const res = await listCampaigns(makeRequest('http://localhost/api/outreach-campaigns'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.campaigns)).toBe(true);
      expect(body.campaigns).toHaveLength(1);
    });

    it('returns 400 for invalid status filter', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      const res = await listCampaigns(
        makeRequest('http://localhost/api/outreach-campaigns?status=invalid')
      );
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/outreach-campaigns ────────────────────────────────────────

  describe('POST /api/outreach-campaigns', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const res = await createCampaign(
        makeRequest('http://localhost/api/outreach-campaigns', {
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
      expect(res.status).toBe(401);
    });

    it('returns 201 on valid input', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.createCampaign as jest.Mock).mockResolvedValue({
        success: true,
        data: mockCampaign,
      });
      const res = await createCampaign(
        makeRequest('http://localhost/api/outreach-campaigns', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Test Campaign',
            preset: 'warm_connect',
            unipile_account_id: 'acct-1',
            first_message_template: 'Hi {{name}}',
          }),
        })
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.campaign).toBeDefined();
      expect(body.campaign.id).toBe('camp-1');
    });

    it('returns 400 on validation failure', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      const res = await createCampaign(
        makeRequest('http://localhost/api/outreach-campaigns', {
          method: 'POST',
          body: JSON.stringify({ name: '' }),
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Name is required');
    });
  });

  // ─── GET /api/outreach-campaigns/[id] ────────────────────────────────────

  describe('GET /api/outreach-campaigns/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const res = await getCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1'),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(401);
    });

    it('returns campaign with stats and progress', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      const stats = {
        total: 5,
        pending: 3,
        active: 1,
        completed: 1,
        replied: 0,
        withdrawn: 0,
        failed: 0,
        skipped: 0,
      };
      const progress = { viewed: 2, connect_sent: 1, connected: 1, messaged: 1, follow_up_sent: 0 };
      (service.getCampaign as jest.Mock).mockResolvedValue({
        success: true,
        data: { ...mockCampaign, stats, progress },
      });
      const res = await getCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1'),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.campaign).toBeDefined();
      expect(body.stats).toEqual(stats);
      expect(body.progress).toEqual(progress);
    });

    it('returns 404 when campaign not found', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.getCampaign as jest.Mock).mockResolvedValue({
        success: false,
        error: 'not_found',
        message: 'Campaign not found',
      });
      const res = await getCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/missing'),
        routeParams({ id: 'missing' })
      );
      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/outreach-campaigns/[id] ──────────────────────────────────

  describe('PATCH /api/outreach-campaigns/[id]', () => {
    it('returns 200 on successful update', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.updateCampaign as jest.Mock).mockResolvedValue({
        success: true,
        data: { ...mockCampaign, name: 'Updated Name' },
      });
      const res = await updateCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated Name' }),
        }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.campaign.name).toBe('Updated Name');
    });
  });

  // ─── DELETE /api/outreach-campaigns/[id] ─────────────────────────────────

  describe('DELETE /api/outreach-campaigns/[id]', () => {
    it('returns 200 on successful delete', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.deleteCampaign as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'camp-1' },
      });
      const res = await deleteCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1', { method: 'DELETE' }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ─── POST /api/outreach-campaigns/[id]/activate ──────────────────────────

  describe('POST /api/outreach-campaigns/[id]/activate', () => {
    it('returns 400 when campaign has 0 leads', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.activateCampaign as jest.Mock).mockResolvedValue({
        success: false,
        error: 'validation',
        message: 'Campaign must have at least one lead before activation',
      });
      const res = await activateCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/activate', { method: 'POST' }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('lead');
    });

    it('returns 200 on successful activation', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.activateCampaign as jest.Mock).mockResolvedValue({
        success: true,
        data: { ...mockCampaign, status: 'active' },
      });
      const res = await activateCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/activate', { method: 'POST' }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.campaign.status).toBe('active');
    });

    it('returns 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const res = await activateCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/activate', { method: 'POST' }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/outreach-campaigns/[id]/pause ─────────────────────────────

  describe('POST /api/outreach-campaigns/[id]/pause', () => {
    it('returns 200 on successful pause', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.pauseCampaign as jest.Mock).mockResolvedValue({
        success: true,
        data: { ...mockCampaign, status: 'paused' },
      });
      const res = await pauseCampaign(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/pause', { method: 'POST' }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.campaign.status).toBe('paused');
    });
  });

  // ─── GET /api/outreach-campaigns/[id]/leads ──────────────────────────────

  describe('GET /api/outreach-campaigns/[id]/leads', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const res = await listLeads(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads'),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(401);
    });

    it('returns leads array', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.listLeads as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockLead],
      });
      const res = await listLeads(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads'),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.leads)).toBe(true);
      expect(body.leads).toHaveLength(1);
    });

    it('returns 400 for invalid status filter', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      const res = await listLeads(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads?status=bogus'),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/outreach-campaigns/[id]/leads ─────────────────────────────

  describe('POST /api/outreach-campaigns/[id]/leads', () => {
    it('returns 201 with inserted count', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.addLeads as jest.Mock).mockResolvedValue({
        success: true,
        data: { inserted: 2 },
      });
      const res = await addLeads(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads', {
          method: 'POST',
          body: JSON.stringify({
            leads: [
              { linkedin_url: 'https://linkedin.com/in/alice', name: 'Alice' },
              { linkedin_url: 'https://linkedin.com/in/bob', name: 'Bob' },
            ],
          }),
        }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.inserted).toBe(2);
    });

    it('returns 400 when leads is not an array', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      const res = await addLeads(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads', {
          method: 'POST',
          body: JSON.stringify({ leads: 'not-an-array' }),
        }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when service validation fails', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.addLeads as jest.Mock).mockResolvedValue({
        success: false,
        error: 'validation',
        message: 'Invalid LinkedIn profile URL(s)',
      });
      const res = await addLeads(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads', {
          method: 'POST',
          body: JSON.stringify({
            leads: [{ linkedin_url: 'https://example.com/not-linkedin' }],
          }),
        }),
        routeParams({ id: 'camp-1' })
      );
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/outreach-campaigns/[id]/leads/[leadId] ─────────────────────

  describe('GET /api/outreach-campaigns/[id]/leads/[leadId]', () => {
    it('returns 200 with lead detail', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.getLead as jest.Mock).mockResolvedValue({
        success: true,
        data: mockLead,
      });
      const res = await getLead(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads/lead-1'),
        routeParams({ id: 'camp-1', leadId: 'lead-1' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lead.id).toBe('lead-1');
    });

    it('returns 404 when lead not found', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.getLead as jest.Mock).mockResolvedValue({
        success: false,
        error: 'not_found',
        message: 'Lead not found',
      });
      const res = await getLead(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads/missing'),
        routeParams({ id: 'camp-1', leadId: 'missing' })
      );
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/outreach-campaigns/[id]/leads/[leadId]/skip ───────────────

  describe('POST /api/outreach-campaigns/[id]/leads/[leadId]/skip', () => {
    it('returns 200 with skipped lead', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (service.skipLead as jest.Mock).mockResolvedValue({
        success: true,
        data: { ...mockLead, status: 'skipped' },
      });
      const res = await skipLead(
        makeRequest('http://localhost/api/outreach-campaigns/camp-1/leads/lead-1/skip', {
          method: 'POST',
        }),
        routeParams({ id: 'camp-1', leadId: 'lead-1' })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lead.status).toBe('skipped');
    });
  });

  // ─── GET /api/linkedin-activity ──────────────────────────────────────────

  describe('GET /api/linkedin-activity', () => {
    it('returns 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);
      const res = await getActivity(makeRequest('http://localhost/api/linkedin-activity'));
      expect(res.status).toBe(401);
    });

    it('returns activity array', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (queueRepo.listActivityLog as jest.Mock).mockResolvedValue({
        data: [
          {
            id: 'act-1',
            user_id: 'user-123',
            unipile_account_id: 'acct-1',
            action_type: 'view_profile',
            target_provider_id: null,
            target_linkedin_url: 'https://linkedin.com/in/test',
            source_type: 'outreach',
            source_campaign_id: 'camp-1',
            source_lead_id: 'lead-1',
            payload: {},
            result: {},
            created_at: '2026-03-19T00:00:00Z',
          },
        ],
        error: null,
      });
      const res = await getActivity(makeRequest('http://localhost/api/linkedin-activity'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.activity)).toBe(true);
      expect(body.activity).toHaveLength(1);
    });

    it('returns 500 on db error', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (queueRepo.listActivityLog as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Connection error' },
      });
      const res = await getActivity(makeRequest('http://localhost/api/linkedin-activity'));
      expect(res.status).toBe(500);
    });

    it('passes query params to listActivityLog', async () => {
      (auth as jest.Mock).mockResolvedValue(SESSION);
      (queueRepo.listActivityLog as jest.Mock).mockResolvedValue({ data: [], error: null });
      await getActivity(
        makeRequest(
          'http://localhost/api/linkedin-activity?account_id=acct-1&action_type=connect&limit=10&offset=5'
        )
      );
      expect(queueRepo.listActivityLog as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acct-1',
          actionType: 'connect',
          limit: 10,
          offset: 5,
        })
      );
    });
  });
});
