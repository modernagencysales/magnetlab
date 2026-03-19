/**
 * Tests for outreach-campaigns.service — business logic for campaign CRUD, leads, and rendering.
 * Mocks the repository layer.
 *
 * @jest-environment node
 */

// ─── Mocks (before imports) ──────────────────────────────────────────────────

jest.mock('@/server/repositories/outreach-campaigns.repo', () => ({
  createCampaign: jest.fn(),
  getCampaign: jest.fn(),
  listCampaigns: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaign: jest.fn(),
  getCampaignStats: jest.fn(),
  getCampaignProgress: jest.fn(),
  bulkAddLeads: jest.fn(),
  listLeads: jest.fn(),
  getLead: jest.fn(),
  skipLead: jest.fn(),
}));

jest.mock('@/server/repositories/linkedin-action-queue.repo', () => ({
  cancelByCampaign: jest.fn(),
  cancelByLead: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import * as campaignRepo from '@/server/repositories/outreach-campaigns.repo';
import * as queueRepo from '@/server/repositories/linkedin-action-queue.repo';
import * as service from '@/server/services/outreach-campaigns.service';

// ─── Typed mock helpers ──────────────────────────────────────────────────────

const mockCreateCampaign = campaignRepo.createCampaign as jest.Mock;
const mockGetCampaign = campaignRepo.getCampaign as jest.Mock;
const _mockListCampaigns = campaignRepo.listCampaigns as jest.Mock;
const mockUpdateCampaign = campaignRepo.updateCampaign as jest.Mock;
const mockDeleteCampaign = campaignRepo.deleteCampaign as jest.Mock;
const mockGetCampaignStats = campaignRepo.getCampaignStats as jest.Mock;
const _mockGetCampaignProgress = campaignRepo.getCampaignProgress as jest.Mock;
const mockBulkAddLeads = campaignRepo.bulkAddLeads as jest.Mock;
const mockListLeads = campaignRepo.listLeads as jest.Mock;
const mockGetLead = campaignRepo.getLead as jest.Mock;
const mockSkipLead = campaignRepo.skipLead as jest.Mock;
const mockCancelByCampaign = queueRepo.cancelByCampaign as jest.Mock;
const mockCancelByLead = queueRepo.cancelByLead as jest.Mock;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const TEAM_ID = 'team-xyz';
const CAMPAIGN_ID = 'campaign-1';
const LEAD_ID = 'lead-1';

const mockCampaign = {
  id: CAMPAIGN_ID,
  user_id: USER_ID,
  team_id: TEAM_ID,
  name: 'Test Campaign',
  preset: 'warm_connect',
  unipile_account_id: 'acc_123',
  first_message_template: 'Hey {{name}}, saw you work at {{company}}!',
  connect_message: null,
  follow_up_template: null,
  follow_up_delay_days: 3,
  withdraw_delay_days: 14,
  status: 'draft',
  created_at: '2026-03-19T00:00:00Z',
  updated_at: '2026-03-19T00:00:00Z',
};

const mockStats = {
  total: 10,
  pending: 5,
  active: 3,
  completed: 1,
  replied: 1,
  withdrawn: 0,
  failed: 0,
  skipped: 0,
};

const _mockProgress = {
  viewed: 8,
  connect_sent: 5,
  connected: 3,
  messaged: 3,
  follow_up_sent: 1,
};

const mockLead = {
  id: LEAD_ID,
  user_id: USER_ID,
  campaign_id: CAMPAIGN_ID,
  linkedin_url: 'https://linkedin.com/in/johndoe',
  linkedin_username: 'johndoe',
  unipile_provider_id: null,
  name: 'John Doe',
  company: 'Acme Corp',
  current_step_order: 0,
  status: 'pending',
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

const validInput = {
  name: 'My Campaign',
  preset: 'warm_connect' as const,
  unipile_account_id: 'acc_123',
  first_message_template: 'Hey {{name}}, saw you work at {{company}}!',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockCancelByCampaign.mockResolvedValue({ data: [], error: null });
  mockCancelByLead.mockResolvedValue({ data: [], error: null });
});

// ─── validateCampaignInput ───────────────────────────────────────────────────

describe('validateCampaignInput', () => {
  it('accepts valid input', () => {
    const result = service.validateCampaignInput(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = service.validateCampaignInput({ ...validInput, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/name/i);
    }
  });

  it('rejects missing name (whitespace only)', () => {
    const result = service.validateCampaignInput({ ...validInput, name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
    }
  });

  it('rejects invalid preset', () => {
    const result = service.validateCampaignInput({
      ...validInput,
      preset: 'invalid_preset' as never,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/preset/i);
    }
  });

  it('rejects missing first_message_template', () => {
    const result = service.validateCampaignInput({
      ...validInput,
      first_message_template: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/template/i);
    }
  });

  it('rejects missing unipile_account_id', () => {
    const result = service.validateCampaignInput({
      ...validInput,
      unipile_account_id: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/account/i);
    }
  });
});

// ─── renderTemplate ──────────────────────────────────────────────────────────

describe('renderTemplate', () => {
  it('replaces {{name}} placeholder', () => {
    const result = service.renderTemplate('Hi {{name}}!', { name: 'Alice', company: 'Acme' });
    expect(result).toBe('Hi Alice!');
  });

  it('replaces {{company}} placeholder', () => {
    const result = service.renderTemplate('I see you work at {{company}}', {
      name: 'Bob',
      company: 'Globex',
    });
    expect(result).toBe('I see you work at Globex');
  });

  it('replaces both placeholders', () => {
    const result = service.renderTemplate('Hey {{name}} from {{company}}!', {
      name: 'Carol',
      company: 'Initech',
    });
    expect(result).toBe('Hey Carol from Initech!');
  });

  it('replaces multiple occurrences', () => {
    const result = service.renderTemplate('{{name}} — hello {{name}}!', {
      name: 'Dave',
      company: 'Umbrella',
    });
    expect(result).toBe('Dave — hello Dave!');
  });

  it('falls back to empty string for missing name', () => {
    const result = service.renderTemplate('Hi {{name}}!', { name: '', company: '' });
    expect(result).toBe('Hi !');
  });

  it('returns template unchanged when no placeholders present', () => {
    const template = 'No placeholders here.';
    expect(service.renderTemplate(template, { name: 'Eve', company: 'Weyland' })).toBe(template);
  });
});

// ─── createCampaign ──────────────────────────────────────────────────────────

describe('createCampaign', () => {
  it('validates input before calling repo', async () => {
    const result = await service.createCampaign(USER_ID, TEAM_ID, {
      ...validInput,
      name: '',
    });
    expect(result.success).toBe(false);
    expect(mockCreateCampaign).not.toHaveBeenCalled();
  });

  it('calls repo and returns campaign on success', async () => {
    mockCreateCampaign.mockResolvedValue({ data: mockCampaign, error: null });

    const result = await service.createCampaign(USER_ID, TEAM_ID, validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(CAMPAIGN_ID);
    }
    expect(mockCreateCampaign).toHaveBeenCalledWith(USER_ID, TEAM_ID, validInput);
  });

  it('returns database error when repo fails', async () => {
    mockCreateCampaign.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const result = await service.createCampaign(USER_ID, TEAM_ID, validInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('database');
    }
  });
});

// ─── activateCampaign ────────────────────────────────────────────────────────

describe('activateCampaign', () => {
  it('returns not_found when campaign does not exist', async () => {
    mockGetCampaign.mockResolvedValue({ data: null, error: null });

    const result = await service.activateCampaign(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('not_found');
    }
  });

  it('fails validation when campaign has 0 leads', async () => {
    mockGetCampaign.mockResolvedValue({ data: mockCampaign, error: null });
    mockGetCampaignStats.mockResolvedValue({ ...mockStats, total: 0 });

    const result = await service.activateCampaign(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/lead/i);
    }
  });

  it('fails validation when campaign has no first_message_template', async () => {
    mockGetCampaign.mockResolvedValue({
      data: { ...mockCampaign, first_message_template: '' },
      error: null,
    });
    mockGetCampaignStats.mockResolvedValue(mockStats);

    const result = await service.activateCampaign(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/template/i);
    }
  });

  it('succeeds and updates status to active', async () => {
    mockGetCampaign.mockResolvedValue({ data: mockCampaign, error: null });
    mockGetCampaignStats.mockResolvedValue(mockStats);
    mockUpdateCampaign.mockResolvedValue({
      data: { ...mockCampaign, status: 'active' },
      error: null,
    });

    const result = await service.activateCampaign(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('active');
    }
  });
});

// ─── pauseCampaign ───────────────────────────────────────────────────────────

describe('pauseCampaign', () => {
  it('cancels queued actions then updates status', async () => {
    mockUpdateCampaign.mockResolvedValue({
      data: { ...mockCampaign, status: 'paused' },
      error: null,
    });

    const result = await service.pauseCampaign(USER_ID, CAMPAIGN_ID);
    expect(mockCancelByCampaign).toHaveBeenCalledWith(CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('paused');
    }
  });

  it('still updates status even if cancel throws', async () => {
    mockCancelByCampaign.mockRejectedValue(new Error('Queue error'));
    mockUpdateCampaign.mockResolvedValue({
      data: { ...mockCampaign, status: 'paused' },
      error: null,
    });

    const result = await service.pauseCampaign(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(true);
  });

  it('returns not_found when campaign does not exist', async () => {
    mockUpdateCampaign.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await service.pauseCampaign(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('not_found');
    }
  });
});

// ─── deleteCampaign ──────────────────────────────────────────────────────────

describe('deleteCampaign', () => {
  it('cancels queued actions then deletes', async () => {
    mockDeleteCampaign.mockResolvedValue({ error: null });

    const result = await service.deleteCampaign(USER_ID, CAMPAIGN_ID);
    expect(mockCancelByCampaign).toHaveBeenCalledWith(CAMPAIGN_ID);
    expect(mockDeleteCampaign).toHaveBeenCalledWith(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(CAMPAIGN_ID);
    }
  });

  it('still deletes even if cancel throws', async () => {
    mockCancelByCampaign.mockRejectedValue(new Error('Queue error'));
    mockDeleteCampaign.mockResolvedValue({ error: null });

    const result = await service.deleteCampaign(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(true);
  });

  it('returns database error when delete fails', async () => {
    mockDeleteCampaign.mockResolvedValue({ error: { message: 'DB failure' } });

    const result = await service.deleteCampaign(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('database');
    }
  });
});

// ─── addLeads ────────────────────────────────────────────────────────────────

describe('addLeads', () => {
  const validLeads = [
    { linkedin_url: 'https://linkedin.com/in/johndoe', name: 'John', company: 'Acme' },
    { linkedin_url: 'https://linkedin.com/in/janedoe', name: 'Jane', company: 'Globex' },
  ];

  it('rejects more than 500 leads', async () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => ({
      linkedin_url: `https://linkedin.com/in/user${i}`,
    }));

    const result = await service.addLeads(USER_ID, CAMPAIGN_ID, tooMany);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
      expect(result.message).toMatch(/500/);
    }
    expect(mockBulkAddLeads).not.toHaveBeenCalled();
  });

  it('rejects invalid LinkedIn URLs', async () => {
    const result = await service.addLeads(USER_ID, CAMPAIGN_ID, [
      { linkedin_url: 'https://example.com/not-linkedin' },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation');
    }
    expect(mockBulkAddLeads).not.toHaveBeenCalled();
  });

  it('calls bulkAddLeads and returns inserted count', async () => {
    mockBulkAddLeads.mockResolvedValue({ inserted: 2, error: null });

    const result = await service.addLeads(USER_ID, CAMPAIGN_ID, validLeads);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inserted).toBe(2);
    }
    expect(mockBulkAddLeads).toHaveBeenCalledWith(USER_ID, CAMPAIGN_ID, validLeads);
  });

  it('returns database error when repo fails', async () => {
    mockBulkAddLeads.mockResolvedValue({ inserted: 0, error: { message: 'Insert failed' } });

    const result = await service.addLeads(USER_ID, CAMPAIGN_ID, validLeads);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('database');
    }
  });

  it('accepts exactly 500 leads', async () => {
    const exactly500 = Array.from({ length: 500 }, (_, i) => ({
      linkedin_url: `https://linkedin.com/in/user${i}`,
    }));
    mockBulkAddLeads.mockResolvedValue({ inserted: 500, error: null });

    const result = await service.addLeads(USER_ID, CAMPAIGN_ID, exactly500);
    expect(result.success).toBe(true);
  });
});

