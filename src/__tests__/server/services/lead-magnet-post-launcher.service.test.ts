/** Lead Magnet Post Launcher Service Tests.
 *  Covers: publish-only, full launch orchestration, error paths.
 *
 *  @jest-environment node
 */

// ─── Mocks (before imports) ─────────────────────────────────────────────────

jest.mock('@/lib/services/team-integrations', () => ({
  getTeamProfileUnipileAccountId: jest.fn(),
  getTeamProfilesWithConnections: jest.fn(),
}));
jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: jest.fn(),
  isUnipileConfigured: jest.fn().mockReturnValue(true),
}));
jest.mock('@/server/services/post-campaigns.service', () => ({
  createCampaign: jest.fn(),
  activateCampaign: jest.fn(),
}));
jest.mock('@/lib/ai/post-campaign/auto-setup', () => ({
  analyzePostForCampaign: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import {
  launchLeadMagnetPost,
  publishLinkedInPost,
} from '@/server/services/lead-magnet-post-launcher.service';
import {
  getTeamProfileUnipileAccountId,
  getTeamProfilesWithConnections,
} from '@/lib/services/team-integrations';
import { getUnipileClient, isUnipileConfigured } from '@/lib/integrations/unipile';
import { createCampaign, activateCampaign } from '@/server/services/post-campaigns.service';
import { analyzePostForCampaign } from '@/lib/ai/post-campaign/auto-setup';
import { logError } from '@/lib/utils/logger';
import type { AutoSetupResult } from '@/lib/ai/post-campaign/auto-setup';
import type { PostCampaign } from '@/lib/types/post-campaigns';

// ─── Typed mock helpers ─────────────────────────────────────────────────────

const mockGetAccountId = getTeamProfileUnipileAccountId as jest.Mock;
const mockGetTeamProfiles = getTeamProfilesWithConnections as jest.Mock;
const mockGetClient = getUnipileClient as jest.Mock;
const mockIsConfigured = isUnipileConfigured as jest.Mock;
const mockCreateCampaign = createCampaign as jest.Mock;
const mockActivateCampaign = activateCampaign as jest.Mock;
const mockAnalyze = analyzePostForCampaign as jest.Mock;
const mockLogError = logError as jest.Mock;

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockClient = {
  createPost: jest.fn(),
};

const VALID_UNIPILE_POST = {
  id: 'post123',
  social_id: 'urn:li:activity:7890123456',
  account_id: 'acc1',
  provider: 'LINKEDIN' as const,
  text: 'Download my free LinkedIn growth guide...',
  created_at: '2026-03-20T10:00:00Z',
};

const VALID_AUTO_SETUP: AutoSetupResult = {
  keyword: 'guide',
  dmTemplate: 'Hey {{name}}, here is the guide: {{funnel_url}}',
  replyTemplate: 'Thanks for commenting! Sending it over now.',
  funnelPageId: 'f1',
  funnelName: 'Growth Guide',
  deliveryAccountId: 'acc1',
  deliveryAccountName: 'Christian',
  posterAccountId: 'p1',
  confidence: 'high',
  needsUserInput: [],
};

const NOW = '2026-03-20T10:00:00Z';

function buildMockCampaign(overrides: Partial<PostCampaign> = {}): PostCampaign {
  return {
    id: 'camp1',
    user_id: 'u1',
    team_id: 't1',
    name: 'Test Campaign',
    post_url: 'https://www.linkedin.com/feed/update/urn:li:activity:7890123456',
    keywords: ['guide'],
    unipile_account_id: 'acc1',
    sender_name: null,
    dm_template: 'Hey {{name}}, here is the guide: {{funnel_url}}',
    connect_message_template: null,
    reply_template: 'Thanks for commenting!',
    poster_account_id: null,
    target_locations: [],
    lead_expiry_days: 7,
    funnel_page_id: 'f1',
    auto_accept_connections: true,
    auto_like_comments: true,
    auto_connect_non_requesters: true,
    status: 'draft',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

const BASE_LAUNCH_INPUT = {
  userId: 'u1',
  teamId: 't1',
  teamProfileId: 'p1',
  postText: 'Download my free LinkedIn growth guide...',
  funnelPageId: 'f1',
};

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockGetClient.mockReturnValue(mockClient);
  mockIsConfigured.mockReturnValue(true);
  mockGetTeamProfiles.mockResolvedValue([
    {
      id: 'p1',
      full_name: 'Christian',
      linkedin_connected: true,
      unipile_account_id: 'acc1',
      status: 'active',
    },
  ]);
});

// ─── publishLinkedInPost ────────────────────────────────────────────────────

describe('publishLinkedInPost', () => {
  it('throws if team profile has no Unipile account', async () => {
    mockGetAccountId.mockResolvedValue(null);

    await expect(publishLinkedInPost('p1', 'Hello world')).rejects.toThrow(
      'LinkedIn account not connected'
    );
  });

  it('throws if Unipile is not configured', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockIsConfigured.mockReturnValue(false);

    await expect(publishLinkedInPost('p1', 'Hello world')).rejects.toThrow(
      'Unipile is not configured'
    );
  });

  it('throws if Unipile publish returns error', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: 'rate limited', data: null });

    await expect(publishLinkedInPost('p1', 'Hello world')).rejects.toThrow('Failed to publish');
  });

  it('returns URL and post ID on success', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: null, data: VALID_UNIPILE_POST });

    const result = await publishLinkedInPost('p1', 'Hello world');

    expect(result.linkedinPostId).toBe('urn:li:activity:7890123456');
    expect(result.linkedinPostUrl).toBe(
      'https://www.linkedin.com/feed/update/urn:li:activity:7890123456'
    );
    expect(mockClient.createPost).toHaveBeenCalledWith('acc1', 'Hello world');
  });
});

