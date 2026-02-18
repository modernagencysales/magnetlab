# Thank-You Page A/B Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Self-serve A/B testing for thank-you pages — AI generates variant suggestions, system auto-declares winners at statistical significance, maximizing survey completion rates.

**Architecture:** Variant rows on `funnel_pages` linked via `ab_experiments` table. Server-side deterministic bucketing via IP+UA hash. Existing page_views and funnel_leads tracking works unchanged per variant. Trigger.dev scheduled task checks significance every 6 hours.

**Tech Stack:** Next.js 15, Supabase PostgreSQL, Trigger.dev v4, Claude AI (variant generation), TypeScript

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260218200000_ab_experiments.sql`

**Context:** This migration creates the `ab_experiments` table and adds variant columns to `funnel_pages`. The `ab_experiments` table tracks test metadata (status, winner, significance). The variant columns on `funnel_pages` link variant rows back to their experiment.

**Step 1: Write the migration**

```sql
-- A/B experiment tracking
CREATE TABLE ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
  test_field TEXT NOT NULL CHECK (test_field IN ('headline', 'subline', 'vsl_url', 'pass_message')),
  winner_id UUID REFERENCES funnel_pages(id),
  significance FLOAT,
  min_sample_size INT NOT NULL DEFAULT 50,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Variant columns on funnel_pages
ALTER TABLE funnel_pages
  ADD COLUMN experiment_id UUID REFERENCES ab_experiments(id) ON DELETE SET NULL,
  ADD COLUMN is_variant BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN variant_label TEXT;

-- Indexes
CREATE INDEX idx_ab_experiments_funnel ON ab_experiments(funnel_page_id);
CREATE INDEX idx_ab_experiments_user ON ab_experiments(user_id);
CREATE INDEX idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX idx_funnel_pages_experiment ON funnel_pages(experiment_id) WHERE experiment_id IS NOT NULL;
CREATE INDEX idx_funnel_pages_variant ON funnel_pages(is_variant) WHERE is_variant = true;

-- RLS
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own experiments"
  ON ab_experiments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own experiments"
  ON ab_experiments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own experiments"
  ON ab_experiments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own experiments"
  ON ab_experiments FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypass (for Trigger.dev scheduled task)
CREATE POLICY "Service role full access"
  ON ab_experiments FOR ALL
  USING (auth.role() = 'service_role');
```

**Step 2: Run the migration**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx supabase db push --linked
```

Expected: Migration applies successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260218200000_ab_experiments.sql
git commit -m "feat: add ab_experiments table and variant columns to funnel_pages"
```

---

### Task 2: A/B Experiments API — CRUD

**Files:**
- Create: `src/app/api/ab-experiments/route.ts`
- Create: `src/app/api/ab-experiments/[id]/route.ts`

**Context:** These API routes handle creating, listing, updating, and getting experiments. The POST route clones the control funnel_page to create a variant with the changed field. Uses `createSupabaseAdminClient()` to bypass RLS (auth checked via NextAuth session). Pattern: see `src/app/api/funnel/route.ts`.

**Step 1: Create the list + create route**

Create `src/app/api/ab-experiments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// GET /api/ab-experiments?funnelPageId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const funnelPageId = req.nextUrl.searchParams.get('funnelPageId');
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('ab_experiments')
    .select('id, funnel_page_id, name, status, test_field, winner_id, significance, min_sample_size, started_at, completed_at, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (funnelPageId) {
    query = query.eq('funnel_page_id', funnelPageId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiments: data });
}

