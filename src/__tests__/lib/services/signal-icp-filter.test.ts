/**
 * @jest-environment node
 */

import {
  matchesIcp,
  computeIcpScore,
  extractJobTitle,
  extractCompany,
  type IcpFilters,
} from '@/lib/services/signal-icp-filter';
import type { HarvestProfile } from '@/lib/types/signals';

// ============================================
// HELPERS
// ============================================

/** Builds a minimal HarvestProfile with sensible defaults. */
function buildProfile(overrides: Partial<HarvestProfile> = {}): HarvestProfile {
  return {
    id: 'test-id',
    publicIdentifier: 'john-doe',
    firstName: 'John',
    lastName: 'Doe',
    headline: 'VP Sales at Acme Corp',
    about: 'Sales leader',
    linkedinUrl: 'https://linkedin.com/in/john-doe',
    ...overrides,
  };
}

/** Builds a minimal IcpFilters config with sensible defaults (no restrictions). */
function buildConfig(overrides: Partial<IcpFilters> = {}): IcpFilters {
  return {
    target_countries: [],
    target_job_titles: [],
    exclude_job_titles: [],
    min_company_size: null,
    max_company_size: null,
    target_industries: [],
    ...overrides,
  };
}

// ============================================
// matchesIcp
// ============================================

describe('matchesIcp', () => {
  it('returns true when profile matches correct country and job title', () => {
    const profile = buildProfile({
      headline: 'VP Sales at Acme',
      location: {
        parsed: { countryCode: 'US' },
      },
    });
    const config = buildConfig({
      target_countries: ['US'],
      target_job_titles: ['VP Sales'],
    });

    expect(matchesIcp(profile, config)).toBe(true);
  });

  it('returns false when profile has an excluded job title', () => {
    const profile = buildProfile({
      headline: 'Student Intern at University',
      location: {
        parsed: { countryCode: 'US' },
      },
    });
    const config = buildConfig({
      target_countries: ['US'],
      exclude_job_titles: ['Intern', 'Student'],
    });

    expect(matchesIcp(profile, config)).toBe(false);
  });

  it('returns false when profile is in the wrong country', () => {
    const profile = buildProfile({
      headline: 'VP Sales at Acme',
      location: {
        parsed: { countryCode: 'IN' },
      },
    });
    const config = buildConfig({
      target_countries: ['US', 'GB', 'CA'],
    });

    expect(matchesIcp(profile, config)).toBe(false);
  });

  it('passes when country filter is empty (no restriction)', () => {
    const profile = buildProfile({
      headline: 'VP Sales at Acme',
      location: {
        parsed: { countryCode: 'BR' },
      },
    });
    const config = buildConfig({
      target_countries: [],
      target_job_titles: ['VP Sales'],
    });

    expect(matchesIcp(profile, config)).toBe(true);
  });

  it('passes when job title filter is empty (no restriction)', () => {
    const profile = buildProfile({
      headline: 'Random Person',
      location: {
        parsed: { countryCode: 'US' },
      },
    });
    const config = buildConfig({
      target_countries: ['US'],
      target_job_titles: [],
    });

    expect(matchesIcp(profile, config)).toBe(true);
  });

  it('is case-insensitive for country codes', () => {
    const profile = buildProfile({
      headline: 'CTO at TechCo',
      location: {
        parsed: { countryCode: 'us' },
      },
    });
    const config = buildConfig({
      target_countries: ['US'],
    });

    expect(matchesIcp(profile, config)).toBe(true);
  });

  it('is case-insensitive for job title matching', () => {
    const profile = buildProfile({
      headline: 'vp sales at some company',
    });
    const config = buildConfig({
      target_job_titles: ['VP Sales'],
    });

    expect(matchesIcp(profile, config)).toBe(true);
  });

  it('is case-insensitive for exclude title matching', () => {
    const profile = buildProfile({
      headline: 'Marketing INTERN at BigCo',
    });
    const config = buildConfig({
      exclude_job_titles: ['intern'],
    });

    expect(matchesIcp(profile, config)).toBe(false);
  });

  it('passes when profile has no country and country filter is set', () => {
    // No country on profile + country filter = skip country check (not reject)
    const profile = buildProfile({
      headline: 'VP Sales at Acme',
      location: undefined,
    });
    const config = buildConfig({
      target_countries: ['US'],
      target_job_titles: ['VP Sales'],
    });

    expect(matchesIcp(profile, config)).toBe(true);
  });

  it('returns false when headline does not match any target job titles', () => {
    const profile = buildProfile({
      headline: 'Software Engineer at Google',
    });
    const config = buildConfig({
      target_job_titles: ['VP Sales', 'Director', 'CEO'],
    });

    expect(matchesIcp(profile, config)).toBe(false);
  });

  it('handles all filters empty (no restrictions) — returns true', () => {
    const profile = buildProfile();
    const config = buildConfig();

    expect(matchesIcp(profile, config)).toBe(true);
  });

  it('handles partial keyword match in exclude filter', () => {
    const profile = buildProfile({
      headline: 'Consulting Director at PwC',
    });
    const config = buildConfig({
      exclude_job_titles: ['consult'],
    });

    // 'consult' is a substring of 'consulting' — should match
    expect(matchesIcp(profile, config)).toBe(false);
  });
});

