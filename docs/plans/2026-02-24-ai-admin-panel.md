# AI Admin Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an internal admin panel at `/admin/prompts` and `/admin/learning` where super-admins can view, edit, version, and rollback all AI prompt templates used in magnetlab's content pipeline, plus observe the self-learning system.

**Architecture:** DB-backed prompt registry (`ai_prompt_templates` + `ai_prompt_versions`) with in-memory cache. All 14+ hardcoded prompts extracted to DB. AI modules fetch prompts from registry at runtime with fallback to hardcoded defaults. Admin UI inside the existing dashboard, hidden from non-super-admins via `is_super_admin` column on `users` table.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL), Tailwind + shadcn/ui, `diff` npm package for version diffs.

---

### Task 1: Database Migration — Tables + Super-Admin Column

**Files:**
- Create: `supabase/migrations/20260224000000_ai_prompt_registry.sql`

**Step 1: Write the migration SQL**

```sql
-- AI Prompt Registry tables + super-admin flag

-- Super-admin flag on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Prompt templates
CREATE TABLE ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  user_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  temperature FLOAT NOT NULL DEFAULT 1.0,
  max_tokens INTEGER NOT NULL DEFAULT 4000,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Version history (snapshot on every save)
CREATE TABLE ai_prompt_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  user_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  temperature FLOAT NOT NULL DEFAULT 1.0,
  max_tokens INTEGER NOT NULL DEFAULT 4000,
  change_note TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prompt_id, version)
);

-- Indexes
CREATE INDEX idx_ai_prompt_templates_slug ON ai_prompt_templates(slug);
CREATE INDEX idx_ai_prompt_templates_category ON ai_prompt_templates(category);
CREATE INDEX idx_ai_prompt_versions_prompt_id ON ai_prompt_versions(prompt_id);
CREATE INDEX idx_ai_prompt_versions_prompt_version ON ai_prompt_versions(prompt_id, version DESC);

-- No RLS — these are admin-only tables, protected at the route level
```

**Step 2: Push the migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`
Expected: Migration applies successfully.

**Step 3: Set your user as super-admin**

Run a SQL query via Supabase dashboard or CLI:
```sql
UPDATE users SET is_super_admin = true WHERE email = '<your-email>';
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260224000000_ai_prompt_registry.sql
git commit -m "feat: add ai_prompt_templates + ai_prompt_versions tables and is_super_admin column"
```

---

### Task 2: Prompt Defaults — Extract All Hardcoded Prompts

**Files:**
- Create: `src/lib/ai/content-pipeline/prompt-defaults.ts`

**Step 1: Write the defaults map**

This file captures every hardcoded prompt as a typed constant map. Each entry corresponds to a prompt template that will later be seeded into the DB. The prompts use `{{variable}}` placeholders where runtime values get injected.

```typescript
// src/lib/ai/content-pipeline/prompt-defaults.ts
//
// Hardcoded prompt defaults — used as fallback when DB prompt is inactive or missing.
// Each key is the prompt slug. Keep in sync with DB seeds.

export interface PromptDefault {
  slug: string;
  name: string;
  category: 'content_writing' | 'knowledge' | 'learning' | 'email' | 'scoring';
  description: string;
  system_prompt: string;
  user_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  variables: Array<{ name: string; description: string; example: string }>;
}

