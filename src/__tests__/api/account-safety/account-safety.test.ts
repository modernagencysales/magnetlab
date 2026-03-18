/**
 * @jest-environment node
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockMaybeSingle = jest.fn();

const mockSupabase = { from: mockFrom };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => mockSupabase,
}));

// Import AFTER mocks
import {
  getEffectiveLimit,
  isWithinOperatingHours,
  isCircuitBreakerActive,
  checkDailyLimit,
  shouldSkipRun,
  getRandomDelayMs,
} from '@/server/services/account-safety.service';

import type { AccountSafetySettings } from '@/lib/types/post-campaigns';
import { SAFETY_DEFAULTS } from '@/lib/types/post-campaigns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<AccountSafetySettings> = {}): AccountSafetySettings {
  return {
    id: 'settings-1',
    userId: 'user-1',
    unipileAccountId: 'account-1',
    operatingHoursStart: SAFETY_DEFAULTS.operatingHoursStart,
    operatingHoursEnd: SAFETY_DEFAULTS.operatingHoursEnd,
    timezone: SAFETY_DEFAULTS.timezone,
    maxDmsPerDay: SAFETY_DEFAULTS.maxDmsPerDay,
    maxConnectionRequestsPerDay: SAFETY_DEFAULTS.maxConnectionRequestsPerDay,
    maxConnectionAcceptsPerDay: SAFETY_DEFAULTS.maxConnectionAcceptsPerDay,
    maxCommentsPerDay: SAFETY_DEFAULTS.maxCommentsPerDay,
    maxLikesPerDay: SAFETY_DEFAULTS.maxLikesPerDay,
    minActionDelayMs: SAFETY_DEFAULTS.minActionDelayMs,
    maxActionDelayMs: SAFETY_DEFAULTS.maxActionDelayMs,
    accountConnectedAt: null,
    circuitBreakerUntil: null,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('account-safety.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── getEffectiveLimit ────────────────────────────────────────────────────

  describe('getEffectiveLimit', () => {
    it('returns 50% for high-risk action in week 1 (0-6 days)', () => {
      const settings = makeSettings({
        accountConnectedAt: daysAgo(3),
        maxDmsPerDay: 50,
      });
      const result = getEffectiveLimit(settings, 'dm');
      expect(result).toBe(25); // 50 * 0.5
    });

    it('returns 50% for connection_request in week 1', () => {
      const settings = makeSettings({
        accountConnectedAt: daysAgo(0),
        maxConnectionRequestsPerDay: 10,
      });
      const result = getEffectiveLimit(settings, 'connection_request');
      expect(result).toBe(5); // 10 * 0.5
    });

    it('returns 75% for high-risk action in week 2 (7-13 days)', () => {
      const settings = makeSettings({
        accountConnectedAt: daysAgo(10),
        maxDmsPerDay: 50,
      });
      const result = getEffectiveLimit(settings, 'dm');
      expect(result).toBe(37); // Math.floor(50 * 0.75)
    });

    it('returns 100% for high-risk action in week 3+ (14+ days)', () => {
      const settings = makeSettings({
        accountConnectedAt: daysAgo(21),
        maxDmsPerDay: 50,
      });
      const result = getEffectiveLimit(settings, 'dm');
      expect(result).toBe(50);
    });

    it('returns 100% when accountConnectedAt is null', () => {
      const settings = makeSettings({
        accountConnectedAt: null,
        maxDmsPerDay: 50,
      });
      const result = getEffectiveLimit(settings, 'dm');
      expect(result).toBe(50);
    });

    it('returns 100% for non-high-risk action regardless of connection age', () => {
      const settings = makeSettings({
        accountConnectedAt: daysAgo(1),
        maxCommentsPerDay: 30,
        maxLikesPerDay: 60,
        maxConnectionAcceptsPerDay: 80,
      });

      // All non-high-risk actions should return full limit even in week 1
      expect(getEffectiveLimit(settings, 'comment')).toBe(30);
      expect(getEffectiveLimit(settings, 'like')).toBe(60);
      expect(getEffectiveLimit(settings, 'connection_accept')).toBe(80);
    });

    it('floors the result for odd numbers', () => {
      const settings = makeSettings({
        accountConnectedAt: daysAgo(2),
        maxDmsPerDay: 7, // 7 * 0.5 = 3.5 → 3
      });
      const result = getEffectiveLimit(settings, 'dm');
      expect(result).toBe(3);
    });
  });

  // ─── isWithinOperatingHours ────────────────────────────────────────────────

  describe('isWithinOperatingHours', () => {
    it('returns true when current time is within operating hours', () => {
      const settings = makeSettings({
        operatingHoursStart: '08:00',
        operatingHoursEnd: '19:00',
        timezone: 'UTC',
      });

      // Create a date at 12:00 UTC
      const noon = new Date('2026-03-18T12:00:00Z');
      expect(isWithinOperatingHours(settings, noon)).toBe(true);
    });

    it('returns false when current time is before operating hours', () => {
      const settings = makeSettings({
        operatingHoursStart: '08:00',
        operatingHoursEnd: '19:00',
        timezone: 'UTC',
      });

      const earlyMorning = new Date('2026-03-18T06:00:00Z');
      expect(isWithinOperatingHours(settings, earlyMorning)).toBe(false);
    });

    it('returns false when current time is after operating hours', () => {
      const settings = makeSettings({
        operatingHoursStart: '08:00',
        operatingHoursEnd: '19:00',
        timezone: 'UTC',
      });

      const evening = new Date('2026-03-18T20:00:00Z');
      expect(isWithinOperatingHours(settings, evening)).toBe(false);
    });

    it('returns true at the exact start time', () => {
      const settings = makeSettings({
        operatingHoursStart: '08:00',
        operatingHoursEnd: '19:00',
        timezone: 'UTC',
      });

      const exactStart = new Date('2026-03-18T08:00:00Z');
      expect(isWithinOperatingHours(settings, exactStart)).toBe(true);
    });

    it('returns false at the exact end time (exclusive)', () => {
      const settings = makeSettings({
        operatingHoursStart: '08:00',
        operatingHoursEnd: '19:00',
        timezone: 'UTC',
      });

      const exactEnd = new Date('2026-03-18T19:00:00Z');
      expect(isWithinOperatingHours(settings, exactEnd)).toBe(false);
    });

    it('handles timezone conversion (EST is UTC-5 in winter)', () => {
      const settings = makeSettings({
        operatingHoursStart: '08:00',
        operatingHoursEnd: '19:00',
        timezone: 'America/New_York',
      });

      // 14:00 UTC = 10:00 EST (within hours)
      const utcNoon = new Date('2026-01-15T14:00:00Z');
      expect(isWithinOperatingHours(settings, utcNoon)).toBe(true);

      // 05:00 UTC = 00:00 EST (outside hours)
      const utcEarly = new Date('2026-01-15T05:00:00Z');
      expect(isWithinOperatingHours(settings, utcEarly)).toBe(false);
    });
  });

  // ─── isCircuitBreakerActive ───────────────────────────────────────────────

  describe('isCircuitBreakerActive', () => {
    it('returns true when circuit breaker is in the future', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);

      const settings = makeSettings({
        circuitBreakerUntil: futureDate.toISOString(),
      });

      expect(isCircuitBreakerActive(settings)).toBe(true);
    });

    it('returns false when circuit breaker is in the past', () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);

      const settings = makeSettings({
        circuitBreakerUntil: pastDate.toISOString(),
      });

      expect(isCircuitBreakerActive(settings)).toBe(false);
    });

    it('returns false when circuit breaker is null', () => {
      const settings = makeSettings({
        circuitBreakerUntil: null,
      });

      expect(isCircuitBreakerActive(settings)).toBe(false);
    });

    it('uses provided "now" parameter for comparison', () => {
      const breakerTime = new Date('2026-03-18T15:00:00Z');
      const settings = makeSettings({
        circuitBreakerUntil: breakerTime.toISOString(),
      });

      const before = new Date('2026-03-18T14:00:00Z');
      const after = new Date('2026-03-18T16:00:00Z');

      expect(isCircuitBreakerActive(settings, before)).toBe(true);
      expect(isCircuitBreakerActive(settings, after)).toBe(false);
    });
  });

  // ─── checkDailyLimit ──────────────────────────────────────────────────────

  describe('checkDailyLimit', () => {
    function setupDailyLimitsMock(
      dailyLimits: {
        dms_sent?: number;
        connections_accepted?: number;
        connection_requests_sent?: number;
        comments_sent?: number;
        likes_sent?: number;
      } | null
    ) {
      mockMaybeSingle.mockResolvedValue({
        data: dailyLimits
          ? {
              id: 'limit-1',
              user_id: 'user-1',
              unipile_account_id: 'account-1',
              date: '2026-03-18',
              dms_sent: 0,
              connections_accepted: 0,
              connection_requests_sent: 0,
              comments_sent: 0,
              likes_sent: 0,
              ...dailyLimits,
            }
          : null,
        error: null,
      });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });

      // Build the chain: from → select → eq(account) → eq(date) → maybeSingle
      const eqDate = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const eqAccount = jest.fn().mockReturnValue({ eq: eqDate });
      mockSelect.mockReturnValue({ eq: eqAccount });
      mockFrom.mockReturnValue({ select: mockSelect });
    }

    it('returns allowed=true when under limit', async () => {
      setupDailyLimitsMock({ dms_sent: 10 });

      const settings = makeSettings({ maxDmsPerDay: 50 });
      const result = await checkDailyLimit('account-1', 'dm', settings);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(10);
      expect(result.limit).toBe(50);
    });

    it('returns allowed=false when at limit', async () => {
      setupDailyLimitsMock({ dms_sent: 50 });

      const settings = makeSettings({ maxDmsPerDay: 50 });
      const result = await checkDailyLimit('account-1', 'dm', settings);

      expect(result.allowed).toBe(false);
      expect(result.used).toBe(50);
      expect(result.limit).toBe(50);
    });

    it('returns allowed=false when over limit', async () => {
      setupDailyLimitsMock({ connection_requests_sent: 15 });

      const settings = makeSettings({ maxConnectionRequestsPerDay: 10 });
      const result = await checkDailyLimit('account-1', 'connection_request', settings);

      expect(result.allowed).toBe(false);
      expect(result.used).toBe(15);
      expect(result.limit).toBe(10);
    });

    it('returns allowed=true with used=0 when no daily record exists', async () => {
      setupDailyLimitsMock(null);

      const settings = makeSettings({ maxDmsPerDay: 50 });
      const result = await checkDailyLimit('account-1', 'dm', settings);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(50);
    });

    it('applies warm-up ramp to effective limit', async () => {
      setupDailyLimitsMock({ dms_sent: 20 });

      const settings = makeSettings({
        maxDmsPerDay: 50,
        accountConnectedAt: daysAgo(3), // Week 1 → 50% → 25
      });
      const result = await checkDailyLimit('account-1', 'dm', settings);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(20);
      expect(result.limit).toBe(25); // 50 * 0.5
    });

    it('checks correct column for each action type', async () => {
      setupDailyLimitsMock({ likes_sent: 55 });

      const settings = makeSettings({ maxLikesPerDay: 60 });
      const result = await checkDailyLimit('account-1', 'like', settings);

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(55);
      expect(result.limit).toBe(60);
    });
  });

  // ─── shouldSkipRun ────────────────────────────────────────────────────────

  describe('shouldSkipRun', () => {
    it('returns a boolean', () => {
      const result = shouldSkipRun();
      expect(typeof result).toBe('boolean');
    });

    it('returns true approximately 10% of the time (statistical)', () => {
      const iterations = 10_000;
      let trueCount = 0;
      for (let i = 0; i < iterations; i++) {
        if (shouldSkipRun()) trueCount++;
      }
      // With 10k iterations at 10% chance, expect ~1000 true
      // Allow wide range: 5%-15% (500-1500)
      expect(trueCount).toBeGreaterThan(500);
      expect(trueCount).toBeLessThan(1500);
    });
  });

  // ─── getRandomDelayMs ─────────────────────────────────────────────────────

  describe('getRandomDelayMs', () => {
    it('returns a value between min and max (inclusive)', () => {
      const settings = makeSettings({
        minActionDelayMs: 1000,
        maxActionDelayMs: 5000,
      });

      for (let i = 0; i < 100; i++) {
        const delay = getRandomDelayMs(settings);
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThanOrEqual(5000);
      }
    });

    it('returns exact value when min equals max', () => {
      const settings = makeSettings({
        minActionDelayMs: 3000,
        maxActionDelayMs: 3000,
      });

      const delay = getRandomDelayMs(settings);
      expect(delay).toBe(3000);
    });
  });
});
