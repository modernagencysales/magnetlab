# Global Style Learning Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed human edit patterns back into every AI content generation prompt via a reviewed, compiled rule system.

**Architecture:** Weekly Trigger.dev task aggregates edit patterns → proposes rules in `cp_style_rules` → admin reviews on `/admin/learning` → approved rules compiled into `ai_prompt_templates` row → injected as `{{global_style_rules}}` into all 6 generation points.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), Trigger.dev v4, Claude Haiku (rule drafting), Zod, Jest, React (admin UI)

**Spec:** `docs/superpowers/specs/2026-03-25-global-style-learning-pipeline-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `supabase/migrations/20260325300000_style_rules.sql` | Create `cp_style_rules` table + seed `global-style-rules` prompt template |
| `src/server/repositories/style-rules.repo.ts` | CRUD for `cp_style_rules` table |
| `src/server/services/style-rules.service.ts` | Business logic: propose, approve/reject, compile |
| `src/lib/services/style-rules.ts` | `getGlobalStyleRules()` runtime helper |
| `src/lib/validations/style-rules.ts` | Zod schemas for API requests |
| `src/app/api/admin/style-rules/route.ts` | GET (list) + POST (create) |
| `src/app/api/admin/style-rules/[id]/route.ts` | PATCH (update status/text) |
| `src/app/api/admin/style-rules/compile/route.ts` | POST (manual compile trigger) |
| `src/trigger/propose-style-rules.ts` | Weekly aggregation + rule drafting task |
| `src/components/admin/StyleRulesSection.tsx` | Admin UI for proposed + active rules |
| `src/components/admin/LearningDashboard.tsx` | Learning dashboard wrapper (does not currently exist) |
| `src/app/(dashboard)/admin/learning/page.tsx` | Admin learning page route (does not currently exist) |
| `src/__tests__/lib/services/style-rules.test.ts` | Unit tests for compile + helper |
| `src/__tests__/api/admin/style-rules.test.ts` | API route tests |

### Modified Files

| File | Change |
|---|---|
| `src/lib/ai/content-pipeline/post-writer.ts` | Call `getGlobalStyleRules()`, add to interpolation |
| `src/lib/ai/content-pipeline/post-polish.ts` | Same pattern (uses slug `post-polish-rewrite`, NOT `post-polish`) |
| `src/lib/ai/content-pipeline/email-writer.ts` | Same pattern |
| `src/lib/ai/content-pipeline/mixer-prompt-builder.ts` | Add `globalStyleRules` parameter |
| `src/lib/ai/email-sequence-generator.ts` | Append global rules to system prompt |
| `src/lib/ai/generate-lead-magnet-content.ts` | Append global rules to system prompt |
| `src/components/admin/LearningDashboard.tsx` | Add StyleRulesSection |
| `src/app/(dashboard)/admin/learning/page.tsx` | Fetch style rules, pass to dashboard |

---

## Task 1: Database Migration + Seed

**Files:**
- Create: `supabase/migrations/20260325300000_style_rules.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Style rules table for the global style learning pipeline
-- Stores individual rules (proposed/approved/rejected) derived from edit patterns.
-- Approved rules are compiled into ai_prompt_templates row 'global-style-rules'.

CREATE TABLE cp_style_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'team')),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  pattern_name TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  source_edit_ids UUID[] DEFAULT '{}',
  frequency INT NOT NULL DEFAULT 1,
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'global' AND team_id IS NULL) OR
    (scope = 'team' AND team_id IS NOT NULL)
  )
);

ALTER TABLE cp_style_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on cp_style_rules"
  ON cp_style_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_cp_style_rules_scope_status ON cp_style_rules(scope, status);
CREATE INDEX idx_cp_style_rules_pattern ON cp_style_rules(pattern_name);