export const PROMPT_DEFAULTS: Record<string, PromptDefault> = {};
```

Then populate `PROMPT_DEFAULTS` with entries for each of the 14+ prompts. For each prompt, copy the EXACT current prompt text from the corresponding source file and replace the dynamic `${...}` interpolations with `{{variable_name}}` placeholders.

**Important:** This is the largest single file in the feature. Each prompt entry follows this pattern:

```typescript
PROMPT_DEFAULTS['post-writer-freeform'] = {
  slug: 'post-writer-freeform',
  name: 'Post Writer (Freeform)',
  category: 'content_writing',
  description: 'Writes a LinkedIn post from a content idea using freeform style (no template). Used by writePostFreeform() in post-writer.ts.',
  system_prompt: '', // This prompt uses a single user message, no system prompt
  user_prompt: `You are writing a LinkedIn post. Write the post without any preamble. Your first word is the first word of the post.

{{style_guidelines}}
{{voice_section}}

Audience: {{target_audience}}
What this means for your writing:
- Match technical depth to their sophistication level
- Reference their specific reality and daily frustrations
- Don't write like you're introducing basic concepts
- Use "you" to speak directly to them
- If the post doesn't feel like it was written specifically for this person, rewrite it.

CONTEXT FOR THIS POST:
Title: {{idea_title}}
Core Insight: {{idea_core_insight}}
Full Context: {{idea_full_context}}
Why Post-Worthy: {{idea_why_post_worthy}}
Content Type: {{idea_content_type}}
{{knowledge_section}}
Using this context:
- Pull exact numbers and metrics
- Use the specific stories and examples provided. Do not generalize them.
- Include step-by-step details when a process is described
- Preserve memorable phrasing when it's strong

Post structure by type:
Story/Lesson: Hook with outcome > Setup situation > Mistake/turning point > Consequence > Takeaway
Framework/Process: Hook with result > Why it matters > Numbered steps with specifics
Contrarian/Reframe: Bold claim > What most people do wrong > Why it fails > What to do instead
Trend/Observation: Hook with shift > How it used to work > What changed > What to do

Length: Either SHORT (under 100 words, punchy, one idea) or LONG (300+ words, comprehensive). Pick based on how much substance the idea has.

Now write the post. Return ONLY valid JSON: {"content": "the post", "variations": [{"id": "v1", "content": "variation 1", "hook_type": "type"}, {"id": "v2", "content": "variation 2", "hook_type": "type"}], "dm_template": "DM template", "cta_word": "word"}`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 4000,
  variables: [
    { name: 'style_guidelines', description: 'Base style guidelines (from getBaseStyleGuidelines())', example: '## STYLE GUIDELINES\nVoice: Direct, conversational...' },
    { name: 'voice_section', description: 'Voice profile section (from buildVoicePromptSection())', example: '## Writing Style (learned from author edits)\nTone: Authoritative...' },
    { name: 'target_audience', description: 'Target audience description', example: 'B2B professionals, agency owners, and marketers' },
    { name: 'idea_title', description: 'Content idea title', example: 'Why cold email is dead for agencies' },
    { name: 'idea_core_insight', description: 'Core insight of the idea', example: 'Response rates dropped 80% in 2 years...' },
    { name: 'idea_full_context', description: 'Full context from knowledge base', example: 'Extended context about the topic...' },
    { name: 'idea_why_post_worthy', description: 'Why this is worth posting', example: 'Contrarian take backed by real data' },
    { name: 'idea_content_type', description: 'Content type classification', example: 'contrarian' },
    { name: 'knowledge_section', description: 'Knowledge base context section (optional, may be empty)', example: 'KNOWLEDGE BASE CONTEXT:\n...' },
  ],
};
```

**Full prompt slugs to extract** (copy exact prompt text from each source file):

| Slug | Source | Function |
|------|--------|----------|
| `post-writer-freeform` | `post-writer.ts:131-175` | `writePostFreeform()` |
| `post-writer-template` | `post-writer.ts:208-244` | `writePostWithTemplate()` |
| `post-rewrite-section` | `post-writer.ts` | `rewriteSection()` |
| `post-polish-rewrite` | `post-polish.ts:312-347` | `buildPolishPrompt()` |
| `email-newsletter` | `email-writer.ts:23-43` | `writeNewsletterEmail()` |
| `knowledge-extractor` | `knowledge-extractor.ts:77-161` | `extractKnowledgeFromTranscript()` |
| `content-brief-angles` | `briefing-agent.ts:130-142` | `generateSuggestedAngles()` |
| `edit-classifier` | `edit-classifier.ts:32-50` | `classifyEditPatterns()` |
| `style-evolution` | `evolve-writing-style.ts:54-87` | `evolveWritingStyle` task |
| `topic-summarizer` | `topic-summarizer.ts:41-54` | `generateTopicSummary()` |
| `style-guidelines` | `post-writer.ts:70-117` | `getBaseStyleGuidelines()` — stored as a config prompt (the text block itself) |
| `banned-ai-phrases` | `post-polish.ts:34-80` | `AI_PHRASES` array — stored as JSON in user_prompt field |
| `hook-scoring-config` | `post-polish.ts:125-186` | Hook scoring strength/weakness factors — stored as JSON config |
| `voice-prompt-template` | `voice-prompt-builder.ts:15-56` | Template for building voice sections — not a Claude call, but a prompt assembly template |

**Step 2: Verify no import errors**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add src/lib/ai/content-pipeline/prompt-defaults.ts
git commit -m "feat: extract all AI prompt defaults to prompt-defaults.ts"
```

---

### Task 3: Prompt Registry Service

**Files:**
- Create: `src/lib/services/prompt-registry.ts`
- Test: `src/__tests__/lib/services/prompt-registry.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/__tests__/lib/services/prompt-registry.test.ts
import { interpolatePrompt } from '@/lib/services/prompt-registry';

describe('interpolatePrompt', () => {
  it('replaces simple {{variable}} placeholders', () => {
    const template = 'Hello {{name}}, welcome to {{place}}.';
    const result = interpolatePrompt(template, { name: 'Alice', place: 'Wonderland' });
    expect(result).toBe('Hello Alice, welcome to Wonderland.');
  });

  it('replaces multiple occurrences of same variable', () => {
    const template = '{{x}} and {{x}} again';
    const result = interpolatePrompt(template, { x: 'test' });
    expect(result).toBe('test and test again');
  });

  it('removes unreplaced placeholders', () => {
    const template = 'Start {{missing}} end';
    const result = interpolatePrompt(template, {});
    expect(result).toBe('Start  end');
  });

  it('handles empty variables object', () => {
    const template = 'No vars here';
    const result = interpolatePrompt(template, {});
    expect(result).toBe('No vars here');
  });

  it('handles multiline templates', () => {
    const template = 'Line1 {{a}}\nLine2 {{b}}';
    const result = interpolatePrompt(template, { a: 'X', b: 'Y' });
    expect(result).toBe('Line1 X\nLine2 Y');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/services/prompt-registry.test.ts --no-coverage`
