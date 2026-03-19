# Thank-You Page Conversion Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the `video_first` thank-you layout into a VSL conversion funnel with video framing, CTA bridge, social proof positioning, and iClosed booking pre-fill from survey answers.

**Architecture:** Add 5 DB columns (4 on funnel_pages, 1 on qualification_questions), rework the `video_first` rendering path in ThankyouPage.tsx, port iClosed URL builder utilities, update CalendlyEmbed to accept pre-fill data, and wire everything through the admin editor.

**Tech Stack:** Next.js 15, React 18, Supabase (PostgreSQL), TypeScript, Zod, iClosed widget.js

**Spec:** `docs/superpowers/specs/2026-03-19-thankyou-page-conversion-redesign.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260319400000_thankyou_conversion_redesign.sql` | Create | Add 5 columns |
| `src/lib/types/funnel.ts` | Modify | Add fields to interfaces + mapper functions |
| `src/lib/validations/api.ts` | Modify | Add fields to Zod schemas |
| `src/lib/utils/iclosed-helpers.ts` | Create | Port `buildIClosedUrl()` + `normalizePhone()` |
| `src/server/repositories/funnels.repo.ts` | Modify | Add columns to select constants |
| `src/server/repositories/qualification-forms.repo.ts` | Modify | Add `booking_prefill_key` to select |
| `src/server/services/funnels.service.ts` | Modify | Handle new fields in create + update mapping |
| `src/server/services/external.service.ts` | Modify | Default to `video_first` in setupThankyou |
| `src/app/p/[username]/[slug]/thankyou/page.tsx` | Modify | Select new columns, pass to component |
| `src/components/funnel/public/ThankyouPage.tsx` | Modify | Rework `video_first` rendering order |
| `src/components/funnel/public/CalendlyEmbed.tsx` | Modify | Accept pre-fill data, build URLs |
| `src/components/funnel/ThankyouPageEditor.tsx` | Modify | Add VSL framing + CTA inputs |
| `src/components/funnel/FunnelBuilder.tsx` | Modify | Add state for new fields |
| `src/components/funnel/QuestionsManager.tsx` | Modify | Add `booking_prefill_key` field |
| `packages/mcp/src/tools/funnels.ts` | Modify | Add new fields to tool schemas |
| `packages/mcp/src/validation.ts` | Modify | Add new fields to Zod validation |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260319400000_thankyou_conversion_redesign.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Thank-you page conversion redesign: VSL framing, CTA bridge, booking pre-fill

-- 4 new columns on funnel_pages for video framing and CTA bridge
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS vsl_headline text;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS vsl_subline text;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS cta_headline text;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS cta_button_text text;

-- 1 new column on qualification_questions for booking pre-fill mapping
ALTER TABLE qualification_questions ADD COLUMN IF NOT EXISTS booking_prefill_key text;

COMMENT ON COLUMN funnel_pages.vsl_headline IS 'Bold label above video embed (e.g. THE MODERN AGENCY SALES METHOD)';
COMMENT ON COLUMN funnel_pages.vsl_subline IS 'Descriptive text below vsl_headline';
COMMENT ON COLUMN funnel_pages.cta_headline IS 'Text above CTA button between video and survey';
COMMENT ON COLUMN funnel_pages.cta_button_text IS 'CTA button text (e.g. BOOK YOUR CALL NOW)';
COMMENT ON COLUMN qualification_questions.booking_prefill_key IS 'iClosed/booking field identifier to map this answer to (e.g. monthlyrevenue, businesstype)';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260319400000_thankyou_conversion_redesign.sql
git commit -m "feat(db): add vsl framing, CTA bridge, and booking prefill columns"
```

---

### Task 2: Type Definitions + Validation Schemas

**Files:**
- Modify: `src/lib/types/funnel.ts` (interfaces at lines 47-104, row type at lines 469-507, mappers at lines 555-620)
- Modify: `src/lib/validations/api.ts` (updateFunnelSchema at line 254)

- [ ] **Step 1: Write failing type test**

Create `src/__tests__/lib/types/funnel-conversion-fields.test.ts`:

```typescript
import {
  funnelPageFromRow,
  qualificationQuestionFromRow,
  type FunnelPage,
  type FunnelPageRow,
  type QualificationQuestion,
  type QualificationQuestionRow,
} from '@/lib/types/funnel';