// POST /api/ab-experiments
// Body: { funnelPageId, name, testField, variantValue, variantLabel }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { funnelPageId, name, testField, variantValue, variantLabel } = body;

  if (!funnelPageId || !name || !testField || variantValue === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const validFields = ['headline', 'subline', 'vsl_url', 'pass_message'];
  if (!validFields.includes(testField)) {
    return NextResponse.json({ error: 'Invalid test field' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify ownership of the funnel page
  const { data: controlPage, error: fetchError } = await supabase
    .from('funnel_pages')
    .select('*')
    .eq('id', funnelPageId)
    .eq('user_id', session.user.id)
    .eq('is_variant', false)
    .single();

  if (fetchError || !controlPage) {
    return NextResponse.json({ error: 'Funnel page not found' }, { status: 404 });
  }

  // Check no running experiment on this funnel
  const { data: existing } = await supabase
    .from('ab_experiments')
    .select('id')
    .eq('funnel_page_id', funnelPageId)
    .in('status', ['draft', 'running'])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'An active experiment already exists for this funnel' }, { status: 409 });
  }

  // Create the experiment
  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .insert({
      funnel_page_id: funnelPageId,
      user_id: session.user.id,
      name,
      test_field: testField,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (expError || !experiment) {
    return NextResponse.json({ error: expError?.message || 'Failed to create experiment' }, { status: 500 });
  }

  // Map test_field to DB column
  const fieldMap: Record<string, string> = {
    headline: 'thankyou_headline',
    subline: 'thankyou_subline',
    vsl_url: 'vsl_url',
    pass_message: 'qualification_pass_message',
  };
  const dbColumn = fieldMap[testField];

  // Clone the control funnel_page as a variant
  const variantSlug = `${controlPage.slug}-variant-${Date.now()}`;
  const variantData: Record<string, unknown> = {};
  // Copy all thank-you relevant fields from control
  const copyFields = [
    'lead_magnet_id', 'user_id', 'team_id',
    'optin_headline', 'optin_subline', 'optin_button_text', 'optin_social_proof',
    'thankyou_headline', 'thankyou_subline', 'vsl_url', 'calendly_url',
    'qualification_pass_message', 'qualification_fail_message',
    'theme', 'primary_color', 'background_style', 'logo_url',
    'qualification_form_id', 'font_family', 'font_url',
    'target_type', 'library_id', 'external_resource_id',
  ];
  for (const field of copyFields) {
    variantData[field] = controlPage[field];
  }

  // Override the tested field
  variantData[dbColumn] = variantValue;

  // Set variant metadata
  variantData.slug = variantSlug;
  variantData.experiment_id = experiment.id;
  variantData.is_variant = true;
  variantData.variant_label = variantLabel || 'Variant B';
  variantData.is_published = true;

  const { data: variant, error: variantError } = await supabase
    .from('funnel_pages')
    .insert(variantData)
    .select('id')
    .single();

  if (variantError || !variant) {
    // Cleanup experiment if variant creation fails
    await supabase.from('ab_experiments').delete().eq('id', experiment.id);
    return NextResponse.json({ error: variantError?.message || 'Failed to create variant' }, { status: 500 });
  }

  // Link control to experiment too
  await supabase
    .from('funnel_pages')
    .update({ experiment_id: experiment.id })
    .eq('id', funnelPageId);

  return NextResponse.json({ experiment: { id: experiment.id }, variant: { id: variant.id } });
}
```

**Step 2: Create the single-experiment route**

Create `src/app/api/ab-experiments/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// GET /api/ab-experiments/[id] — get experiment with variant stats
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // Fetch experiment
  const { data: experiment, error } = await supabase
    .from('ab_experiments')
    .select('id, funnel_page_id, name, status, test_field, winner_id, significance, min_sample_size, started_at, completed_at, created_at')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single();

  if (error || !experiment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Fetch all variants (including control)
  const { data: variants } = await supabase
    .from('funnel_pages')
    .select('id, is_variant, variant_label, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message')
    .or(`id.eq.${experiment.funnel_page_id},experiment_id.eq.${experiment.id}`);

  // Fetch stats per variant
  const variantIds = (variants || []).map(v => v.id);
  const [viewsResult, leadsResult] = await Promise.all([
    supabase
      .from('page_views')
      .select('funnel_page_id')
      .in('funnel_page_id', variantIds)
      .eq('page_type', 'thankyou'),
    supabase
      .from('funnel_leads')
      .select('funnel_page_id, qualification_answers')
      .in('funnel_page_id', variantIds),
  ]);

  const stats = (variants || []).map(v => {
    const views = (viewsResult.data || []).filter(pv => pv.funnel_page_id === v.id).length;
    const completions = (leadsResult.data || []).filter(
      l => l.funnel_page_id === v.id && l.qualification_answers != null
    ).length;
    return {
      funnelPageId: v.id,
      isVariant: v.is_variant,
      label: v.is_variant ? (v.variant_label || 'Variant B') : 'Control',
      views,
      completions,
      completionRate: views > 0 ? Math.round((completions / views) * 10000) / 100 : 0,
      // Include the tested field values for display
      headline: v.thankyou_headline,
      subline: v.thankyou_subline,
      vslUrl: v.vsl_url,
      passMessage: v.qualification_pass_message,
    };
  });

  return NextResponse.json({ experiment, stats });
}

// PATCH /api/ab-experiments/[id] — pause, resume, declare winner
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, winnerId } = body;

  const supabase = createSupabaseAdminClient();

  const { data: experiment, error } = await supabase
    .from('ab_experiments')
    .select('id, funnel_page_id, status, test_field')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single();

  if (error || !experiment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (action === 'pause' && experiment.status === 'running') {
    await supabase.from('ab_experiments').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ success: true });
  }

  if (action === 'resume' && experiment.status === 'paused') {
    await supabase.from('ab_experiments').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ success: true });
  }

  if (action === 'declare_winner' && winnerId) {
    // Promote winner: if winner is a variant, copy its tested field onto the control
    const fieldMap: Record<string, string> = {
      headline: 'thankyou_headline',
      subline: 'thankyou_subline',
      vsl_url: 'vsl_url',
      pass_message: 'qualification_pass_message',
    };
    const dbColumn = fieldMap[experiment.test_field];

    if (winnerId !== experiment.funnel_page_id) {
      // Winner is the variant — copy value to control
      const { data: winner } = await supabase
        .from('funnel_pages')
        .select(dbColumn)
        .eq('id', winnerId)
        .single();

      if (winner) {
        await supabase
          .from('funnel_pages')
          .update({ [dbColumn]: winner[dbColumn], updated_at: new Date().toISOString() })
          .eq('id', experiment.funnel_page_id);
      }
    }

    // Mark experiment completed
    await supabase.from('ab_experiments').update({
      status: 'completed',
      winner_id: winnerId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    // Unpublish variant rows and clear experiment links
    await supabase
      .from('funnel_pages')
      .update({ is_published: false, experiment_id: null })
      .eq('experiment_id', id)
      .eq('is_variant', true);

    // Clear experiment_id on control
    await supabase
      .from('funnel_pages')
      .update({ experiment_id: null })
      .eq('id', experiment.funnel_page_id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// DELETE /api/ab-experiments/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // Verify ownership
  const { data: experiment } = await supabase
    .from('ab_experiments')
    .select('id, funnel_page_id')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single();

  if (!experiment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Delete variant funnel pages (cascade will handle sections/leads)
  await supabase
    .from('funnel_pages')
    .delete()
    .eq('experiment_id', id)
    .eq('is_variant', true);

  // Clear experiment_id on control
  await supabase
    .from('funnel_pages')
    .update({ experiment_id: null })
    .eq('id', experiment.funnel_page_id);

  // Delete experiment
  await supabase.from('ab_experiments').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
```

**Step 3: Typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/ab-experiments/
git commit -m "feat: A/B experiments CRUD API (create, get, list, pause/resume, declare winner, delete)"
```

---

### Task 3: AI Variant Suggestion API

**Files:**
- Create: `src/app/api/ab-experiments/suggest/route.ts`

**Context:** Uses the shared Anthropic client (`src/lib/ai/content-pipeline/anthropic-client.ts`) to generate variant suggestions. Takes the current field value, lead magnet context, and test field, returns 3 suggestions.

**Step 1: Create the suggestion route**

Create `src/app/api/ab-experiments/suggest/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';

// POST /api/ab-experiments/suggest
// Body: { funnelPageId, testField }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { funnelPageId, testField } = body;

  if (!funnelPageId || !testField) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const validFields = ['headline', 'subline', 'vsl_url', 'pass_message'];
  if (!validFields.includes(testField)) {
    return NextResponse.json({ error: 'Invalid test field' }, { status: 400 });
  }

  // Video on/off doesn't need AI
  if (testField === 'vsl_url') {
    return NextResponse.json({
      suggestions: [
        { label: 'Remove video', value: null, rationale: 'Test if removing the video increases survey completion by reducing distraction.' },
      ],
    });
  }

  const supabase = createSupabaseAdminClient();

  // Fetch funnel page + lead magnet context
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message, lead_magnet_id')
    .eq('id', funnelPageId)
    .eq('user_id', session.user.id)
    .single();

  if (!funnel) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
  }

  let leadMagnetContext = '';
  if (funnel.lead_magnet_id) {
    const { data: lm } = await supabase
      .from('lead_magnets')
      .select('title, archetype, concept')
      .eq('id', funnel.lead_magnet_id)
      .single();
    if (lm) {
      leadMagnetContext = `Lead magnet: "${lm.title}" (${lm.archetype}). Concept: ${JSON.stringify(lm.concept)}`;
    }
  }

  const fieldMap: Record<string, string> = {
    headline: 'thankyou_headline',
    subline: 'thankyou_subline',
    pass_message: 'qualification_pass_message',
  };
  const currentValue = funnel[fieldMap[testField] as keyof typeof funnel] as string || '';

  const fieldDescriptions: Record<string, string> = {
    headline: 'the thank-you page headline shown after opt-in, before the qualification survey',
    subline: 'the supporting subtext below the headline on the thank-you page',
    pass_message: 'the congratulatory message shown to qualified leads after completing the survey',
  };

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a conversion rate optimization expert. Generate 3 alternative variants for A/B testing.

Current value for ${fieldDescriptions[testField]}:
"${currentValue}"

${leadMagnetContext}

Goal: Maximize the percentage of visitors who complete the qualification survey on the thank-you page.

The page flow is: visitor opts in → sees thank-you page with headline/subline → takes qualification survey → books a call if qualified.

Generate 3 variants that test different psychological approaches (urgency, curiosity, value framing, social proof, personalization). Each should be meaningfully different from the current value.

Respond in JSON:
{
  "suggestions": [
    { "value": "the new text", "rationale": "1-sentence explanation of why this might convert better" },
    { "value": "the new text", "rationale": "1-sentence explanation" },
    { "value": "the new text", "rationale": "1-sentence explanation" }
  ]
}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseJsonResponse<{ suggestions: Array<{ value: string; rationale: string }> }>(text);

  return NextResponse.json({
    suggestions: parsed.suggestions.map((s, i) => ({
      label: `Variant ${String.fromCharCode(66 + i)}`, // B, C, D
      value: s.value,
      rationale: s.rationale,
    })),
  });
}
```

**Step 2: Typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/ab-experiments/suggest/route.ts
git commit -m "feat: AI variant suggestion API using Claude for CRO copy generation"
```

---

### Task 4: Server-Side Visitor Bucketing

**Files:**
- Modify: `src/app/p/[username]/[slug]/thankyou/page.tsx`

**Context:** When a visitor hits the thank-you page, the server component checks if the control funnel_page has an active experiment. If so, it deterministically assigns the visitor to a variant using a SHA-256 hash of `IP + User-Agent + experiment_id`. The selected variant's field values override the control's props.

**Step 1: Add bucketing logic to the thank-you server component**

In `src/app/p/[username]/[slug]/thankyou/page.tsx`, after the funnel query (around line 86), add experiment bucketing:

```typescript
// After: if (funnelError || !funnel || !funnel.is_published) { notFound(); }

// A/B experiment bucketing
let activeFunnel = funnel;
const { data: activeExperiment } = await supabase
  .from('ab_experiments')
  .select('id, test_field')
  .eq('funnel_page_id', funnel.id)
  .eq('status', 'running')
  .limit(1)
  .single();

if (activeExperiment) {
  // Get all variants including control
  const { data: variants } = await supabase
    .from('funnel_pages')
    .select('id, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message, is_variant, qualification_form_id')
    .or(`id.eq.${funnel.id},experiment_id.eq.${activeExperiment.id}`)
    .eq('is_published', true);

  if (variants && variants.length > 1) {
    // Deterministic bucketing: hash(IP + UA + experiment_id)
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const ua = req.headers.get('user-agent') || 'unknown';
    const { createHash } = await import('crypto');
    const hash = createHash('sha256').update(`${ip}${ua}${activeExperiment.id}`).digest();
    const bucketIndex = hash.readUInt32BE(0) % variants.length;
    const selected = variants[bucketIndex];

    // Override the funnel data with the selected variant
    activeFunnel = { ...funnel, ...selected };
  }
}
```

**Important:** The server component function signature needs to accept `req` — but Next.js App Router server components receive `params` and `searchParams`, not `req`. We need to use `headers()` from `next/headers` instead:

```typescript
import { headers } from 'next/headers';

// Inside the component, for bucketing:
const headersList = await headers();
const forwarded = headersList.get('x-forwarded-for');
const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
const ua = headersList.get('user-agent') || 'unknown';
```

Also update the `select` in the initial funnel query to include `is_variant` (add filter `.eq('is_variant', false)` to ensure we always start with the control).

The rest of the component stays the same — it already renders based on `activeFunnel` fields. The `funnelPageId` passed to ThankyouPage should be the **selected variant's ID** so that page_views and lead submissions track against the correct variant.

**Step 2: Typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/p/[username]/[slug]/thankyou/page.tsx
git commit -m "feat: server-side A/B test bucketing on thank-you page"
```

---

### Task 5: Auto-Winner Trigger.dev Task

**Files:**
- Create: `src/trigger/check-ab-experiments.ts`

**Context:** Scheduled task runs every 6 hours. For each running experiment, counts views and completions per variant, runs a two-proportion z-test, and declares a winner if p < 0.05. Pattern: see `src/trigger/autopilot-batch.ts` for scheduled task structure.

**Step 1: Create the scheduled task**

Create `src/trigger/check-ab-experiments.ts`:

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// Two-proportion z-test
function zTestTwoProportions(
  n1: number, x1: number,
  n2: number, x2: number
): { zScore: number; pValue: number } {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pPooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));

  if (se === 0) return { zScore: 0, pValue: 1 };

  const z = (p1 - p2) / se;
  // Two-tailed p-value approximation using normal CDF
  const absZ = Math.abs(z);
  const p = 2 * (1 - normalCDF(absZ));
  return { zScore: z, pValue: p };
}

// Standard normal CDF approximation (Abramowitz & Stegun)
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

export const checkAbExperiments = schedules.task({
  id: 'check-ab-experiments',
  cron: '0 */6 * * *', // Every 6 hours
  maxDuration: 120,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Get all running experiments
    const { data: experiments } = await supabase
      .from('ab_experiments')
      .select('id, funnel_page_id, min_sample_size, test_field')
      .eq('status', 'running');

    if (!experiments || experiments.length === 0) {
      logger.info('No running experiments');
      return { checked: 0 };
    }

    let winnersFound = 0;

    for (const exp of experiments) {
      // Get all variants for this experiment
      const { data: variants } = await supabase
        .from('funnel_pages')
        .select('id, is_variant')
        .or(`id.eq.${exp.funnel_page_id},experiment_id.eq.${exp.id}`);

      if (!variants || variants.length < 2) continue;

      const variantIds = variants.map(v => v.id);

      // Count views per variant
      const { data: views } = await supabase
        .from('page_views')
        .select('funnel_page_id')
        .in('funnel_page_id', variantIds)
        .eq('page_type', 'thankyou');

      // Count completions per variant
      const { data: leads } = await supabase
        .from('funnel_leads')
        .select('funnel_page_id, qualification_answers')
        .in('funnel_page_id', variantIds);

      const statsMap = new Map<string, { views: number; completions: number }>();
      for (const v of variants) {
        statsMap.set(v.id, { views: 0, completions: 0 });
      }
      for (const pv of views || []) {
        const s = statsMap.get(pv.funnel_page_id);
        if (s) s.views++;
      }
      for (const l of leads || []) {
        if (l.qualification_answers != null) {
          const s = statsMap.get(l.funnel_page_id);
          if (s) s.completions++;
        }
      }

      // Check minimum sample size
      const allStats = Array.from(statsMap.entries()).map(([id, s]) => ({ id, ...s }));
      const belowMin = allStats.some(s => s.views < exp.min_sample_size);
      if (belowMin) {
        logger.info('Experiment below min sample', { experimentId: exp.id, stats: allStats });
        continue;
      }

      // Find best variant by completion rate
      const sorted = allStats.sort((a, b) => {
        const rateA = a.views > 0 ? a.completions / a.views : 0;
        const rateB = b.views > 0 ? b.completions / b.views : 0;
        return rateB - rateA;
      });

      const best = sorted[0];
      const second = sorted[1];

      // Run z-test between top two
      const { pValue } = zTestTwoProportions(
        best.views, best.completions,
        second.views, second.completions
      );

      logger.info('Significance check', {
        experimentId: exp.id,
        best: { id: best.id, rate: best.completions / best.views },
        second: { id: second.id, rate: second.completions / second.views },
        pValue,
      });

      if (pValue < 0.05) {
        // Declare winner
        const fieldMap: Record<string, string> = {
          headline: 'thankyou_headline',
          subline: 'thankyou_subline',
          vsl_url: 'vsl_url',
          pass_message: 'qualification_pass_message',
        };
        const dbColumn = fieldMap[exp.test_field];

        // Promote winner if it's not the control
        if (best.id !== exp.funnel_page_id) {
          const { data: winner } = await supabase
            .from('funnel_pages')
            .select(dbColumn)
            .eq('id', best.id)
            .single();

          if (winner) {
            await supabase
              .from('funnel_pages')
              .update({ [dbColumn]: (winner as Record<string, unknown>)[dbColumn], updated_at: new Date().toISOString() })
              .eq('id', exp.funnel_page_id);
          }
        }

        // Complete the experiment
        await supabase.from('ab_experiments').update({
          status: 'completed',
          winner_id: best.id,
          significance: pValue,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', exp.id);

        // Unpublish variants and clear links
        await supabase
          .from('funnel_pages')
          .update({ is_published: false, experiment_id: null })
          .eq('experiment_id', exp.id)
          .eq('is_variant', true);

        await supabase
          .from('funnel_pages')
          .update({ experiment_id: null })
          .eq('id', exp.funnel_page_id);

        winnersFound++;
        logger.info('Winner declared', { experimentId: exp.id, winnerId: best.id, pValue });
      }
    }

    return { checked: experiments.length, winnersFound };
  },
});
```

**Step 2: Typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/trigger/check-ab-experiments.ts
git commit -m "feat: scheduled task to check A/B experiment significance every 6 hours"
```

---

### Task 6: Filter Variants from Funnel Lists

**Files:**
- Modify: `src/app/(dashboard)/magnets/page.tsx`
- Modify: `src/app/(dashboard)/magnets/[id]/page.tsx`

**Context:** Variant funnel_pages should not appear in the magnets list or be directly accessible as standalone pages. Add `is_variant = false` filters to funnel queries.

**Step 1: Update magnets list page**

In `src/app/(dashboard)/magnets/page.tsx`, find the `funnel_pages` query and add `.eq('is_variant', false)`.

**Step 2: Update magnet detail page**

In `src/app/(dashboard)/magnets/[id]/page.tsx`, find the `funnel_pages` query (line 41-45) and add `.eq('is_variant', false)` to ensure the detail page loads the control, not a variant.

**Step 3: Typecheck and commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
git add src/app/(dashboard)/magnets/page.tsx src/app/(dashboard)/magnets/[id]/page.tsx
git commit -m "fix: filter variant funnel pages from magnets list and detail views"
```

---

### Task 7: Dashboard UI — ABTestPanel Component

**Files:**
- Create: `src/components/funnel/ABTestPanel.tsx`

**Context:** A client component that lives on the funnel editor page (inside FunnelBuilder, on the `thankyou` tab). Shows experiment status, variant comparison, live stats, and controls. This is the main user-facing UI for the feature.

**Step 1: Create the ABTestPanel component**

Create `src/components/funnel/ABTestPanel.tsx`. This component should:

1. **No active test state:** Show a card with "Optimize with A/B Testing" headline, a description explaining the feature, and a "New A/B Test" button.

2. **Test creation flow:**
   - Click "New A/B Test" → show a dropdown to pick the test field (Headline, Subline, Video, Pass Message)
   - On selection, call `POST /api/ab-experiments/suggest` to get AI suggestions
   - Show a loading state while AI generates
   - Display suggestions as selectable cards (each with the variant text and rationale)
   - Each suggestion has an "Edit" button to inline-edit the text
   - A "Custom" option to write your own variant
   - "Launch Test" button to call `POST /api/ab-experiments`

3. **Running test state:**
   - Show control vs variant side by side with the differing field highlighted
   - Live stats per variant: views, completions, completion rate
   - Simple horizontal bar chart comparing rates
   - Sample progress indicator: "23 / 50 minimum views" with progress bar
   - "Pause Test" and "Declare Winner" dropdown buttons

4. **Completed test state:**
   - Winner badge on the winning variant
   - Final stats + confidence percentage
   - "Run Another Test" button
   - Past tests in a collapsible list

The component polls `GET /api/ab-experiments/[id]` every 30 seconds when a test is running.

**Key UI patterns (match existing codebase):**
- Use inline styles with theme vars (`var(--ds-card)`, `var(--ds-text)`, etc.) — matching `ThankyouPage` style
- Or use Tailwind classes + shadcn/ui components — matching dashboard style
- Since this is a dashboard component, use Tailwind + shadcn/ui

**Step 2: Typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/funnel/ABTestPanel.tsx
git commit -m "feat: ABTestPanel dashboard component for creating and monitoring A/B tests"
```

---

### Task 8: Integrate ABTestPanel into FunnelBuilder

**Files:**
- Modify: `src/components/funnel/FunnelBuilder.tsx`
- Modify: `src/app/(dashboard)/magnets/[id]/page.tsx` (pass experiment data)

**Context:** Add the ABTestPanel to the `thankyou` tab of the FunnelBuilder. The panel sits below the thank-you page editor fields. The server component needs to fetch active experiment data and pass it down.

**Step 1: Update the magnet detail server component**

In `src/app/(dashboard)/magnets/[id]/page.tsx`, add a query to fetch the active experiment for this funnel:

```typescript
// After fetching funnelData (around line 55):
let activeExperiment = null;
if (funnelData) {
  const { data: expData } = await adminClient
    .from('ab_experiments')
    .select('id, name, status, test_field, winner_id, significance, min_sample_size, started_at, completed_at')
    .eq('funnel_page_id', funnelData.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  activeExperiment = expData;
}
```

Pass `activeExperiment` as a prop to `MagnetDetail` → `FunnelBuilder`.

**Step 2: Add ABTestPanel to FunnelBuilder's thankyou tab**

In `src/components/funnel/FunnelBuilder.tsx`, import ABTestPanel and render it at the bottom of the `thankyou` tab content, after the ThankyouPageEditor:

```typescript
import { ABTestPanel } from './ABTestPanel';

// In the thankyou tab rendering:
{activeTab === 'thankyou' && (
  <>
    <ThankyouPageEditor ... />
    <ABTestPanel
      funnelPageId={funnel.id}
      experiment={activeExperiment}
    />
  </>
)}
```

**Step 3: Typecheck and commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
git add src/components/funnel/FunnelBuilder.tsx src/app/(dashboard)/magnets/[id]/page.tsx
git commit -m "feat: integrate ABTestPanel into funnel builder thankyou tab"
```

---

### Task 9: Build, Deploy, and Deploy Trigger.dev

**Files:** None (deployment task)

**Step 1: Build**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build
```

**Step 2: Deploy to Vercel**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod
```

**Step 3: Deploy Trigger.dev tasks**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

**Step 4: Commit any build fixes and push**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && git push
```

---

### Task 10: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Context:** Per the post-feature workflow, add A/B testing documentation to CLAUDE.md covering the new tables, API routes, Trigger.dev task, and key files.

Add a new section after the Branding & Conversion Tracking section:

```markdown
## A/B Testing

Self-serve A/B testing for thank-you pages to maximize survey completion rate.

### How It Works

1. User picks a field to test (headline, subline, video, pass message) on the funnel builder
2. AI generates 3 variant suggestions; user can edit before launching
3. System clones the funnel_page row as a variant linked via `ab_experiments`
4. Server-side bucketing assigns visitors deterministically (SHA-256 of IP+UA+experiment_id)
5. Trigger.dev scheduled task (`check-ab-experiments`, every 6h) runs two-proportion z-test
6. At p < 0.05 with min 50 views per variant, auto-declares winner and promotes to control

### Key Tables

- `ab_experiments` — test metadata (status, test_field, winner_id, significance)
- `funnel_pages.experiment_id` / `is_variant` / `variant_label` — variant rows

### Key Files

- `src/app/api/ab-experiments/route.ts` — CRUD (list, create with variant clone)
- `src/app/api/ab-experiments/[id]/route.ts` — get with stats, pause/resume, declare winner, delete
- `src/app/api/ab-experiments/suggest/route.ts` — AI variant generation via Claude
- `src/trigger/check-ab-experiments.ts` — scheduled significance checker
- `src/components/funnel/ABTestPanel.tsx` — dashboard UI
- `src/app/p/[username]/[slug]/thankyou/page.tsx` — server-side bucketing logic
```

**Step 1: Update CLAUDE.md with the above section**

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add A/B testing documentation to CLAUDE.md"
```