Expected: FAIL — module not found.

**Step 3: Write the registry service**

```typescript
// src/lib/services/prompt-registry.ts
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { PROMPT_DEFAULTS, type PromptDefault } from '@/lib/ai/content-pipeline/prompt-defaults';

export interface PromptTemplate {
  slug: string;
  name: string;
  category: string;
  description: string;
  system_prompt: string;
  user_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  variables: Array<{ name: string; description: string; example: string }>;
  is_active: boolean;
  source: 'db' | 'default';
}

// In-memory cache with TTL
const cache = new Map<string, { template: PromptTemplate; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a prompt template by slug.
 * Priority: active DB row > hardcoded default.
 */
export async function getPrompt(slug: string): Promise<PromptTemplate> {
  // Check cache
  const cached = cache.get(slug);
  if (cached && Date.now() < cached.expires) {
    return cached.template;
  }

  // Try DB
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('ai_prompt_templates')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (data) {
      const template: PromptTemplate = {
        slug: data.slug,
        name: data.name,
        category: data.category,
        description: data.description,
        system_prompt: data.system_prompt,
        user_prompt: data.user_prompt,
        model: data.model,
        temperature: data.temperature,
        max_tokens: data.max_tokens,
        variables: data.variables as PromptTemplate['variables'],
        is_active: true,
        source: 'db',
      };
      cache.set(slug, { template, expires: Date.now() + CACHE_TTL_MS });
      return template;
    }
  } catch {
    // DB fetch failed — fall through to default
  }

  // Fallback to hardcoded default
  const fallback = PROMPT_DEFAULTS[slug];
  if (fallback) {
    const template: PromptTemplate = { ...fallback, is_active: false, source: 'default' };
    cache.set(slug, { template, expires: Date.now() + CACHE_TTL_MS });
    return template;
  }

  throw new Error(`No prompt template found for slug: ${slug}`);
}

/**
 * Replace {{variable}} placeholders with values.
 * Unreplaced placeholders are removed (replaced with empty string).
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  // Remove any unreplaced placeholders
  result = result.replace(/\{\{[a-zA-Z_]+\}\}/g, '');
  return result;
}

/**
 * Save a prompt template + create a version snapshot.
 * Returns the new version number.
 */
export async function savePrompt(
  slug: string,
  updates: {
    system_prompt?: string;
    user_prompt?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    is_active?: boolean;
    name?: string;
    description?: string;
    variables?: PromptTemplate['variables'];
  },
  changedBy: string,
  changeNote?: string
): Promise<number> {
  const supabase = createSupabaseAdminClient();

  // Get current prompt
  const { data: current, error: fetchError } = await supabase
    .from('ai_prompt_templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (fetchError || !current) {
    throw new Error(`Prompt not found: ${slug}`);
  }

  // Update the template
  const { error: updateError } = await supabase
    .from('ai_prompt_templates')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug);

  if (updateError) throw new Error(`Failed to update prompt: ${updateError.message}`);

  // Get next version number
  const { data: latestVersion } = await supabase
    .from('ai_prompt_versions')
    .select('version')
    .eq('prompt_id', current.id)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  // Snapshot the NEW state (after update)
  const merged = { ...current, ...updates };
  const { error: versionError } = await supabase
    .from('ai_prompt_versions')
    .insert({
      prompt_id: current.id,
      version: nextVersion,
      system_prompt: merged.system_prompt ?? current.system_prompt,
      user_prompt: merged.user_prompt ?? current.user_prompt,
      model: merged.model ?? current.model,
      temperature: merged.temperature ?? current.temperature,
      max_tokens: merged.max_tokens ?? current.max_tokens,
      change_note: changeNote ?? null,
      changed_by: changedBy,
    });

  if (versionError) throw new Error(`Failed to create version: ${versionError.message}`);

  // Invalidate cache
  cache.delete(slug);

  return nextVersion;
}

/** Clear the entire cache (useful for tests). */
export function clearPromptCache(): void {
  cache.clear();
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/services/prompt-registry.test.ts --no-coverage`
Expected: PASS — all 5 tests.

**Step 5: Commit**

