# Engagement Cold Email Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When leads engage with lead magnet posts, automatically enrich their email and push them to PlusVibe cold email campaigns — plus a manual "Reply with Link" button in the automation events feed.

**Architecture:** Port the email enrichment waterfall (LeadMagic → Prospeo → BlitzAPI) and validators (ZeroBounce → BounceBan) from gtm-system into magnetlab as self-contained services. Add a new `enrich-and-push-plusvibe` Trigger.dev task triggered by the existing `process-linkedin-comment` automation pipeline. Add a PlusVibe client. Add a manual comment reply API route + UI button.

**Tech Stack:** Next.js 15, Supabase, Trigger.dev v4, PlusVibe API, LeadMagic/Prospeo/BlitzAPI/ZeroBounce/BounceBan APIs, Harvest API

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260227300000_engagement_enrichment_plusvibe.sql`

**Step 1: Write the migration**

```sql
-- Add PlusVibe and opt-in URL columns to linkedin_automations
ALTER TABLE linkedin_automations
  ADD COLUMN IF NOT EXISTS plusvibe_campaign_id text,
  ADD COLUMN IF NOT EXISTS opt_in_url text;

-- Create engagement_enrichments table
CREATE TABLE IF NOT EXISTS engagement_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  automation_id uuid NOT NULL REFERENCES linkedin_automations(id) ON DELETE CASCADE,
  linkedin_url text NOT NULL,
  first_name text,
  last_name text,
  headline text,
  company text,
  email text,
  email_provider text,
  email_validation_status text,
  plusvibe_campaign_id text,
  plusvibe_pushed_at timestamptz,
  plusvibe_error text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, automation_id, linkedin_url)
);

-- RLS
ALTER TABLE engagement_enrichments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_enrichments" ON engagement_enrichments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "service_role_bypass_enrichments" ON engagement_enrichments
  FOR ALL USING (current_setting('role') = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engagement_enrichments_automation ON engagement_enrichments(automation_id);
CREATE INDEX IF NOT EXISTS idx_engagement_enrichments_status ON engagement_enrichments(status);
CREATE INDEX IF NOT EXISTS idx_engagement_enrichments_user ON engagement_enrichments(user_id);
```

**Step 2: Apply migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`
Expected: Migration applies successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260227300000_engagement_enrichment_plusvibe.sql
git commit -m "feat: add engagement_enrichments table and plusvibe columns to automations"
```

---

## Task 2: Enrichment Types

**Files:**
- Create: `src/lib/integrations/enrichment/types.ts`

**Step 1: Write enrichment types**

These are adapted from gtm-system's `src/lib/types/cold-email.ts` (lines 102-210), keeping only what magnetlab needs.

```typescript
/** Email finder result */
export interface EmailFinderResult {
  email: string | null;
  confidence: number;
  provider?: string;
}

/** Email finder parameters - supports both camelCase and snake_case */
export interface EmailFinderParams {
  firstName?: string;
  lastName?: string;
  domain?: string;
  linkedinUrl?: string;
  company?: string;
  first_name?: string;
  last_name?: string;
  company_domain?: string;
  linkedin_url?: string;
}

/** Email finder provider interface */
export interface EmailFinderProvider {
  name: string;
  findEmail(params: EmailFinderParams): Promise<EmailFinderResult>;
  isConfigured(): boolean;
}

/** Email validation status */
export type EmailValidationStatus =
  | 'valid'
  | 'invalid'
  | 'catch_all'
  | 'unknown'
  | 'spamtrap'
  | 'abuse'
  | 'do_not_mail';

/** Email validation result */
export interface EmailValidationResult {
  email: string;
  status: EmailValidationStatus;
  is_valid: boolean;
  provider?: string;
}

/** Email validator provider interface */
export interface EmailValidatorProvider {
  name: string;
  validateEmail(email: string): Promise<EmailValidationResult>;
  isConfigured(): boolean;
}

/** Waterfall email finder result */
export interface WaterfallResult {
  email: string | null;
  provider: string | null;
  confidence: number;
  validated: boolean;
  validation_status?: string;
  attempts: Array<{
    provider: string;
    email?: string | null;
    error?: string;
  }>;
}
```

**Step 2: Commit**

```bash
git add src/lib/integrations/enrichment/types.ts
git commit -m "feat: add enrichment provider types for email waterfall"
```

---

## Task 3: Email Finder Providers

**Files:**
- Create: `src/lib/integrations/enrichment/leadmagic.ts`
- Create: `src/lib/integrations/enrichment/prospeo.ts`
- Create: `src/lib/integrations/enrichment/blitzapi.ts`

These are direct ports from gtm-system. The source files are:
- `gtm-system/src/services/enrichment/providers/leadmagic.ts`
- `gtm-system/src/services/enrichment/providers/prospeo.ts`
- `gtm-system/src/services/enrichment/providers/blitzapi.ts`

The only change is the import path — change `@/lib/types/cold-email` to `./types`.

**Step 1: Write LeadMagic provider**

```typescript
// src/lib/integrations/enrichment/leadmagic.ts
import type { EmailFinderProvider, EmailFinderResult, EmailFinderParams } from './types';

export class LeadMagicProvider implements EmailFinderProvider {
  name = 'leadmagic';

  isConfigured(): boolean {
    return !!process.env.LEADMAGIC_API_KEY;
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const apiKey = process.env.LEADMAGIC_API_KEY;
    if (!apiKey) {
      return { email: null, confidence: 0, provider: this.name };
    }

    const firstName = params.first_name || params.firstName || '';
    const lastName = params.last_name || params.lastName || '';
    const domain = params.company_domain || params.domain || '';

    try {
      const response = await fetch('https://api.leadmagic.io/v1/people/email-finder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          domain,
        }),
      });

      if (!response.ok) {
        throw new Error(`LeadMagic API error: ${response.status}`);
      }

      const data: Record<string, unknown> = await response.json();

      if (!data.email) {
        return { email: null, confidence: 0, provider: this.name };
      }

      const confidence =
        data.status === 'valid' ? 95 :
        data.status === 'valid_catch_all' ? 80 :
        data.status === 'catch_all' ? 60 :
        50;

      return {
        email: data.email as string,
        confidence,
        provider: this.name,
      };
    } catch {
      return { email: null, confidence: 0, provider: this.name };
    }
  }
}
```

**Step 2: Write Prospeo provider**

```typescript
// src/lib/integrations/enrichment/prospeo.ts
import type { EmailFinderProvider, EmailFinderResult, EmailFinderParams } from './types';