-- Seed the prompt template row (empty — will be populated when rules are approved)
INSERT INTO ai_prompt_templates (slug, name, category, description, system_prompt, user_prompt, model, temperature, max_tokens, variables, is_active)
VALUES (
  'global-style-rules',
  'Global Style Rules',
  'learning',
  'Compiled global style rules derived from human edit patterns. Auto-populated by the style learning pipeline.',
  '',
  '',
  'claude-haiku-4-5-20251001',
  0,
  0,
  '[]'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Seed the rule drafter prompt template
INSERT INTO ai_prompt_templates (slug, name, category, description, system_prompt, user_prompt, model, temperature, max_tokens, variables, is_active)
VALUES (
  'style-rule-drafter',
  'Style Rule Drafter',
  'learning',
  'Drafts concrete prompt instructions from classified edit patterns.',
  '',
  'You are analyzing patterns from human edits to AI-generated content. Based on the pattern below, write a single, specific prompt instruction that tells an AI content generator what to do differently.

Pattern name: {{pattern_name}}
Pattern descriptions from multiple edits:
{{pattern_descriptions}}

Example edit (before):
{{example_original}}

Example edit (after):
{{example_edited}}

Rules for your instruction:
- Be SPECIFIC — name exact phrases, formats, or behaviors to use/avoid
- Be ACTIONABLE — tell the AI what to do, not what was observed
- Be CONCISE — 1-3 sentences maximum
- Start with an imperative verb (Use, Avoid, Write, Break, Replace, etc.)

Return ONLY the instruction text, nothing else.',
  'claude-haiku-4-5-20251001',
  0.3,
  256,
  '[{"name":"pattern_name","description":"The classified pattern name","example":"added_specifics"},{"name":"pattern_descriptions","description":"All descriptions for this pattern across edits","example":"Replaced placeholder with real URL"},{"name":"example_original","description":"Original AI-generated text from one source edit","example":"[DOWNLOAD LINK]"},{"name":"example_edited","description":"Human-edited version","example":"https://example.com/checklist.pdf"}]'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;
```

- [ ] **Step 2: Apply migration to Supabase**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`

Or apply directly via Supabase execute_sql MCP tool.

- [ ] **Step 3: Verify tables exist**

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cp_style_rules' ORDER BY ordinal_position;
SELECT slug, name, category FROM ai_prompt_templates WHERE slug IN ('global-style-rules', 'style-rule-drafter');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260325300000_style_rules.sql
git commit -m "feat: add cp_style_rules table and seed prompt templates for style learning pipeline"
```

---

## Task 2: Repository Layer

**Files:**
- Create: `src/server/repositories/style-rules.repo.ts`
- Test: `src/__tests__/lib/services/style-rules.test.ts` (started here, expanded in Task 3)

- [ ] **Step 1: Write the repository**

```typescript
/** Style Rules Repository. CRUD for cp_style_rules table. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Column Constants ──────────────────────────────────────────────────────

const STYLE_RULE_COLUMNS =
  'id, scope, team_id, pattern_name, rule_text, source_edit_ids, frequency, confidence, status, proposed_at, reviewed_at, reviewed_by, updated_at, created_at';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface StyleRuleRow {
  id: string;
  scope: 'global' | 'team';
  team_id: string | null;
  pattern_name: string;
  rule_text: string;
  source_edit_ids: string[];
  frequency: number;
  confidence: number;
  status: 'proposed' | 'approved' | 'rejected';
  proposed_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface StyleRuleInsertInput {
  scope?: 'global' | 'team';
  team_id?: string | null;
  pattern_name: string;
  rule_text: string;
  source_edit_ids?: string[];
  frequency?: number;
  confidence?: number;
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function listRules(filters?: {
  status?: string;
  scope?: string;
}): Promise<StyleRuleRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_style_rules')
    .select(STYLE_RULE_COLUMNS)
    .order('frequency', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.scope) {
    query = query.eq('scope', filters.scope);
  }

  const { data, error } = await query;
  if (error) throw new Error(`style-rules.listRules: ${error.message}`);
  return (data ?? []) as StyleRuleRow[];
}

export async function getRuleById(id: string): Promise<StyleRuleRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_style_rules')
    .select(STYLE_RULE_COLUMNS)
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as StyleRuleRow;
}

export async function getExistingPatternNames(): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_style_rules')
    .select('pattern_name');
  if (error) throw new Error(`style-rules.getExistingPatternNames: ${error.message}`);
  return (data ?? []).map((r) => r.pattern_name);
}

export async function getApprovedGlobalRules(): Promise<StyleRuleRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_style_rules')
    .select(STYLE_RULE_COLUMNS)
    .eq('scope', 'global')
    .eq('status', 'approved')
    .order('frequency', { ascending: false });
  if (error) throw new Error(`style-rules.getApprovedGlobalRules: ${error.message}`);
  return (data ?? []) as StyleRuleRow[];
}

// ─── Writes ────────────────────────────────────────────────────────────────

export async function insertRule(input: StyleRuleInsertInput): Promise<StyleRuleRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_style_rules')
    .insert({
      scope: input.scope ?? 'global',
      team_id: input.team_id ?? null,
      pattern_name: input.pattern_name,
      rule_text: input.rule_text,
      source_edit_ids: input.source_edit_ids ?? [],
      frequency: input.frequency ?? 1,
      confidence: input.confidence ?? 0,
    })
    .select(STYLE_RULE_COLUMNS)
    .single();
  if (error) throw new Error(`style-rules.insertRule: ${error.message}`);
  return data as StyleRuleRow;
}

export async function insertRulesBatch(inputs: StyleRuleInsertInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const supabase = createSupabaseAdminClient();
  const rows = inputs.map((input) => ({
    scope: input.scope ?? 'global',
    team_id: input.team_id ?? null,
    pattern_name: input.pattern_name,
    rule_text: input.rule_text,
    source_edit_ids: input.source_edit_ids ?? [],
    frequency: input.frequency ?? 1,
    confidence: input.confidence ?? 0,
  }));
  const { error } = await supabase.from('cp_style_rules').insert(rows);
  if (error) throw new Error(`style-rules.insertRulesBatch: ${error.message}`);
  return rows.length;
}

const ALLOWED_UPDATE_FIELDS = ['status', 'rule_text', 'reviewed_at', 'reviewed_by'] as const;

export async function updateRule(
  id: string,
  updates: {
    status?: 'proposed' | 'approved' | 'rejected';
    rule_text?: string;
    reviewed_at?: string;
    reviewed_by?: string;
  }
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (updates[field] !== undefined) safeUpdates[field] = updates[field];
  }
  const { error } = await supabase
    .from('cp_style_rules')
    .update(safeUpdates)
    .eq('id', id);
  if (error) throw new Error(`style-rules.updateRule: ${error.message}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/repositories/style-rules.repo.ts
git commit -m "feat: add style-rules repository layer"
```

---

## Task 3: Service Layer (Compile + Helper)

**Files:**
- Create: `src/server/services/style-rules.service.ts`
- Create: `src/lib/services/style-rules.ts`
- Create: `src/lib/validations/style-rules.ts`
- Test: `src/__tests__/lib/services/style-rules.test.ts`

- [ ] **Step 1: Write Zod validations**

```typescript
/** Style Rules Validation Schemas. Zod schemas for style rules API requests. */

import { z } from 'zod';

export const StyleRuleCreateSchema = z.object({
  rule_text: z.string().min(10, 'Rule text must be at least 10 characters'),
  pattern_name: z.string().min(1).optional().default('manual'),
  scope: z.enum(['global', 'team']).default('global'),
  team_id: z.string().uuid().nullable().optional(),
});

export type StyleRuleCreateInput = z.infer<typeof StyleRuleCreateSchema>;

export const StyleRulePatchSchema = z.object({
  status: z.enum(['proposed', 'approved', 'rejected']).optional(),
  rule_text: z.string().min(10, 'Rule text must be at least 10 characters').optional(),
}).refine(
  (data) => data.status !== undefined || data.rule_text !== undefined,
  { message: 'At least one field must be provided' }
);

export type StyleRulePatchInput = z.infer<typeof StyleRulePatchSchema>;
```

- [ ] **Step 2: Write the compile function and runtime helper**

File: `src/lib/services/style-rules.ts`

```typescript
/** Style Rules runtime helpers. Used by generation points to inject global rules. */

import { getPrompt } from '@/lib/services/prompt-registry';
import { logError } from '@/lib/utils/logger';

/**
 * Load compiled global style rules from prompt registry.
 * Returns empty string if no rules exist or on any error.
 * Never throws — generation must not break due to style rules.
 */
export async function getGlobalStyleRules(): Promise<string> {
  try {
    const template = await getPrompt('global-style-rules');
    return template.user_prompt || '';
  } catch (err) {
    logError('style-rules', err, { slug: 'global-style-rules' });
    return '';
  }
}

/**
 * Compile approved global rules into a numbered instruction block.
 * Pure function — takes rules, returns compiled text.
 */
export function compileRuleText(rules: Array<{ rule_text: string }>): string {
  if (rules.length === 0) return '';

  const numbered = rules.map((r, i) => `${i + 1}. ${r.rule_text}`).join('\n\n');
  return `When generating any content, follow these rules learned from human editing patterns:\n\n${numbered}`;
}
```

- [ ] **Step 3: Write the service layer**

File: `src/server/services/style-rules.service.ts`

```typescript
/**
 * Style Rules Service.
 * Business logic for proposing, reviewing, and compiling style rules.
 * Never imports from Next.js HTTP layer.
 */

import * as repo from '@/server/repositories/style-rules.repo';
import { savePrompt } from '@/lib/services/prompt-registry';
import { compileRuleText } from '@/lib/services/style-rules';
import { logInfo } from '@/lib/utils/logger';
import type { StyleRuleCreateInput, StyleRulePatchInput } from '@/lib/validations/style-rules';

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function listRules(filters?: { status?: string; scope?: string }) {
  return repo.listRules(filters);
}

export async function getRuleById(id: string) {
  return repo.getRuleById(id);
}

// ─── Writes ────────────────────────────────────────────────────────────────

export async function createRule(input: StyleRuleCreateInput) {
  const rule = await repo.insertRule({
    pattern_name: input.pattern_name,
    rule_text: input.rule_text,
    scope: input.scope,
    team_id: input.team_id ?? null,
  });
  return rule;
}

export async function updateRule(id: string, input: StyleRulePatchInput, reviewerId: string) {
  const rule = await repo.getRuleById(id);
  if (!rule) {
    throw Object.assign(new Error('Rule not found'), { statusCode: 404 });
  }

  const updates: Parameters<typeof repo.updateRule>[1] = {};

  if (input.rule_text !== undefined) {
    updates.rule_text = input.rule_text;
  }

  if (input.status !== undefined) {
    updates.status = input.status;
    updates.reviewed_at = new Date().toISOString();
    updates.reviewed_by = reviewerId;
  }

  await repo.updateRule(id, updates);

  // Recompile if status changed or rule_text changed on an approved rule
  if (input.status !== undefined || (input.rule_text !== undefined && rule.status === 'approved')) {
    await compileGlobalRules(reviewerId);
  }

  return { ...rule, ...updates };
}

// ─── Compile ───────────────────────────────────────────────────────────────

export async function compileGlobalRules(changedBy: string): Promise<{ ruleCount: number }> {
  const approvedRules = await repo.getApprovedGlobalRules();
  const compiledText = compileRuleText(approvedRules);

  await savePrompt(
    'global-style-rules',
    { user_prompt: compiledText },
    changedBy,
    `Compiled ${approvedRules.length} approved global style rules`
  );

  logInfo('style-rules', 'Global rules compiled', {
    ruleCount: approvedRules.length,
    textLength: compiledText.length,
  });

  return { ruleCount: approvedRules.length };
}
```

- [ ] **Step 4: Write unit tests**

File: `src/__tests__/lib/services/style-rules.test.ts`

```typescript
import { compileRuleText, getGlobalStyleRules } from '@/lib/services/style-rules';

// Mock the prompt registry
jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { getPrompt } from '@/lib/services/prompt-registry';
const mockGetPrompt = getPrompt as jest.MockedFunction<typeof getPrompt>;

describe('style-rules', () => {
  describe('compileRuleText', () => {
    it('returns empty string for empty rules', () => {
      expect(compileRuleText([])).toBe('');
    });

    it('compiles single rule into numbered format with preamble', () => {
      const result = compileRuleText([{ rule_text: 'Never use placeholder text.' }]);
      expect(result).toContain('follow these rules');
      expect(result).toContain('1. Never use placeholder text.');
    });

    it('compiles multiple rules in order', () => {
      const result = compileRuleText([
        { rule_text: 'Rule one.' },
        { rule_text: 'Rule two.' },
        { rule_text: 'Rule three.' },
      ]);
      expect(result).toContain('1. Rule one.');
      expect(result).toContain('2. Rule two.');
      expect(result).toContain('3. Rule three.');
    });

    it('separates rules with double newlines', () => {
      const result = compileRuleText([
        { rule_text: 'A.' },
        { rule_text: 'B.' },
      ]);
      expect(result).toContain('1. A.\n\n2. B.');
    });
  });

  describe('getGlobalStyleRules', () => {
    it('returns user_prompt from the prompt registry', async () => {
      mockGetPrompt.mockResolvedValue({
        slug: 'global-style-rules',
        user_prompt: '1. Never use placeholders.',
      } as ReturnType<typeof getPrompt> extends Promise<infer T> ? T : never);

      const result = await getGlobalStyleRules();
      expect(result).toBe('1. Never use placeholders.');
      expect(mockGetPrompt).toHaveBeenCalledWith('global-style-rules');
    });

    it('returns empty string when user_prompt is empty', async () => {
      mockGetPrompt.mockResolvedValue({
        slug: 'global-style-rules',
        user_prompt: '',
      } as ReturnType<typeof getPrompt> extends Promise<infer T> ? T : never);

      const result = await getGlobalStyleRules();
      expect(result).toBe('');
    });

    it('returns empty string and logs error when prompt registry throws', async () => {
      mockGetPrompt.mockRejectedValue(new Error('No prompt found'));

      const result = await getGlobalStyleRules();
      expect(result).toBe('');
    });
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm jest "style-rules"`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/style-rules.ts src/server/services/style-rules.service.ts src/lib/validations/style-rules.ts src/__tests__/lib/services/style-rules.test.ts
git commit -m "feat: add style-rules service, compile function, and runtime helper"
```

---

## Task 4: API Routes

**Files:**
- Create: `src/app/api/admin/style-rules/route.ts`
- Create: `src/app/api/admin/style-rules/[id]/route.ts`
- Create: `src/app/api/admin/style-rules/compile/route.ts`
- Test: `src/__tests__/api/admin/style-rules.test.ts`

- [ ] **Step 1: Write GET + POST route**

File: `src/app/api/admin/style-rules/route.ts`

```typescript
/** Style Rules Admin API. List and create style rules. Super-admin only. */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as service from '@/server/services/style-rules.service';
import { StyleRuleCreateSchema } from '@/lib/validations/style-rules';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') || undefined;
  const scope = searchParams.get('scope') || undefined;

  const rules = await service.listRules({ status, scope });
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = StyleRuleCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rule = await service.createRule(parsed.data);
  return NextResponse.json({ rule }, { status: 201 });
}
```

- [ ] **Step 2: Write PATCH route**

File: `src/app/api/admin/style-rules/[id]/route.ts`

```typescript
/** Style Rules Admin API. Update rule status or text. Super-admin only. */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as service from '@/server/services/style-rules.service';
import { StyleRulePatchSchema } from '@/lib/validations/style-rules';
import { logError } from '@/lib/utils/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = StyleRulePatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await service.updateRule(id, parsed.data, session.user.id);
    return NextResponse.json({ rule: updated });
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode || 500;
    logError('admin/style-rules', err, { ruleId: id });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: statusCode }
    );
  }
}
```

- [ ] **Step 3: Write compile route**

File: `src/app/api/admin/style-rules/compile/route.ts`

```typescript
/** Manual trigger to recompile approved global rules. Super-admin only. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as service from '@/server/services/style-rules.service';
import { logError } from '@/lib/utils/logger';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await service.compileGlobalRules(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    logError('admin/style-rules/compile', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Compile failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Write API route tests**

File: `src/__tests__/api/admin/style-rules.test.ts`

Test cases to cover:
- GET: 401 without session, 403 non-admin, 200 returns rules array, filters by status param
- POST: 401/403 auth, 400 on invalid body (missing rule_text, too short), 201 creates rule
- PATCH: 401/403 auth, 404 on bad ID, 200 updates status, 200 updates rule_text
- POST compile: 401/403 auth, 200 returns ruleCount

Mock `@/lib/auth` (return session), `@/lib/auth/super-admin` (return true/false), and `@/server/services/style-rules.service` (mock service methods). Follow the pattern in existing test files like `src/__tests__/api/content-queue/review-funnel.test.ts`.

- [ ] **Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm jest "style-rules"`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/style-rules/ src/__tests__/api/admin/style-rules.test.ts
git commit -m "feat: add style-rules admin API routes (GET, POST, PATCH, compile)"
```

---

## Task 5: Injection into Generation Points

**Files:**
- Modify: `src/lib/ai/content-pipeline/post-writer.ts:128-170` (writePost function)
- Modify: `src/lib/ai/content-pipeline/post-polish.ts` (polishPost function)
- Modify: `src/lib/ai/content-pipeline/email-writer.ts` (writeNewsletterEmail function)
- Modify: `src/lib/ai/content-pipeline/mixer-prompt-builder.ts:275` (buildMixerPrompt signature)
- Modify: `src/lib/ai/email-sequence-generator.ts` (system prompt)
- Modify: `src/lib/ai/generate-lead-magnet-content.ts` (system prompt)

- [ ] **Step 1: Wire post-writer.ts**

Add import at top:
```typescript
import { getGlobalStyleRules } from '@/lib/services/style-rules';
```

In `writePost()`, before the `interpolatePrompt` call (around line 158), add:
```typescript
const globalRules = await getGlobalStyleRules();
```

Then add `global_style_rules: globalRules` to the interpolation variables object (line 159-170).

The `post-writer-freeform` prompt template in the DB needs `{{global_style_rules}}` added after `{{style_guidelines}}`. This can be done via the admin prompt editor or a migration. For now, add a note in the code:

```typescript
// NOTE: The post-writer-freeform template must include {{global_style_rules}} after {{style_guidelines}}.
// If the template doesn't include it, the variable is silently removed by interpolatePrompt().
```

- [ ] **Step 2: Wire post-polish.ts**

Same pattern — import `getGlobalStyleRules`, call it, add to interpolation variables. **Important:** This file uses slug `post-polish-rewrite` (not `post-polish`). The DB template update in Step 7 must target the correct slug.

- [ ] **Step 3: Wire email-writer.ts**

Same pattern — import `getGlobalStyleRules`, call it, add to interpolation variables.

- [ ] **Step 4: Wire mixer-prompt-builder.ts**

Change the function signature at line 275:

```typescript
export function buildMixerPrompt(
  input: MixerPromptInput,
  baseStyleGuidelines: string,
  globalStyleRules?: string
): string {
```

Before the output format section (around line 325), add:

```typescript
if (globalStyleRules) {
  parts.push(`\n## Learned Style Rules\n${globalStyleRules}`);
}
```

Then update the caller of `buildMixerPrompt` (in the mixer API route or Trigger task) to fetch and pass `globalStyleRules`:

```typescript
const globalRules = await getGlobalStyleRules();
const prompt = buildMixerPrompt(input, getBaseStyleGuidelines(), globalRules);
```

- [ ] **Step 5: Wire email-sequence-generator.ts**

This uses a hardcoded system prompt. Import `getGlobalStyleRules` and append it to the system prompt in the generation function:

```typescript
import { getGlobalStyleRules } from '@/lib/services/style-rules';

// In the generation function, before the Claude API call:
const globalRules = await getGlobalStyleRules();
const systemPrompt = globalRules
  ? `${EMAIL_SEQUENCE_SYSTEM_PROMPT}\n\n## Learned Style Rules\n${globalRules}`
  : EMAIL_SEQUENCE_SYSTEM_PROMPT;
```

- [ ] **Step 6: Wire generate-lead-magnet-content.ts**

Same pattern as email-sequence-generator — append global rules to the hardcoded system prompt.

- [ ] **Step 7: Update prompt templates in DB**

Add `{{global_style_rules}}` to the `user_prompt` field of these templates via admin panel or execute_sql:
- `post-writer-freeform` — after `{{style_guidelines}}`
- `post-polish` — after existing style section
- `email-newsletter` — after existing style section

```sql
UPDATE ai_prompt_templates
SET user_prompt = replace(user_prompt, '{{style_guidelines}}', '{{style_guidelines}}

{{global_style_rules}}')
WHERE slug = 'post-writer-freeform';
```

Repeat for `post-polish-rewrite` (NOT `post-polish` — check the actual slug used in `post-polish.ts` line 335) and `email-newsletter`. Check exact insertion points first by reading current templates.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/content-pipeline/post-writer.ts src/lib/ai/content-pipeline/post-polish.ts src/lib/ai/content-pipeline/email-writer.ts src/lib/ai/content-pipeline/mixer-prompt-builder.ts src/lib/ai/email-sequence-generator.ts src/lib/ai/generate-lead-magnet-content.ts
git commit -m "feat: inject global style rules into all 6 content generation points"
```

---

## Task 6: Weekly Proposal Task (Trigger.dev)

**Files:**
- Create: `src/trigger/propose-style-rules.ts`

- [ ] **Step 1: Write the Trigger.dev task**

```typescript
/** Propose style rules from aggregated edit patterns. Runs weekly. */

import { task, schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
import * as styleRulesRepo from '@/server/repositories/style-rules.repo';

interface PatternAggregate {
  pattern_name: string;
  descriptions: string[];
  frequency: number;
  source_edit_ids: string[];
  example_original: string;
  example_edited: string;
}

export const proposeStyleRules = task({
  id: 'propose-style-rules',
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // 1. Find the latest proposal time to avoid reprocessing
    const existingRules = await styleRulesRepo.listRules();
    const latestProposal = existingRules.reduce<string | null>((max, r) => {
      if (!max || r.proposed_at > max) return r.proposed_at;
      return max;
    }, null);

    // 2. Fetch edits since last proposal (or all if first run)
    let query = supabase
      .from('cp_edit_history')
      .select('id, original_text, edited_text, auto_classified_changes, created_at')
      .not('auto_classified_changes', 'is', null)
      .order('created_at', { ascending: true });

    if (latestProposal) {
      query = query.gt('created_at', latestProposal);
    }

    const { data: edits, error } = await query;
    if (error) throw new Error(`Failed to fetch edits: ${error.message}`);
    if (!edits || edits.length === 0) {
      logger.info('No new edits since last proposal run');
      return { status: 'no_edits' as const, proposed: 0 };
    }

    logger.info('Processing edits for rule proposals', { editCount: edits.length });

    // 3. Aggregate patterns across all edits
    const patternMap = new Map<string, PatternAggregate>();
    for (const edit of edits) {
      const patterns = edit.auto_classified_changes?.patterns;
      if (!Array.isArray(patterns)) continue;

      for (const p of patterns) {
        const key = p.pattern as string;
        const existing = patternMap.get(key);
        if (existing) {
          existing.descriptions.push(p.description as string);
          existing.frequency++;
          existing.source_edit_ids.push(edit.id);
        } else {
          patternMap.set(key, {
            pattern_name: key,
            descriptions: [p.description as string],
            frequency: 1,
            source_edit_ids: [edit.id],
            example_original: edit.original_text,
            example_edited: edit.edited_text,
          });
        }
      }
    }

    // 4. Filter: frequency >= 2, not already in cp_style_rules
    const existingPatterns = new Set(await styleRulesRepo.getExistingPatternNames());
    const candidates = Array.from(patternMap.values()).filter(
      (p) => p.frequency >= 2 && !existingPatterns.has(p.pattern_name)
    );

    if (candidates.length === 0) {
      logger.info('No new patterns qualifying for proposals');
      return { status: 'no_candidates' as const, proposed: 0 };
    }

    logger.info('Drafting rules for candidates', { count: candidates.length });

    // 5. Draft rules using Claude Haiku
    const template = await getPrompt('style-rule-drafter');
    const client = getAnthropicClient('style-rule-drafter');
    const proposals: styleRulesRepo.StyleRuleInsertInput[] = [];

    for (const candidate of candidates) {
      try {
        const prompt = interpolatePrompt(template.user_prompt, {
          pattern_name: candidate.pattern_name,
          pattern_descriptions: candidate.descriptions.join('\n- '),
          example_original: candidate.example_original.substring(0, 500),
          example_edited: candidate.example_edited.substring(0, 500),
        });

        const response = await client.messages.create({
          model: template.model,
          max_tokens: template.max_tokens,
          temperature: template.temperature,
          messages: [{ role: 'user', content: prompt }],
        });

        const ruleText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
        if (ruleText.length < 10) continue; // Skip bad drafts

        proposals.push({
          pattern_name: candidate.pattern_name,
          rule_text: ruleText,
          source_edit_ids: candidate.source_edit_ids,
          frequency: candidate.frequency,
          confidence: Math.min(candidate.frequency / 10, 1.0),
        });
      } catch (err) {
        logger.error('Failed to draft rule', {
          pattern: candidate.pattern_name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 6. Insert proposals
    const inserted = await styleRulesRepo.insertRulesBatch(proposals);
    logger.info('Style rule proposals created', { count: inserted });

    return { status: 'proposed' as const, proposed: inserted };
  },
});

// Weekly schedule — Sunday 4:30 AM UTC (staggered 1hr after evolve-writing-style at 3:30 AM)
export const weeklyStyleRuleProposal = schedules.task({
  id: 'weekly-style-rule-proposal',
  cron: '30 4 * * 0', // Sunday 4:30 AM UTC
  maxDuration: 300,
  run: async () => {
    await proposeStyleRules.trigger({});
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/trigger/propose-style-rules.ts
git commit -m "feat: add weekly propose-style-rules Trigger.dev task"
```

---

## Task 7: Admin UI

**Files:**
- Create: `src/components/admin/StyleRulesSection.tsx`
- Create: `src/components/admin/LearningDashboard.tsx` (does NOT exist yet — create from scratch)
- Create: `src/app/(dashboard)/admin/learning/page.tsx` (does NOT exist yet — create from scratch)

**Note:** The API routes at `/api/admin/learning/` exist but there is no frontend page or dashboard component. Both must be created. The existing API returns `{ editActivity, profiles }` — the new page will fetch this plus style rules data.

- [ ] **Step 1: Write the StyleRulesSection component**

```typescript
'use client';

/** Style Rules Section. Proposed + active rules for the admin learning dashboard. */

import { useState } from 'react';
import { Check, X, Edit2, Plus, RefreshCw } from 'lucide-react';
import { Badge } from '@magnetlab/magnetui';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StyleRule {
  id: string;
  pattern_name: string;
  rule_text: string;
  frequency: number;
  confidence: number;
  status: 'proposed' | 'approved' | 'rejected';
  proposed_at: string;
  reviewed_at: string | null;
}

interface StyleRulesSectionProps {
  rules: StyleRule[];
  onRefresh: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StyleRulesSection({ rules, onRefresh }: StyleRulesSectionProps) {
  const proposed = rules.filter((r) => r.status === 'proposed');
  const approved = rules.filter((r) => r.status === 'approved');

  return (
    <div className="space-y-8">
      {/* Proposed Rules */}
      {proposed.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Proposed Rules ({proposed.length})
          </h3>
          <div className="space-y-3">
            {proposed.map((rule) => (
              <ProposedRuleCard key={rule.id} rule={rule} onAction={onRefresh} />
            ))}
          </div>
        </section>
      )}

      {/* Active Rules */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Active Rules ({approved.length})
          </h3>
          <div className="flex gap-2">
            <CreateRuleButton onCreated={onRefresh} />
            <button
              onClick={async () => {
                await fetch('/api/admin/style-rules/compile', { method: 'POST' });
                onRefresh();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Recompile
            </button>
          </div>
        </div>
        {approved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active rules yet. Approve proposed rules or create one manually.
          </p>
        ) : (
          <div className="space-y-3">
            {approved.map((rule) => (
              <ActiveRuleCard key={rule.id} rule={rule} onAction={onRefresh} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ProposedRuleCard({ rule, onAction }: { rule: StyleRule; onAction: () => void }) {
  const [editText, setEditText] = useState(rule.rule_text);
  const [loading, setLoading] = useState(false);

  async function handleAction(status: 'approved' | 'rejected') {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/style-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rule_text: editText !== rule.rule_text ? editText : undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('Failed to update rule:', body.error || res.statusText);
        return;
      }
      onAction();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <Badge variant="outline">{rule.pattern_name}</Badge>
        <span className="text-xs text-muted-foreground">Seen in {rule.frequency} edits</span>
      </div>
      <textarea
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] mb-3"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => handleAction('rejected')}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Reject
        </button>
        <button
          onClick={() => handleAction('approved')}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
      </div>
    </div>
  );
}

function ActiveRuleCard({ rule, onAction }: { rule: StyleRule; onAction: () => void }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(rule.rule_text);

  async function handleSave() {
    await fetch(`/api/admin/style-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_text: editText }),
    });
    setEditing(false);
    onAction();
  }

  async function handleDeactivate() {
    await fetch(`/api/admin/style-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    onAction();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <Badge>{rule.pattern_name}</Badge>
        <span className="text-xs text-muted-foreground">{rule.frequency}x</span>
      </div>
      {editing ? (
        <>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] mb-3"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground">Save</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-foreground mb-3">{rule.rule_text}</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent">
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={handleDeactivate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20">
              <X className="h-3.5 w-3.5" /> Deactivate
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateRuleButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [ruleText, setRuleText] = useState('');

  async function handleCreate() {
    if (ruleText.length < 10) return;
    await fetch('/api/admin/style-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_text: ruleText, pattern_name: 'manual', scope: 'global' }),
    });
    setRuleText('');
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent"
      >
        <Plus className="h-3.5 w-3.5" /> Add Rule
      </button>
    );
  }

  return (
    <div className="flex gap-2 items-start">
      <textarea
        value={ruleText}
        onChange={(e) => setRuleText(e.target.value)}
        placeholder="Write a specific style instruction..."
        className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[40px] w-64"
      />
      <button onClick={handleCreate} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground">Create</button>
      <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground">Cancel</button>
    </div>
  );
}
```

- [ ] **Step 2: Create LearningDashboard component**

Create `src/components/admin/LearningDashboard.tsx` from scratch. This is a client component that:

1. Accepts `styleRules` array and `onRefreshRules` callback as props
2. Renders `<StyleRulesSection>` at the top
3. Below that, renders existing edit activity data (fetch from `/api/admin/learning` client-side using SWR or useEffect)
4. Shows pattern frequencies, edit counts, and recent edits (the data the `/api/admin/learning` GET route already returns)

Keep this component focused on layout/composition — the `StyleRulesSection` handles all rule management.

- [ ] **Step 3: Create the admin learning page**

Create `src/app/(dashboard)/admin/learning/page.tsx` from scratch. This is a server component that:

1. Checks auth + super admin (same pattern as `/api/admin/*` routes)
2. Fetches initial style rules data server-side via direct service call (not fetch)
3. Renders the `LearningDashboard` client component, passing style rules as initial props
4. The client component handles refresh by re-fetching from `/api/admin/style-rules` and `/api/admin/learning`

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/StyleRulesSection.tsx src/components/admin/LearningDashboard.tsx "src/app/(dashboard)/admin/learning/page.tsx"
git commit -m "feat: add admin learning dashboard with style rules management"
```

---

## Task 8: Seed Initial Proposals from Existing Data

**Files:** No new files — run the propose task manually.

- [ ] **Step 1: Trigger the proposal task manually**

Either via Trigger.dev dashboard or by calling:

```typescript
await proposeStyleRules.trigger({});
```

From a one-off script or the Trigger.dev test UI. This will process the existing 33 classified edits and propose rules for patterns with frequency >= 2.

- [ ] **Step 2: Review proposals in admin UI**

Navigate to `/admin/learning`, review the proposed rules, approve the good ones, reject or edit the rest.

- [ ] **Step 3: Verify compilation**

After approving rules, verify:
```sql
SELECT slug, length(user_prompt) as compiled_length
FROM ai_prompt_templates
WHERE slug = 'global-style-rules';
```

The `user_prompt` should contain the compiled numbered list of approved rules.

---

## Task 9: Deploy + Verify

- [ ] **Step 1: Run full test suite**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: Clean (no errors).

- [ ] **Step 3: Deploy Trigger.dev tasks**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB pnpm dlx trigger.dev@4.3.3 deploy`

Verify new tasks appear: `propose-style-rules`, `weekly-style-rule-proposal`

- [ ] **Step 4: Deploy to Vercel**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod`

- [ ] **Step 5: Smoke test**

1. Visit `/admin/learning` — verify style rules section renders
2. Create a manual rule, approve it — verify it compiles
3. Generate a test post — verify `getGlobalStyleRules()` returns the compiled rules (check logs)