```bash
git add src/lib/services/prompt-registry.ts src/__tests__/lib/services/prompt-registry.test.ts
git commit -m "feat: add prompt registry service with cache + interpolation + versioning"
```

---

### Task 4: Seed Migration — Populate All Prompts in DB

**Files:**
- Create: `supabase/migrations/20260224100000_seed_ai_prompts.sql`

**Step 1: Write the seed migration**

This inserts all 14+ prompt entries into `ai_prompt_templates` with `is_active = false`. Also creates a version 1 snapshot for each.

For each prompt, use the exact text from `prompt-defaults.ts`. The SQL uses dollar-quoted strings (`$$...$$`) to handle the multi-line prompt text with single quotes inside.

Pattern for each prompt:

```sql
-- post-writer-freeform
INSERT INTO ai_prompt_templates (id, slug, name, category, description, system_prompt, user_prompt, model, temperature, max_tokens, variables, is_active)
VALUES (
  uuid_generate_v4(),
  'post-writer-freeform',
  'Post Writer (Freeform)',
  'content_writing',
  'Writes a LinkedIn post from a content idea using freeform style. Used by writePostFreeform().',
  '',
  $$<paste exact user_prompt from prompt-defaults.ts>$$,
  'claude-sonnet-4-6',
  1.0,
  4000,
  '[{"name":"style_guidelines","description":"Base style guidelines","example":"..."},...]'::jsonb,
  false
);

-- Create version 1 snapshot
INSERT INTO ai_prompt_versions (prompt_id, version, system_prompt, user_prompt, model, temperature, max_tokens, change_note, changed_by)
SELECT id, 1, system_prompt, user_prompt, model, temperature, max_tokens, 'Initial seed from codebase', 'system'
FROM ai_prompt_templates WHERE slug = 'post-writer-freeform';
```

Repeat for ALL 14 prompts: `post-writer-freeform`, `post-writer-template`, `post-rewrite-section`, `post-polish-rewrite`, `email-newsletter`, `knowledge-extractor`, `content-brief-angles`, `edit-classifier`, `style-evolution`, `topic-summarizer`, `style-guidelines`, `banned-ai-phrases`, `hook-scoring-config`, `voice-prompt-template`.

**Step 2: Push migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`
Expected: 14 rows in `ai_prompt_templates`, 14 rows in `ai_prompt_versions`.

**Step 3: Commit**

```bash
git add supabase/migrations/20260224100000_seed_ai_prompts.sql
git commit -m "feat: seed all 14 AI prompt templates into database"
```

---

### Task 5: Wire First AI Module to Registry (post-writer.ts)

**Files:**
- Modify: `src/lib/ai/content-pipeline/post-writer.ts`

**Step 1: Update writePostFreeform() to use registry**

Replace the hardcoded prompt construction with:

```typescript
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';

export async function writePostFreeform(input: WritePostInput): Promise<WrittenPost> {
  const { idea, knowledgeContext, voiceProfile, targetAudience } = input;

  const voiceSection = buildVoicePromptSection(voiceProfile ?? null, 'linkedin');
  const styleGuidelines = getBaseStyleGuidelines(); // kept for fallback + style-guidelines prompt

  // Fetch prompt template (DB if active, else hardcoded default)
  const template = await getPrompt('post-writer-freeform');

  const knowledgeSection = knowledgeContext
    ? `\nKNOWLEDGE BASE CONTEXT (from your calls — use specific quotes, real numbers, and validated insights):\n${knowledgeContext}`
    : '';

  const prompt = interpolatePrompt(template.user_prompt, {
    style_guidelines: styleGuidelines,
    voice_section: voiceSection,
    target_audience: targetAudience || 'B2B professionals, agency owners, and marketers',
    idea_title: idea.title,
    idea_core_insight: idea.core_insight,
    idea_full_context: idea.full_context || '',
    idea_why_post_worthy: idea.why_post_worthy || '',
    idea_content_type: idea.content_type || '',
    knowledge_section: knowledgeSection,
  });

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: template.model,
    max_tokens: template.max_tokens,
    messages: [{ role: 'user', content: prompt }],
  });

  // ... rest of parsing unchanged
}
```

**Step 2: Repeat for writePostWithTemplate()**

Same pattern — fetch `post-writer-template`, interpolate, use `template.model` and `template.max_tokens`.

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit`
Expected: No new errors.

**Step 4: Commit**

```bash
git add src/lib/ai/content-pipeline/post-writer.ts
git commit -m "feat: wire post-writer to prompt registry with DB fallback"
```

---

### Task 6: Wire Remaining AI Modules to Registry

