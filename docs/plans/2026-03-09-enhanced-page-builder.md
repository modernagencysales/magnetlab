# Enhanced Page Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add named section variants, position rules, animation layer, and 4 new section types to funnel pages — AI-generated, not manually built.

**Architecture:** Extend the existing section system with a `variant` column, variant-specific Zod schemas, a position rules engine enforced in the service layer, and CSS/Framer Motion animations. New section types (hero, stats_bar, feature_grid, social_proof_wall) follow the same renderer pattern as existing ones. The restyler is extended with `sectionVariantChanges`.

**Tech Stack:** Next.js 15, TypeScript, Supabase (PostgreSQL), Zod, Framer Motion, Tailwind CSS, Jest, Claude AI SDK

**Design doc:** `docs/plans/2026-03-09-enhanced-page-builder-design.md`

**Branch:** `early-users/experiments`

**Repo:** `/Users/timlife/Documents/claude code/magnetlab`

---

## Important Context

### Current Section System

- **5 section types:** `logo_bar`, `steps`, `testimonial`, `marketing_block`, `section_bridge`
- **3 page locations:** `optin`, `thankyou`, `content`
- **Sort order convention:** `< 50` = above form, `>= 50` = below form
- **DB table:** `funnel_page_sections` with columns: `id, funnel_page_id, section_type, page_location, sort_order, is_visible, config (JSONB), created_at, updated_at`
- **No variant column yet** — all sections use a single config schema per type

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/types/funnel.ts` | SectionType, PageLocation, config interfaces, FunnelPageSection, FunnelPageSectionRow, funnelPageSectionFromRow() |
| `src/lib/validations/api.ts` | sectionTypes array, pageLocations array, config Zod schemas, createSectionSchema, updateSectionSchema |
| `src/server/repositories/funnels.repo.ts` | SECTION_COLUMNS, findSections(), createSection(), updateSection(), deleteSection(), getMaxSortOrder() |
| `src/server/services/funnels.service.ts` | getSections(), createSection(), updateSection(), deleteSection(), resetSections() |
| `src/components/ds/SectionRenderer.tsx` | Switch-case router: sectionType → component |
| `src/components/ds/LogoBar.tsx` | Logo bar renderer |
| `src/components/ds/SimpleSteps.tsx` | Steps renderer |
| `src/components/ds/TestimonialQuote.tsx` | Testimonial renderer |
| `src/components/ds/MarketingBlock.tsx` | Marketing block renderer (275 lines, handles 7 blockTypes) |
| `src/components/ds/SectionBridge.tsx` | Section bridge renderer |
| `src/components/funnel/SectionsManager.tsx` | Editor UI for managing sections (461 lines) |
| `src/components/funnel/FunnelPreview.tsx` | Editor preview (416 lines) |
| `src/components/funnel/public/OptinPage.tsx` | Public page renderer (249 lines) |
| `src/server/services/restyle.service.ts` | Restyle orchestrator |
| `src/lib/ai/restyle/plan-generator.ts` | Restyle prompt builder + plan parser |

### Layered Architecture

```
Route (src/app/api/) → Service (src/server/services/) → Repository (src/server/repositories/) → DB
```

- Services never import NextRequest/NextResponse
- Route handlers under 30 lines
- Explicit field whitelists for all updates
- `DataScope` for tenant scoping

### Testing Pattern

- Service tests: `jest.mock()` all dependencies, test orchestration + error paths
- AI module tests: pure function tests, no mocks
- Validation tests: realistic data through Zod schemas
- Test files mirror source: `src/__tests__/lib/...`, `src/__tests__/server/...`

### Existing DB CHECK Constraint

The `funnel_page_sections` table has a CHECK constraint on `section_type`:
```sql
CHECK (section_type IN ('logo_bar', 'steps', 'testimonial', 'marketing_block', 'section_bridge'))
```
This must be updated to include the 4 new types.

---

## Task 1: Database Migration — Add Variant Column + New Section Types

**Files:**
- Create: `supabase/migrations/20260309000000_section_variants.sql`

**Step 1: Write the migration**

```sql
-- Add variant column to funnel_page_sections
ALTER TABLE funnel_page_sections
  ADD COLUMN variant TEXT NOT NULL DEFAULT 'default';