export class ProspeoProvider implements EmailFinderProvider {
  name = 'prospeo';

  isConfigured(): boolean {
    return !!process.env.PROSPEO_API_KEY;
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const apiKey = process.env.PROSPEO_API_KEY;
    if (!apiKey) {
      return { email: null, confidence: 0, provider: this.name };
    }

    const firstName = params.first_name || params.firstName || '';
    const lastName = params.last_name || params.lastName || '';
    const domain = params.company_domain || params.domain || '';

    if (!firstName || !lastName || !domain) {
      return { email: null, confidence: 0, provider: this.name };
    }

    try {
      const body: Record<string, unknown> = {
        only_verified_email: true,
        data: {
          first_name: firstName,
          last_name: lastName,
          company_website: domain,
          ...(params.linkedin_url || params.linkedinUrl
            ? { linkedin_url: params.linkedin_url || params.linkedinUrl }
            : {}),
        },
      };

      const response = await fetch('https://api.prospeo.io/enrich-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Prospeo API error: ${response.status}`);
      }

      const data = await response.json() as { error?: boolean; person?: { email?: { email?: string; status?: string } } };
      if (!data.error && data.person?.email?.email) {
        const status = data.person.email.status;
        return {
          email: data.person.email.email,
          confidence: status === 'verified' ? 95 : 70,
          provider: this.name,
        };
      }

      return { email: null, confidence: 0, provider: this.name };
    } catch {
      return { email: null, confidence: 0, provider: this.name };
    }
  }
}
```

**Step 3: Write BlitzAPI provider**

```typescript
// src/lib/integrations/enrichment/blitzapi.ts
import type { EmailFinderProvider, EmailFinderResult, EmailFinderParams } from './types';

export class BlitzApiProvider implements EmailFinderProvider {
  name = 'blitzapi';