**Files:**
- Modify: `src/lib/ai/content-pipeline/post-polish.ts`
- Modify: `src/lib/ai/content-pipeline/email-writer.ts`
- Modify: `src/lib/ai/content-pipeline/knowledge-extractor.ts`
- Modify: `src/lib/ai/content-pipeline/briefing-agent.ts`
- Modify: `src/lib/ai/content-pipeline/edit-classifier.ts`
- Modify: `src/lib/ai/content-pipeline/topic-summarizer.ts`
- Modify: `src/trigger/evolve-writing-style.ts`

**Step 1: Wire each module**

Same pattern as Task 5 for each file:
1. Import `getPrompt` + `interpolatePrompt`
2. Replace hardcoded prompt string with `await getPrompt('<slug>')`
3. Replace `${variable}` interpolations with `interpolatePrompt(template.user_prompt, { ... })`
4. Use `template.model` and `template.max_tokens` instead of hardcoded constants

Special cases:
- **post-polish.ts** (`polishPost`): The `AI_PHRASES` array and `scoreHook` weights are config-style. For these, `getPrompt('banned-ai-phrases')` returns the JSON list in `user_prompt` field. Parse it: `JSON.parse(template.user_prompt) as string[]`. Same for `hook-scoring-config`.
- **evolve-writing-style.ts**: This is a Trigger.dev task. The `getPrompt()` call works the same — Supabase is available in Trigger.dev runtime via `createSupabaseAdminClient()` with env vars.
- **voice-prompt-builder.ts**: `getPrompt('voice-prompt-template')` returns a template that `buildVoicePromptSection()` uses to assemble the voice section. This is a string template, not a Claude call.

**Step 2: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit`
Expected: No errors.

**Step 3: Run existing tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test -- --no-coverage`
Expected: All existing tests pass (the registry falls back to defaults since DB rows are inactive).

**Step 4: Commit**

```bash
git add src/lib/ai/content-pipeline/ src/trigger/evolve-writing-style.ts
git commit -m "feat: wire all AI modules to prompt registry"
```

---

### Task 7: Super-Admin Auth Helper

**Files:**
- Create: `src/lib/auth/super-admin.ts`
- Test: `src/__tests__/lib/auth/super-admin.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/lib/auth/super-admin.test.ts
import { isSuperAdmin } from '@/lib/auth/super-admin';

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { is_super_admin: true }, error: null }),
        }),
      }),
    }),
  }),
}));

describe('isSuperAdmin', () => {
  it('returns true for super admin user', async () => {
    const result = await isSuperAdmin('test-user-id');
    expect(result).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/auth/super-admin.test.ts --no-coverage`
Expected: FAIL — module not found.

**Step 3: Implement**

```typescript
// src/lib/auth/super-admin.ts
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Check if a user is a super admin.
 * Used to gate access to /admin/* routes.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single();

  if (error || !data) return false;
  return data.is_super_admin === true;
}
```

**Step 4: Run test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/auth/super-admin.test.ts --no-coverage`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/auth/super-admin.ts src/__tests__/lib/auth/super-admin.test.ts
git commit -m "feat: add isSuperAdmin auth helper"
```

---

### Task 8: Admin Layout — Super-Admin Gate

**Files:**
- Create: `src/app/(dashboard)/admin/layout.tsx`

**Step 1: Write the layout**

```typescript
// src/app/(dashboard)/admin/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const isAdmin = await isSuperAdmin(session.user.id);
  if (!isAdmin) {
    redirect('/');
  }

  return <>{children}</>;
}
```

**Step 2: Add `/admin` to protected routes in middleware**

Modify `src/middleware.ts` — add `'/admin'` to the `protectedRoutes` array. It's already covered by the dashboard layout auth check, but adding it explicitly prevents even unauthenticated access.

**Step 3: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/layout.tsx src/middleware.ts
git commit -m "feat: add admin layout with super-admin gate"
```

---

### Task 9: Admin API Routes

**Files:**
- Create: `src/app/api/admin/prompts/route.ts` — GET (list all), POST (create)
- Create: `src/app/api/admin/prompts/[slug]/route.ts` — GET (single + versions), PATCH (update),
- Create: `src/app/api/admin/prompts/[slug]/versions/route.ts` — GET (version history)
- Create: `src/app/api/admin/prompts/[slug]/restore/route.ts` — POST (restore a version)
- Create: `src/app/api/admin/prompts/[slug]/test/route.ts` — POST (dry-run interpolation)

**Step 1: Write the list + single-prompt routes**

Every admin API route follows this pattern:

```typescript
// src/app/api/admin/prompts/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isSuperAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('ai_prompt_templates')
    .select('slug, name, category, description, model, is_active, updated_at')
    .order('category')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**`[slug]/route.ts` GET** — returns full prompt + latest 3 versions:
```typescript
const { data: prompt } = await supabase
  .from('ai_prompt_templates')
  .select('*')
  .eq('slug', params.slug)
  .single();

const { data: versions } = await supabase
  .from('ai_prompt_versions')
  .select('*')
  .eq('prompt_id', prompt.id)
  .order('version', { ascending: false })
  .limit(50);

return NextResponse.json({ prompt, versions });
```

