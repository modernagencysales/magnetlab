/**
 * Section Rules Enforcement Tests.
 * Verifies that createSection enforces position rules (page restrictions, max-per-page).
 * @jest-environment node
 */

// ─── Mock dependencies before imports ────────────────────────────────

const mockAssertFunnelAccess = jest.fn();
const mockFindSections = jest.fn();
const mockGetMaxSortOrder = jest.fn();
const mockCreateSection = jest.fn();
const mockGetSectionType = jest.fn();
const mockGetFunnelTeamId = jest.fn();

jest.mock('@/server/repositories/funnels.repo', () => ({
  assertFunnelAccess: (...args: unknown[]) => mockAssertFunnelAccess(...args),
  findSections: (...args: unknown[]) => mockFindSections(...args),
  getMaxSortOrder: (...args: unknown[]) => mockGetMaxSortOrder(...args),
  createSection: (...args: unknown[]) => mockCreateSection(...args),
  getSectionType: (...args: unknown[]) => mockGetSectionType(...args),
  getFunnelTeamId: (...args: unknown[]) => mockGetFunnelTeamId(...args),
}));

jest.mock('@/lib/api/errors', () => ({
  logApiError: jest.fn(),
}));

// ─── Imports after mocks ─────────────────────────────────────────────

import { createSection } from '@/server/services/funnels.service';
import type { DataScope } from '@/lib/utils/team-context';
import type { FunnelPageSection } from '@/lib/types/funnel';

// ─── Test data ───────────────────────────────────────────────────────

const mockScope: DataScope = { type: 'user', userId: 'user-1' };
const funnelId = 'funnel-1';

function makeMockSection(overrides: Partial<FunnelPageSection> = {}): FunnelPageSection {
  return {
    id: 'sec-1',
    funnelPageId: funnelId,
    sectionType: 'testimonial',
    pageLocation: 'optin',
    sortOrder: 0,
    isVisible: true,
    variant: 'default',
    config: { quote: 'Great tool!' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('createSection — position rules enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertFunnelAccess.mockResolvedValue(funnelId);
    mockGetMaxSortOrder.mockResolvedValue(0);
  });

  it('rejects hero on thankyou page (400 with "not allowed" message)', async () => {
    mockFindSections.mockResolvedValue([]);

    try {
      await createSection(mockScope, funnelId, {
        sectionType: 'hero',
        pageLocation: 'thankyou',
        variant: 'centered',
        config: { headline: 'Welcome' },
      });
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toMatch(/not allowed/i);
      expect((err as { statusCode: number }).statusCode).toBe(400);
    }
  });

  it('rejects second hero on same page (400 with "max" message)', async () => {
    mockFindSections.mockResolvedValue([
      makeMockSection({
        id: 'sec-hero',
        sectionType: 'hero',
        pageLocation: 'optin',
        variant: 'centered',
      }),
    ]);

    try {
      await createSection(mockScope, funnelId, {
        sectionType: 'hero',
        pageLocation: 'optin',
        variant: 'centered',
        config: { headline: 'Another hero' },
      });
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toMatch(/max/i);
      expect((err as { statusCode: number }).statusCode).toBe(400);
    }
  });

  it('allows valid section placement (hero on optin with no existing hero)', async () => {
    mockFindSections.mockResolvedValue([]);

    const createdSection = makeMockSection({
      id: 'sec-new',
      sectionType: 'hero',
      pageLocation: 'optin',
      variant: 'centered',
      config: { headline: 'Welcome' },
    });
    mockCreateSection.mockResolvedValue(createdSection);

    const result = await createSection(mockScope, funnelId, {
      sectionType: 'hero',
      pageLocation: 'optin',
      variant: 'centered',
      config: { headline: 'Welcome' },
    });

    expect(result).toEqual(createdSection);
    expect(mockCreateSection).toHaveBeenCalledWith(
      expect.objectContaining({
        funnel_page_id: funnelId,
        section_type: 'hero',
        page_location: 'optin',
        variant: 'centered',
        is_visible: true,
      })
    );
  });
});