// ─── skipLead ────────────────────────────────────────────────────────────────

describe('skipLead', () => {
  it('cancels queued actions then skips lead', async () => {
    mockSkipLead.mockResolvedValue({ data: { ...mockLead, status: 'skipped' }, error: null });

    const result = await service.skipLead(USER_ID, LEAD_ID);
    expect(mockCancelByLead).toHaveBeenCalledWith(LEAD_ID);
    expect(mockSkipLead).toHaveBeenCalledWith(LEAD_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('skipped');
    }
  });

  it('still skips even if cancel throws', async () => {
    mockCancelByLead.mockRejectedValue(new Error('Queue error'));
    mockSkipLead.mockResolvedValue({ data: { ...mockLead, status: 'skipped' }, error: null });

    const result = await service.skipLead(USER_ID, LEAD_ID);
    expect(result.success).toBe(true);
  });

  it('returns not_found when lead does not exist', async () => {
    mockSkipLead.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });

    const result = await service.skipLead(USER_ID, LEAD_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('not_found');
    }
  });
});

// ─── listLeads ───────────────────────────────────────────────────────────────

describe('listLeads', () => {
  it('delegates to repo and returns leads', async () => {
    mockListLeads.mockResolvedValue({ data: [mockLead], error: null });

    const result = await service.listLeads(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });

  it('returns empty array on null data', async () => {
    mockListLeads.mockResolvedValue({ data: null, error: null });

    const result = await service.listLeads(USER_ID, CAMPAIGN_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});

// ─── getLead ─────────────────────────────────────────────────────────────────

describe('getLead', () => {
  it('returns lead when found', async () => {
    mockGetLead.mockResolvedValue({ data: mockLead, error: null });

    const result = await service.getLead(USER_ID, LEAD_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(LEAD_ID);
    }
  });

  it('returns not_found for PGRST116', async () => {
    mockGetLead.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    const result = await service.getLead(USER_ID, LEAD_ID);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('not_found');
    }
  });
});

// ─── getStatusCode ───────────────────────────────────────────────────────────

describe('getStatusCode', () => {
  it('extracts statusCode from error object', () => {
    expect(service.getStatusCode({ statusCode: 404 })).toBe(404);
  });

  it('defaults to 500 for unknown errors', () => {
    expect(service.getStatusCode(new Error('fail'))).toBe(500);
    expect(service.getStatusCode(null)).toBe(500);
    expect(service.getStatusCode('string error')).toBe(500);
  });
});
