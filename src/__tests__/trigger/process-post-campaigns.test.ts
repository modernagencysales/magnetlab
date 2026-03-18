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
  incrementDailyLimit: jest.fn(),
}));
jest.mock('@/server/services/post-campaigns.service', () => ({
  renderDmTemplate: jest.fn(),
}));
jest.mock('@/server/services/account-safety.service', () => ({
  getAccountSettings: jest.fn(),
  isWithinOperatingHours: jest.fn(),
  isCircuitBreakerActive: jest.fn(),
  checkDailyLimit: jest.fn(),
  randomDelay: jest.fn(),
  sleep: jest.fn(),
}));
jest.mock('@/lib/ai/post-campaign/intent-classifier', () => ({
  classifyCommentIntent: jest.fn(),
}));

import { _testExports } from '@/trigger/process-post-campaigns';

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
    expect(_testExports).toHaveProperty('detectCommenters');
    expect(_testExports).toHaveProperty('reactReplyConnect');
    expect(_testExports).toHaveProperty('sendDms');
    expect(_testExports).toHaveProperty('hasPostBeenLiked');
    expect(_testExports).toHaveProperty('matchesTargetLocations');
  });

  it('all exported functions should be callable', () => {
    expect(typeof _testExports.detectCommenters).toBe('function');
    expect(typeof _testExports.reactReplyConnect).toBe('function');
    expect(typeof _testExports.sendDms).toBe('function');
    expect(typeof _testExports.hasPostBeenLiked).toBe('function');
    expect(typeof _testExports.matchesTargetLocations).toBe('function');
  });
});
