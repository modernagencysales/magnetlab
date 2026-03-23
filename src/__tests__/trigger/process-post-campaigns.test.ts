/**
 * Tests for process-post-campaigns trigger task.
 * Tests the exported helper functions and validates the detection + action chain logic.
 */

// Mock Trigger.dev SDK before importing the module
jest.mock('@trigger.dev/sdk/v3', () => ({
  schedules: {
    task: jest.fn().mockImplementation((config) => config),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock all external dependencies so we can import the module cleanly
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));
jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));
jest.mock('@/server/repositories/post-campaigns.repo', () => ({
  listActiveCampaigns: jest.fn(),
  findCampaignLeadByUrl: jest.fn(),
  insertCampaignLead: jest.fn(),
  findLeadsByStatus: jest.fn(),
  updateCampaignLead: jest.fn(),
}));
jest.mock('@/server/services/post-campaigns.service', () => ({
  renderDmTemplate: jest.fn(),
}));
jest.mock('@/server/repositories/linkedin-action-queue.repo', () => ({
  enqueueAction: jest.fn(),
  getUnprocessedResultsByCampaign: jest.fn(),
  markProcessed: jest.fn(),
  hasPendingAction: jest.fn(),
}));
jest.mock('@/lib/ai/post-campaign/intent-classifier', () => ({
  classifyCommentIntent: jest.fn(),
}));

import { _testExports } from '@/trigger/process-post-campaigns';
import { getUnipileClient } from '@/lib/integrations/unipile';
import {
  findCampaignLeadByUrl,
  insertCampaignLead,
  listActiveCampaigns,
} from '@/server/repositories/post-campaigns.repo';
import { classifyCommentIntent } from '@/lib/ai/post-campaign/intent-classifier';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { PostCampaign } from '@/lib/types/post-campaigns';

const mockGetUnipileClient = getUnipileClient as jest.MockedFunction<typeof getUnipileClient>;
const mockFindCampaignLeadByUrl = findCampaignLeadByUrl as jest.MockedFunction<
  typeof findCampaignLeadByUrl
>;
const mockInsertCampaignLead = insertCampaignLead as jest.MockedFunction<typeof insertCampaignLead>;
const mockListActiveCampaigns = listActiveCampaigns as jest.MockedFunction<
  typeof listActiveCampaigns
>;
const mockClassifyCommentIntent = classifyCommentIntent as jest.MockedFunction<
  typeof classifyCommentIntent
>;
const mockCreateSupabaseAdminClient = createSupabaseAdminClient as jest.MockedFunction<
  typeof createSupabaseAdminClient
>;

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeCampaign(overrides: Partial<PostCampaign> = {}): PostCampaign {
  return {
    id: 'campaign-1',
    user_id: 'user-1',
    team_id: null,
    name: 'Test Campaign',
    post_url: 'https://www.linkedin.com/feed/update/urn:li:activity:7441847037123248129',
    keywords: ['BLUEPRINT', 'INTERESTED'],
    unipile_account_id: 'account-1',
    sender_name: null,
    dm_template: 'Hey {{name}}!',
    connect_message_template: null,
    reply_template: null,
    poster_account_id: null,
    target_locations: [],
    lead_expiry_days: 7,
    funnel_page_id: null,
    auto_accept_connections: false,
    auto_like_comments: false,
    auto_connect_non_requesters: false,
    status: 'active',
    created_at: '2026-03-23T00:00:00Z',
    updated_at: '2026-03-23T00:00:00Z',
    ...overrides,
  };
}

// ─── matchesTargetLocations ─────────────────────────────────────────────────

describe('matchesTargetLocations', () => {
  const { matchesTargetLocations } = _testExports;

  it('should return true when target_locations is empty (accept all)', () => {
    expect(matchesTargetLocations('New York, NY', [])).toBe(true);
  });

  it('should return true when lead location matches a target', () => {
    expect(matchesTargetLocations('New York, NY', ['New York'])).toBe(true);
  });

  it('should return true with case-insensitive match', () => {
    expect(matchesTargetLocations('new york, ny', ['New York'])).toBe(true);
  });

  it('should return true when lead location matches any target', () => {
    expect(
      matchesTargetLocations('San Francisco, CA', ['New York', 'San Francisco', 'Chicago'])
    ).toBe(true);
  });

  it('should return false when lead location does not match any target', () => {
    expect(matchesTargetLocations('London, UK', ['New York', 'San Francisco'])).toBe(false);
  });

  it('should return false when lead has no location', () => {
    expect(matchesTargetLocations(null, ['New York'])).toBe(false);
  });

  it('should return true when lead has no location but no targets configured', () => {
    expect(matchesTargetLocations(null, [])).toBe(true);
  });

  it('should handle substring matching (e.g., "York" matches "New York")', () => {
    expect(matchesTargetLocations('New York, NY', ['York'])).toBe(true);
  });
});

// ─── Type-level validation ──────────────────────────────────────────────────