-- Drop the old CHECK constraint on section_type and add updated one
-- First find the constraint name (it's auto-generated)
ALTER TABLE funnel_page_sections
  DROP CONSTRAINT IF EXISTS funnel_page_sections_section_type_check;

ALTER TABLE funnel_page_sections
  ADD CONSTRAINT funnel_page_sections_section_type_check
  CHECK (section_type IN (
    'logo_bar', 'steps', 'testimonial', 'marketing_block', 'section_bridge',
    'hero', 'stats_bar', 'feature_grid', 'social_proof_wall'
  ));

-- Index for variant queries
CREATE INDEX idx_funnel_page_sections_variant
  ON funnel_page_sections(section_type, variant);
```

**Step 2: Apply migration locally**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260309000000_section_variants.sql
git commit -m "feat: add variant column to funnel_page_sections + new section types"
```

---

## Task 2: Type System — Section Variants and New Config Types

**Files:**
- Modify: `src/lib/types/funnel.ts`
- Test: `src/__tests__/lib/types/funnel.test.ts`

**Step 1: Write the failing test**

Add to `src/__tests__/lib/types/funnel.test.ts`:

```typescript
import { funnelPageSectionFromRow, type FunnelPageSectionRow } from '@/lib/types/funnel';

describe('funnelPageSectionFromRow', () => {
  it('should include variant field', () => {
    const row: FunnelPageSectionRow = {
      id: 'section-123',
      funnel_page_id: 'funnel-456',
      section_type: 'hero',
      page_location: 'optin',
      sort_order: 0,
      is_visible: true,
      variant: 'centered',
      config: { headline: 'Test' },
      created_at: '2025-01-25T00:00:00Z',
      updated_at: '2025-01-26T00:00:00Z',
    };

    const result = funnelPageSectionFromRow(row);

    expect(result.variant).toBe('centered');
    expect(result.sectionType).toBe('hero');
  });

  it('should default variant to "default" when not set', () => {
    const row: FunnelPageSectionRow = {
      id: 'section-123',
      funnel_page_id: 'funnel-456',
      section_type: 'steps',
      page_location: 'optin',
      sort_order: 0,
      is_visible: true,
      variant: 'default',
      config: { steps: [] },
      created_at: '2025-01-25T00:00:00Z',
      updated_at: '2025-01-26T00:00:00Z',
    };

    const result = funnelPageSectionFromRow(row);
    expect(result.variant).toBe('default');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="lib/types/funnel" --no-coverage`
Expected: FAIL — `variant` not on FunnelPageSectionRow / FunnelPageSection types.

**Step 3: Update types in `src/lib/types/funnel.ts`**

Add variant maps after `SectionType` (around line 179):

```typescript
// ─── Section Variants ─────────────────────────────────────────────
export type SectionType =
  | 'logo_bar' | 'steps' | 'testimonial' | 'marketing_block' | 'section_bridge'
  | 'hero' | 'stats_bar' | 'feature_grid' | 'social_proof_wall';

export type PageLocation = 'optin' | 'thankyou' | 'content';

/** Named layout variants per section type. AI picks; user can switch. */
export const SECTION_VARIANTS = {
  logo_bar: ['inline', 'grid'] as const,
  steps: ['numbered', 'timeline', 'icon-cards'] as const,
  testimonial: ['quote-card', 'highlight', 'avatar'] as const,
  marketing_block: ['feature-card', 'benefit', 'faq-accordion', 'cta-banner'] as const,
  section_bridge: ['divider', 'accent-bar', 'gradient-fade'] as const,
  hero: ['centered', 'split-image', 'full-bleed-gradient'] as const,
  stats_bar: ['inline', 'cards', 'animated-counters'] as const,
  feature_grid: ['icon-top', 'icon-left', 'minimal'] as const,
  social_proof_wall: ['grid', 'carousel', 'stacked'] as const,
} as const;

export type SectionVariant<T extends SectionType> = (typeof SECTION_VARIANTS)[T][number];
```

Add new config interfaces after the existing ones (around line 215):

```typescript
// ─── New Section Configs ──────────────────────────────────────────
export interface HeroConfig {
  headline: string;
  subline?: string;
  ctaText?: string;
  ctaUrl?: string;
  backgroundImageUrl?: string;
  gradientConfig?: { from: string; to: string; direction?: string };
}

export interface StatsBarConfig {
  items: Array<{ value: string; label: string }>;
}

export interface FeatureGridConfig {
  features: Array<{ icon: string; title: string; description: string }>;
}

export interface SocialProofWallConfig {
  testimonials: Array<{ quote: string; author: string; role?: string; avatar?: string }>;
}
```

Update `SectionConfig` union:

```typescript
export type SectionConfig =
  | LogoBarConfig | StepsConfig | TestimonialConfig | MarketingBlockConfig | SectionBridgeConfig
  | HeroConfig | StatsBarConfig | FeatureGridConfig | SocialProofWallConfig;
```

Add `variant` to row and domain types:

In `FunnelPageSectionRow`, add: `variant: string;`

In `FunnelPageSection`, add: `variant: string;`

In `funnelPageSectionFromRow()`, add: `variant: row.variant || 'default',`

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="lib/types/funnel" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/types/funnel.ts src/__tests__/lib/types/funnel.test.ts
git commit -m "feat: add section variant types + 4 new section config interfaces"
```

---

## Task 3: Variant-Specific Zod Schemas

**Files:**
- Modify: `src/lib/validations/api.ts`
- Create: `src/__tests__/lib/validations/section-schemas.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/lib/validations/section-schemas.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import {
  heroConfigSchema,
  statsBarConfigSchema,
  featureGridConfigSchema,
  socialProofWallConfigSchema,
  getVariantConfigSchema,
  sectionTypes,
} from '@/lib/validations/api';

describe('New Section Config Schemas', () => {
  describe('heroConfigSchema', () => {
    it('should accept valid hero config', () => {
      const config = { headline: 'Get Your Free Guide' };
      expect(heroConfigSchema.parse(config)).toEqual(config);
    });

    it('should require headline', () => {
      expect(() => heroConfigSchema.parse({})).toThrow();
    });

    it('should accept full hero config', () => {
      const config = {
        headline: 'Transform Your Business',
        subline: 'Download the guide',
        ctaText: 'Get Started',
        ctaUrl: 'https://example.com',
        backgroundImageUrl: 'https://example.com/bg.jpg',
        gradientConfig: { from: '#000', to: '#fff' },
      };
      expect(heroConfigSchema.parse(config)).toEqual(config);
    });
  });

  describe('statsBarConfigSchema', () => {
    it('should accept 3 stat items', () => {
      const config = {
        items: [
          { value: '500+', label: 'Clients' },
          { value: '$10M', label: 'Revenue' },
          { value: '98%', label: 'Satisfaction' },
        ],
      };
      expect(statsBarConfigSchema.parse(config)).toEqual(config);
    });

    it('should reject fewer than 3 items', () => {
      const config = { items: [{ value: '1', label: 'One' }] };
      expect(() => statsBarConfigSchema.parse(config)).toThrow();
    });

    it('should reject more than 4 items', () => {
      const config = {
        items: Array.from({ length: 5 }, (_, i) => ({ value: `${i}`, label: `Item ${i}` })),
      };
      expect(() => statsBarConfigSchema.parse(config)).toThrow();
    });

    it('should reject values longer than 10 chars', () => {
      const config = {
        items: [
          { value: 'way too long value', label: 'Bad' },
          { value: '2', label: 'Ok' },
          { value: '3', label: 'Ok' },
        ],
      };
      expect(() => statsBarConfigSchema.parse(config)).toThrow();
    });
  });

  describe('featureGridConfigSchema', () => {
    it('should accept 3-6 features', () => {
      const config = {
        features: [
          { icon: '🚀', title: 'Fast', description: 'Lightning speed' },
          { icon: '🔒', title: 'Secure', description: 'Bank-grade security' },
          { icon: '📊', title: 'Analytics', description: 'Deep insights' },
        ],
      };
      expect(featureGridConfigSchema.parse(config)).toEqual(config);
    });

    it('should reject fewer than 3 features', () => {
      const config = {
        features: [{ icon: '🚀', title: 'Fast', description: 'Speed' }],
      };
      expect(() => featureGridConfigSchema.parse(config)).toThrow();
    });
  });

  describe('socialProofWallConfigSchema', () => {
    it('should accept 2-6 testimonials', () => {
      const config = {
        testimonials: [
          { quote: 'Amazing product that changed everything', author: 'John Doe' },
          { quote: 'Best decision we ever made for growth', author: 'Jane Smith', role: 'CEO' },
        ],
      };
      expect(socialProofWallConfigSchema.parse(config)).toEqual(config);
    });

    it('should require quote min 20 chars', () => {
      const config = {
        testimonials: [
          { quote: 'Short', author: 'John' },
          { quote: 'Also short', author: 'Jane' },
        ],
      };
      expect(() => socialProofWallConfigSchema.parse(config)).toThrow();
    });
  });

  describe('sectionTypes', () => {
    it('should include all 9 section types', () => {
      expect(sectionTypes).toContain('hero');
      expect(sectionTypes).toContain('stats_bar');
      expect(sectionTypes).toContain('feature_grid');
      expect(sectionTypes).toContain('social_proof_wall');
      expect(sectionTypes).toHaveLength(9);
    });
  });

  describe('getVariantConfigSchema', () => {
    it('should return schema for known section type', () => {
      const schema = getVariantConfigSchema('hero');
      expect(schema).toBeDefined();
    });

    it('should return null for unknown type', () => {
      const schema = getVariantConfigSchema('nonexistent' as any);
      expect(schema).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="section-schemas" --no-coverage`
Expected: FAIL — exports don't exist yet.

**Step 3: Add schemas to `src/lib/validations/api.ts`**

Add new schemas near the existing section config schemas (around line 313):

```typescript
// ─── Updated Section Types ────────────────────────────────────────
export const sectionTypes = [
  'logo_bar', 'steps', 'testimonial', 'marketing_block', 'section_bridge',
  'hero', 'stats_bar', 'feature_grid', 'social_proof_wall',
] as const;

// ─── New Section Config Schemas ───────────────────────────────────
export const heroConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  subline: z.string().max(500).optional(),
  ctaText: z.string().max(50).optional(),
  ctaUrl: z.string().url().optional(),
  backgroundImageUrl: z.string().url().optional(),
  gradientConfig: z.object({
    from: z.string(),
    to: z.string(),
    direction: z.string().optional(),
  }).optional(),
});

export const statsBarConfigSchema = z.object({
  items: z.array(z.object({
    value: z.string().min(1).max(10),
    label: z.string().min(1).max(50),
  })).min(3).max(4),
});

export const featureGridConfigSchema = z.object({
  features: z.array(z.object({
    icon: z.string().min(1).max(50),
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(300),
  })).min(3).max(6),
});

export const socialProofWallConfigSchema = z.object({
  testimonials: z.array(z.object({
    quote: z.string().min(20).max(2000),
    author: z.string().min(1).max(100),
    role: z.string().max(100).optional(),
    avatar: z.string().url().optional(),
  })).min(2).max(6),
});
```

Update the `sectionConfigSchemas` map to include new types:

```typescript
export const sectionConfigSchemas: Record<string, z.ZodType> = {
  logo_bar: logoBarConfigSchema,
  steps: stepsConfigSchema,
  testimonial: testimonialConfigSchema,
  marketing_block: marketingBlockConfigSchema,
  section_bridge: sectionBridgeConfigSchema,
  hero: heroConfigSchema,
  stats_bar: statsBarConfigSchema,
  feature_grid: featureGridConfigSchema,
  social_proof_wall: socialProofWallConfigSchema,
};

/** Get the config schema for a given section type. Returns null if unknown. */
export function getVariantConfigSchema(sectionType: string): z.ZodType | null {
  return sectionConfigSchemas[sectionType] ?? null;
}
```

Update `sectionConfigSchema` union to include new schemas:

```typescript
export const sectionConfigSchema = z.union([
  logoBarConfigSchema,
  stepsConfigSchema,
  testimonialConfigSchema,
  marketingBlockConfigSchema,
  sectionBridgeConfigSchema,
  heroConfigSchema,
  statsBarConfigSchema,
  featureGridConfigSchema,
  socialProofWallConfigSchema,
]);
```

Add `variant` to create/update schemas:

```typescript
export const createSectionSchema = z.object({
  sectionType: z.enum(sectionTypes),
  pageLocation: z.enum(pageLocations),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isVisible: z.boolean().optional(),
  variant: z.string().max(50).optional(),
  config: sectionConfigSchema,
});

export const updateSectionSchema = z.object({
  sortOrder: z.number().int().min(0).max(999).optional(),
  isVisible: z.boolean().optional(),
  pageLocation: z.enum(pageLocations).optional(),
  variant: z.string().max(50).optional(),
  config: sectionConfigSchema.optional(),
});
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="section-schemas" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/validations/api.ts src/__tests__/lib/validations/section-schemas.test.ts
git commit -m "feat: add Zod schemas for 4 new section types + variant field"
```

---

## Task 4: Position Rules Engine

**Files:**
- Create: `src/lib/validations/section-rules.ts`
- Create: `src/__tests__/lib/validations/section-rules.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/lib/validations/section-rules.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { validateSectionPlacement, SECTION_RULES } from '@/lib/validations/section-rules';
import type { FunnelPageSection } from '@/lib/types/funnel';

const makeSection = (overrides: Partial<FunnelPageSection>): FunnelPageSection => ({
  id: 'test-id',
  funnelPageId: 'funnel-123',
  sectionType: 'testimonial',
  pageLocation: 'optin',
  sortOrder: 50,
  isVisible: true,
  variant: 'default',
  config: { quote: 'Test testimonial quote here', author: 'Author' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('Position Rules Engine', () => {
  describe('SECTION_RULES', () => {
    it('should define rules for all 9 section types', () => {
      const types = [
        'hero', 'logo_bar', 'stats_bar', 'steps', 'feature_grid',
        'testimonial', 'social_proof_wall', 'section_bridge', 'marketing_block',
      ];
      for (const type of types) {
        expect(SECTION_RULES[type]).toBeDefined();
      }
    });
  });

  describe('validateSectionPlacement', () => {
    it('should allow hero on optin page top', () => {
      const result = validateSectionPlacement('hero', 'optin', []);
      expect(result.valid).toBe(true);
    });

    it('should reject hero on thankyou page', () => {
      const result = validateSectionPlacement('hero', 'thankyou', []);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    it('should reject second hero on same page', () => {
      const existing = [makeSection({ sectionType: 'hero', pageLocation: 'optin' })];
      const result = validateSectionPlacement('hero', 'optin', existing);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('max');
    });

    it('should allow testimonial up to max 2 per page', () => {
      const existing = [makeSection({ sectionType: 'testimonial', pageLocation: 'optin' })];
      const result = validateSectionPlacement('testimonial', 'optin', existing);
      expect(result.valid).toBe(true);
    });

    it('should reject third testimonial on same page', () => {
      const existing = [
        makeSection({ sectionType: 'testimonial', pageLocation: 'optin', id: '1' }),
        makeSection({ sectionType: 'testimonial', pageLocation: 'optin', id: '2' }),
      ];
      const result = validateSectionPlacement('testimonial', 'optin', existing);
      expect(result.valid).toBe(false);
    });

    it('should allow marketing_block up to 3 per page', () => {
      const existing = [
        makeSection({ sectionType: 'marketing_block', pageLocation: 'optin', id: '1' }),
        makeSection({ sectionType: 'marketing_block', pageLocation: 'optin', id: '2' }),
      ];
      const result = validateSectionPlacement('marketing_block', 'optin', existing);
      expect(result.valid).toBe(true);
    });

    it('should reject 4th marketing_block', () => {
      const existing = Array.from({ length: 3 }, (_, i) =>
        makeSection({ sectionType: 'marketing_block', pageLocation: 'optin', id: `${i}` })
      );
      const result = validateSectionPlacement('marketing_block', 'optin', existing);
      expect(result.valid).toBe(false);
    });

    it('should allow logo_bar only on optin', () => {
      expect(validateSectionPlacement('logo_bar', 'optin', []).valid).toBe(true);
      expect(validateSectionPlacement('logo_bar', 'thankyou', []).valid).toBe(false);
      expect(validateSectionPlacement('logo_bar', 'content', []).valid).toBe(false);
    });

    it('should allow section_bridge up to 3', () => {
      const existing = Array.from({ length: 2 }, (_, i) =>
        makeSection({ sectionType: 'section_bridge', pageLocation: 'optin', id: `${i}` })
      );
      const result = validateSectionPlacement('section_bridge', 'optin', existing);
      expect(result.valid).toBe(true);
    });

    it('should reject 4th section_bridge', () => {
      const existing = Array.from({ length: 3 }, (_, i) =>
        makeSection({ sectionType: 'section_bridge', pageLocation: 'optin', id: `${i}` })
      );
      const result = validateSectionPlacement('section_bridge', 'optin', existing);
      expect(result.valid).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="section-rules" --no-coverage`
Expected: FAIL — module not found.

**Step 3: Implement position rules**

Create `src/lib/validations/section-rules.ts`:

```typescript
/** Position Rules Engine. Enforces where sections can be placed. */
import type { SectionType, PageLocation, FunnelPageSection } from '@/lib/types/funnel';

// ─── Rule Definitions ─────────────────────────────────────────────

interface SectionRule {
  allowedPages: PageLocation[];
  maxPerPage: number;
}

export const SECTION_RULES: Record<SectionType, SectionRule> = {
  hero:              { allowedPages: ['optin'],                       maxPerPage: 1 },
  logo_bar:          { allowedPages: ['optin'],                       maxPerPage: 1 },
  stats_bar:         { allowedPages: ['optin', 'thankyou'],           maxPerPage: 1 },
  steps:             { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 1 },
  feature_grid:      { allowedPages: ['optin', 'content'],            maxPerPage: 1 },
  testimonial:       { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 2 },
  social_proof_wall: { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 1 },
  section_bridge:    { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 3 },
  marketing_block:   { allowedPages: ['optin', 'thankyou', 'content'], maxPerPage: 3 },
};

// ─── Validation ───────────────────────────────────────────────────

export interface PlacementResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate whether a section type can be placed on a given page.
 * @param sectionType - The type of section to place
 * @param pageLocation - The page to place it on
 * @param existingSections - All sections currently on this funnel (all pages)
 */
export function validateSectionPlacement(
  sectionType: SectionType,
  pageLocation: PageLocation,
  existingSections: FunnelPageSection[],
): PlacementResult {
  const rule = SECTION_RULES[sectionType];
  if (!rule) {
    return { valid: false, reason: `Unknown section type: ${sectionType}` };
  }

  // Check allowed pages
  if (!rule.allowedPages.includes(pageLocation)) {
    return {
      valid: false,
      reason: `${sectionType} is not allowed on ${pageLocation} page. Allowed: ${rule.allowedPages.join(', ')}`,
    };
  }

  // Check max per page
  const countOnPage = existingSections.filter(
    (s) => s.sectionType === sectionType && s.pageLocation === pageLocation,
  ).length;

  if (countOnPage >= rule.maxPerPage) {
    return {
      valid: false,
      reason: `${sectionType} has reached max of ${rule.maxPerPage} on ${pageLocation} page`,
    };
  }

  return { valid: true };
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="section-rules" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/validations/section-rules.ts src/__tests__/lib/validations/section-rules.test.ts
git commit -m "feat: add position rules engine for section placement validation"
```

---

## Task 5: Repository Layer — Variant Column Support

**Files:**
- Modify: `src/server/repositories/funnels.repo.ts`

**Step 1: Update SECTION_COLUMNS**

In `src/server/repositories/funnels.repo.ts`, find `SECTION_COLUMNS` (line ~38) and add `variant`:

```typescript
const SECTION_COLUMNS = 'id, funnel_page_id, section_type, page_location, sort_order, is_visible, variant, config, created_at, updated_at';
```

**Step 2: Update createSection to include variant**

In `createSection()` (line ~491), add `variant` to the insert:

The method receives a row object. Add `variant: row.variant || 'default'` to the insert object.

**Step 3: Update updateSection to support variant changes**

In `updateSection()` (line ~510), ensure the updates object can include `variant`.

**Step 4: Run existing tests to verify nothing breaks**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="funnel" --no-coverage`
Expected: All existing tests still pass.

**Step 5: Commit**

```bash
git add src/server/repositories/funnels.repo.ts
git commit -m "feat: add variant column to section repository queries"
```

---

## Task 6: Service Layer — Position Rules Enforcement

**Files:**
- Modify: `src/server/services/funnels.service.ts`
- Create: `src/__tests__/server/services/section-rules-enforcement.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/server/services/section-rules-enforcement.test.ts`:

```typescript
/**
 * @jest-environment node
 */

// Mock dependencies before imports
jest.mock('@/server/repositories/funnels.repo', () => ({
  findFunnelById: jest.fn(),
  findSections: jest.fn(),
  getMaxSortOrder: jest.fn(),
  createSection: jest.fn(),
  getSectionType: jest.fn(),
  getFunnelTeamId: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

import * as funnelsService from '@/server/services/funnels.service';
import * as funnelsRepo from '@/server/repositories/funnels.repo';
import type { DataScope } from '@/lib/utils/team-context';

const mockScope: DataScope = { userId: 'user-1', teamId: 'team-1', role: 'owner' };

describe('Section creation with position rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (funnelsRepo.findFunnelById as jest.Mock).mockResolvedValue({ id: 'funnel-1', user_id: 'user-1' });
    (funnelsRepo.getMaxSortOrder as jest.Mock).mockResolvedValue(0);
    (funnelsRepo.findSections as jest.Mock).mockResolvedValue({ data: [], error: null });
  });

  it('should reject hero on thankyou page', async () => {
    await expect(
      funnelsService.createSection(mockScope, 'funnel-1', {
        sectionType: 'hero',
        pageLocation: 'thankyou',
        config: { headline: 'Test' },
      })
    ).rejects.toThrow();
  });

  it('should reject second hero on same page', async () => {
    (funnelsRepo.findSections as jest.Mock).mockResolvedValue({
      data: [{ id: '1', section_type: 'hero', page_location: 'optin', sort_order: 0, is_visible: true, variant: 'default', config: {} }],
      error: null,
    });

    await expect(
      funnelsService.createSection(mockScope, 'funnel-1', {
        sectionType: 'hero',
        pageLocation: 'optin',
        config: { headline: 'Another Hero' },
      })
    ).rejects.toThrow(/max/i);
  });

  it('should allow valid section placement', async () => {
    (funnelsRepo.createSection as jest.Mock).mockResolvedValue({
      data: [{ id: 'new-1', funnel_page_id: 'funnel-1', section_type: 'hero', page_location: 'optin', sort_order: 0, is_visible: true, variant: 'centered', config: { headline: 'Test' }, created_at: '2025-01-01', updated_at: '2025-01-01' }],
      error: null,
    });

    const result = await funnelsService.createSection(mockScope, 'funnel-1', {
      sectionType: 'hero',
      pageLocation: 'optin',
      variant: 'centered',
      config: { headline: 'Test' },
    });

    expect(result.sectionType).toBe('hero');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="section-rules-enforcement" --no-coverage`
Expected: FAIL — service doesn't enforce rules yet, or doesn't accept variant.

**Step 3: Update service to enforce position rules**

In `src/server/services/funnels.service.ts`, modify `createSection()` (around line 336):

1. Import `validateSectionPlacement` from `@/lib/validations/section-rules`
2. After schema validation, fetch existing sections for the funnel
3. Call `validateSectionPlacement(sectionType, pageLocation, existingSections)`
4. If invalid, throw with 400 status code
5. Pass `variant` through to the repo `createSection()` call

```typescript
import { validateSectionPlacement } from '@/lib/validations/section-rules';
import { funnelPageSectionFromRow } from '@/lib/types/funnel';

// Inside createSection(), after Zod validation:
const existingSectionsResult = await funnelsRepo.findSections(funnelId);
const existingSections = (existingSectionsResult.data || []).map(funnelPageSectionFromRow);
const placement = validateSectionPlacement(
  parsed.sectionType as SectionType,
  parsed.pageLocation as PageLocation,
  existingSections,
);
if (!placement.valid) {
  throw Object.assign(new Error(placement.reason || 'Invalid section placement'), { statusCode: 400 });
}
```

Also pass `variant` through to the repo:

```typescript
const row = {
  funnel_page_id: funnelId,
  section_type: parsed.sectionType,
  page_location: parsed.pageLocation,
  sort_order: parsed.sortOrder ?? nextSortOrder,
  is_visible: parsed.isVisible ?? true,
  variant: parsed.variant || 'default',
  config: parsed.config,
};
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="section-rules-enforcement" --no-coverage`
Expected: PASS

**Step 5: Run all funnel tests to verify nothing broke**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="funnel" --no-coverage`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/server/services/funnels.service.ts src/__tests__/server/services/section-rules-enforcement.test.ts
git commit -m "feat: enforce position rules in section creation service"
```

---

## Task 7: Animation Hooks

**Files:**
- Create: `src/components/funnel/animations/useScrollReveal.ts`
- Create: `src/components/funnel/animations/useCountUp.ts`
- Create: `src/components/funnel/animations/ScrollReveal.tsx`
- Create: `src/__tests__/components/funnel/animations.test.tsx`

**Step 1: Write the failing test**

Create `src/__tests__/components/funnel/animations.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock matchMedia for prefers-reduced-motion
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('ScrollReveal', () => {
  it('should render children', () => {
    render(
      <ScrollReveal>
        <div data-testid="child">Hello</div>
      </ScrollReveal>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should start hidden with opacity 0', () => {
    const { container } = render(
      <ScrollReveal>
        <div>Content</div>
      </ScrollReveal>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.opacity).toBe('0');
  });

  it('should register IntersectionObserver', () => {
    render(
      <ScrollReveal>
        <div>Content</div>
      </ScrollReveal>
    );
    expect(mockIntersectionObserver).toHaveBeenCalled();
  });

  it('should support stagger delay', () => {
    const { container } = render(
      <ScrollReveal delay={200}>
        <div>Content</div>
      </ScrollReveal>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.transitionDelay).toBe('200ms');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="animations" --no-coverage`
Expected: FAIL — module not found.

**Step 3: Create animation hooks and components**

Create `src/components/funnel/animations/useScrollReveal.ts`:

```typescript
/** Scroll-triggered reveal hook. Uses IntersectionObserver. Respects prefers-reduced-motion. */
'use client';

import { useEffect, useRef, useState } from 'react';

export function useScrollReveal(options?: { threshold?: number; once?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const threshold = options?.threshold ?? 0.15;
  const once = options?.once ?? true;

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(element);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, isVisible };
}
```

Create `src/components/funnel/animations/useCountUp.ts`:

```typescript
/** Animated counter hook. Counts from 0 to target on trigger. */
'use client';

import { useEffect, useState } from 'react';

export function useCountUp(target: number, isActive: boolean, duration = 1500): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setCount(target);
      return;
    }

    let startTime: number | null = null;
    let frameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * target));

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [target, isActive, duration]);

  return count;
}
```

Create `src/components/funnel/animations/ScrollReveal.tsx`:

```typescript
/** Scroll-triggered reveal wrapper. Fade + slide up on scroll enter. */
'use client';

import React, { type ReactNode } from 'react';
import { useScrollReveal } from './useScrollReveal';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
```

Create `src/components/funnel/animations/index.ts`:

```typescript
export { ScrollReveal } from './ScrollReveal';
export { useScrollReveal } from './useScrollReveal';
export { useCountUp } from './useCountUp';
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="animations" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/funnel/animations/ src/__tests__/components/funnel/animations.test.tsx
git commit -m "feat: add scroll reveal + count up animation hooks"
```

---

## Task 8: New Section Renderers — Hero

**Files:**
- Create: `src/components/ds/HeroSection.tsx`
- Modify: `src/components/ds/SectionRenderer.tsx`

**Step 1: Create HeroSection renderer**

Create `src/components/ds/HeroSection.tsx`:

```typescript
/** Hero section renderer. Variants: centered, split-image, full-bleed-gradient. */
'use client';

import React from 'react';
import type { HeroConfig } from '@/lib/types/funnel';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

interface HeroSectionProps {
  config: HeroConfig;
  variant: string;
  primaryColor: string;
}

export function HeroSection({ config, variant, primaryColor }: HeroSectionProps) {
  const { headline, subline, ctaText, ctaUrl, backgroundImageUrl, gradientConfig } = config;

  if (variant === 'split-image') {
    return (
      <ScrollReveal>
        <div className="flex flex-col md:flex-row items-center gap-8 py-12">
          <div className="flex-1 space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--ds-foreground)' }}>
              {headline}
            </h1>
            {subline && <p className="text-lg" style={{ color: 'var(--ds-muted)' }}>{subline}</p>}
            {ctaText && ctaUrl && (
              <a
                href={ctaUrl}
                className="inline-block px-6 py-3 rounded-lg font-semibold text-white transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: primaryColor }}
              >
                {ctaText}
              </a>
            )}
          </div>
          {backgroundImageUrl && (
            <div className="flex-1">
              <img
                src={backgroundImageUrl}
                alt=""
                className="rounded-xl w-full object-cover max-h-80"
              />
            </div>
          )}
        </div>
      </ScrollReveal>
    );
  }

  if (variant === 'full-bleed-gradient') {
    const from = gradientConfig?.from || primaryColor;
    const to = gradientConfig?.to || 'transparent';
    const direction = gradientConfig?.direction || 'to bottom right';

    return (
      <ScrollReveal>
        <div
          className="relative py-16 px-8 rounded-2xl overflow-hidden text-center"
          style={{
            background: `linear-gradient(${direction}, ${from}, ${to})`,
            backgroundSize: '200% 200%',
            animation: 'gradientShift 8s ease infinite',
          }}
        >
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">{headline}</h1>
          {subline && <p className="text-lg text-white/80 max-w-2xl mx-auto">{subline}</p>}
          {ctaText && ctaUrl && (
            <a
              href={ctaUrl}
              className="inline-block mt-6 px-8 py-3 rounded-lg font-semibold bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 transition-all"
            >
              {ctaText}
            </a>
          )}
        </div>
      </ScrollReveal>
    );
  }

  // Default: centered
  return (
    <ScrollReveal>
      <div className="text-center py-12 space-y-4">
        <h1 className="text-3xl md:text-5xl font-bold" style={{ color: 'var(--ds-foreground)' }}>
          {headline}
        </h1>
        {subline && (
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--ds-muted)' }}>
            {subline}
          </p>
        )}
        {ctaText && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block px-8 py-3 rounded-lg font-semibold text-white transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: primaryColor }}
          >
            {ctaText}
          </a>
        )}
      </div>
    </ScrollReveal>
  );
}
```

**Step 2: Add to SectionRenderer**

In `src/components/ds/SectionRenderer.tsx`, add the import and case:

```typescript
import { HeroSection } from './HeroSection';

// Inside the switch statement, add:
case 'hero':
  return <HeroSection config={section.config as HeroConfig} variant={section.variant} primaryColor={primaryColor} />;
```

Note: `SectionRenderer` will need to accept `primaryColor` as a prop and pass it to components that need it. Check the existing props interface and add `primaryColor?: string` if not present.

**Step 3: Commit**

```bash
git add src/components/ds/HeroSection.tsx src/components/ds/SectionRenderer.tsx
git commit -m "feat: add hero section renderer with 3 variants"
```

---

## Task 9: New Section Renderers — StatsBar, FeatureGrid, SocialProofWall

**Files:**
- Create: `src/components/ds/StatsBar.tsx`
- Create: `src/components/ds/FeatureGrid.tsx`
- Create: `src/components/ds/SocialProofWall.tsx`
- Modify: `src/components/ds/SectionRenderer.tsx`

**Step 1: Create StatsBar renderer**

Create `src/components/ds/StatsBar.tsx`:

```typescript
/** Stats bar section. Variants: inline, cards, animated-counters. */
'use client';

import React from 'react';
import type { StatsBarConfig } from '@/lib/types/funnel';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';
import { useScrollReveal } from '@/components/funnel/animations/useScrollReveal';
import { useCountUp } from '@/components/funnel/animations/useCountUp';

interface StatsBarProps {
  config: StatsBarConfig;
  variant: string;
  primaryColor: string;
}

function AnimatedStat({ value, label, isVisible, delay }: { value: string; label: string; isVisible: boolean; delay: number }) {
  const numericValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
  const prefix = value.match(/^[^0-9]*/)?.[0] || '';
  const suffix = value.match(/[^0-9]*$/)?.[0] || '';
  const isNumeric = !isNaN(numericValue) && numericValue > 0;
  const count = useCountUp(isNumeric ? numericValue : 0, isVisible);

  return (
    <div className="text-center" style={{ transitionDelay: `${delay}ms` }}>
      <div className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--ds-primary)' }}>
        {isNumeric ? `${prefix}${count}${suffix}` : value}
      </div>
      <div className="text-sm mt-1" style={{ color: 'var(--ds-muted)' }}>{label}</div>
    </div>
  );
}

export function StatsBar({ config, variant, primaryColor }: StatsBarProps) {
  const { ref, isVisible } = useScrollReveal();
  const { items } = config;

  if (variant === 'cards') {
    return (
      <div ref={ref} className={`grid grid-cols-${items.length} gap-4 py-8`}>
        {items.map((item, i) => (
          <ScrollReveal key={i} delay={i * 100}>
            <div
              className="rounded-xl p-6 text-center transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--ds-card)', border: '1px solid var(--ds-border)' }}
            >
              <div className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>
                {item.value}
              </div>
              <div className="text-sm mt-2" style={{ color: 'var(--ds-muted)' }}>{item.label}</div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    );
  }

  if (variant === 'animated-counters') {
    return (
      <div ref={ref} className="flex justify-around py-8">
        {items.map((item, i) => (
          <AnimatedStat key={i} value={item.value} label={item.label} isVisible={isVisible} delay={i * 150} />
        ))}
      </div>
    );
  }

  // Default: inline
  return (
    <ScrollReveal>
      <div className="flex justify-around py-6 border-y" style={{ borderColor: 'var(--ds-border)' }}>
        {items.map((item, i) => (
          <div key={i} className="text-center">
            <div className="text-2xl font-bold" style={{ color: primaryColor }}>{item.value}</div>
            <div className="text-sm" style={{ color: 'var(--ds-muted)' }}>{item.label}</div>
          </div>
        ))}
      </div>
    </ScrollReveal>
  );
}
```

**Step 2: Create FeatureGrid renderer**

Create `src/components/ds/FeatureGrid.tsx`:

```typescript
/** Feature grid section. Variants: icon-top, icon-left, minimal. */
'use client';

import React from 'react';
import type { FeatureGridConfig } from '@/lib/types/funnel';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

interface FeatureGridProps {
  config: FeatureGridConfig;
  variant: string;
  primaryColor: string;
}

export function FeatureGrid({ config, variant, primaryColor }: FeatureGridProps) {
  const { features } = config;

  if (variant === 'icon-left') {
    return (
      <div className="space-y-4 py-8">
        {features.map((feature, i) => (
          <ScrollReveal key={i} delay={i * 100}>
            <div className="flex items-start gap-4 p-4 rounded-lg transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: 'var(--ds-card)' }}>
              <span className="text-2xl flex-shrink-0 mt-1">{feature.icon}</span>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--ds-foreground)' }}>{feature.title}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--ds-muted)' }}>{feature.description}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
        {features.map((feature, i) => (
          <ScrollReveal key={i} delay={i * 100}>
            <div className="space-y-2">
              <h3 className="font-semibold" style={{ color: primaryColor }}>{feature.title}</h3>
              <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>{feature.description}</p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    );
  }

  // Default: icon-top
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
      {features.map((feature, i) => (
        <ScrollReveal key={i} delay={i * 100}>
          <div
            className="text-center p-6 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{ backgroundColor: 'var(--ds-card)', border: '1px solid var(--ds-border)' }}
          >
            <span className="text-3xl block mb-3">{feature.icon}</span>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--ds-foreground)' }}>{feature.title}</h3>
            <p className="text-sm" style={{ color: 'var(--ds-muted)' }}>{feature.description}</p>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}
```

**Step 3: Create SocialProofWall renderer**

Create `src/components/ds/SocialProofWall.tsx`:

```typescript
/** Social proof wall section. Variants: grid, carousel, stacked. */
'use client';

import React from 'react';
import type { SocialProofWallConfig } from '@/lib/types/funnel';
import { ScrollReveal } from '@/components/funnel/animations/ScrollReveal';

interface SocialProofWallProps {
  config: SocialProofWallConfig;
  variant: string;
  primaryColor: string;
}

export function SocialProofWall({ config, variant, primaryColor }: SocialProofWallProps) {
  const { testimonials } = config;

  if (variant === 'stacked') {
    return (
      <div className="space-y-4 py-8">
        {testimonials.map((t, i) => (
          <ScrollReveal key={i} delay={i * 100}>
            <div
              className="p-5 rounded-lg border-l-4"
              style={{ borderColor: primaryColor, backgroundColor: 'var(--ds-card)' }}
            >
              <p className="italic" style={{ color: 'var(--ds-foreground)' }}>&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-3 flex items-center gap-2">
                {t.avatar && (
                  <img src={t.avatar} alt={t.author} className="w-8 h-8 rounded-full object-cover" />
                )}
                <div>
                  <span className="font-semibold text-sm" style={{ color: 'var(--ds-foreground)' }}>{t.author}</span>
                  {t.role && <span className="text-xs ml-1" style={{ color: 'var(--ds-muted)' }}>— {t.role}</span>}
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    );
  }

  if (variant === 'carousel') {
    // Simple horizontal scroll for now (CSS-only, no JS carousel lib)
    return (
      <ScrollReveal>
        <div className="flex gap-4 overflow-x-auto py-8 snap-x snap-mandatory scrollbar-hide">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-72 p-5 rounded-xl snap-center"
              style={{ backgroundColor: 'var(--ds-card)', border: '1px solid var(--ds-border)' }}
            >
              <p className="text-sm italic" style={{ color: 'var(--ds-foreground)' }}>&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-3 flex items-center gap-2">
                {t.avatar && (
                  <img src={t.avatar} alt={t.author} className="w-7 h-7 rounded-full object-cover" />
                )}
                <div>
                  <span className="font-semibold text-xs">{t.author}</span>
                  {t.role && <span className="text-xs block" style={{ color: 'var(--ds-muted)' }}>{t.role}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>
    );
  }

  // Default: grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-8">
      {testimonials.map((t, i) => (
        <ScrollReveal key={i} delay={i * 100}>
          <div
            className="p-5 rounded-xl transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--ds-card)', border: '1px solid var(--ds-border)' }}
          >
            <p className="text-sm italic" style={{ color: 'var(--ds-foreground)' }}>&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-4 flex items-center gap-3">
              {t.avatar && (
                <img src={t.avatar} alt={t.author} className="w-9 h-9 rounded-full object-cover" />
              )}
              <div>
                <span className="font-semibold text-sm">{t.author}</span>
                {t.role && <span className="text-xs block" style={{ color: 'var(--ds-muted)' }}>{t.role}</span>}
              </div>
            </div>
          </div>
        </ScrollReveal>
      ))}
    </div>
  );
}
```

**Step 4: Wire into SectionRenderer**

In `src/components/ds/SectionRenderer.tsx`, add imports and cases:

```typescript
import { StatsBar } from './StatsBar';
import { FeatureGrid } from './FeatureGrid';
import { SocialProofWall } from './SocialProofWall';

// In the switch:
case 'stats_bar':
  return <StatsBar config={section.config as StatsBarConfig} variant={section.variant} primaryColor={primaryColor} />;
case 'feature_grid':
  return <FeatureGrid config={section.config as FeatureGridConfig} variant={section.variant} primaryColor={primaryColor} />;
case 'social_proof_wall':
  return <SocialProofWall config={section.config as SocialProofWallConfig} variant={section.variant} primaryColor={primaryColor} />;
```

**Step 5: Commit**

```bash
git add src/components/ds/StatsBar.tsx src/components/ds/FeatureGrid.tsx src/components/ds/SocialProofWall.tsx src/components/ds/SectionRenderer.tsx
git commit -m "feat: add stats bar, feature grid, social proof wall section renderers"
```

---

## Task 10: Update Existing Section Renderers for Variant Support

**Files:**
- Modify: `src/components/ds/LogoBar.tsx`
- Modify: `src/components/ds/SimpleSteps.tsx`
- Modify: `src/components/ds/TestimonialQuote.tsx`
- Modify: `src/components/ds/MarketingBlock.tsx`
- Modify: `src/components/ds/SectionBridge.tsx`

**Step 1: Add variant prop to all 5 existing section components**

Each component should accept a `variant` prop and render differently based on it. The `default` variant should match the current rendering (backward compatible).

**LogoBar.tsx**: Add `variant: string` prop. `inline` = current horizontal layout (default). `grid` = 2-column grid on mobile, 4-column on desktop.

**SimpleSteps.tsx**: Add `variant: string` prop. `numbered` = current layout (default). `timeline` = vertical line with dots. `icon-cards` = card-based with icon emphasis.

**TestimonialQuote.tsx**: Add `variant: string` prop. `quote-card` = current card layout (default). `highlight` = large centered quote. `avatar` = circular avatar with quote.

**MarketingBlock.tsx**: Add `variant: string` prop. Map to internal blockType: `feature-card` → 'feature', `benefit` → 'benefit', `faq-accordion` → 'faq', `cta-banner` → 'cta'. The `default` variant uses existing blockType from config.

**SectionBridge.tsx**: Already supports `variant` in config. Move `variant` from config to the component prop, defaulting to config.variant for backward compat.

**Step 2: Wrap all sections with ScrollReveal**

Import `ScrollReveal` from `@/components/funnel/animations/ScrollReveal` in each component. Wrap the outermost div with `<ScrollReveal>`.

**Step 3: Update SectionRenderer to pass variant**

Ensure `SectionRenderer` passes `section.variant` to each component.

**Step 4: Run existing tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --no-coverage`
Expected: All pass (backward compat with `variant='default'`).

**Step 5: Commit**

```bash
git add src/components/ds/LogoBar.tsx src/components/ds/SimpleSteps.tsx src/components/ds/TestimonialQuote.tsx src/components/ds/MarketingBlock.tsx src/components/ds/SectionBridge.tsx src/components/ds/SectionRenderer.tsx
git commit -m "feat: add variant support + scroll animations to existing section renderers"
```

---

## Task 11: Gradient Shift CSS Animation

**Files:**
- Modify: `src/app/globals.css` (or wherever global styles live)

**Step 1: Add gradient animation keyframes**

Find the global CSS file and add:

```css
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

**Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add gradient shift keyframes + scrollbar hide utility"
```

---

## Task 12: Extend RestylePlan for Variant Changes

**Files:**
- Modify: `src/lib/types/funnel.ts`
- Modify: `src/lib/ai/restyle/plan-generator.ts`
- Modify: `src/server/services/restyle.service.ts`
- Create: `src/__tests__/lib/ai/restyle/variant-changes.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/lib/ai/restyle/variant-changes.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { parseRestylePlan } from '@/lib/ai/restyle/plan-generator';

describe('RestylePlan variant changes', () => {
  it('should parse sectionVariantChanges from AI response', () => {
    const json = JSON.stringify({
      styleDirection: 'Modern SaaS',
      reasoning: 'Clean and professional',
      changes: [],
      sectionChanges: [],
      sectionVariantChanges: [
        { sectionId: 'abc', fromVariant: 'numbered', toVariant: 'timeline', reason: 'More visual flow' },
      ],
    });

    const plan = parseRestylePlan(json);
    expect(plan.sectionVariantChanges).toHaveLength(1);
    expect(plan.sectionVariantChanges![0].toVariant).toBe('timeline');
  });

  it('should default sectionVariantChanges to empty array', () => {
    const json = JSON.stringify({
      styleDirection: 'Minimal',
      reasoning: 'Clean',
      changes: [],
      sectionChanges: [],
    });

    const plan = parseRestylePlan(json);
    expect(plan.sectionVariantChanges).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="variant-changes" --no-coverage`
Expected: FAIL — `sectionVariantChanges` not on RestylePlan type.

**Step 3: Add sectionVariantChanges to types**

In `src/lib/types/funnel.ts`, add after RestyleSectionChange:

```typescript
export interface RestyleVariantChange {
  sectionId: string;
  fromVariant: string;
  toVariant: string;
  reason: string;
}

export interface RestylePlan {
  styleDirection: string;
  reasoning: string;
  changes: RestyleFieldChange[];
  sectionChanges: RestyleSectionChange[];
  sectionVariantChanges?: RestyleVariantChange[];
}
```

**Step 4: Update plan-generator.ts**

In `parseRestylePlan()`, add parsing for `sectionVariantChanges`:

```typescript
// After parsing sectionChanges:
const sectionVariantChanges = (parsed.sectionVariantChanges || [])
  .filter((c: any) => c.sectionId && c.toVariant && c.reason);

return {
  styleDirection: parsed.styleDirection,
  reasoning: parsed.reasoning,
  changes: validChanges,
  sectionChanges: validSectionChanges,
  sectionVariantChanges,
};
```

Update `buildRestylePrompt()` to include variant information in the prompt — mention available variants per section type and that the AI can suggest variant changes.

**Step 5: Update restyle.service.ts**

In `applyRestylePlan()`, add variant change application after section changes:

```typescript
// Apply variant changes
let variantChangesApplied = 0;
for (const variantChange of plan.sectionVariantChanges || []) {
  try {
    await funnelsRepo.updateSection(variantChange.sectionId, funnelId, {
      variant: variantChange.toVariant,
    });
    variantChangesApplied++;
  } catch (error) {
    logError('restyle:apply-variant-change', error, { sectionId: variantChange.sectionId });
  }
}
```

**Step 6: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="variant-changes|restyle" --no-coverage`
Expected: PASS

**Step 7: Commit**

```bash
git add src/lib/types/funnel.ts src/lib/ai/restyle/plan-generator.ts src/server/services/restyle.service.ts src/__tests__/lib/ai/restyle/variant-changes.test.ts
git commit -m "feat: extend RestylePlan with sectionVariantChanges"
```

---

## Task 13: AI Section Generation Module

**Files:**
- Create: `src/lib/ai/funnel-generation/section-generator.ts`
- Create: `src/__tests__/lib/ai/funnel-generation/section-generator.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/lib/ai/funnel-generation/section-generator.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { buildSectionGenerationPrompt, parseSectionPlan } from '@/lib/ai/funnel-generation/section-generator';

describe('Section Generator', () => {
  describe('buildSectionGenerationPrompt', () => {
    it('should include lead magnet details in prompt', () => {
      const prompt = buildSectionGenerationPrompt({
        leadMagnetTitle: 'Agency Growth Playbook',
        leadMagnetFormat: 'guide',
        targetAudience: 'Agency owners',
        brandKit: { primaryColor: '#8b5cf6', theme: 'dark' },
      });

      expect(prompt).toContain('Agency Growth Playbook');
      expect(prompt).toContain('Agency owners');
      expect(prompt).toContain('#8b5cf6');
    });

    it('should list available section types and variants', () => {
      const prompt = buildSectionGenerationPrompt({
        leadMagnetTitle: 'Test',
        leadMagnetFormat: 'checklist',
      });

      expect(prompt).toContain('hero');
      expect(prompt).toContain('stats_bar');
      expect(prompt).toContain('feature_grid');
      expect(prompt).toContain('centered');
      expect(prompt).toContain('animated-counters');
    });
  });

  describe('parseSectionPlan', () => {
    it('should parse valid section plan JSON', () => {
      const json = JSON.stringify({
        sections: [
          {
            sectionType: 'hero',
            variant: 'centered',
            pageLocation: 'optin',
            sortOrder: 0,
            config: { headline: 'Get Your Free Guide' },
          },
          {
            sectionType: 'stats_bar',
            variant: 'animated-counters',
            pageLocation: 'optin',
            sortOrder: 10,
            config: {
              items: [
                { value: '500+', label: 'Clients' },
                { value: '$10M', label: 'Revenue' },
                { value: '98%', label: 'Satisfaction' },
              ],
            },
          },
        ],
      });

      const plan = parseSectionPlan(json);
      expect(plan.sections).toHaveLength(2);
      expect(plan.sections[0].sectionType).toBe('hero');
      expect(plan.sections[0].variant).toBe('centered');
    });

    it('should filter invalid section types', () => {
      const json = JSON.stringify({
        sections: [
          { sectionType: 'invalid_type', variant: 'default', pageLocation: 'optin', sortOrder: 0, config: {} },
          { sectionType: 'hero', variant: 'centered', pageLocation: 'optin', sortOrder: 0, config: { headline: 'Hi' } },
        ],
      });

      const plan = parseSectionPlan(json);
      expect(plan.sections).toHaveLength(1);
      expect(plan.sections[0].sectionType).toBe('hero');
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseSectionPlan('not json')).toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="section-generator" --no-coverage`
Expected: FAIL — module not found.

**Step 3: Implement section generator**

Create `src/lib/ai/funnel-generation/section-generator.ts`:

```typescript
/**
 * AI Section Generation. Builds prompts for generating funnel page sections.
 * Never imports NextRequest/NextResponse.
 */
import { SECTION_VARIANTS, type SectionType } from '@/lib/types/funnel';

// ─── Types ────────────────────────────────────────────────────────

interface GenerationContext {
  leadMagnetTitle: string;
  leadMagnetFormat?: string;
  targetAudience?: string;
  brandKit?: { primaryColor?: string; theme?: string };
}

export interface SectionPlanItem {
  sectionType: SectionType;
  variant: string;
  pageLocation: 'optin' | 'thankyou' | 'content';
  sortOrder: number;
  config: Record<string, unknown>;
}

export interface SectionPlan {
  sections: SectionPlanItem[];
}

// ─── Valid Types ──────────────────────────────────────────────────

const VALID_SECTION_TYPES = new Set<string>(Object.keys(SECTION_VARIANTS));

// ─── Prompt Builder ───────────────────────────────────────────────

export function buildSectionGenerationPrompt(context: GenerationContext): string {
  const variantList = Object.entries(SECTION_VARIANTS)
    .map(([type, variants]) => `  ${type}: ${(variants as readonly string[]).join(', ')}`)
    .join('\n');

  return `You are a conversion-focused landing page designer. Generate sections for a funnel opt-in page.

LEAD MAGNET:
- Title: ${context.leadMagnetTitle}
- Format: ${context.leadMagnetFormat || 'guide'}
- Target audience: ${context.targetAudience || 'professionals'}
${context.brandKit?.primaryColor ? `- Primary color: ${context.brandKit.primaryColor}` : ''}
${context.brandKit?.theme ? `- Theme: ${context.brandKit.theme}` : ''}

AVAILABLE SECTION TYPES AND VARIANTS:
${variantList}

POSITION RULES:
- hero: optin page only, max 1, sort_order 0-5
- logo_bar: optin page only, max 1, sort_order 5-10
- stats_bar: optin or thankyou, max 1, sort_order 10-20
- steps: any page, max 1, sort_order 20-40
- feature_grid: optin or content, max 1, sort_order 20-40
- testimonial: any page, max 2, sort_order 40-60
- social_proof_wall: any page, max 1, sort_order 60-80
- section_bridge: any page, max 3, sort_order between other sections
- marketing_block: any page, max 3, sort_order 40-80

RULES:
- Pick 3-6 sections total for the optin page
- Always include a hero section
- Pick variants that match the content type and audience
- Generate realistic, professional content for each section config
- stats_bar items: 3-4 items, values under 10 chars (e.g., "500+", "$10M", "98%")
- feature_grid: 3-6 features with emoji icons
- social_proof_wall testimonials: 2-6, each quote min 20 chars
- steps: 3-5 steps with title + description

Return JSON only (no markdown):
{
  "sections": [
    { "sectionType": "...", "variant": "...", "pageLocation": "optin", "sortOrder": N, "config": {...} }
  ]
}`;
}

// ─── Parser ───────────────────────────────────────────────────────

export function parseSectionPlan(response: string): SectionPlan {
  const cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();

  let parsed: { sections?: unknown[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse section plan JSON');
  }

  if (!Array.isArray(parsed.sections)) {
    throw new Error('Section plan must contain a sections array');
  }

  const validSections = parsed.sections
    .filter((s: any) => VALID_SECTION_TYPES.has(s.sectionType) && s.config && s.pageLocation)
    .map((s: any) => ({
      sectionType: s.sectionType as SectionType,
      variant: s.variant || 'default',
      pageLocation: s.pageLocation,
      sortOrder: s.sortOrder ?? 0,
      config: s.config,
    }));

  return { sections: validSections };
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="section-generator" --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/funnel-generation/section-generator.ts src/__tests__/lib/ai/funnel-generation/section-generator.test.ts
git commit -m "feat: add AI section generation prompt builder + parser"
```

---

## Task 14: MCP Tools — Section Variant Support

**Files:**
- Modify: `packages/mcp/src/tools/funnels.ts`
- Modify: `packages/mcp/src/handlers/funnels.ts`
- Modify: `packages/mcp/src/client.ts`
- Modify: `packages/mcp/src/__tests__/tools.test.ts`

**Step 1: Add variant to section tools**

In `packages/mcp/src/tools/funnels.ts`, find the section-related tools (create/update section) and add `variant` as an optional string parameter.

If there is a `magnetlab_create_section` tool, add:
```typescript
variant: { type: 'string', description: 'Layout variant for the section (e.g., "centered", "timeline", "grid")' },
```

If there is a `magnetlab_update_section` tool, add the same.

**Step 2: Update handler to pass variant**

In `packages/mcp/src/handlers/funnels.ts`, ensure `variant` is included in the params passed to client methods.

**Step 3: Update client to send variant**

In `packages/mcp/src/client.ts`, ensure section create/update methods include `variant` in the request body.

**Step 4: Update tool count in tests**

In `packages/mcp/src/__tests__/tools.test.ts`, verify tool counts still match (no new tools added, just new parameters).

**Step 5: Run MCP tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && npm test -- --no-coverage`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/mcp/src/tools/funnels.ts packages/mcp/src/handlers/funnels.ts packages/mcp/src/client.ts packages/mcp/src/__tests__/tools.test.ts
git commit -m "feat: add variant parameter to MCP section tools"
```

---

## Task 15: SectionsManager Editor — Variant Selector + New Section Types

**Files:**
- Modify: `src/components/funnel/SectionsManager.tsx`

**Step 1: Add new section types to the add-section dropdown**

In `SectionsManager.tsx`, find the section type selector (where users choose which section to add). Add the 4 new types: `hero`, `stats_bar`, `feature_grid`, `social_proof_wall`.

**Step 2: Add default configs for new section types**

Find the `getDefaultConfig(type)` function and add default configs:

```typescript
case 'hero':
  return { headline: 'Your Headline Here', subline: 'Your subline goes here' };
case 'stats_bar':
  return { items: [{ value: '100+', label: 'Clients' }, { value: '99%', label: 'Satisfaction' }, { value: '24/7', label: 'Support' }] };
case 'feature_grid':
  return { features: [
    { icon: '🚀', title: 'Feature 1', description: 'Description here' },
    { icon: '🔒', title: 'Feature 2', description: 'Description here' },
    { icon: '📊', title: 'Feature 3', description: 'Description here' },
  ] };
case 'social_proof_wall':
  return { testimonials: [
    { quote: 'This product changed everything for us.', author: 'Customer Name' },
    { quote: 'Best decision we made this year by far.', author: 'Another Customer' },
  ] };
```

**Step 3: Add variant selector to section editor**

Add a dropdown/select for variant in the section editor panel. Use `SECTION_VARIANTS[sectionType]` to populate options. When variant changes, call `updateSection` API with the new variant.

```typescript
import { SECTION_VARIANTS, type SectionType } from '@/lib/types/funnel';

// In the section editor:
const variants = SECTION_VARIANTS[section.sectionType as SectionType] || [];
// Render a select with these variants
```

**Step 4: Add config editors for new section types**

Add editor UI for each new section type:
- **HeroEditor**: headline input, subline input, CTA text/url inputs, background image URL
- **StatsBarEditor**: 3-4 stat items (value + label inputs)
- **FeatureGridEditor**: 3-6 features (icon + title + description inputs)
- **SocialProofWallEditor**: 2-6 testimonials (quote + author + role inputs)

**Step 5: Run existing tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --no-coverage`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/components/funnel/SectionsManager.tsx
git commit -m "feat: add new section types + variant selector to SectionsManager"
```

---

## Task 16: Public Page Rendering — Variant + primaryColor Pass-Through

**Files:**
- Modify: `src/components/funnel/public/OptinPage.tsx`
- Modify: `src/components/funnel/FunnelPreview.tsx`
- Modify: `src/components/ds/SectionRenderer.tsx`
- Modify: `src/app/p/[username]/[slug]/page.tsx` (if needed)

**Step 1: Update SectionRenderer props**

Add `primaryColor` to SectionRenderer props if not already present. Pass it through to all section components.

```typescript
interface SectionRendererProps {
  section: FunnelPageSection;
  primaryColor?: string;
}
```

**Step 2: Update OptinPage to pass primaryColor**

In `OptinPage.tsx`, pass `primaryColor` from the funnel to each `<SectionRenderer>`:

```typescript
<SectionRenderer key={s.id} section={s} primaryColor={funnel.primaryColor || '#8b5cf6'} />
```

**Step 3: Update FunnelPreview to pass primaryColor**

Same change in `FunnelPreview.tsx`.

**Step 4: Update server page to include variant in section query**

In `src/app/p/[username]/[slug]/page.tsx`, the query already selects all columns via SECTION_COLUMNS. Verify `variant` is included in the select. If the page uses a raw select string, add `variant` to it.

**Step 5: Run existing tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --no-coverage`
Expected: All pass.

**Step 6: Commit**

```bash
git add src/components/funnel/public/OptinPage.tsx src/components/funnel/FunnelPreview.tsx src/components/ds/SectionRenderer.tsx src/app/p/[username]/[slug]/page.tsx
git commit -m "feat: pass primaryColor + variant through section rendering pipeline"
```

---

## Task 17: Frontend API + RestylePanel Update

**Files:**
- Modify: `src/frontend/api/funnel/index.ts`
- Modify: `src/components/funnel/RestylePanel.tsx`

**Step 1: Update frontend API section methods**

In `src/frontend/api/funnel/index.ts`, ensure `createSection` and `updateSection` accept `variant` in their params.

**Step 2: Update RestylePanel to show variant changes**

In `src/components/funnel/RestylePanel.tsx`, render `sectionVariantChanges` from the plan alongside existing field changes and section changes. Each variant change should be toggleable (accept/reject) like existing items.

**Step 3: Commit**

```bash
git add src/frontend/api/funnel/index.ts src/components/funnel/RestylePanel.tsx
git commit -m "feat: update frontend API + RestylePanel for variant changes"
```

---

## Task 18: Update CLAUDE.md + Documentation

**Files:**
- Modify: `/Users/timlife/Documents/claude code/magnetlab/CLAUDE.md`

**Step 1: Add Enhanced Page Builder section to CLAUDE.md**

Add after the "Funnel Restyler" section:

```markdown
## Enhanced Page Builder (Mar 2026)

9 section types with named layout variants, position rules engine, and scroll animations. AI picks sections/variants on creation; user refines via restyler.

### Section Types & Variants

| Type | Variants | Max Per Page |
|------|----------|-------------|
| hero | centered, split-image, full-bleed-gradient | 1 (optin only) |
| logo_bar | inline, grid | 1 (optin only) |
| stats_bar | inline, cards, animated-counters | 1 |
| steps | numbered, timeline, icon-cards | 1 |
| feature_grid | icon-top, icon-left, minimal | 1 |
| testimonial | quote-card, highlight, avatar | 2 |
| social_proof_wall | grid, carousel, stacked | 1 |
| section_bridge | divider, accent-bar, gradient-fade | 3 |
| marketing_block | feature-card, benefit, faq-accordion, cta-banner | 3 |

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/types/funnel.ts` | SECTION_VARIANTS, new config interfaces |
| `src/lib/validations/section-rules.ts` | Position rules engine |
| `src/lib/validations/api.ts` | Variant-specific Zod schemas |
| `src/lib/ai/funnel-generation/section-generator.ts` | AI section generation prompts |
| `src/components/funnel/animations/` | ScrollReveal, useCountUp hooks |
| `src/components/ds/HeroSection.tsx` | Hero renderer (3 variants) |
| `src/components/ds/StatsBar.tsx` | Stats bar renderer (3 variants) |
| `src/components/ds/FeatureGrid.tsx` | Feature grid renderer (3 variants) |
| `src/components/ds/SocialProofWall.tsx` | Social proof wall renderer (3 variants) |
```

**Step 2: Commit**

```bash
git add "/Users/timlife/Documents/claude code/magnetlab/CLAUDE.md"
git commit -m "docs: add Enhanced Page Builder section to CLAUDE.md"
```

---

## Task 19: Run Full Test Suite + Fix Any Failures

**Step 1: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --no-coverage`

**Step 2: Fix any failures**

Address any test failures caused by the changes. Common issues:
- Existing tests may fail if `FunnelPageSectionRow` now requires `variant` in test data
- `SectionRenderer` tests may need updating for new props
- Snapshot tests may need updating

**Step 3: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`

**Step 4: Fix any type errors**

**Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve test failures and type errors from enhanced page builder"
```

---

## Dependency Graph

```
Task 1 (DB migration)
  ↓
Task 2 (Types) ──→ Task 5 (Repo)
  ↓                    ↓
Task 3 (Schemas) → Task 6 (Service + rules enforcement)
  ↓
Task 4 (Rules engine)
  ↓
Task 7 (Animation hooks)
  ↓
Task 8 (Hero renderer) → Task 9 (3 more renderers)
  ↓
Task 10 (Update existing renderers)
  ↓
Task 11 (CSS animations)
  ↓
Task 12 (RestylePlan extension)
  ↓
Task 13 (AI section generation)
  ↓
Task 14 (MCP tools) → Task 15 (SectionsManager UI)
  ↓
Task 16 (Public page rendering)
  ↓
Task 17 (Frontend API + RestylePanel)
  ↓
Task 18 (Docs)
  ↓
Task 19 (Full test suite)
```