describe('funnel conversion fields', () => {
  it('maps vsl/cta fields from row to FunnelPage', () => {
    const row = {
      id: 'fp1', lead_magnet_id: 'lm1', user_id: 'u1', slug: 'test',
      target_type: 'lead_magnet', library_id: null, external_resource_id: null,
      optin_headline: 'H', optin_subline: null, optin_button_text: 'Get',
      optin_social_proof: null, thankyou_headline: 'Thanks', thankyou_subline: null,
      vsl_url: null, calendly_url: null,
      qualification_pass_message: 'Pass', qualification_fail_message: 'Fail',
      redirect_trigger: 'none', redirect_url: null, redirect_fail_url: null,
      homepage_url: null, homepage_label: null, send_resource_email: true,
      thankyou_layout: 'video_first',
      theme: 'dark', primary_color: '#8b5cf6', background_style: 'solid',
      font_family: null, font_url: null, logo_url: null,
      qualification_form_id: null, is_published: true, published_at: null,
      created_at: '2026-01-01', updated_at: '2026-01-01',
      // New fields:
      vsl_headline: 'THE METHOD', vsl_subline: 'Watch this free training',
      cta_headline: 'Ready?', cta_button_text: 'BOOK NOW',
    } as FunnelPageRow;

    const result = funnelPageFromRow(row);
    expect(result.vslHeadline).toBe('THE METHOD');
    expect(result.vslSubline).toBe('Watch this free training');
    expect(result.ctaHeadline).toBe('Ready?');
    expect(result.ctaButtonText).toBe('BOOK NOW');
  });

  it('maps null vsl/cta fields correctly', () => {
    const row = {
      id: 'fp1', lead_magnet_id: 'lm1', user_id: 'u1', slug: 'test',
      target_type: 'lead_magnet', library_id: null, external_resource_id: null,
      optin_headline: 'H', optin_subline: null, optin_button_text: 'Get',
      optin_social_proof: null, thankyou_headline: 'Thanks', thankyou_subline: null,
      vsl_url: null, calendly_url: null,
      qualification_pass_message: 'Pass', qualification_fail_message: 'Fail',
      redirect_trigger: 'none', redirect_url: null, redirect_fail_url: null,
      homepage_url: null, homepage_label: null, send_resource_email: true,
      thankyou_layout: 'survey_first',
      theme: 'dark', primary_color: '#8b5cf6', background_style: 'solid',
      font_family: null, font_url: null, logo_url: null,
      qualification_form_id: null, is_published: true, published_at: null,
      created_at: '2026-01-01', updated_at: '2026-01-01',
      vsl_headline: null, vsl_subline: null,
      cta_headline: null, cta_button_text: null,
    } as FunnelPageRow;

    const result = funnelPageFromRow(row);
    expect(result.vslHeadline).toBeNull();
    expect(result.ctaButtonText).toBeNull();
  });

  it('maps booking_prefill_key from question row', () => {
    const row = {
      id: 'q1', funnel_page_id: 'fp1', form_id: null,
      question_text: 'Monthly revenue?', question_order: 1,
      answer_type: 'multiple_choice', qualifying_answer: null,
      options: ['Under $10k', '$10k-$50k', '$50k+'],
      placeholder: null, is_qualifying: false, is_required: true,
      created_at: '2026-01-01',
      booking_prefill_key: 'monthlyrevenue',
    } as QualificationQuestionRow;

    const result = qualificationQuestionFromRow(row);
    expect(result.bookingPrefillKey).toBe('monthlyrevenue');
  });

  it('maps null booking_prefill_key', () => {
    const row = {
      id: 'q1', funnel_page_id: 'fp1', form_id: null,
      question_text: 'Are you an agency?', question_order: 1,
      answer_type: 'yes_no', qualifying_answer: 'yes',
      options: null, placeholder: null, is_qualifying: true, is_required: true,
      created_at: '2026-01-01',
      booking_prefill_key: null,
    } as QualificationQuestionRow;

    const result = qualificationQuestionFromRow(row);
    expect(result.bookingPrefillKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/lib/types/funnel-conversion-fields.test.ts`
Expected: FAIL — properties `vslHeadline`, `ctaHeadline`, `bookingPrefillKey` don't exist on types

- [ ] **Step 3: Add fields to FunnelPage interface**

In `src/lib/types/funnel.ts`, add after `thankyouLayout` (line 85):

```typescript
  // VSL framing + CTA bridge (video_first layout)
  vslHeadline: string | null;
  vslSubline: string | null;
  ctaHeadline: string | null;
  ctaButtonText: string | null;
```

- [ ] **Step 4: Add fields to FunnelPageRow interface**

In `src/lib/types/funnel.ts`, add after `thankyou_layout` (line 495):

```typescript
  vsl_headline: string | null;
  vsl_subline: string | null;
  cta_headline: string | null;
  cta_button_text: string | null;
```

- [ ] **Step 5: Update funnelPageFromRow() mapper**

In `src/lib/types/funnel.ts`, add after `thankyouLayout` mapping (line 580):

```typescript
    vslHeadline: row.vsl_headline || null,
    vslSubline: row.vsl_subline || null,
    ctaHeadline: row.cta_headline || null,
    ctaButtonText: row.cta_button_text || null,
```

- [ ] **Step 6: Add bookingPrefillKey to QualificationQuestion interface**

In `src/lib/types/funnel.ts`, add after `isRequired` (line 124):

```typescript
  bookingPrefillKey: string | null;
```

- [ ] **Step 7: Add booking_prefill_key to QualificationQuestionRow**

In `src/lib/types/funnel.ts`, add after `is_required` (line 520):

```typescript
  booking_prefill_key: string | null;
```

- [ ] **Step 8: Update qualificationQuestionFromRow() mapper**

In `src/lib/types/funnel.ts`, add after `isRequired` mapping (line 617):

```typescript
    bookingPrefillKey: row.booking_prefill_key || null,
```

- [ ] **Step 9: Add to UpdateFunnelPagePayload**

In `src/lib/types/funnel.ts`, add after `thankyouLayout` in `UpdateFunnelPagePayload` (line 342):

```typescript
  vslHeadline?: string | null;
  vslSubline?: string | null;
  ctaHeadline?: string | null;
  ctaButtonText?: string | null;
```

- [ ] **Step 10: Add to Zod updateFunnelSchema**

In `src/lib/validations/api.ts`, add after `thankyouLayout` (line 285):

```typescript
  vslHeadline: z.string().max(500).nullable().optional(),
  vslSubline: z.string().max(1000).nullable().optional(),
  ctaHeadline: z.string().max(500).nullable().optional(),
  ctaButtonText: z.string().max(200).nullable().optional(),
```

- [ ] **Step 11: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/lib/types/funnel-conversion-fields.test.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/lib/types/funnel.ts src/lib/validations/api.ts src/__tests__/lib/types/funnel-conversion-fields.test.ts
git commit -m "feat: add vsl framing, CTA bridge, and booking prefill types + validation"
```

---

### Task 3: iClosed Helpers Utility

**Files:**
- Create: `src/lib/utils/iclosed-helpers.ts`
- Create: `src/__tests__/lib/utils/iclosed-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { buildIClosedUrl, normalizePhone } from '@/lib/utils/iclosed-helpers';

describe('normalizePhone', () => {
  it('returns undefined for empty input', () => {
    expect(normalizePhone(undefined)).toBeUndefined();
    expect(normalizePhone('')).toBeUndefined();
  });

  it('passes through numbers with + prefix', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671');
  });

  it('prepends +1 to 10-digit US numbers', () => {
    expect(normalizePhone('4155552671')).toBe('+14155552671');
  });

  it('prepends + to 11-digit numbers starting with 1', () => {
    expect(normalizePhone('14155552671')).toBe('+14155552671');
  });

  it('strips non-digit characters', () => {
    expect(normalizePhone('(415) 555-2671')).toBe('+14155552671');
  });
});

describe('buildIClosedUrl', () => {
  const baseUrl = 'https://app.iclosed.io/e/timkeen/li-growth';

  it('returns empty string for empty url', () => {
    expect(buildIClosedUrl('')).toBe('');
  });

  it('returns base url when no options', () => {
    expect(buildIClosedUrl(baseUrl)).toBe(baseUrl);
  });

  it('adds lead name and email', () => {
    const url = buildIClosedUrl(baseUrl, {
      leadName: 'John Doe',
      leadEmail: 'john@example.com',
    });
    expect(url).toContain('iclosedName=John+Doe');
    expect(url).toContain('iclosedEmail=john%40example.com');
  });

  it('adds phone in E.164 format', () => {
    const url = buildIClosedUrl(baseUrl, { leadPhone: '4155552671' });
    expect(url).toContain('iclosedPhone=%2B14155552671');
  });

  it('adds survey answers as custom fields', () => {
    const url = buildIClosedUrl(baseUrl, {
      surveyAnswers: { monthlyrevenue: '$50k-$100k', businesstype: 'Agency' },
    });
    expect(url).toContain('monthlyrevenue=%2450k-%24100k');
    expect(url).toContain('businesstype=Agency');
  });

  it('combines all params', () => {
    const url = buildIClosedUrl(baseUrl, {
      leadName: 'Jane',
      leadEmail: 'jane@co.com',
      leadPhone: '+14155550000',
      surveyAnswers: { businesstype: 'SaaS' },
    });
    expect(url).toContain('iclosedName=Jane');
    expect(url).toContain('iclosedEmail=');
    expect(url).toContain('iclosedPhone=');
    expect(url).toContain('businesstype=SaaS');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/lib/utils/iclosed-helpers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create iclosed-helpers.ts**

```typescript
/** iClosed Helpers. Pure utility functions for booking URL pre-fill. No React imports, no side effects. */

// ─── Phone Normalization ────────────────────────────────────────────────────

/**
 * Normalize a phone number to E.164 format for iClosed.
 * - Already has '+' prefix -> pass through
 * - 10 digits (US/CA) -> prepend '+1'
 * - 11 digits starting with '1' (US/CA with country code) -> prepend '+'
 * - Otherwise -> prepend '+' (best effort)
 */
export function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;
  if (phone.startsWith('+')) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// ─── URL Builder ────────────────────────────────────────────────────────────

/**
 * Build an iClosed booking URL with pre-filled lead data + survey answers.
 * Supports: iclosedName, iclosedEmail, iclosedPhone, custom survey answer fields.
 */
export function buildIClosedUrl(
  eventUrl: string,
  options?: {
    leadEmail?: string | null;
    leadName?: string | null;
    leadPhone?: string | null;
    surveyAnswers?: Record<string, string>;
  }
): string {
  if (!eventUrl) return '';
  if (!options) return eventUrl;

  const url = new URL(eventUrl);
  const params = url.searchParams;

  if (options.leadName) params.set('iclosedName', options.leadName);
  if (options.leadEmail) params.set('iclosedEmail', options.leadEmail);
  const normalizedPhone = normalizePhone(options.leadPhone ?? undefined);
  if (normalizedPhone) params.set('iclosedPhone', normalizedPhone);

  if (options.surveyAnswers) {
    for (const [key, value] of Object.entries(options.surveyAnswers)) {
      if (value) params.set(key, value);
    }
  }

  return url.toString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/lib/utils/iclosed-helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/iclosed-helpers.ts src/__tests__/lib/utils/iclosed-helpers.test.ts
git commit -m "feat: add iClosed URL builder + phone normalizer for booking pre-fill"
```

---

### Task 4: Repository + Service Layer Updates

**Files:**
- Modify: `src/server/repositories/funnels.repo.ts` (line 33-36 column constants)
- Modify: `src/server/repositories/qualification-forms.repo.ts` (line 9-10 QUESTION_COLUMNS)
- Modify: `src/server/services/funnels.service.ts` (line 196-221 create row)
- Modify: `src/server/services/external.service.ts` (setupThankyou function at line 246+)

- [ ] **Step 1: Add columns to funnels.repo.ts FUNNEL_COLUMNS**

In `src/server/repositories/funnels.repo.ts` line 33-34, append `thankyou_layout` (pre-existing gap) and the 4 new columns to FUNNEL_COLUMNS:

```typescript
const FUNNEL_COLUMNS =
  'id, lead_magnet_id, user_id, slug, target_type, library_id, external_resource_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, font_family, font_url, logo_url, qualification_form_id, is_published, published_at, created_at, updated_at, redirect_trigger, redirect_url, redirect_fail_url, send_resource_email, thankyou_layout, vsl_headline, vsl_subline, cta_headline, cta_button_text';
```

- [ ] **Step 2: Add booking_prefill_key to qualification-forms.repo.ts**

In `src/server/repositories/qualification-forms.repo.ts` line 9-10, append to QUESTION_COLUMNS:

```typescript
const QUESTION_COLUMNS =
  'id, funnel_page_id, form_id, question_text, question_order, answer_type, qualifying_answer, options, placeholder, is_qualifying, is_required, created_at, booking_prefill_key';
```

- [ ] **Step 3: Add new fields to funnels.service.ts createFunnel row**

In `src/server/services/funnels.service.ts`, add after `send_resource_email: true` (line 220):

```typescript
    thankyou_layout: funnelData.thankyouLayout || 'video_first',
    vsl_headline: funnelData.vslHeadline || null,
    vsl_subline: funnelData.vslSubline || null,
    cta_headline: funnelData.ctaHeadline || null,
    cta_button_text: funnelData.ctaButtonText || null,
```

Note: This also changes the default from `survey_first` to `video_first` for new funnels.

- [ ] **Step 4: Add update mapping in funnels.service.ts updateFunnel()**

In `src/server/services/funnels.service.ts`, add after `sendResourceEmail` mapping (line 319):

```typescript
  if (v.thankyouLayout !== undefined) updates.thankyou_layout = v.thankyouLayout;
  if (v.vslHeadline !== undefined) updates.vsl_headline = v.vslHeadline;
  if (v.vslSubline !== undefined) updates.vsl_subline = v.vslSubline;
  if (v.ctaHeadline !== undefined) updates.cta_headline = v.ctaHeadline;
  if (v.ctaButtonText !== undefined) updates.cta_button_text = v.ctaButtonText;
```

**Critical:** Without this, the admin editor saves will silently discard all new fields. Note: `thankyouLayout` mapping was also missing (pre-existing gap) — this fixes it.

- [ ] **Step 5: Update setupThankyou in external.service.ts**

In `src/server/services/external.service.ts`, find the `funnelUpdate` object near line 364. Add `thankyou_layout: 'video_first'` and CTA defaults:

```typescript
    const funnelUpdate: Record<string, unknown> = {
      send_resource_email: true,
      thankyou_layout: 'video_first',
      cta_headline: 'Ready to Take the Next Step?',
      cta_button_text: 'BOOK YOUR STRATEGY CALL',
    };
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (no type errors)

- [ ] **Step 7: Commit**

```bash
git add src/server/repositories/funnels.repo.ts src/server/repositories/qualification-forms.repo.ts src/server/services/funnels.service.ts src/server/services/external.service.ts
git commit -m "feat: wire vsl/cta/prefill fields through repo + service layers"
```

---

### Task 5: CalendlyEmbed Pre-fill Support

**Files:**
- Modify: `src/components/funnel/public/CalendlyEmbed.tsx`
- Create: `src/__tests__/components/funnel/calendly-embed-prefill.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import { CalendlyEmbed } from '@/components/funnel/public/CalendlyEmbed';

describe('CalendlyEmbed pre-fill', () => {
  it('renders iClosed widget with pre-filled data-url', () => {
    const { container } = render(
      <CalendlyEmbed
        url="https://app.iclosed.io/e/timkeen/li-growth"
        prefillData={{
          leadName: 'John Doe',
          leadEmail: 'john@example.com',
          surveyAnswers: { businesstype: 'Agency' },
        }}
      />
    );

    const widget = container.querySelector('.iclosed-widget');
    expect(widget).toBeTruthy();
    const dataUrl = widget?.getAttribute('data-url') || '';
    expect(dataUrl).toContain('iclosedName=John+Doe');
    expect(dataUrl).toContain('iclosedEmail=john%40example.com');
    expect(dataUrl).toContain('businesstype=Agency');
  });

  it('renders iClosed widget without pre-fill when no data', () => {
    const { container } = render(
      <CalendlyEmbed url="https://app.iclosed.io/e/timkeen/li-growth" />
    );

    const widget = container.querySelector('.iclosed-widget');
    const dataUrl = widget?.getAttribute('data-url') || '';
    expect(dataUrl).toBe('https://app.iclosed.io/e/timkeen/li-growth');
  });

  it('renders Cal.com iframe with pre-fill params', () => {
    const { container } = render(
      <CalendlyEmbed
        url="https://cal.com/tim/30min"
        prefillData={{ leadName: 'Jane', leadEmail: 'jane@co.com' }}
      />
    );

    const iframe = container.querySelector('iframe');
    const src = iframe?.getAttribute('src') || '';
    expect(src).toContain('name=Jane');
    expect(src).toContain('email=jane%40co.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/components/funnel/calendly-embed-prefill.test.ts`
Expected: FAIL — prefillData prop not accepted

- [ ] **Step 3: Update CalendlyEmbed component**

Replace `src/components/funnel/public/CalendlyEmbed.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { buildIClosedUrl } from '@/lib/utils/iclosed-helpers';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookingPrefillData {
  leadName?: string | null;
  leadEmail?: string | null;
  surveyAnswers?: Record<string, string>;
}

interface CalendlyEmbedProps {
  url: string;
  prefillData?: BookingPrefillData;
}

type EmbedType = 'calendly' | 'cal' | 'iclosed' | 'unknown';

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectEmbedType(url: string): EmbedType {
  if (url.includes('calendly.com') || url.includes('calendly/')) return 'calendly';
  if (url.includes('iclosed.io') || url.includes('iclosed.com')) return 'iclosed';
  if (url.includes('cal.com') || url.includes('cal/')) return 'cal';
  return 'unknown';
}

function getCalEmbedUrl(url: string, prefill?: BookingPrefillData): string {
  let fullUrl = url;
  if (!url.startsWith('https://')) fullUrl = `https://cal.com/${url}`;

  const parsed = new URL(fullUrl);
  parsed.searchParams.set('embed', 'true');
  parsed.searchParams.set('theme', 'dark');
  parsed.searchParams.set('hideEventTypeDetails', 'false');
  if (prefill?.leadName) parsed.searchParams.set('name', prefill.leadName);
  if (prefill?.leadEmail) parsed.searchParams.set('email', prefill.leadEmail);
  return parsed.toString();
}

function getCalendlyUrl(url: string, prefill?: BookingPrefillData): string {
  const calendlyUrl = url.startsWith('https://') ? url : `https://calendly.com/${url}`;
  const parsed = new URL(calendlyUrl);
  parsed.searchParams.set('background_color', '18181b');
  parsed.searchParams.set('text_color', 'fafafa');
  parsed.searchParams.set('primary_color', '8b5cf6');
  if (prefill?.leadName) parsed.searchParams.set('name', prefill.leadName);
  if (prefill?.leadEmail) parsed.searchParams.set('email', prefill.leadEmail);
  return parsed.toString();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CalendlyEmbed({ url, prefillData }: CalendlyEmbedProps) {
  const embedType = detectEmbedType(url);

  useEffect(() => {
    if (embedType === 'calendly') {
      const existing = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://assets.calendly.com/assets/external/widget.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    if (embedType === 'iclosed') {
      const existing = document.querySelector('script[src="https://app.iclosed.io/assets/widget.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://app.iclosed.io/assets/widget.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [embedType]);

  if (embedType === 'calendly') {
    return (
      <div
        className="calendly-inline-widget rounded-xl overflow-hidden"
        data-url={getCalendlyUrl(url, prefillData)}
        style={{ minWidth: '320px', height: '630px', background: '#18181B', border: '1px solid #27272A', borderRadius: '12px' }}
      />
    );
  }

  if (embedType === 'iclosed') {
    const resolvedUrl = prefillData
      ? buildIClosedUrl(url, {
          leadName: prefillData.leadName,
          leadEmail: prefillData.leadEmail,
          surveyAnswers: prefillData.surveyAnswers,
        })
      : url;

    return (
      <div
        className="iclosed-widget"
        data-url={resolvedUrl}
        title="Book a Call"
        style={{ width: '100%', height: '620px' }}
      />
    );
  }

  if (embedType === 'cal') {
    return (
      <div className="rounded-xl overflow-hidden" style={{ minWidth: '320px', height: '700px', background: '#18181B', border: '1px solid #27272A', borderRadius: '12px' }}>
        <iframe
          src={getCalEmbedUrl(url, prefillData)}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Book a Call"
          allow="camera; microphone; payment"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ minWidth: '320px', height: '630px', background: '#18181B', border: '1px solid #27272A', borderRadius: '12px' }}>
      <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title="Booking Calendar" />
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- src/__tests__/components/funnel/calendly-embed-prefill.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/funnel/public/CalendlyEmbed.tsx src/__tests__/components/funnel/calendly-embed-prefill.test.ts
git commit -m "feat: add booking pre-fill to CalendlyEmbed for iClosed, Cal.com, Calendly"
```

---

### Task 6: Server Page — Wire New Fields + Pre-fill Data

**Files:**
- Modify: `src/app/p/[username]/[slug]/thankyou/page.tsx`

This is a server component — no unit tests, verified via typecheck + manual.

- [ ] **Step 1: Add new columns to main funnel select**

In `src/app/p/[username]/[slug]/thankyou/page.tsx`, add to the `.select()` call (after `thankyou_layout` on line 99):

```
      vsl_headline,
      vsl_subline,
      cta_headline,
      cta_button_text
```

- [ ] **Step 2: Add new columns to A/B variant select**

Find the variant select (line 146-148). Add the new fields:

```typescript
      .select(
        'id, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message, is_variant, qualification_form_id, thankyou_layout, vsl_headline, vsl_subline, cta_headline, cta_button_text'
      )
```

Also update the `activeFunnel` override spread (around line 163) to include the new fields:

```typescript
      activeFunnel = {
        ...funnel,
        id: selected.id,
        thankyou_headline: selected.thankyou_headline,
        thankyou_subline: selected.thankyou_subline,
        vsl_url: selected.vsl_url,
        qualification_pass_message: selected.qualification_pass_message,
        qualification_form_id: selected.qualification_form_id,
        thankyou_layout: selected.thankyou_layout,
        vsl_headline: selected.vsl_headline,
        vsl_subline: selected.vsl_subline,
        cta_headline: selected.cta_headline,
        cta_button_text: selected.cta_button_text,
      };
```

- [ ] **Step 3: Fetch lead name alongside email**

In the lead email fetch (line 188-193), add `name` to select:

```typescript
    const { data: lead } = await supabase
      .from('funnel_leads')
      .select('email, name')
      .eq('id', leadId)
      .eq('funnel_page_id', activeFunnel.id)
      .single();
    leadEmail = lead?.email || null;
```

Add a `leadName` variable alongside `leadEmail`:

```typescript
  let leadEmail: string | null = null;
  let leadName: string | null = null;
  // ... inside the if block:
    leadEmail = lead?.email || null;
    leadName = lead?.name || null;
```

- [ ] **Step 4: Add booking_prefill_key to question selects**

In both question queries (line 218 and 225), add `booking_prefill_key`:

```
      .select('id, question_text, question_order, answer_type, options, placeholder, is_required, booking_prefill_key')
```

- [ ] **Step 5: Pass new props to ThankyouPage component**

Add new props to the `<ThankyouPage>` JSX (after `layout` prop, around line 316):

```typescript
      vslHeadline={activeFunnel.vsl_headline}
      vslSubline={activeFunnel.vsl_subline}
      ctaHeadline={activeFunnel.cta_headline}
      ctaButtonText={activeFunnel.cta_button_text}
      leadName={leadName}
```

And update the questions mapping to include `bookingPrefillKey`:

```typescript
      questions={(questions || []).map((q) => ({
        id: q.id,
        questionText: q.question_text,
        questionOrder: q.question_order,
        answerType: (q.answer_type || 'yes_no') as 'yes_no' | 'text' | 'textarea' | 'multiple_choice',
        options: q.options || null,
        placeholder: q.placeholder || null,
        isRequired: q.is_required ?? true,
        bookingPrefillKey: q.booking_prefill_key || null,
      }))}
```

**Do NOT commit yet** — continue to Task 7 (same commit, since the server page references props added in Task 7).

---

### Task 7: Rework ThankyouPage video_first Layout (combined commit with Task 6)

**Files:**
- Modify: `src/components/funnel/public/ThankyouPage.tsx`

This is the core UI change. Rework the `video_first` rendering path.

- [ ] **Step 1: Add new props to ThankyouPageProps interface**

In `src/components/funnel/public/ThankyouPage.tsx`, add to `ThankyouPageProps` (after `layout`, line 331):

```typescript
  vslHeadline?: string | null;
  vslSubline?: string | null;
  ctaHeadline?: string | null;
  ctaButtonText?: string | null;
  leadName?: string | null;
```

And update the `Question` interface (after `isRequired`, line 300) to add:

```typescript
  bookingPrefillKey: string | null;
```

- [ ] **Step 2: Destructure new props in component**

Add to the destructured props (after `layout`, around line 361):

```typescript
  vslHeadline,
  vslSubline,
  ctaHeadline,
  ctaButtonText,
  leadName,
```

- [ ] **Step 3: Add survey ref and prefill builder**

Add a ref for the survey section (after `bookingRef` on line 370):

```typescript
  const surveyRef = useRef<HTMLDivElement>(null);
```

Add a function to build pre-fill data from survey answers (after the `handleSkip` function):

```typescript
  const buildPrefillData = () => {
    const surveyMappedAnswers: Record<string, string> = {};
    for (const q of questions) {
      if (q.bookingPrefillKey && answers[q.id]) {
        surveyMappedAnswers[q.bookingPrefillKey] = answers[q.id];
      }
    }
    return {
      leadName: leadName || undefined,
      leadEmail: email || undefined,
      surveyAnswers: Object.keys(surveyMappedAnswers).length > 0 ? surveyMappedAnswers : undefined,
    };
  };
```

Add a scroll handler for the CTA button:

```typescript
  const handleCtaClick = () => {
    const target = hasQuestions ? surveyRef.current : bookingRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
```

- [ ] **Step 4: Rework the video_first rendering block**

Replace the `video_first` rendering section. The current code at line 568-569 is:

```typescript
        {layout === 'video_first' && vslUrl && (
          <VideoEmbed url={vslUrl} />
        )}
```

Replace with the full new `video_first` block. This goes in the same location — between the headline/subline and the survey card. The new order for `video_first` is:

1. VSL framing (vsl_headline + vsl_subline) + video
2. CTA bridge (only when vsl_url exists)
3. ALL sections (social proof between CTA and survey)
4. Survey (with ref)
5. (Qualification result + booking handled by existing code below)

```typescript
        {/* Layout: video_first — VSL framing + video + CTA bridge + sections + survey */}
        {layout === 'video_first' && (
          <>
            {/* VSL framing + video */}
            {vslUrl && (
              <div className="space-y-4">
                {(vslHeadline || vslSubline) && (
                  <div className="text-center space-y-2">
                    {vslHeadline && (
                      <p
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: primaryColor }}
                      >
                        {vslHeadline}
                      </p>
                    )}
                    {vslSubline && (
                      <h2
                        className="text-xl md:text-2xl font-semibold"
                        style={{ color: 'var(--ds-text)' }}
                      >
                        {vslSubline}
                      </h2>
                    )}
                  </div>
                )}
                <VideoEmbed url={vslUrl} />
              </div>
            )}

            {/* CTA bridge — only render when video exists */}
            {vslUrl && (ctaHeadline || ctaButtonText) && (
              <div className="text-center space-y-4 py-4">
                {ctaHeadline && (
                  <p
                    className="text-lg md:text-xl font-semibold"
                    style={{ color: 'var(--ds-text)' }}
                  >
                    {ctaHeadline}
                  </p>
                )}
                <button
                  onClick={handleCtaClick}
                  className="inline-flex items-center rounded-lg px-10 py-4 text-lg font-bold text-white uppercase tracking-wide transition-opacity hover:opacity-90"
                  style={{ background: primaryColor }}
                >
                  {ctaButtonText || 'BOOK YOUR CALL NOW'}
                </button>
              </div>
            )}

            {/* All sections — social proof between CTA and survey */}
            {sections.length > 0 && (
              <div className="space-y-6">
                {sections.map(s => <SectionRenderer key={s.id} section={s} />)}
              </div>
            )}

            {/* Survey */}
            <div ref={surveyRef}>
              {hasQuestions && !qualificationComplete && (
                <SurveyCard
                  questions={questions}
                  currentQuestionIndex={currentQuestionIndex}
                  setCurrentQuestionIndex={setCurrentQuestionIndex}
                  currentTextValue={currentTextValue}
                  setCurrentTextValue={setCurrentTextValue}
                  answers={answers}
                  error={error}
                  setError={setError}
                  submitting={submitting}
                  primaryColor={primaryColor}
                  currentQuestion={currentQuestion}
                  handleYesNoAnswer={handleYesNoAnswer}
                  handleTextSubmit={handleTextSubmit}
                  handleMultipleChoiceSelect={handleMultipleChoiceSelect}
                  handleSkip={handleSkip}
                />
              )}
            </div>
          </>
        )}
```

- [ ] **Step 5: Remove duplicate survey/video rendering for video_first**

The existing code after the `side_by_side` ternary (around line 629-657) renders the survey and video for both `survey_first` and `video_first`. Since `video_first` now handles its own rendering in the block above, update the condition to only render for `survey_first`:

Change the survey card block (line 631-650) from:
```typescript
            {/* Survey card — for survey_first and video_first layouts */}
            {hasQuestions && !qualificationComplete && (
```

To:
```typescript
            {/* Survey card — for survey_first layout only (video_first handles its own) */}
            {layout === 'survey_first' && hasQuestions && !qualificationComplete && (
```

And the video block (line 652-655) already has `layout === 'survey_first'` so that's fine.

- [ ] **Step 6: Remove duplicate sections rendering for video_first**

The existing below-sections rendering (line 682-687) shows sections for ALL layouts. For `video_first`, sections are now rendered inside the video_first block (between CTA and survey). Gate the existing section rendering:

Change:
```typescript
        {belowSections.length > 0 && (
```

To:
```typescript
        {layout !== 'video_first' && belowSections.length > 0 && (
```

Similarly, the above-sections (line 561-565) already has `layout === 'survey_first'` so that's fine.

- [ ] **Step 7: Pass prefillData to CalendlyEmbed**

Find the CalendlyEmbed usage (line 699):
```typescript
          <CalendlyEmbed url={calendlyUrl} />
```

Replace with:
```typescript
          <CalendlyEmbed url={calendlyUrl} prefillData={buildPrefillData()} />
```

- [ ] **Step 8: Make resource access button more prominent**

The current resource button (line 522-532) is adequate but could be bigger. Update the text and add an arrow:

```typescript
        {showResourceOnPage && contentPageUrl && (
          <div className="text-center">
            <a
              href={contentPageUrl}
              className="inline-flex items-center gap-2 rounded-lg px-10 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--ds-primary)' }}
            >
              Access Your Free Resource &rarr;
            </a>
          </div>
        )}
```

- [ ] **Step 9: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 10: Commit (includes Task 6 server page changes)**

```bash
git add src/app/p/[username]/[slug]/thankyou/page.tsx src/components/funnel/public/ThankyouPage.tsx
git commit -m "feat: rework video_first layout with VSL framing, CTA bridge, and booking pre-fill"
```

---

### Task 8: Admin Editor — VSL Framing + CTA Fields

**Files:**
- Modify: `src/components/funnel/ThankyouPageEditor.tsx`
- Modify: `src/components/funnel/FunnelBuilder.tsx`

- [ ] **Step 1: Add state to FunnelBuilder.tsx**

In `src/components/funnel/FunnelBuilder.tsx`, add after `thankyouLayout` state (line 159-161):

```typescript
  const [vslHeadline, setVslHeadline] = useState(existingFunnel?.vslHeadline || '');
  const [vslSubline, setVslSubline] = useState(existingFunnel?.vslSubline || '');
  const [ctaHeadline, setCtaHeadline] = useState(existingFunnel?.ctaHeadline || '');
  const [ctaButtonText, setCtaButtonText] = useState(existingFunnel?.ctaButtonText || '');
```

- [ ] **Step 2: Add to save payload**

In `src/components/funnel/FunnelBuilder.tsx`, add to the payload object (after `thankyouLayout` on line 297):

```typescript
        vslHeadline: vslHeadline || null,
        vslSubline: vslSubline || null,
        ctaHeadline: ctaHeadline || null,
        ctaButtonText: ctaButtonText || null,
```

- [ ] **Step 3: Pass new props to ThankyouPageEditor**

In `src/components/funnel/FunnelBuilder.tsx`, add props to the `<ThankyouPageEditor>` JSX (after `setLayout`, line 620):

```typescript
                  vslHeadline={vslHeadline}
                  setVslHeadline={setVslHeadline}
                  vslSubline={vslSubline}
                  setVslSubline={setVslSubline}
                  ctaHeadline={ctaHeadline}
                  setCtaHeadline={setCtaHeadline}
                  ctaButtonText={ctaButtonText}
                  setCtaButtonText={setCtaButtonText}
```

- [ ] **Step 4: Update ThankyouPageEditor props interface**

In `src/components/funnel/ThankyouPageEditor.tsx`, add to the interface (after `setLayout`, line 45):

```typescript
  vslHeadline: string;
  setVslHeadline: (value: string) => void;
  vslSubline: string;
  setVslSubline: (value: string) => void;
  ctaHeadline: string;
  setCtaHeadline: (value: string) => void;
  ctaButtonText: string;
  setCtaButtonText: (value: string) => void;
```

- [ ] **Step 5: Destructure new props**

Add to the function parameters (after `setLayout`, line 75):

```typescript
  vslHeadline,
  setVslHeadline,
  vslSubline,
  setVslSubline,
  ctaHeadline,
  setCtaHeadline,
  ctaButtonText,
  setCtaButtonText,
```

- [ ] **Step 6: Add VSL framing inputs to the editor UI**

In `src/components/funnel/ThankyouPageEditor.tsx`, add a new section after the Video URL input (after line 299, inside the `redirectTrigger !== 'immediate'` block), gated by `layout === 'video_first'`:

```tsx
          {/* VSL Framing + CTA Bridge (video_first only) */}
          {layout === 'video_first' && (
            <div className="space-y-4 rounded-lg border border-dashed border-violet-500/30 p-4">
              <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">
                VSL Conversion Flow
              </h3>
              <p className="text-xs text-muted-foreground">
                These fields frame the video and add a call-to-action between the video and survey.
              </p>

              <div>
                <Label className="block text-sm font-medium mb-1.5">Video Headline</Label>
                <Input
                  type="text"
                  value={vslHeadline}
                  onChange={(e) => setVslHeadline(e.target.value)}
                  placeholder="THE MODERN AGENCY SALES METHOD"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Bold label above the video (uppercase recommended)
                </p>
              </div>

              <div>
                <Label className="block text-sm font-medium mb-1.5">Video Subline</Label>
                <Textarea
                  value={vslSubline}
                  onChange={(e) => setVslSubline(e.target.value)}
                  rows={2}
                  className="resize-none"
                  placeholder="Watch this free training to learn how agencies are closing $5k+/mo retainers"
                />
              </div>

              <div>
                <Label className="block text-sm font-medium mb-1.5">CTA Headline</Label>
                <Input
                  type="text"
                  value={ctaHeadline}
                  onChange={(e) => setCtaHeadline(e.target.value)}
                  placeholder="Want to see how this applies to your agency?"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Text above the call-to-action button
                </p>
              </div>

              <div>
                <Label className="block text-sm font-medium mb-1.5">CTA Button Text</Label>
                <Input
                  type="text"
                  value={ctaButtonText}
                  onChange={(e) => setCtaButtonText(e.target.value)}
                  placeholder="BOOK YOUR CALL NOW"
                />
              </div>
            </div>
          )}
```

- [ ] **Step 7: Run typecheck + build**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/funnel/ThankyouPageEditor.tsx src/components/funnel/FunnelBuilder.tsx
git commit -m "feat: add VSL framing + CTA bridge inputs to funnel editor"
```

---

### Task 9: QuestionsManager — Booking Prefill Key

**Files:**
- Modify: `src/components/funnel/QuestionsManager.tsx`
- Modify: `src/lib/types/funnel.ts` (CreateQuestionPayload, UpdateQuestionPayload)

- [ ] **Step 0: Add bookingPrefillKey to question payload types**

In `src/lib/types/funnel.ts`, add to `CreateQuestionPayload` (after `isRequired`, around line 353):

```typescript
  bookingPrefillKey?: string | null;
```

And to `UpdateQuestionPayload` (after `isRequired`, around line 364):

```typescript
  bookingPrefillKey?: string | null;
```

- [ ] **Step 1: Add booking_prefill_key to the new question form**

In `src/components/funnel/QuestionsManager.tsx`, add state for the new field (after `newQualifyingOptions` on line 49):

```typescript
  const [newBookingPrefillKey, setNewBookingPrefillKey] = useState('');
```

- [ ] **Step 2: Add to resetNewForm**

In `resetNewForm()` (line 58-67), add:

```typescript
    setNewBookingPrefillKey('');
```

- [ ] **Step 3: Add to handleAddQuestion body**

In `handleAddQuestion` (line 103-112), add to the `body` object:

```typescript
        bookingPrefillKey: newBookingPrefillKey || null,
```

- [ ] **Step 4: Add UI for booking prefill key**

Find where the existing question form fields end (near the "is required" toggle or add button). Add an input:

```tsx
              {/* Booking Pre-fill Key */}
              <div>
                <Label className="block text-xs font-medium mb-1 text-muted-foreground">
                  Booking Pre-fill Key (optional)
                </Label>
                <Input
                  value={newBookingPrefillKey}
                  onChange={(e) => setNewBookingPrefillKey(e.target.value)}
                  placeholder="e.g. monthlyrevenue, businesstype"
                  className="text-sm"
                />
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Maps this answer to a booking form field. Common: monthlyrevenue, businesstype, linkedinurl
                </p>
              </div>
```

- [ ] **Step 5: Add to expanded question edit view**

The expanded question edit view (where existing questions can be edited) should also show `booking_prefill_key`. Find the section where `handleUpdateQuestion` is called with field edits and add a similar input that calls:

```typescript
handleUpdateQuestion(question.id, { bookingPrefillKey: value || null })
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/funnel/QuestionsManager.tsx
git commit -m "feat: add booking_prefill_key field to question editor"
```

---

### Task 10: MCP Tool Schema Updates

**Files:**
- Modify: `packages/mcp/src/tools/funnels.ts` (line 119-157)
- Modify: `packages/mcp/src/validation.ts` (line 112-137)

- [ ] **Step 1: Add to MCP tool inputSchema**

In `packages/mcp/src/tools/funnels.ts`, add after `calendly_url` (line 121):

```typescript
        vsl_headline: { type: ['string', 'null'], description: 'Bold label above video (e.g. THE MODERN AGENCY SALES METHOD)' },
        vsl_subline: { type: ['string', 'null'], description: 'Descriptive text below video label' },
        cta_headline: { type: ['string', 'null'], description: 'Text above CTA button between video and survey' },
        cta_button_text: { type: ['string', 'null'], description: 'CTA button text (e.g. BOOK YOUR CALL NOW)' },
        thankyou_layout: {
          type: 'string',
          enum: ['survey_first', 'video_first', 'side_by_side'],
          description: 'Thank-you page layout',
        },
```

- [ ] **Step 2: Add to MCP validation schema**

In `packages/mcp/src/validation.ts`, add after `send_resource_email` (line 137):

```typescript
    vsl_headline: z.string().nullable().optional(),
    vsl_subline: z.string().nullable().optional(),
    cta_headline: z.string().nullable().optional(),
    cta_button_text: z.string().nullable().optional(),
    thankyou_layout: z.enum(['survey_first', 'video_first', 'side_by_side'] as [string, ...string[]]).optional(),
```

- [ ] **Step 3: Run MCP tests**

Run: `cd packages/mcp && pnpm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/mcp/src/tools/funnels.ts packages/mcp/src/validation.ts
git commit -m "feat(mcp): add vsl framing, CTA bridge, and layout fields to funnel tools"
```

---

### Task 11: Tim's Account Configuration (Post-Deploy)

**Files:** None — SQL commands run against Supabase

- [ ] **Step 1: Find Tim's user ID and default_vsl_url**

```sql
SELECT id, default_vsl_url FROM users WHERE username = 'timkeen' OR email LIKE '%tim%';
```

- [ ] **Step 2: Find all Tim's funnel pages**

```sql
SELECT id, slug, thankyou_layout, vsl_url, calendly_url, vsl_headline
FROM funnel_pages
WHERE user_id = '<tim_user_id>'
ORDER BY created_at DESC;
```

- [ ] **Step 3: Update all funnel pages to video_first with iClosed**

```sql
UPDATE funnel_pages
SET
  thankyou_layout = 'video_first',
  calendly_url = 'https://app.iclosed.io/e/timkeen/li-growth',
  vsl_url = COALESCE(vsl_url, '<default_vsl_url>'),
  vsl_headline = 'THE MODERN AGENCY SALES METHOD',
  vsl_subline = 'Watch this free training to learn how agencies are closing $5k+/mo retainers',
  cta_headline = 'Want to see how this applies to your agency?',
  cta_button_text = 'BOOK YOUR STRATEGY CALL'
WHERE user_id = '<tim_user_id>';
```

- [ ] **Step 4: Map qualification questions to iClosed fields**

Inspect current questions:

```sql
SELECT q.id, q.question_text, q.answer_type, q.options, q.booking_prefill_key
FROM qualification_questions q
JOIN funnel_pages fp ON q.funnel_page_id = fp.id
WHERE fp.user_id = '<tim_user_id>'
ORDER BY q.question_order;
```

Set `booking_prefill_key` based on question content (manual mapping based on what the questions ask).

- [ ] **Step 5: Verify a thank-you page renders correctly**

Visit one of Tim's published funnel thank-you pages and confirm:
- Video with framing headline renders
- CTA bridge appears below video
- Survey appears below social proof
- After qualification, iClosed embed has pre-filled params in URL

---

### Task 12: Additional Tests + Full Verification

- [ ] **Step 1: Add Zod schema test for new funnel fields**

Create or append to `src/__tests__/lib/validations/funnel-schema.test.ts`:

```typescript
import { updateFunnelSchema } from '@/lib/validations/api';

describe('updateFunnelSchema — conversion fields', () => {
  it('accepts vsl framing and CTA fields', () => {
    const result = updateFunnelSchema.safeParse({
      vslHeadline: 'THE METHOD',
      vslSubline: 'Watch this free training',
      ctaHeadline: 'Ready?',
      ctaButtonText: 'BOOK NOW',
      thankyouLayout: 'video_first',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null values for optional fields', () => {
    const result = updateFunnelSchema.safeParse({
      vslHeadline: null,
      vslSubline: null,
      ctaHeadline: null,
      ctaButtonText: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid thankyouLayout', () => {
    const result = updateFunnelSchema.safeParse({
      thankyouLayout: 'invalid_layout',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run new schema test**

Run: `pnpm test -- src/__tests__/lib/validations/funnel-schema.test.ts`
Expected: PASS

- [ ] **Step 3: Commit test files**

```bash
git add src/__tests__/lib/validations/funnel-schema.test.ts
git commit -m "test: add Zod schema tests for conversion redesign fields"
```

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Run build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any test/type issues from thankyou conversion redesign"
```