**`[slug]/route.ts` PATCH** — update prompt using `savePrompt()`:
```typescript
import { savePrompt } from '@/lib/services/prompt-registry';

const body = await request.json();
const version = await savePrompt(
  params.slug,
  body.updates,
  session.user.email || session.user.id,
  body.change_note
);
return NextResponse.json({ version });
```

**`[slug]/restore/route.ts` POST** — copy a version's content into the live prompt:
```typescript
const { version_id } = await request.json();
// Fetch the version
const { data: version } = await supabase
  .from('ai_prompt_versions')
  .select('*')
  .eq('id', version_id)
  .single();
// Save as new version via savePrompt()
await savePrompt(slug, {
  system_prompt: version.system_prompt,
  user_prompt: version.user_prompt,
  model: version.model,
  temperature: version.temperature,
  max_tokens: version.max_tokens,
}, session.user.email, `Restored from version ${version.version}`);
```

**`[slug]/test/route.ts` POST** — dry-run interpolation:
```typescript
import { interpolatePrompt } from '@/lib/services/prompt-registry';

const { system_prompt, user_prompt, test_variables } = await request.json();
return NextResponse.json({
  interpolated_system: interpolatePrompt(system_prompt, test_variables),
  interpolated_user: interpolatePrompt(user_prompt, test_variables),
});
```

**Step 2: Write API tests**

Create `src/__tests__/api/admin/prompts.test.ts` — test auth rejection (401/403), list response shape, single prompt response shape.

**Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/admin/ --no-coverage`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/app/api/admin/ src/__tests__/api/admin/
git commit -m "feat: add admin API routes for prompt CRUD, versioning, restore, and test"
```

---

### Task 10: Install diff Package

**Step 1: Install**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm install diff && npm install -D @types/diff`

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add diff package for version comparison"
```

---

### Task 11: Prompt List Page (`/admin/prompts`)

**Files:**
- Create: `src/app/(dashboard)/admin/page.tsx` — redirect to /admin/prompts
- Create: `src/app/(dashboard)/admin/prompts/page.tsx` — server component
- Create: `src/components/admin/PromptList.tsx` — client component

**Step 1: Write the redirect page**

```typescript
// src/app/(dashboard)/admin/page.tsx
import { redirect } from 'next/navigation';
export default function AdminPage() {
  redirect('/admin/prompts');
}
```

**Step 2: Write the prompt list server component**

```typescript
// src/app/(dashboard)/admin/prompts/page.tsx
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { PromptList } from '@/components/admin/PromptList';

export default async function AdminPromptsPage() {
  const session = await auth();
  const supabase = createSupabaseAdminClient();

  const { data: prompts } = await supabase
    .from('ai_prompt_templates')
    .select('slug, name, category, description, model, is_active, updated_at')
    .order('category')
    .order('name');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AI Prompts</h1>
        <p className="text-sm text-zinc-500 mt-1">View, edit, and version all AI prompt templates used in content production.</p>
      </div>
      <PromptList prompts={prompts ?? []} />
    </div>
  );
}
```

**Step 3: Write the PromptList client component**