describe('process-post-campaigns type contracts', () => {
  it('_testExports should expose all test helpers', () => {
    expect(_testExports).toHaveProperty('processCompletedActions');
    expect(_testExports).toHaveProperty('processCompletedAction');
    expect(_testExports).toHaveProperty('processFailedAction');
    expect(_testExports).toHaveProperty('detectCommenters');
    expect(_testExports).toHaveProperty('detectCommentersForCampaign');
    expect(_testExports).toHaveProperty('detectFromUnipile');
    expect(_testExports).toHaveProperty('detectFromSignalEvents');
    expect(_testExports).toHaveProperty('reactReplyConnect');
    expect(_testExports).toHaveProperty('sendDms');
    expect(_testExports).toHaveProperty('hasPostBeenLiked');
    expect(_testExports).toHaveProperty('matchesTargetLocations');
  });

  it('all exported functions should be callable', () => {
    expect(typeof _testExports.processCompletedActions).toBe('function');
    expect(typeof _testExports.processCompletedAction).toBe('function');
    expect(typeof _testExports.processFailedAction).toBe('function');
    expect(typeof _testExports.detectCommenters).toBe('function');
    expect(typeof _testExports.detectCommentersForCampaign).toBe('function');
    expect(typeof _testExports.detectFromUnipile).toBe('function');
    expect(typeof _testExports.detectFromSignalEvents).toBe('function');
    expect(typeof _testExports.reactReplyConnect).toBe('function');
    expect(typeof _testExports.sendDms).toBe('function');
    expect(typeof _testExports.hasPostBeenLiked).toBe('function');
    expect(typeof _testExports.matchesTargetLocations).toBe('function');
  });
});

// ─── detectFromUnipile ──────────────────────────────────────────────────────

describe('detectFromUnipile', () => {
  const { detectFromUnipile } = _testExports;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when post_url cannot be parsed to a URN', async () => {
    const campaign = makeCampaign({ post_url: 'not-a-valid-url' });
    const result = await detectFromUnipile(campaign);
    expect(result).toBeNull();
  });

  it('should return null when Unipile API returns an error', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({ data: null, error: 'API error', status: 500 }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);

    const campaign = makeCampaign();
    const result = await detectFromUnipile(campaign);
    expect(result).toBeNull();
    expect(mockClient.getPostComments).toHaveBeenCalledWith(
      'urn:li:activity:7441847037123248129',
      'account-1' // unipile_account_id since poster_account_id is null
    );
  });

  it('should return 0 when Unipile returns empty comments', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: { items: [] },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);

    const campaign = makeCampaign();
    const result = await detectFromUnipile(campaign);
    expect(result).toBe(0);
  });

  it('should use poster_account_id when available', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: { items: [] },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);

    const campaign = makeCampaign({ poster_account_id: 'poster-account-1' });
    await detectFromUnipile(campaign);
    expect(mockClient.getPostComments).toHaveBeenCalledWith(
      'urn:li:activity:7441847037123248129',
      'poster-account-1'
    );
  });

  it('should insert a lead when keyword matches a comment', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'comment-1',
              text: 'BLUEPRINT please',
              author: 'Jane Doe',
              author_details: {
                id: 'provider-123',
                profile_url: 'https://www.linkedin.com/in/jane-doe',
              },
              date: '2026-03-23T14:00:00Z',
            },
          ],
        },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);
    mockFindCampaignLeadByUrl.mockResolvedValue({ data: null, error: null } as never);
    mockInsertCampaignLead.mockResolvedValue({ data: {}, error: null } as never);

    const campaign = makeCampaign();
    const result = await detectFromUnipile(campaign);

    expect(result).toBe(1);
    expect(mockInsertCampaignLead).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        campaign_id: 'campaign-1',
        signal_lead_id: null,
        linkedin_url: 'https://www.linkedin.com/in/jane-doe',
        linkedin_username: 'jane-doe',
        unipile_provider_id: 'provider-123',
        name: 'Jane Doe',
        comment_text: 'BLUEPRINT please',
        comment_social_id: 'comment-1',
        match_type: 'keyword',
        status: 'detected',
      })
    );
  });

  it('should skip comments from authors already in the campaign', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'comment-1',
              text: 'BLUEPRINT',
              author: 'Existing Lead',
              author_details: {
                id: 'provider-existing',
                profile_url: 'https://www.linkedin.com/in/existing-lead',
              },
              date: '2026-03-23T14:00:00Z',
            },
          ],
        },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);
    mockFindCampaignLeadByUrl.mockResolvedValue({
      data: { id: 'lead-1', status: 'detected' },
      error: null,
    } as never);

    const campaign = makeCampaign();
    const result = await detectFromUnipile(campaign);

    expect(result).toBe(0);
    expect(mockInsertCampaignLead).not.toHaveBeenCalled();
  });

  it('should skip comments without profile_url', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'comment-1',
              text: 'BLUEPRINT',
              author: 'Unknown',
              author_details: { id: 'provider-1', profile_url: '' },
              date: '2026-03-23T14:00:00Z',
            },
          ],
        },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);

    const campaign = makeCampaign();
    const result = await detectFromUnipile(campaign);

    expect(result).toBe(0);
    expect(mockInsertCampaignLead).not.toHaveBeenCalled();
  });

  it('should use AI intent classification as Tier 2 when no keyword match', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'comment-1',
              text: 'This sounds amazing, I want in!',
              author: 'Interested Person',
              author_details: {
                id: 'provider-456',
                profile_url: 'https://www.linkedin.com/in/interested-person',
              },
              date: '2026-03-23T14:00:00Z',
            },
          ],
        },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);
    mockFindCampaignLeadByUrl.mockResolvedValue({ data: null, error: null } as never);
    mockInsertCampaignLead.mockResolvedValue({ data: {}, error: null } as never);
    mockClassifyCommentIntent.mockResolvedValue({ isInterested: true, confidence: 0.9 } as never);

    const campaign = makeCampaign();
    const result = await detectFromUnipile(campaign);

    expect(result).toBe(1);
    expect(mockClassifyCommentIntent).toHaveBeenCalledWith(
      'BLUEPRINT, INTERESTED',
      'This sounds amazing, I want in!'
    );
    expect(mockInsertCampaignLead).toHaveBeenCalledWith(
      expect.objectContaining({
        match_type: 'intent',
      })
    );
  });

  it('should skip comments that fail both keyword and intent matching', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'comment-1',
              text: 'Nice post!',
              author: 'Casual Commenter',
              author_details: {
                id: 'provider-789',
                profile_url: 'https://www.linkedin.com/in/casual-commenter',
              },
              date: '2026-03-23T14:00:00Z',
            },
          ],
        },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);
    mockFindCampaignLeadByUrl.mockResolvedValue({ data: null, error: null } as never);
    mockClassifyCommentIntent.mockResolvedValue({ isInterested: false, confidence: 0.2 } as never);

    const campaign = makeCampaign();
    const result = await detectFromUnipile(campaign);

    expect(result).toBe(0);
    expect(mockInsertCampaignLead).not.toHaveBeenCalled();
  });

  it('should handle insert errors gracefully', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'comment-1',
              text: 'BLUEPRINT',
              author: 'Jane',
              author_details: {
                id: 'provider-1',
                profile_url: 'https://www.linkedin.com/in/jane',
              },
              date: '2026-03-23T14:00:00Z',
            },
          ],
        },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);
    mockFindCampaignLeadByUrl.mockResolvedValue({ data: null, error: null } as never);
    mockInsertCampaignLead.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key' },
    } as never);

    const campaign = makeCampaign();
    const result = await detectFromUnipile(campaign);

    // Insert failed, so 0 inserted
    expect(result).toBe(0);
  });
});