// ─── launchLeadMagnetPost ───────────────────────────────────────────────────

describe('launchLeadMagnetPost', () => {
  it('throws if team profile has no Unipile account', async () => {
    mockGetAccountId.mockResolvedValue(null);

    await expect(launchLeadMagnetPost(BASE_LAUNCH_INPUT)).rejects.toThrow(
      'LinkedIn account not connected'
    );
  });

  it('throws if Unipile publish fails', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: 'rate limited', data: null });

    await expect(launchLeadMagnetPost(BASE_LAUNCH_INPUT)).rejects.toThrow('Failed to publish');
  });

  it('orchestrates full flow: publish -> create campaign -> activate', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: null, data: VALID_UNIPILE_POST });
    mockAnalyze.mockResolvedValue(VALID_AUTO_SETUP);
    mockCreateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign(),
    });
    mockActivateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign({ status: 'active' }),
    });

    const result = await launchLeadMagnetPost(BASE_LAUNCH_INPUT);

    // Verify publish was called with correct account
    expect(mockClient.createPost).toHaveBeenCalledWith('acc1', BASE_LAUNCH_INPUT.postText);

    // Verify campaign was created with AI-derived config
    expect(mockCreateCampaign).toHaveBeenCalledWith(
      'u1',
      't1',
      expect.objectContaining({
        post_url: expect.stringContaining('linkedin.com'),
        keywords: ['guide'],
        dm_template: expect.stringContaining('{{name}}'),
        unipile_account_id: 'acc1',
      })
    );

    // Verify campaign was activated
    expect(mockActivateCampaign).toHaveBeenCalledWith('u1', 'camp1');

    // Verify return shape
    expect(result.linkedinPostUrl).toContain('linkedin.com');
    expect(result.linkedinPostId).toBe('urn:li:activity:7890123456');
    expect(result.campaignId).toBe('camp1');
    expect(result.status).toBe('active');
    expect(result.keywords).toEqual(['guide']);
    expect(result.funnelPageId).toBe('f1');
  });

  it('uses override keywords and DM template when provided', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: null, data: VALID_UNIPILE_POST });
    mockCreateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign(),
    });
    mockActivateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign({ status: 'active' }),
    });

    await launchLeadMagnetPost({
      ...BASE_LAUNCH_INPUT,
      keywords: ['playbook', 'interested'],
      dmTemplate: 'Custom DM: {{funnel_url}}',
    });

    // AI auto-setup should NOT be called when both overrides are provided
    expect(mockAnalyze).not.toHaveBeenCalled();

    // Overrides should be used in campaign creation
    expect(mockCreateCampaign).toHaveBeenCalledWith(
      'u1',
      't1',
      expect.objectContaining({
        keywords: ['playbook', 'interested'],
        dm_template: 'Custom DM: {{funnel_url}}',
      })
    );
  });

  it('falls back to defaults when AI auto-setup fails', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: null, data: VALID_UNIPILE_POST });
    mockAnalyze.mockRejectedValue(new Error('AI service unavailable'));
    mockCreateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign(),
    });
    mockActivateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign({ status: 'active' }),
    });

    const result = await launchLeadMagnetPost(BASE_LAUNCH_INPUT);

    // Should still succeed with fallback defaults
    expect(result.campaignId).toBe('camp1');
    expect(result.keywords).toEqual(['guide', 'interested', 'send']);
  });

  it('throws if createCampaign fails', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: null, data: VALID_UNIPILE_POST });
    mockAnalyze.mockResolvedValue(VALID_AUTO_SETUP);
    mockCreateCampaign.mockResolvedValue({
      success: false,
      error: 'database',
      message: 'DB error',
    });

    await expect(launchLeadMagnetPost(BASE_LAUNCH_INPUT)).rejects.toThrow(
      'Failed to create campaign'
    );
  });

  it('logs warning but still returns if activateCampaign fails', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: null, data: VALID_UNIPILE_POST });
    mockAnalyze.mockResolvedValue(VALID_AUTO_SETUP);
    mockCreateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign(),
    });
    mockActivateCampaign.mockResolvedValue({
      success: false,
      error: 'database',
      message: 'Activation failed',
    });

    const result = await launchLeadMagnetPost(BASE_LAUNCH_INPUT);

    // Should still return a result (campaign was created) but status reflects failure
    expect(result.campaignId).toBe('camp1');
    expect(result.status).toBe('draft');
    // Should have logged the activation failure
    expect(mockLogError).toHaveBeenCalledWith(
      'lead-magnet-post-launcher',
      expect.any(Error),
      expect.objectContaining({ campaignId: 'camp1' })
    );
  });

  it('uses custom campaign name when provided', async () => {
    mockGetAccountId.mockResolvedValue('acc1');
    mockClient.createPost.mockResolvedValue({ error: null, data: VALID_UNIPILE_POST });
    mockAnalyze.mockResolvedValue(VALID_AUTO_SETUP);
    mockCreateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign({ name: 'My Custom Campaign' }),
    });
    mockActivateCampaign.mockResolvedValue({
      success: true,
      data: buildMockCampaign({ name: 'My Custom Campaign', status: 'active' }),
    });

    const result = await launchLeadMagnetPost({
      ...BASE_LAUNCH_INPUT,
      campaignName: 'My Custom Campaign',
    });

    expect(mockCreateCampaign).toHaveBeenCalledWith(
      'u1',
      't1',
      expect.objectContaining({ name: 'My Custom Campaign' })
    );
    expect(result.campaignName).toBe('My Custom Campaign');
  });
});