// ============================================
// computeIcpScore
// ============================================

describe('computeIcpScore', () => {
  it('scores VP Sales in US with recent job change high (>50)', () => {
    // Today minus 30 days = recent role change
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const profile = buildProfile({
      headline: 'VP Sales at Acme Corp',
      location: {
        parsed: { countryCode: 'US' },
      },
      connectionsCount: 800,
      followerCount: 2000,
      hiring: true,
      experience: [
        {
          companyName: 'Acme Corp',
          position: 'VP Sales',
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          // no endDate = current position
        },
      ],
    });
    const config = buildConfig({
      target_countries: ['US'],
      target_job_titles: ['VP Sales'],
    });

    const score = computeIcpScore(profile, config);
    // Country match: +20, Job title: +30, Current position: +10,
    // Recent role change: +20, Connections >500: +5, Followers >1000: +5, Hiring: +10
    // Total = 100
    expect(score).toBeGreaterThan(50);
    expect(score).toBe(100);
  });

  it('reduces score when openToWork is true', () => {
    const profile = buildProfile({
      headline: 'VP Sales at Acme Corp',
      location: {
        parsed: { countryCode: 'US' },
      },
      openToWork: true,
    });
    const config = buildConfig({
      target_countries: ['US'],
      target_job_titles: ['VP Sales'],
    });

    const scoreWithOpenToWork = computeIcpScore(profile, config);

    const profileNoOTW = buildProfile({
      headline: 'VP Sales at Acme Corp',
      location: {
        parsed: { countryCode: 'US' },
      },
      openToWork: false,
    });
    const scoreWithout = computeIcpScore(profileNoOTW, config);

    expect(scoreWithOpenToWork).toBeLessThan(scoreWithout);
    expect(scoreWithout - scoreWithOpenToWork).toBe(10);
  });

  it('gives +15 for job title when no filter is configured', () => {
    const profile = buildProfile({
      headline: 'Random Person',
    });
    const configNoFilter = buildConfig({
      target_job_titles: [],
    });
    const configWithFilter = buildConfig({
      target_job_titles: ['VP Sales'], // will NOT match "Random Person"
    });

    const scoreNoFilter = computeIcpScore(profile, configNoFilter);
    const scoreWithFilter = computeIcpScore(profile, configWithFilter);

    // No filter gives +15, unmatched filter gives +0
    expect(scoreNoFilter).toBeGreaterThan(scoreWithFilter);
  });

  it('gives +20 for country when no filter is configured', () => {
    const profile = buildProfile({
      headline: 'VP Sales at Acme',
    });
    const config = buildConfig({
      target_countries: [],
    });

    // Country +20, no job filter +15 = 35 base
    const score = computeIcpScore(profile, config);
    expect(score).toBeGreaterThanOrEqual(35);
  });

  it('gives +10 for hiring signal', () => {
    const base = buildProfile({ headline: 'CEO at StartupCo' });
    const hiring = buildProfile({ headline: 'CEO at StartupCo', hiring: true });
    const config = buildConfig();

    const diff = computeIcpScore(hiring, config) - computeIcpScore(base, config);
    expect(diff).toBe(10);
  });

  it('gives +5 for high connections and +5 for high followers', () => {
    const base = buildProfile({ headline: 'CEO' });
    const withConnections = buildProfile({
      headline: 'CEO',
      connectionsCount: 1000,
    });
    const withBoth = buildProfile({
      headline: 'CEO',
      connectionsCount: 1000,
      followerCount: 5000,
    });
    const config = buildConfig();

    const baseScore = computeIcpScore(base, config);
    const connScore = computeIcpScore(withConnections, config);
    const bothScore = computeIcpScore(withBoth, config);

    expect(connScore - baseScore).toBe(5);
    expect(bothScore - baseScore).toBe(10);
  });

  it('gives +10 for current position (experience with no endDate)', () => {
    const withCurrent = buildProfile({
      headline: 'CEO',
      experience: [
        { companyName: 'Acme', position: 'CEO' }, // no endDate
      ],
    });
    const withPast = buildProfile({
      headline: 'CEO',
      experience: [
        { companyName: 'Acme', position: 'CEO', endDate: '2023-01-01' },
      ],
    });
    const config = buildConfig();

    const diff =
      computeIcpScore(withCurrent, config) -
      computeIcpScore(withPast, config);
    expect(diff).toBe(10);
  });

  it('clamps score to 0 minimum', () => {
    // openToWork = -10, with basically no positive signals matching
    const profile = buildProfile({
      headline: 'unemployed person',
      openToWork: true,
      location: {
        parsed: { countryCode: 'BR' },
      },
    });
    const config = buildConfig({
      target_countries: ['US'],
      target_job_titles: ['VP Sales'],
    });

    const score = computeIcpScore(profile, config);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('clamps score to 100 maximum', () => {
    // Even with all bonuses, should not exceed 100
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 10);

    const profile = buildProfile({
      headline: 'VP Sales at Acme',
      location: { parsed: { countryCode: 'US' } },
      connectionsCount: 5000,
      followerCount: 50000,
      hiring: true,
      openToWork: false,
      experience: [
        {
          companyName: 'Acme',
          position: 'VP Sales',
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
        },
      ],
    });
    const config = buildConfig({
      target_countries: ['US'],
      target_job_titles: ['VP Sales'],
    });

    const score = computeIcpScore(profile, config);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ============================================
// extractJobTitle
// ============================================

describe('extractJobTitle', () => {
  it('extracts title from "VP Sales at Acme"', () => {
    expect(extractJobTitle('VP Sales at Acme')).toBe('VP Sales');
  });

  it('extracts title from "VP Sales | Acme Corp"', () => {
    expect(extractJobTitle('VP Sales | Acme Corp')).toBe('VP Sales');
  });

  it('extracts title from "VP Sales, Acme Corp"', () => {
    expect(extractJobTitle('VP Sales, Acme Corp')).toBe('VP Sales');
  });

  it('extracts title from "CTO @ TechStartup"', () => {
    expect(extractJobTitle('CTO @ TechStartup')).toBe('CTO');
  });

  it('returns entire headline when no separator found', () => {
    expect(extractJobTitle('Just a headline')).toBe('Just a headline');
  });

  it('returns null for empty string', () => {
    expect(extractJobTitle('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(extractJobTitle('   ')).toBeNull();
  });

  it('handles "at" being case-insensitive', () => {
    expect(extractJobTitle('Director of Sales AT BigCorp')).toBe(
      'Director of Sales'
    );
  });

  it('prioritizes "at" over pipe or comma', () => {
    // "at" check runs first
    expect(extractJobTitle('CEO | Visionary at MegaCorp')).toBe(
      'CEO | Visionary'
    );
  });
});

// ============================================
// extractCompany
// ============================================

describe('extractCompany', () => {
  it('extracts company from "VP Sales at Acme Corp"', () => {
    expect(extractCompany('VP Sales at Acme Corp')).toBe('Acme Corp');
  });

  it('extracts company from "CTO @ TechStartup"', () => {
    expect(extractCompany('CTO @ TechStartup')).toBe('TechStartup');
  });

  it('returns null when no "at" or "@" separator found', () => {
    expect(extractCompany('Just a headline')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractCompany('')).toBeNull();
  });

  it('handles "at" being case-insensitive', () => {
    expect(extractCompany('Director AT BigCorp International')).toBe(
      'BigCorp International'
    );
  });

  it('does not treat pipe or comma as company separators', () => {
    expect(extractCompany('VP Sales | Acme Corp')).toBeNull();
  });

  it('handles "at" with extra whitespace', () => {
    expect(extractCompany('CEO   at   SpaceCo')).toBe('SpaceCo');
  });
});