// ─── detectCommentersForCampaign ────────────────────────────────────────────

describe('detectCommentersForCampaign', () => {
  const { detectCommentersForCampaign } = _testExports;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use Unipile result when API succeeds', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: { items: [] },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);

    const campaign = makeCampaign();
    const result = await detectCommentersForCampaign(campaign);

    expect(result).toBe(0);
    // Should NOT have called createSupabaseAdminClient for signal_events fallback
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('should fall back to signal_events when Unipile API fails', async () => {
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: null,
        error: 'API unavailable',
        status: 503,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);

    // Mock supabase for signal_events fallback — return empty events
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockFrom = jest.fn().mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockImplementation(() => ({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }));
    mockCreateSupabaseAdminClient.mockReturnValue({ from: mockFrom } as never);

    const campaign = makeCampaign();
    const result = await detectCommentersForCampaign(campaign);

    // Fell back to signal_events which returned empty
    expect(result).toBe(0);
    expect(mockCreateSupabaseAdminClient).toHaveBeenCalled();
  });
});

// ─── detectCommenters (integration) ────────────────────────────────────────

describe('detectCommenters', () => {
  const { detectCommenters } = _testExports;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 0 when no active campaigns exist', async () => {
    mockListActiveCampaigns.mockResolvedValue({ data: [], error: null } as never);

    const result = await detectCommenters();
    expect(result).toBe(0);
  });

  it('should return 0 when listActiveCampaigns returns an error', async () => {
    mockListActiveCampaigns.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    } as never);

    const result = await detectCommenters();
    expect(result).toBe(0);
  });

  it('should process multiple campaigns and sum results', async () => {
    const campaigns = [makeCampaign({ id: 'campaign-1' }), makeCampaign({ id: 'campaign-2' })];
    mockListActiveCampaigns.mockResolvedValue({ data: campaigns, error: null } as never);

    // Both campaigns return 0 comments from Unipile
    const mockClient = {
      getPostComments: jest.fn().mockResolvedValue({
        data: { items: [] },
        error: null,
        status: 200,
      }),
    };
    mockGetUnipileClient.mockReturnValue(mockClient as never);

    const result = await detectCommenters();
    expect(result).toBe(0);
    expect(mockClient.getPostComments).toHaveBeenCalledTimes(2);
  });
});