```typescript
// src/components/admin/PromptList.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

interface PromptSummary {
  slug: string;
  name: string;
  category: string;
  description: string;
  model: string;
  is_active: boolean;
  updated_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  content_writing: 'Content Writing',
  knowledge: 'Knowledge',
  learning: 'Learning',
  email: 'Email',
  scoring: 'Scoring & Config',
};

const CATEGORY_ORDER = ['content_writing', 'email', 'knowledge', 'learning', 'scoring'];

export function PromptList({ prompts }: { prompts: PromptSummary[] }) {
  const [search, setSearch] = useState('');

  const filtered = prompts.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = CATEGORY_ORDER.reduce<Record<string, PromptSummary[]>>((acc, cat) => {
    const items = filtered.filter((p) => p.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Grouped list */}
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items) return null;
        return (
          <div key={cat} className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[cat] || cat}
            </h2>
            <div className="grid gap-3">
              {items.map((p) => (
                <Link
                  key={p.slug}
                  href={`/admin/prompts/${p.slug}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-violet-500/50 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{p.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{p.description}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-xs text-zinc-400">{p.model}</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 4: Verify it renders**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run dev`
Visit: `http://localhost:3000/admin/prompts`
Expected: See all 14 prompts grouped by category, all showing "Inactive".

**Step 5: Commit**

```bash
git add src/app/(dashboard)/admin/ src/components/admin/PromptList.tsx
git commit -m "feat: add admin prompt list page with search and category grouping"
```

---

### Task 12: Prompt Editor Page (`/admin/prompts/[slug]`)

**Files:**
- Create: `src/app/(dashboard)/admin/prompts/[slug]/page.tsx` — server component
- Create: `src/components/admin/PromptEditor.tsx` — client component (main editor)
- Create: `src/components/admin/VersionTimeline.tsx` — client component (version history)
- Create: `src/components/admin/PromptDiffViewer.tsx` — client component (side-by-side diff)

**Step 1: Write the server page**

```typescript
// src/app/(dashboard)/admin/prompts/[slug]/page.tsx
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { PromptEditor } from '@/components/admin/PromptEditor';
import { notFound } from 'next/navigation';

export default async function PromptEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const supabase = createSupabaseAdminClient();

  const { data: prompt } = await supabase
    .from('ai_prompt_templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!prompt) notFound();

  const { data: versions } = await supabase
    .from('ai_prompt_versions')
    .select('*')
    .eq('prompt_id', prompt.id)
    .order('version', { ascending: false });

  return (
    <div className="max-w-7xl mx-auto p-6">
      <PromptEditor
        prompt={prompt}
        versions={versions ?? []}
        currentUserEmail={session?.user?.email ?? 'admin'}
      />
    </div>
  );
}
```

**Step 2: Write the PromptEditor component**

This is the main editor component with:
- Back link to `/admin/prompts`
- Two tabs: "System Prompt" and "User Prompt" — each is a `<textarea>` with monospace font
- Right sidebar: variable reference (from `prompt.variables` JSONB), model dropdown, temperature slider, max_tokens input, active toggle
- Bottom bar: change note input, Test button, Save button
- Version history tab toggle

The editor should:
- Use `useState` for local edits
- Call `PATCH /api/admin/prompts/[slug]` on save
- Call `POST /api/admin/prompts/[slug]/test` on test (shows interpolated result in a modal)
- Call `POST /api/admin/prompts/[slug]/restore` on version restore
- Use `useRouter().refresh()` after save to reload server data

The component is ~250-350 lines. Use existing Tailwind patterns from the codebase (zinc backgrounds, violet accents, text-sm, rounded-lg borders).

**Step 3: Write the VersionTimeline component**

Renders a list of versions as a timeline. Each entry shows version number, change note, changed_by, timestamp, and a "View Diff" button that opens `PromptDiffViewer`.

**Step 4: Write the PromptDiffViewer component**

Uses `import { diffLines } from 'diff'` to compute line-by-line diff between two prompt versions. Renders side-by-side with red/green highlighting for removed/added lines.

```typescript
import { diffLines } from 'diff';

export function PromptDiffViewer({ oldText, newText, oldLabel, newLabel }: Props) {
  const changes = diffLines(oldText, newText);
  // Render with added (green bg) / removed (red bg) / unchanged styling
}
```

**Step 5: Verify it renders**

Run dev server, navigate to `/admin/prompts/post-writer-freeform`.
Expected: See full prompt text in editor, variable reference sidebar, version history.

**Step 6: Test the save flow**

Edit the prompt text, add a change note, click Save.
Expected: Version 2 created, version history shows both versions, diff between v1 and v2 visible.

**Step 7: Test the restore flow**

Click "Restore" on version 1.
Expected: Editor text reverts to v1 content. Click Save → version 3 created with note "Restored from version 1".

**Step 8: Test the dry-run**

Click "Test" button.
Expected: Modal shows the fully interpolated prompt with example variable values filled in.

**Step 9: Commit**

```bash
git add src/app/(dashboard)/admin/prompts/[slug]/ src/components/admin/
git commit -m "feat: add prompt editor page with diff viewer, version timeline, and restore"
```

---

### Task 13: Learning Dashboard (`/admin/learning`)

**Files:**
- Create: `src/app/(dashboard)/admin/learning/page.tsx`
- Create: `src/components/admin/LearningDashboard.tsx`
- Create: `src/app/api/admin/learning/route.ts`

**Step 1: Write the API route**

```typescript
// GET /api/admin/learning
// Returns: edit activity stats, top patterns, voice evolution history, cron status
const supabase = createSupabaseAdminClient();

// Edit activity (last 30 days)
const { data: editActivity } = await supabase
  .from('cp_edit_history')
  .select('id, profile_id, content_type, auto_classified_changes, ceo_note, created_at')
  .gte('created_at', thirtyDaysAgo)
  .order('created_at', { ascending: false });

// All team profiles with voice evolution metadata
const { data: profiles } = await supabase
  .from('team_profiles')
  .select('id, full_name, voice_profile')
  .eq('status', 'active');

return NextResponse.json({ editActivity, profiles });
```

**Step 2: Write the LearningDashboard component**

Four sections:
1. **Edit Activity** — Simple count cards: total edits (30d), edits with classified patterns, edits with CEO notes. List of recent edits.
2. **Pattern Frequency** — Aggregate `auto_classified_changes` across all edit history rows, count pattern occurrences, display as sorted list with bars.
3. **Voice Evolution** — For each profile, show `voice_profile.evolution_version`, `voice_profile.last_evolved`, `voice_profile.edit_patterns[]` with counts and confidence.
4. **Cron Status** — Display last evolution run timestamp from most recent `last_evolved` across profiles.

This is the "fun/secondary" feature — keep it read-only and simple. No charts library needed — use simple Tailwind progress bars for pattern frequency visualization.

**Step 3: Verify it renders**

Visit `/admin/learning`. Expected: Dashboard loads with current data (may be empty if no edits yet).

**Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/learning/ src/components/admin/LearningDashboard.tsx src/app/api/admin/learning/
git commit -m "feat: add learning observability dashboard"
```

---

### Task 14: Hide Admin from Regular Users

**Files:**
- Modify: `src/components/dashboard/DashboardNav.tsx`

**Step 1: Conditionally show admin link**

The nav should NOT show an admin link by default. The admin panel is accessed by direct URL only (`/admin/prompts`). No changes needed to `DashboardNav.tsx` — the admin layout gate handles unauthorized access.

However, for convenience, you may optionally pass `isSuperAdmin` from the dashboard layout down to the nav and render a small admin link at the very bottom:

```typescript
// In DashboardNav, after bottomNav items:
{isSuperAdmin && (
  <NavLink href="/admin" label="Admin" icon={Shield} />
)}
```

This is optional — the user said "as long as users can't see the link". If you add it, it's only visible to super-admins. If you skip it, admins just bookmark `/admin/prompts`.

**Step 2: Commit (if changes made)**

```bash
git add src/components/dashboard/DashboardNav.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat: conditionally show admin nav link for super-admins only"
```

---

### Task 15: Tests — API + Integration

**Files:**
- Create: `src/__tests__/api/admin/prompts.test.ts`
- Create: `src/__tests__/lib/services/prompt-registry.test.ts` (extend from Task 3)

**Step 1: Write admin API tests**

```typescript
// src/__tests__/api/admin/prompts.test.ts
describe('GET /api/admin/prompts', () => {
  it('returns 401 for unauthenticated request', async () => { ... });
  it('returns 403 for non-super-admin', async () => { ... });
  it('returns prompt list for super-admin', async () => { ... });
});

describe('PATCH /api/admin/prompts/[slug]', () => {
  it('creates a new version on save', async () => { ... });
});

describe('POST /api/admin/prompts/[slug]/test', () => {
  it('returns interpolated prompt with test variables', async () => { ... });
});
```

**Step 2: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test -- --no-coverage`
Expected: All pass.

**Step 3: Commit**

```bash
git add src/__tests__/
git commit -m "test: add admin prompt API tests"
```

---

### Task 16: Typecheck + Final Build Verification

**Step 1: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit`
Expected: No errors.

**Step 2: Run full build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run build`
Expected: Build succeeds.

**Step 3: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test -- --no-coverage`
Expected: All tests pass.

**Step 4: Commit any fixes**

If any issues found, fix and commit.

---

### Task 17: Update CLAUDE.md Documentation

**Files:**
- Modify: `src/../../CLAUDE.md` (magnetlab repo CLAUDE.md)

Add a new section documenting:

```markdown
## AI Admin Panel

Internal super-admin panel for managing all AI prompt templates and observing the self-learning system.

### Access

- Route: `/admin/prompts` and `/admin/learning`
- Gate: `is_super_admin` boolean on `users` table
- Set via: `UPDATE users SET is_super_admin = true WHERE email = 'your@email.com'`
- Not visible in nav for regular users

### Data Model

- `ai_prompt_templates` — 14+ prompt templates with `{{variable}}` placeholders, model config, active flag
- `ai_prompt_versions` — snapshot on every save, supports diff + restore

### Prompt Registry

- `src/lib/services/prompt-registry.ts` — `getPrompt(slug)`, `interpolatePrompt()`, `savePrompt()`
- 5-minute in-memory cache, falls back to hardcoded defaults in `prompt-defaults.ts`
- All AI modules read from registry: post-writer, post-polish, email-writer, knowledge-extractor, briefing-agent, edit-classifier, topic-summarizer, style-evolution

### Key Files

- `src/lib/ai/content-pipeline/prompt-defaults.ts` — hardcoded fallback prompts
- `src/lib/services/prompt-registry.ts` — registry service
- `src/lib/auth/super-admin.ts` — `isSuperAdmin()` helper
- `src/app/(dashboard)/admin/` — admin pages (layout, prompts, learning)
- `src/components/admin/` — PromptList, PromptEditor, VersionTimeline, PromptDiffViewer, LearningDashboard
- `src/app/api/admin/prompts/` — CRUD + versioning + restore + test API routes
- `src/app/api/admin/learning/` — learning data API
```

**Step 1: Make the edit**

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add AI admin panel section to CLAUDE.md"
```