  isConfigured(): boolean {
    return !!process.env.BLITZ_API_KEY;
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const apiKey = process.env.BLITZ_API_KEY;
    if (!apiKey) {
      return { email: null, confidence: 0, provider: this.name };
    }

    const linkedinUrl = params.linkedin_url || params.linkedinUrl;

    if (!linkedinUrl) {
      return { email: null, confidence: 0, provider: this.name };
    }

    try {
      const response = await fetch('https://api.blitz-api.ai/v2/enrichment/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          person_linkedin_url: linkedinUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`BlitzAPI error: ${response.status}`);
      }

      const data = await response.json() as { found?: boolean; email?: string };
      if (data.found && data.email) {
        return {
          email: data.email,
          confidence: 90,
          provider: this.name,
        };
      }

      return { email: null, confidence: 0, provider: this.name };
    } catch {
      return { email: null, confidence: 0, provider: this.name };
    }
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/integrations/enrichment/leadmagic.ts src/lib/integrations/enrichment/prospeo.ts src/lib/integrations/enrichment/blitzapi.ts
git commit -m "feat: port email finder providers from gtm-system (LeadMagic, Prospeo, BlitzAPI)"
```

---

## Task 4: Email Validator Providers

**Files:**
- Create: `src/lib/integrations/enrichment/zerobounce.ts`
- Create: `src/lib/integrations/enrichment/bounceban.ts`

Direct ports from gtm-system `src/services/enrichment/providers/zerobounce.ts` and `bounceban.ts`.

**Step 1: Write ZeroBounce validator**

```typescript
// src/lib/integrations/enrichment/zerobounce.ts
import type { EmailValidatorProvider, EmailValidationResult } from './types';

export class ZeroBounceProvider implements EmailValidatorProvider {
  name = 'zerobounce';

  isConfigured(): boolean {
    return !!process.env.ZEROBOUNCE_API_KEY;
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    const apiKey = process.env.ZEROBOUNCE_API_KEY;
    if (!apiKey) {
      return { email, is_valid: true, status: 'unknown', provider: this.name };
    }

    try {
      const url = `https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`ZeroBounce API error: ${response.status}`);

      const data: Record<string, unknown> = await response.json();
      const status =
        data.status === 'valid'
          ? 'valid' as const
          : data.status === 'catch-all'
            ? 'catch_all' as const
            : data.status === 'invalid'
              ? 'invalid' as const
              : 'unknown' as const;

      return {
        email,
        is_valid: status === 'valid' || status === 'catch_all',
        status,
        provider: this.name,
      };
    } catch {
      return { email, is_valid: true, status: 'unknown', provider: this.name };
    }
  }
}
```

**Step 2: Write BounceBan validator**

```typescript
// src/lib/integrations/enrichment/bounceban.ts
import type { EmailValidatorProvider, EmailValidationResult } from './types';

export class BounceBanProvider implements EmailValidatorProvider {
  name = 'bounceban';

  isConfigured(): boolean {
    return !!process.env.BOUNCEBAN_API_KEY;
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    const apiKey = process.env.BOUNCEBAN_API_KEY;
    if (!apiKey) {
      return { email, is_valid: true, status: 'unknown', provider: this.name };
    }

    try {
      const url = `https://api-waterfall.bounceban.com/v1/verify/single?email=${encodeURIComponent(email)}&timeout=80`;
      const response = await fetch(url, {
        headers: { Authorization: apiKey },
      });

      if (response.status === 408) {
        return { email, is_valid: true, status: 'unknown', provider: this.name };
      }

      if (!response.ok) {
        throw new Error(`BounceBan API error: ${response.status}`);
      }

      const data: Record<string, unknown> = await response.json();
      const result = data.result as string;
      const status =
        result === 'deliverable'
          ? 'valid' as const
          : result === 'undeliverable'
            ? 'invalid' as const
            : result === 'risky'
              ? 'catch_all' as const
              : 'unknown' as const;

      return {
        email,
        is_valid: status === 'valid' || status === 'catch_all',
        status,
        provider: this.name,
      };
    } catch {
      return { email, is_valid: true, status: 'unknown', provider: this.name };
    }
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/integrations/enrichment/zerobounce.ts src/lib/integrations/enrichment/bounceban.ts
git commit -m "feat: port email validators from gtm-system (ZeroBounce, BounceBan)"
```

---

## Task 5: Waterfall Orchestrator + Provider Index

**Files:**
- Create: `src/lib/integrations/enrichment/index.ts`
- Create: `src/lib/integrations/enrichment/waterfall.ts`

**Step 1: Write provider index**

Ported from gtm-system `src/services/enrichment/providers/index.ts`.

```typescript
// src/lib/integrations/enrichment/index.ts
import { LeadMagicProvider } from './leadmagic';
import { ProspeoProvider } from './prospeo';
import { BlitzApiProvider } from './blitzapi';
import { ZeroBounceProvider } from './zerobounce';
import { BounceBanProvider } from './bounceban';
import type { EmailFinderProvider, EmailValidatorProvider } from './types';

// Waterfall order: LeadMagic -> Prospeo -> BlitzAPI
const ALL_FINDERS: EmailFinderProvider[] = [
  new LeadMagicProvider(),
  new ProspeoProvider(),
  new BlitzApiProvider(),
];

export function getConfiguredFinders(): EmailFinderProvider[] {
  return ALL_FINDERS.filter((p) => p.isConfigured());
}

export function getValidator(): EmailValidatorProvider | null {
  const zb = new ZeroBounceProvider();
  return zb.isConfigured() ? zb : null;
}

export function getCatchAllValidator(): EmailValidatorProvider | null {
  const bb = new BounceBanProvider();
  return bb.isConfigured() ? bb : null;
}
```

**Step 2: Write waterfall orchestrator**

Ported from gtm-system `src/services/enrichment/waterfall.ts`.

```typescript
// src/lib/integrations/enrichment/waterfall.ts
import { getConfiguredFinders, getValidator } from './index';
import type { WaterfallResult, EmailFinderParams } from './types';

export async function waterfallEmailFind(params: EmailFinderParams): Promise<WaterfallResult> {
  const finders = getConfiguredFinders();
  const validator = getValidator();
  const attempts: WaterfallResult['attempts'] = [];

  for (const finder of finders) {
    try {
      const result = await finder.findEmail(params);
      attempts.push({ provider: finder.name, email: result.email });

      if (!result.email) continue;

      // Validate with ZeroBounce if available
      if (validator) {
        const validation = await validator.validateEmail(result.email);
        if (validation.is_valid) {
          return {
            email: result.email,
            provider: finder.name,
            confidence: result.confidence,
            validated: true,
            validation_status: validation.status,
            attempts,
          };
        }
        // Invalid email - continue to next finder
        attempts[attempts.length - 1].error = `validation_failed:${validation.status}`;
        continue;
      }

      // No validator - accept the email as-is
      return {
        email: result.email,
        provider: finder.name,
        confidence: result.confidence,
        validated: false,
        attempts,
      };
    } catch (error) {
      attempts.push({
        provider: finder.name,
        email: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // All finders exhausted
  return {
    email: null,
    provider: null,
    confidence: 0,
    validated: false,
    attempts,
  };
}
```

**Step 3: Commit**

```bash
git add src/lib/integrations/enrichment/index.ts src/lib/integrations/enrichment/waterfall.ts
git commit -m "feat: add waterfall email find orchestrator with provider index"
```

---

## Task 6: PlusVibe Client

**Files:**
- Create: `src/lib/integrations/plusvibe.ts`

This is a simplified port of gtm-system's PlusVibe client (`src/lib/integrations/plusvibe.ts`). We only need `addLeadsToCampaign` — not the full 630-line client.

**Step 1: Write PlusVibe client**

```typescript
// src/lib/integrations/plusvibe.ts
// Simplified PlusVibe client for adding leads to campaigns.
// Full client in gtm-system — this only implements what magnetlab needs.

const PLUSVIBE_BASE_URL = 'https://api.plusvibe.ai/api/v1';

export interface PlusVibeLeadPayload {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  linkedin_person_url?: string;
  custom_variables?: Record<string, string>;
}

interface AddLeadsResponse {
  success: boolean;
  added?: number;
  error?: string;
}

/**
 * Add leads to a PlusVibe campaign.
 * Variables are sent WITHOUT `custom_` prefix — PlusVibe auto-prefixes them.
 * Templates reference them as {{custom_variable_name}}.
 */
export async function addLeadsToPlusVibeCampaign(
  campaignId: string,
  leads: PlusVibeLeadPayload[]
): Promise<AddLeadsResponse> {
  const apiKey = process.env.PLUSVIBE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'PLUSVIBE_API_KEY not configured' };
  }

  try {
    const response = await fetch(`${PLUSVIBE_BASE_URL}/lead/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        campaign_id: campaignId,
        leads: leads.map((lead) => ({
          email: lead.email,
          first_name: lead.first_name || '',
          last_name: lead.last_name || '',
          company_name: lead.company_name || '',
          linkedin_person_url: lead.linkedin_person_url || '',
          custom_variables: lead.custom_variables || {},
        })),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, error: `PlusVibe API error ${response.status}: ${text}` };
    }

    const data = await response.json();
    return { success: true, added: data.added_count ?? leads.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown PlusVibe error',
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/integrations/plusvibe.ts
git commit -m "feat: add PlusVibe client for adding leads to campaigns"
```

---

## Task 7: Enrich-and-Push Trigger.dev Task

**Files:**
- Create: `src/trigger/enrich-and-push-plusvibe.ts`

**Dependencies:** Task 1 (migration), Task 5 (waterfall), Task 6 (PlusVibe client). Uses existing Harvest API client at `src/lib/integrations/harvest-api.ts`.

**Step 1: Write the Trigger.dev task**

```typescript
// src/trigger/enrich-and-push-plusvibe.ts
import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { waterfallEmailFind } from '@/lib/integrations/enrichment/waterfall';
import { addLeadsToPlusVibeCampaign } from '@/lib/integrations/plusvibe';
import { getProfile } from '@/lib/integrations/harvest-api';

interface EnrichAndPushPayload {
  userId: string;
  automationId: string;
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  plusvibeCampaignId: string;
  optInUrl?: string;
}

export const enrichAndPushPlusvibe = task({
  id: 'enrich-and-push-plusvibe',
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async (payload: EnrichAndPushPayload) => {
    const {
      userId,
      automationId,
      linkedinUrl,
      firstName,
      lastName,
      plusvibeCampaignId,
      optInUrl,
    } = payload;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    logger.info('Starting enrichment for PlusVibe push', {
      linkedinUrl,
      firstName,
      plusvibeCampaignId,
    });

    // 1. Check dedup — upsert engagement_enrichments record
    const { data: existing } = await supabase
      .from('engagement_enrichments')
      .select('id, status')
      .eq('user_id', userId)
      .eq('automation_id', automationId)
      .eq('linkedin_url', linkedinUrl)
      .maybeSingle();

    if (existing && (existing.status === 'pushed' || existing.status === 'enriching')) {
      logger.info('Already processed or in progress', { status: existing.status });
      return { skipped: true, reason: existing.status };
    }

    // Upsert the record
    const { data: enrichment, error: upsertError } = await supabase
      .from('engagement_enrichments')
      .upsert(
        {
          user_id: userId,
          automation_id: automationId,
          linkedin_url: linkedinUrl,
          first_name: firstName,
          last_name: lastName,
          plusvibe_campaign_id: plusvibeCampaignId,
          status: 'enriching',
        },
        { onConflict: 'user_id,automation_id,linkedin_url' }
      )
      .select('id')
      .single();

    if (upsertError || !enrichment) {
      logger.error('Failed to upsert enrichment record', { error: upsertError?.message });
      return { success: false, error: 'db_upsert_failed' };
    }

    const enrichmentId = enrichment.id;

    // 2. Enrich profile via Harvest API (get company, headline for email finding)
    let company = '';
    let headline = '';
    let companyDomain = '';

    try {
      const profile = await getProfile({ url: linkedinUrl });
      if (profile.data) {
        company = profile.data.company || '';
        headline = profile.data.headline || '';
        // Try to extract company domain from experience
        const experience = profile.data.experience;
        if (Array.isArray(experience) && experience.length > 0) {
          companyDomain = experience[0]?.company_url
            ? new URL(experience[0].company_url).hostname.replace('www.', '')
            : '';
        }
      }
    } catch (err) {
      logger.warn('Harvest profile lookup failed, continuing with name only', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Update enrichment record with profile data
    await supabase
      .from('engagement_enrichments')
      .update({ headline, company })
      .eq('id', enrichmentId);

    // 3. Run email waterfall
    logger.info('Running email waterfall', { firstName, lastName, company, companyDomain });

    const result = await waterfallEmailFind({
      first_name: firstName,
      last_name: lastName,
      company_domain: companyDomain,
      linkedin_url: linkedinUrl,
    });

    logger.info('Waterfall result', {
      email: result.email ? '***found***' : null,
      provider: result.provider,
      validated: result.validated,
      attempts: result.attempts.length,
    });

    if (!result.email) {
      await supabase
        .from('engagement_enrichments')
        .update({ status: 'no_email' })
        .eq('id', enrichmentId);

      return { success: false, reason: 'no_email', attempts: result.attempts };
    }

    if (result.validation_status === 'invalid') {
      await supabase
        .from('engagement_enrichments')
        .update({
          email: result.email,
          email_provider: result.provider,
          email_validation_status: result.validation_status,
          status: 'failed',
        })
        .eq('id', enrichmentId);

      return { success: false, reason: 'email_invalid', email_provider: result.provider };
    }

    // 4. Update enrichment record with email
    await supabase
      .from('engagement_enrichments')
      .update({
        email: result.email,
        email_provider: result.provider,
        email_validation_status: result.validation_status || 'unknown',
        status: 'enriched',
      })
      .eq('id', enrichmentId);

    // 5. Push to PlusVibe
    logger.info('Pushing to PlusVibe campaign', { plusvibeCampaignId });

    const customVariables: Record<string, string> = {};
    if (optInUrl) customVariables.opt_in_url = optInUrl;
    if (company) customVariables.company_name = company;
    customVariables.linkedin_url = linkedinUrl;

    const pushResult = await addLeadsToPlusVibeCampaign(plusvibeCampaignId, [
      {
        email: result.email,
        first_name: firstName,
        last_name: lastName,
        company_name: company || undefined,
        linkedin_person_url: linkedinUrl,
        custom_variables: customVariables,
      },
    ]);

    if (!pushResult.success) {
      await supabase
        .from('engagement_enrichments')
        .update({
          plusvibe_error: pushResult.error,
          status: 'failed',
        })
        .eq('id', enrichmentId);

      logger.error('PlusVibe push failed', { error: pushResult.error });
      return { success: false, reason: 'plusvibe_push_failed', error: pushResult.error };
    }

    // 6. Mark as pushed
    await supabase
      .from('engagement_enrichments')
      .update({
        plusvibe_pushed_at: new Date().toISOString(),
        status: 'pushed',
      })
      .eq('id', enrichmentId);

    logger.info('Successfully enriched and pushed to PlusVibe', {
      email_provider: result.provider,
      plusvibe_campaign: plusvibeCampaignId,
    });

    return {
      success: true,
      email_provider: result.provider,
      validated: result.validated,
    };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/enrich-and-push-plusvibe.ts
git commit -m "feat: add enrich-and-push-plusvibe Trigger.dev task"
```

---

## Task 8: Wire Enrichment into Existing Automation Pipeline

**Files:**
- Modify: `src/lib/services/linkedin-automation.ts` (add PlusVibe enrichment step after HeyReach)
- Modify: `src/lib/types/content-pipeline.ts` (add new event types + automation fields)

**Step 1: Update types**

In `src/lib/types/content-pipeline.ts`, add new event types to `AutomationEventType` (around line 673):

Add `'plusvibe_enrichment_triggered' | 'plusvibe_enrichment_failed'` to the union.

Add `plusvibe_campaign_id` and `opt_in_url` to `LinkedInAutomation` interface (around line 688).

**Step 2: Add PlusVibe enrichment step to `processComment`**

In `src/lib/services/linkedin-automation.ts`, after the HeyReach block (line 131) and before the comment reply block (line 133), add a new block that triggers the `enrich-and-push-plusvibe` Trigger.dev task when `automation.plusvibe_campaign_id` is set and `comment.commenterLinkedinUrl` is available.

```typescript
// 2b. Trigger PlusVibe enrichment + push (async background task)
if (automation.plusvibe_campaign_id && comment.commenterLinkedinUrl) {
  try {
    const { tasks } = await import('@trigger.dev/sdk/v3');
    const { enrichAndPushPlusvibe } = await import('@/trigger/enrich-and-push-plusvibe');

    await tasks.trigger(enrichAndPushPlusvibe.id, {
      userId: automation.user_id,
      automationId: automation.id,
      linkedinUrl: comment.commenterLinkedinUrl,
      firstName: comment.commenterName.split(' ')[0] || '',
      lastName: comment.commenterName.split(' ').slice(1).join(' ') || '',
      plusvibeCampaignId: automation.plusvibe_campaign_id,
      optInUrl: automation.opt_in_url || undefined,
    });

    actions.push('plusvibe_enrichment_triggered');
    await logEvent(automation.id, 'plusvibe_enrichment_triggered', comment,
      `Campaign: ${automation.plusvibe_campaign_id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`plusvibe_enrich: ${msg}`);
    await logEvent(automation.id, 'plusvibe_enrichment_failed', comment, undefined, msg);
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/services/linkedin-automation.ts src/lib/types/content-pipeline.ts
git commit -m "feat: wire PlusVibe enrichment into comment automation pipeline"
```

---

## Task 9: Update Automation API + Editor for PlusVibe Fields

**Files:**
- Modify: `src/app/api/linkedin/automations/route.ts` (POST handler — add plusvibe fields)
- Modify: `src/app/api/linkedin/automations/[id]/route.ts` (PATCH handler — add to allowed fields)
- Modify: `src/components/automations/AutomationEditor.tsx` (add PlusVibe + opt-in URL fields)
- Modify: `src/components/automations/AutomationList.tsx` (add PlusVibe badge + Automation type interface update)

**Step 1: Update POST handler**

In `src/app/api/linkedin/automations/route.ts`, add `plusvibeCampaignId` and `optInUrl` to the destructured body (line 58-59 area) and add them to the insert object (around line 100):

```typescript
plusvibe_campaign_id: plusvibeCampaignId || null,
opt_in_url: optInUrl || null,
```

**Step 2: Update PATCH handler**

In `src/app/api/linkedin/automations/[id]/route.ts`, add `'plusvibe_campaign_id'` and `'opt_in_url'` to the `allowedFields` array (line 74).

**Step 3: Update AutomationEditor**

In `src/components/automations/AutomationEditor.tsx`:
- Add state variables: `plusvibeCampaignId`, `optInUrl`
- Initialize from `automation` in `useEffect` (around line 85)
- Reset in create mode (around line 99)
- Add to payload in `handleSave` (around line 169)
- Add UI fields after the HeyReach/DM template section:
  - "PlusVibe Campaign ID" text input
  - "Opt-In URL" text input with helper text about cold email + comment reply

**Step 4: Update AutomationList type**

In `src/components/automations/AutomationList.tsx`, add `plusvibe_campaign_id` and `opt_in_url` to the `Automation` interface (around line 20). Add a "PlusVibe" badge next to HeyReach when `plusvibe_campaign_id` is set.

**Step 5: Commit**

```bash
git add src/app/api/linkedin/automations/route.ts src/app/api/linkedin/automations/\[id\]/route.ts src/components/automations/AutomationEditor.tsx src/components/automations/AutomationList.tsx
git commit -m "feat: add PlusVibe campaign + opt-in URL to automation editor"
```

---

## Task 10: Manual Comment Reply API Route

**Files:**
- Create: `src/app/api/linkedin/automations/[id]/reply/route.ts`

**Step 1: Write the reply API route**

```typescript
// POST /api/linkedin/automations/[id]/reply
// Sends a reply to a specific comment via Unipile and logs the event.
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient, getUserPostingAccountId } from '@/lib/integrations/unipile';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid automation ID');
    }

    const body = await request.json();
    const { commentSocialId, text, commenterName } = body as {
      commentSocialId: string;
      text: string;
      commenterName?: string;
    };

    if (!commentSocialId || !text?.trim()) {
      return ApiErrors.validationError('commentSocialId and text are required');
    }

    const supabase = createSupabaseAdminClient();

    // Verify automation belongs to user
    const { data: automation, error: autoError } = await supabase
      .from('linkedin_automations')
      .select('id, user_id, post_social_id, unipile_account_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (autoError || !automation) {
      return ApiErrors.notFound('Automation');
    }

    // Get Unipile account
    const accountId = automation.unipile_account_id
      || await getUserPostingAccountId(automation.user_id);

    if (!accountId) {
      return ApiErrors.validationError('No LinkedIn account connected');
    }

    // Send reply via Unipile
    const client = getUnipileClient();
    const postSocialId = automation.post_social_id || commentSocialId;

    const result = await client.addComment(postSocialId, accountId, text.trim());

    if (result.error) {
      throw new Error(result.error);
    }

    // Log the event
    await supabase.from('linkedin_automation_events').insert({
      automation_id: id,
      event_type: 'reply_sent',
      commenter_name: commenterName || null,
      commenter_provider_id: null,
      commenter_linkedin_url: null,
      comment_text: null,
      action_details: `Manual reply: ${text.trim().substring(0, 200)}`,
      error: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('linkedin/automations/reply', error);
    return ApiErrors.internalError('Failed to send reply');
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/linkedin/automations/\[id\]/reply/route.ts
git commit -m "feat: add manual comment reply API route"
```

---

## Task 11: Manual Reply Button in Automation Events UI

**Files:**
- Modify: `src/components/automations/AutomationList.tsx` — add events drawer with reply button

The current AutomationList shows automation cards. The GET `/api/linkedin/automations/[id]` route already returns events. We need to:

1. Add a "View Activity" button to each automation card
2. Show a slide-out drawer with recent events
3. Add a "Reply with Link" button on `comment_detected`/`keyword_matched` events when `opt_in_url` is set

**Step 1: Create AutomationEventsDrawer component**

Create `src/components/automations/AutomationEventsDrawer.tsx`:

This component:
- Fetches events via `GET /api/linkedin/automations/[id]` on open
- Shows timeline of events (comment_detected, keyword_matched, dm_sent, reply_sent, plusvibe_enrichment_triggered, etc.)
- For `comment_detected` and `keyword_matched` events, shows a "Reply with Link" button if the automation has `opt_in_url`
- Clicking "Reply with Link" opens a textarea pre-filled with: `Thanks {{commenterName}}! Here's the link: {{opt_in_url}}`
- User can edit, then click "Send" which calls `POST /api/linkedin/automations/[id]/reply`

**Step 2: Wire into AutomationList**

Add "View Activity" button to each automation card (next to Edit/Delete). Opens the drawer.

**Step 3: Commit**

```bash
git add src/components/automations/AutomationEventsDrawer.tsx src/components/automations/AutomationList.tsx
git commit -m "feat: add automation events drawer with manual reply button"
```

---

## Task 12: Tests

**Files:**
- Create: `src/__tests__/lib/integrations/enrichment/waterfall.test.ts`
- Create: `src/__tests__/api/linkedin/automations/reply.test.ts`

**Step 1: Write waterfall tests**

Test the waterfall orchestrator with mocked providers:
- Test returns email from first provider when found
- Test falls through to second provider when first returns null
- Test falls through to third when first two fail
- Test validates email with ZeroBounce
- Test returns null when all providers exhausted
- Test records all attempts

**Step 2: Write reply API route tests**

Test the manual reply route:
- Returns 401 without auth
- Returns 400 with missing fields
- Returns 404 with wrong automation ID
- Calls Unipile addComment and logs event on success

**Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test -- --no-coverage src/__tests__/lib/integrations/enrichment/ src/__tests__/api/linkedin/automations/`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/__tests__/lib/integrations/enrichment/waterfall.test.ts src/__tests__/api/linkedin/automations/reply.test.ts
git commit -m "test: add tests for email waterfall and manual reply API"
```

---

## Task 13: Environment Variables

**No code changes** — set API keys in Vercel and Trigger.dev environments.

**Step 1: List required env vars**

These must be set in BOTH Vercel (for API routes) and Trigger.dev (for background tasks):

```
LEADMAGIC_API_KEY
PROSPEO_API_KEY
BLITZ_API_KEY
ZEROBOUNCE_API_KEY
BOUNCEBAN_API_KEY
PLUSVIBE_API_KEY
```

**Step 2: Set env vars**

Use the Trigger.dev API to set env vars:
```bash
# Trigger.dev
curl -X POST "https://api.trigger.dev/api/v1/projects/proj_jdjofdqazqwitpinxady/envvars/prod" \
  -H "Authorization: Bearer $TRIGGER_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"LEADMAGIC_API_KEY", "value":"..."}'
```

And set them in Vercel project settings or via CLI.

**Note:** The actual API key values should come from the user's existing gtm-system env vars.

---

## Task 14: Deploy

**Step 1: Build and typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit && npm run build`
Expected: No type errors, build succeeds.

**Step 2: Deploy Vercel**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod`

**Step 3: Deploy Trigger.dev tasks**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy`

**Step 4: Apply migration to production**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`

---

## Task 15: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Add a new section documenting the engagement cold email pipeline:
- Architecture overview
- Key files list
- Data flow diagram
- Environment variables
- PlusVibe integration notes (variable naming convention, campaign IDs)

**Commit:**

```bash
git add CLAUDE.md
git commit -m "docs: add engagement cold email pipeline documentation"
```
