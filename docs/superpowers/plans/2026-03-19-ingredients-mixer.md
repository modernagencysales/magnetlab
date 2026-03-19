# Ingredients Mixer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered content creation pages (Knowledge, Inspo, Posts Ideas/Library, Settings Styles) with a unified mixer on the Posts page — pick ingredients, generate LinkedIn posts.

**Architecture:** New Posts page with 4 zones (mixer, suggested recipes, inventory, inline results). Backend: new mixer service + prompt builder, 4 API routes, 4 MCP tools, 1 new DB table. Pipeline page absorbs distribution tabs. Sidebar collapses from 4 sections to 2.

**Tech Stack:** Next.js 15, React 18, TypeScript, Supabase, shadcn/ui Sheet, SWR, Zod, Claude API, Trigger.dev, pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-03-19-ingredients-mixer-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260320100000_mix_recipes.sql` | `cp_mix_recipes` table + RLS + indexes |
| `src/lib/types/mixer.ts` | MixerInput, MixerResult, IngredientInventory, RecipeSuggestion, ComboPerformance types |
| `src/lib/validations/mixer.ts` | Zod schemas: MixSchema, InventoryQuerySchema, RecipeQuerySchema |
| `src/server/services/mixer.service.ts` | Core mixer service: resolveScope, getInventory, mix, getRecipes, getComboPerformance |
| `src/server/repositories/mix-recipes.repo.ts` | CRUD for cp_mix_recipes table |
| `src/lib/ai/content-pipeline/mixer-prompt-builder.ts` | buildMixerPrompt() + buildMixerVoiceSection() |
| `src/app/api/content-pipeline/inventory/route.ts` | GET /api/content-pipeline/inventory |
| `src/app/api/content-pipeline/recipes/route.ts` | GET /api/content-pipeline/recipes |
| `src/app/api/content-pipeline/mix/route.ts` | POST /api/content-pipeline/mix |
| `src/app/api/content-pipeline/combo-performance/route.ts` | GET /api/content-pipeline/combo-performance |
| `src/frontend/api/content-pipeline/mixer.ts` | Frontend API module: mix(), getInventory(), getRecipes(), getComboPerformance() |
| `src/frontend/hooks/api/useMixer.ts` | useMix() mutation hook, useInventory() SWR hook, useRecipes() SWR hook |
| `src/components/mixer/IngredientTile.tsx` | Selectable chip with 3 states (unselected, selected, loading) |
| `src/components/mixer/IngredientDrawer.tsx` | Reusable Sheet with search, filters, smart suggestion |
| `src/components/mixer/RecipeCard.tsx` | Suggested combo card |
| `src/components/mixer/DraftResultCard.tsx` | LinkedIn-preview draft with actions |
| `src/components/mixer/InventoryCard.tsx` | Count + health badge card |
| `src/components/mixer/MixerBar.tsx` | Collapsed recipe summary bar (post-generation) |
| `src/components/mixer/MixerZone.tsx` | Zone 1: tiles + instructions + generate buttons |
| `src/components/mixer/RecipesZone.tsx` | Zone 2: suggested recipes row |
| `src/components/mixer/InventoryZone.tsx` | Zone 3: inventory grid |
| `src/components/mixer/ResultsZone.tsx` | Zone 4: inline draft/idea results |
| `src/components/mixer/SavedIdeasSection.tsx` | Expandable section for existing cp_content_ideas |
| `src/app/(dashboard)/pipeline/page.tsx` | New Pipeline page (kanban, calendar, autopilot, content queue) |
| `src/components/pipeline/PipelineContent.tsx` | Pipeline page content with 4 tabs |
| `packages/mcp/src/tools/mixer.ts` | 4 new MCP tool definitions |
| `packages/mcp/src/handlers/mixer.ts` | MCP handler for mixer tools |
| `src/__tests__/api/content-pipeline/mix.test.ts` | Mix endpoint tests |
| `src/__tests__/api/content-pipeline/inventory.test.ts` | Inventory endpoint tests |
| `src/__tests__/lib/ai/mixer-prompt-builder.test.ts` | Prompt builder tests |
| `src/__tests__/lib/services/mixer.service.test.ts` | Mixer service tests |

### Modified Files

| File | Change |
|------|--------|
| `src/components/dashboard/AppSidebar.tsx` | Replace 4 nav groups with 2 (Create + Distribute), add Pipeline route |
| `src/app/(dashboard)/posts/page.tsx` | Replace current server component with mixer page data fetching |
| `src/components/posts/PostsContent.tsx` | Replace 5-tab layout with mixer zones |
| `src/lib/ai/content-pipeline/post-writer.ts` | Add line break formatting rule to base style guidelines |
| `src/lib/ai/content-pipeline/post-writer.ts` | Export `getBaseStyleGuidelines()` + add line break formatting rule |
| `packages/mcp/src/tools/index.ts` | Register mixer tools |
| `packages/mcp/src/handlers/index.ts` | Register mixer handler |
| `packages/mcp/src/client.ts` | Add mixer API methods |
| `src/app/(dashboard)/knowledge/page.tsx` | Replace with redirect to /posts |
| `src/app/(dashboard)/inspo/page.tsx` | Replace with redirect to /posts |
| `src/app/(dashboard)/pages/page.tsx` | Replace with redirect to /magnets |
| `src/app/(dashboard)/content-queue/page.tsx` | Replace with redirect to /pipeline |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260320100000_mix_recipes.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Mix recipes table for tracking ingredient combinations
CREATE TABLE cp_mix_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES team_profiles(id),
  exploit_id UUID REFERENCES cp_exploits(id) ON DELETE SET NULL,
  knowledge_topic TEXT,
  knowledge_query TEXT,
  style_id UUID REFERENCES cp_writing_styles(id) ON DELETE SET NULL,
  template_id UUID REFERENCES cp_post_templates(id) ON DELETE SET NULL,
  creative_id UUID REFERENCES cp_creatives(id) ON DELETE SET NULL,
  trend_topic TEXT,
  recycled_post_id UUID REFERENCES cp_pipeline_posts(id) ON DELETE SET NULL,
  idea_id UUID REFERENCES cp_content_ideas(id) ON DELETE SET NULL,
  instructions TEXT,
  output_type TEXT NOT NULL DEFAULT 'drafts' CHECK (output_type IN ('drafts', 'ideas')),
  post_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cp_mix_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mix recipes"
  ON cp_mix_recipes FOR ALL
  USING (team_profile_id IN (
    SELECT id FROM team_profiles WHERE team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_mix_recipes_profile ON cp_mix_recipes(team_profile_id);
CREATE INDEX idx_mix_recipes_created ON cp_mix_recipes(created_at DESC);

CREATE TRIGGER update_cp_mix_recipes_updated_at
  BEFORE UPDATE ON cp_mix_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

Note: Uses `update_updated_at_column()` from `20250120000000_initial_schema.sql` — NOT `moddatetime` (that extension is not installed).

- [ ] **Step 2: Apply the migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260320100000_mix_recipes.sql
git commit -m "feat(db): add cp_mix_recipes table for ingredient combo tracking"
```

---

## Task 2: Types & Validation

**Files:**
- Create: `src/lib/types/mixer.ts`
- Create: `src/lib/validations/mixer.ts`

- [ ] **Step 1: Write mixer types**

```typescript
/** Mixer types. Defines inputs/outputs for the ingredient mixer. Never imports from React or Next.js. */

// ─── Ingredient Selection ─────────────────────────────────

export interface MixerInput {
  team_profile_id: string;
  exploit_id?: string;
  knowledge_topic?: string;
  knowledge_query?: string;
  style_id?: string;
  template_id?: string;
  creative_id?: string;
  trend_topic?: string;
  recycled_post_id?: string;
  idea_id?: string;
  hook?: string;
  instructions?: string;
  count?: number;
  output?: 'drafts' | 'ideas';
}

export interface MixerDraft {
  content: string;
  hook_used: string;
  ai_pick: boolean;
  recipe_id: string;
}

export interface MixerIdea {
  title: string;
  hook: string;
  angle: string;
  relevance_score: number;
  recipe_id: string;
}

export type MixerResult =
  | { type: 'drafts'; drafts: MixerDraft[]; recipe_id: string }
  | { type: 'ideas'; ideas: MixerIdea[]; recipe_id: string };

// ─── Inventory ────────────────────────────────────────────

export type IngredientType =
  | 'knowledge'
  | 'exploits'
  | 'styles'
  | 'templates'
  | 'creatives'
  | 'trends'
  | 'recycled';

export type HealthStatus = 'healthy' | 'active' | 'new' | null;

export interface IngredientCount {
  type: IngredientType;
  count: number;
  health: HealthStatus;
  health_detail: string | null;
  sub_label: string | null;
}

export interface IngredientInventory {
  team_profile_id: string;
  ingredients: IngredientCount[];
}

// ─── Recipes ──────────────────────────────────────────────

export interface RecipeSuggestion {
  ingredients: Array<{
    type: IngredientType;
    id?: string;
    name: string;
  }>;
  combo_name: string;
  multiplier: number;
  post_count: number;
  context: string;
}

// ─── Combo Performance ────────────────────────────────────

export interface ComboPerformance {
  exploit_name: string | null;
  knowledge_topic: string | null;
  style_name: string | null;
  template_name: string | null;
  avg_engagement: number;
  multiplier: number;
  post_count: number;
  last_used: string;
}

// ─── Mix Recipe (DB row) ──────────────────────────────────

export interface MixRecipe {
  id: string;
  team_profile_id: string;
  exploit_id: string | null;
  knowledge_topic: string | null;
  knowledge_query: string | null;
  style_id: string | null;
  template_id: string | null;
  creative_id: string | null;
  trend_topic: string | null;
  recycled_post_id: string | null;
  instructions: string | null;
  output_type: 'drafts' | 'ideas';
  post_ids: string[];
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Write Zod validation schemas**

```typescript
/** Mixer validation schemas. Validates API inputs for mixer endpoints. */
import { z } from 'zod';

// ─── Mix ──────────────────────────────────────────────────

export const MixSchema = z.object({
  team_profile_id: z.string().uuid(),
  exploit_id: z.string().uuid().optional(),
  knowledge_topic: z.string().max(200).optional(),
  knowledge_query: z.string().max(500).optional(),
  style_id: z.string().uuid().optional(),
  template_id: z.string().uuid().optional(),
  creative_id: z.string().uuid().optional(),
  trend_topic: z.string().max(200).optional(),
  recycled_post_id: z.string().uuid().optional(),
  idea_id: z.string().uuid().optional(),
  hook: z.string().max(500).optional(),
  instructions: z.string().max(2000).optional(),
  count: z.number().int().min(1).max(5).default(3),
  output: z.enum(['drafts', 'ideas']).default('drafts'),
}).refine(
  (data) => {
    // hook and instructions are direction, not ingredients
    const ingredients = [
      data.exploit_id, data.knowledge_topic, data.knowledge_query,
      data.style_id, data.template_id, data.creative_id,
      data.trend_topic, data.recycled_post_id, data.idea_id,
    ];
    return ingredients.some(Boolean);
  },
  { message: 'At least one ingredient must be selected' }
);

export type MixInput = z.infer<typeof MixSchema>;

// ─── Inventory ────────────────────────────────────────────

export const InventoryQuerySchema = z.object({
  team_profile_id: z.string().uuid(),
});

// ─── Recipes ──────────────────────────────────────────────

export const RecipeQuerySchema = z.object({
  team_profile_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// ─── Combo Performance ────────────────────────────────────

export const ComboPerformanceQuerySchema = z.object({
  team_profile_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
```

- [ ] **Step 3: Write tests for validation schemas**

Create `src/__tests__/lib/validations/mixer.test.ts`:

```typescript
import { MixSchema, InventoryQuerySchema, RecipeQuerySchema } from '@/lib/validations/mixer';

describe('MixSchema', () => {
  it('requires at least one ingredient', () => {
    const result = MixSchema.safeParse({
      team_profile_id: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid input with one ingredient', () => {
    const result = MixSchema.safeParse({
      team_profile_id: '00000000-0000-0000-0000-000000000001',
      exploit_id: '00000000-0000-0000-0000-000000000002',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with multiple ingredients', () => {
    const result = MixSchema.safeParse({
      team_profile_id: '00000000-0000-0000-0000-000000000001',
      exploit_id: '00000000-0000-0000-0000-000000000002',
      knowledge_topic: 'Sales Objections',
      style_id: '00000000-0000-0000-0000-000000000003',
      count: 3,
      output: 'drafts',
    });
    expect(result.success).toBe(true);
  });

  it('defaults count to 3 and output to drafts', () => {
    const result = MixSchema.parse({
      team_profile_id: '00000000-0000-0000-0000-000000000001',
      exploit_id: '00000000-0000-0000-0000-000000000002',
    });
    expect(result.count).toBe(3);
    expect(result.output).toBe('drafts');
  });

  it('rejects count > 5', () => {
    const result = MixSchema.safeParse({
      team_profile_id: '00000000-0000-0000-0000-000000000001',
      exploit_id: '00000000-0000-0000-0000-000000000002',
      count: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe('InventoryQuerySchema', () => {
  it('requires team_profile_id', () => {
    const result = InventoryQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('validates UUID format', () => {
    const result = InventoryQuerySchema.safeParse({ team_profile_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --testPathPattern="validations/mixer" --verbose`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/mixer.ts src/lib/validations/mixer.ts src/__tests__/lib/validations/mixer.test.ts
git commit -m "feat: add mixer types and validation schemas"
```

---

## Task 3: Mix Recipes Repository

**Files:**
- Create: `src/server/repositories/mix-recipes.repo.ts`

- [ ] **Step 1: Write the repository**

```typescript
/** Mix recipes repository. CRUD for cp_mix_recipes table. Never imports from Next.js or React. */
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { MixRecipe } from '@/lib/types/mixer';

// ─── Column Constants ─────────────────────────────────────

const MIX_RECIPE_COLUMNS = `
  id, team_profile_id,
  exploit_id, knowledge_topic, knowledge_query,
  style_id, template_id, creative_id,
  trend_topic, recycled_post_id,
  instructions, output_type, post_ids,
  created_at, updated_at
` as const;

// ─── Reads ────────────────────────────────────────────────

export async function getRecipesByProfile(
  teamProfileId: string,
  limit = 50
): Promise<MixRecipe[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_mix_recipes')
    .select(MIX_RECIPE_COLUMNS)
    .eq('team_profile_id', teamProfileId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw Object.assign(new Error(`Failed to fetch recipes: ${error.message}`), { statusCode: 500 });
  return (data ?? []) as MixRecipe[];
}

export async function getRecipeById(id: string): Promise<MixRecipe | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_mix_recipes')
    .select(MIX_RECIPE_COLUMNS)
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw Object.assign(new Error(`Failed to fetch recipe: ${error.message}`), { statusCode: 500 });
  }
  return (data as MixRecipe) ?? null;
}

// ─── Writes ───────────────────────────────────────────────

export interface InsertMixRecipe {
  team_profile_id: string;
  exploit_id?: string | null;
  knowledge_topic?: string | null;
  knowledge_query?: string | null;
  style_id?: string | null;
  template_id?: string | null;
  creative_id?: string | null;
  trend_topic?: string | null;
  recycled_post_id?: string | null;
  instructions?: string | null;
  output_type: 'drafts' | 'ideas';
}

export async function insertRecipe(input: InsertMixRecipe): Promise<MixRecipe> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_mix_recipes')
    .insert(input)
    .select(MIX_RECIPE_COLUMNS)
    .single();

  if (error) throw Object.assign(new Error(`Failed to insert recipe: ${error.message}`), { statusCode: 500 });
  return data as MixRecipe;
}

export async function updateRecipePostIds(
  recipeId: string,
  postIds: string[]
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_mix_recipes')
    .update({ post_ids: postIds })
    .eq('id', recipeId);

  if (error) throw Object.assign(new Error(`Failed to update recipe post_ids: ${error.message}`), { statusCode: 500 });
}
```

- [ ] **Step 2: Write repository tests**

Create `src/__tests__/lib/repositories/mix-recipes.repo.test.ts`. Test:
- `insertRecipe` calls Supabase insert with correct columns
- `getRecipesByProfile` filters by team_profile_id and orders by created_at DESC
- `updateRecipePostIds` calls update with post_ids array
- Error handling: throws with statusCode 500 on Supabase errors

Mock Supabase following pattern from existing tests.

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --testPathPattern="mix-recipes.repo" --verbose`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/server/repositories/mix-recipes.repo.ts src/__tests__/lib/repositories/mix-recipes.repo.test.ts
git commit -m "feat: add mix-recipes repository"
```

---

## Task 4: Mixer Prompt Builder

**Files:**
- Create: `src/lib/ai/content-pipeline/mixer-prompt-builder.ts`
- Create: `src/__tests__/lib/ai/mixer-prompt-builder.test.ts`
- Modify: `src/lib/ai/content-pipeline/post-writer.ts` (add line break rule)

- [ ] **Step 1: Export getBaseStyleGuidelines and add line break rule**

In `src/lib/ai/content-pipeline/post-writer.ts`:
1. Add `export` to `function getBaseStyleGuidelines()` (currently private — the mixer prompt builder needs to import it)
2. Find the formatting section and add:

```
- Line breaks between most sentences. Not necessarily every sentence,
  but most. LinkedIn is read on mobile — dense paragraphs get skipped.
```

- [ ] **Step 2: Write the mixer prompt builder**

```typescript
/** Mixer prompt builder. Constructs prompts from selected ingredients.
 *  Never imports from Next.js, React, or Supabase. Pure function. */
import type { StyleProfile, TeamVoiceProfile } from '@/lib/types/content-pipeline';

// ─── Types ────────────────────────────────────────────────

export interface MixerPromptInput {
  exploit?: { name: string; description: string; example_posts: string[]; prompt_template?: string };
  knowledge?: { topic: string; entries: Array<{ content: string; context?: string }> };
  style?: { style_profile: StyleProfile; example_posts?: string[] };
  teamVoiceProfile?: TeamVoiceProfile;
  template?: { name: string; structure: string; example_posts?: string[] };
  creative?: { content_text: string; source_platform?: string };
  trend?: { topic: string; context?: string };
  recycled?: { content: string; engagement_stats?: string };
  idea?: { title: string; core_insight: string; key_points?: string[] };
  hook?: string;
  instructions?: string;
  count: number;
  output: 'drafts' | 'ideas';
}

// ─── Public API ───────────────────────────────────────────

export function buildMixerPrompt(input: MixerPromptInput, baseStyleGuidelines: string): string {
  const sections: string[] = [];

  sections.push(buildSystemSection(input.output, input.count));

  if (input.exploit) sections.push(buildExploitSection(input.exploit));
  if (input.knowledge) sections.push(buildKnowledgeSection(input.knowledge));
  if (input.style || input.teamVoiceProfile) {
    sections.push(buildMixerVoiceSection(input.style, input.teamVoiceProfile));
  }
  if (input.template) sections.push(buildTemplateSection(input.template));
  if (input.creative) sections.push(buildCreativeSection(input.creative));
  if (input.trend) sections.push(buildTrendSection(input.trend));
  if (input.recycled) sections.push(buildRecycledSection(input.recycled));
  if (input.idea) sections.push(buildIdeaSection(input.idea));
  if (input.hook) sections.push(buildHookSection(input.hook));
  if (input.instructions) sections.push(buildInstructionsSection(input.instructions));

  sections.push(baseStyleGuidelines);
  sections.push(buildOutputSection(input.output, input.count));

  return sections.join('\n\n');
}

// ─── Voice Section (merges StyleProfile + TeamVoiceProfile) ──

export function buildMixerVoiceSection(
  style?: { style_profile: StyleProfile; example_posts?: string[] },
  teamVoice?: TeamVoiceProfile
): string {
  if (!style && !teamVoice) return '';
  const lines: string[] = ['## VOICE — Match this writing style'];

  if (style?.style_profile) {
    const sp = style.style_profile;
    if (sp.tone) lines.push(`Tone: ${sp.tone}`);
    if (sp.sentence_length) lines.push(`Sentence length: ${sp.sentence_length}`);
    if (sp.vocabulary) lines.push(`Vocabulary level: ${sp.vocabulary}`);
    if (sp.banned_phrases?.length) lines.push(`NEVER use these phrases: ${sp.banned_phrases.join(', ')}`);
    if (sp.signature_phrases?.length) lines.push(`Signature phrases to use naturally: ${sp.signature_phrases.join(', ')}`);
    if (sp.hook_patterns?.length) lines.push(`Hook patterns this author uses: ${sp.hook_patterns.join('; ')}`);
    if (sp.cta_patterns?.length) lines.push(`CTA patterns: ${sp.cta_patterns.join('; ')}`);
    if (sp.formatting) {
      const fmt = sp.formatting;
      if (fmt.uses_emojis === false) lines.push('No emojis.');
      if (fmt.uses_lists) lines.push('Can use lists when appropriate.');
      if (fmt.avg_paragraphs) lines.push(`Aim for ~${fmt.avg_paragraphs} paragraphs.`);
    }
    if (style.example_posts?.length) {
      lines.push(`\nApproved example posts (match this quality):`);
      style.example_posts.slice(0, 3).forEach((p, i) => lines.push(`Example ${i + 1}:\n${p}`));
    }
  }

  // TeamVoiceProfile takes precedence on conflicts
  if (teamVoice) {
    if (teamVoice.tone) lines.push(`[Override] Tone: ${teamVoice.tone}`);
    if (teamVoice.banned_phrases?.length) {
      lines.push(`[Override] NEVER use: ${teamVoice.banned_phrases.join(', ')}`);
    }
    if (teamVoice.vocabulary_preferences) {
      const vp = teamVoice.vocabulary_preferences;
      if (vp.avoid?.length) lines.push(`Vocabulary AVOID: ${vp.avoid.join(', ')}`);
      if (vp.prefer?.length) lines.push(`Vocabulary PREFER: ${vp.prefer.join(', ')}`);
    }
    if (teamVoice.storytelling_style) lines.push(`Storytelling: ${teamVoice.storytelling_style}`);
    if (teamVoice.cta_style) lines.push(`CTA style: ${teamVoice.cta_style}`);
  }

  return lines.join('\n');
}

// ─── Section Builders ─────────────────────────────────────

function buildSystemSection(output: 'drafts' | 'ideas', count: number): string {
  return `You are generating LinkedIn content by combining specific ingredients selected by the user. Each ingredient contributes a different dimension to the output. More ingredients = more constrained and distinctive output.

Output type: ${output === 'drafts' ? `${count} complete LinkedIn post drafts` : `${count} content ideas (title + hook + angle)`}`;
}

function buildExploitSection(exploit: MixerPromptInput['exploit']): string {
  if (!exploit) return '';
  const lines = [
    `## FORMAT — Use this proven post structure`,
    `Name: ${exploit.name}`,
    `Description: ${exploit.description}`,
  ];
  if (exploit.prompt_template) lines.push(`Guidance: ${exploit.prompt_template}`);
  if (exploit.example_posts?.length) {
    lines.push(`Examples of this format:`);
    exploit.example_posts.slice(0, 2).forEach((p, i) => lines.push(`Example ${i + 1}:\n${p}`));
  }
  lines.push('Follow this format\'s hook pattern and structural flow.');
  return lines.join('\n');
}

function buildKnowledgeSection(knowledge: MixerPromptInput['knowledge']): string {
  if (!knowledge) return '';
  const lines = [
    `## SUBSTANCE — Draw on this expertise`,
    `Topic: ${knowledge.topic}`,
    `Relevant knowledge entries:`,
  ];
  knowledge.entries.forEach((e, i) => {
    lines.push(`[${i + 1}] ${e.content}`);
    if (e.context) lines.push(`   Context: ${e.context}`);
  });
  lines.push('Use specific facts, numbers, stories, and quotes from this knowledge.');
  lines.push('Do not make up facts — only use what is provided.');
  return lines.join('\n');
}

function buildTemplateSection(template: MixerPromptInput['template']): string {
  if (!template) return '';
  const lines = [
    `## STRUCTURE — Follow this skeleton`,
    `Template: ${template.name}`,
    template.structure,
  ];
  if (template.example_posts?.length) {
    lines.push('Example posts using this structure:');
    template.example_posts.slice(0, 2).forEach((p, i) => lines.push(`Example ${i + 1}:\n${p}`));
  }
  return lines.join('\n');
}

function buildCreativeSection(creative: MixerPromptInput['creative']): string {
  if (!creative) return '';
  return [
    `## INSPIRATION — Riff on this example`,
    creative.source_platform ? `Source: ${creative.source_platform}` : '',
    creative.content_text,
    'Use this as inspiration for angle/topic. Do not copy it.',
  ].filter(Boolean).join('\n');
}

function buildTrendSection(trend: MixerPromptInput['trend']): string {
  if (!trend) return '';
  return [
    `## TIMING — Tie into this trending topic`,
    `Topic: ${trend.topic}`,
    trend.context ? `Context: ${trend.context}` : '',
    'Make the connection natural, not forced.',
  ].filter(Boolean).join('\n');
}

function buildRecycledSection(recycled: MixerPromptInput['recycled']): string {
  if (!recycled) return '';
  return [
    `## REMIX — Reimagine this previous post`,
    `Original post:`,
    recycled.content,
    recycled.engagement_stats ? `Original performance: ${recycled.engagement_stats}` : '',
    'Create a fresh take — same core insight, different angle/hook.',
  ].filter(Boolean).join('\n');
}

function buildIdeaSection(idea: MixerPromptInput['idea']): string {
  if (!idea) return '';
  const lines = [
    `## IDEA — Expand this content idea`,
    `Title: ${idea.title}`,
    `Core insight: ${idea.core_insight}`,
  ];
  if (idea.key_points?.length) {
    lines.push(`Key points: ${idea.key_points.join('; ')}`);
  }
  return lines.join('\n');
}

function buildHookSection(hook: string): string {
  return `## HOOK — Start with this opening\n${hook}\nUse this as the first line. Build the post from here.`;
}

function buildInstructionsSection(instructions: string): string {
  return `## ADDITIONAL DIRECTION\n${instructions}`;
}

function buildOutputSection(output: 'drafts' | 'ideas', count: number): string {
  if (output === 'drafts') {
    return `Generate exactly ${count} LinkedIn post drafts as a JSON array.
Each draft object: { "content": "full post text", "hook_used": "first line of post" }
Drafts should each take a different angle on the same ingredients.`;
  }
  return `Generate exactly ${count} content ideas as a JSON array.
Each idea object: { "title": "idea title", "hook": "suggested opening line", "angle": "one sentence describing the approach", "relevance_score": 0.0-1.0 }`;
}
```

- [ ] **Step 3: Write prompt builder tests**

Create `src/__tests__/lib/ai/mixer-prompt-builder.test.ts`:

```typescript
import { buildMixerPrompt, buildMixerVoiceSection } from '@/lib/ai/content-pipeline/mixer-prompt-builder';

describe('buildMixerPrompt', () => {
  const baseStyle = '## Base Style\nWrite naturally.';

  it('builds prompt with single exploit ingredient', () => {
    const result = buildMixerPrompt({
      exploit: { name: 'Authority Play', description: 'Share expertise', example_posts: ['Example post'] },
      count: 3,
      output: 'drafts',
    }, baseStyle);

    expect(result).toContain('Authority Play');
    expect(result).toContain('FORMAT');
    expect(result).toContain('3 complete LinkedIn post drafts');
    expect(result).toContain('Base Style');
    expect(result).not.toContain('SUBSTANCE');
    expect(result).not.toContain('VOICE');
  });

  it('builds prompt with multiple ingredients', () => {
    const result = buildMixerPrompt({
      exploit: { name: 'Authority Play', description: 'Share expertise', example_posts: [] },
      knowledge: { topic: 'Sales Objections', entries: [{ content: 'Key insight about objections' }] },
      instructions: 'Make it punchy',
      count: 2,
      output: 'drafts',
    }, baseStyle);

    expect(result).toContain('FORMAT');
    expect(result).toContain('SUBSTANCE');
    expect(result).toContain('Sales Objections');
    expect(result).toContain('ADDITIONAL DIRECTION');
    expect(result).toContain('Make it punchy');
  });

  it('builds ideas output format', () => {
    const result = buildMixerPrompt({
      knowledge: { topic: 'Pricing', entries: [{ content: 'Value-based pricing works' }] },
      count: 5,
      output: 'ideas',
    }, baseStyle);

    expect(result).toContain('5 content ideas');
    expect(result).toContain('relevance_score');
  });

  it('includes all ingredient sections when all provided', () => {
    const result = buildMixerPrompt({
      exploit: { name: 'Test', description: 'Test', example_posts: [] },
      knowledge: { topic: 'Test', entries: [] },
      style: { style_profile: { tone: 'conversational' } as any, example_posts: [] },
      template: { name: 'Test', structure: 'Hook → Body → CTA', example_posts: [] },
      creative: { content_text: 'Saw this post...' },
      trend: { topic: 'AI agents' },
      recycled: { content: 'Old post content' },
      idea: { title: 'Test idea', core_insight: 'Core insight' },
      hook: 'Custom hook line',
      instructions: 'Extra direction',
      count: 3,
      output: 'drafts',
    }, baseStyle);

    expect(result).toContain('FORMAT');
    expect(result).toContain('SUBSTANCE');
    expect(result).toContain('VOICE');
    expect(result).toContain('STRUCTURE');
    expect(result).toContain('INSPIRATION');
    expect(result).toContain('TIMING');
    expect(result).toContain('REMIX');
    expect(result).toContain('IDEA');
    expect(result).toContain('HOOK');
    expect(result).toContain('ADDITIONAL DIRECTION');
  });
});

describe('buildMixerVoiceSection', () => {
  it('builds from StyleProfile only', () => {
    const result = buildMixerVoiceSection({
      style_profile: {
        tone: 'provocative',
        banned_phrases: ['game-changer', 'leverage'],
        signature_phrases: ['look,'],
        hook_patterns: ['Start with a number'],
      } as any,
    });

    expect(result).toContain('provocative');
    expect(result).toContain('game-changer');
    expect(result).toContain('Start with a number');
  });

  it('merges TeamVoiceProfile with precedence', () => {
    const result = buildMixerVoiceSection(
      { style_profile: { tone: 'educational' } as any },
      { tone: 'provocative', banned_phrases: ['synergy'] } as any
    );

    expect(result).toContain('[Override] Tone: provocative');
    expect(result).toContain('synergy');
  });

  it('returns empty string when no data', () => {
    const result = buildMixerVoiceSection(undefined, undefined);
    expect(result).toBe('');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --testPathPattern="mixer-prompt-builder" --verbose`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/content-pipeline/mixer-prompt-builder.ts src/__tests__/lib/ai/mixer-prompt-builder.test.ts src/lib/ai/content-pipeline/post-writer.ts
git commit -m "feat: add mixer prompt builder with layered ingredient assembly"
```

---

## Task 5: Mixer Service

**Files:**
- Create: `src/server/services/mixer.service.ts`
- Create: `src/__tests__/lib/services/mixer.service.test.ts`

- [ ] **Step 1: Write the mixer service**

This is the core orchestrator. It:
1. Resolves `team_profile_id` → `user_id`, `team_id`
2. Fetches selected ingredients from their respective tables
3. Calls `buildMixerPrompt()` to assemble the prompt
4. Calls Claude to generate content
5. Runs the polish layer
6. Inserts a `cp_mix_recipes` row
7. Returns results

Key functions:
- `resolveScope(teamProfileId)` → `{ userId, teamId, teamProfileId }`
- `getInventory(teamProfileId)` → `IngredientInventory`
- `mix(input: MixInput)` → `MixerResult`
- `getSuggestedRecipes(teamProfileId, limit)` → `RecipeSuggestion[]`
- `getComboPerformance(teamProfileId, limit)` → `ComboPerformance[]`

The service imports from: `mix-recipes.repo`, `exploits.service`, `creatives.service`, `ideas.service`, `cp-templates.service`, `mixer-prompt-builder`, `post-writer` (for base style guidelines), `post-polish` (for polish layer).

**Key implementation details:**

`resolveScope(teamProfileId)`:
- Query `team_profiles` JOIN `team_members` to get `user_id` and `team_id`
- Return `{ userId, teamId, teamProfileId }`
- Throw 404 if team profile not found

`getInventory(teamProfileId)`:
- Run 7 parallel count queries (one per ingredient type) using the scope
- Knowledge: count `cp_knowledge_entries` WHERE `team_profile_id = X`, health = "healthy" if > 10
- Exploits: count `cp_exploits` WHERE `user_id = X OR is_global = true`
- Styles: count `cp_writing_styles` WHERE `team_profile_id = X`, health = "active" if any `is_active`
- Templates: count `cp_post_templates` WHERE `user_id = X OR team_id = X OR is_global = true`
- Creatives: count `cp_creatives` WHERE `user_id = X OR team_id = X`, health = "new" if any `status = 'new'`
- Trends: count distinct topics from recent creatives (last 7 days)
- Recycled: count `cp_pipeline_posts` WHERE `status = 'published'` AND `recycle_after <= now()`

`mix(input)`:
1. Resolve scope
2. Fetch each selected ingredient from its table (parallel where possible)
   - Reference `src/app/api/content-pipeline/posts/generate/route.ts` lines 54-138 for exact column selects
   - For knowledge_topic: query `cp_knowledge_entries` WHERE topic matches, limit 10
   - For knowledge_query: call semantic search (`cp_match_team_knowledge_entries` RPC)
3. Build `MixerPromptInput` from fetched data
4. Call `buildMixerPrompt(input, getBaseStyleGuidelines())` — import `getBaseStyleGuidelines` from `post-writer.ts`
5. Call Claude (Anthropic SDK): `anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 4000, temperature: 1.0, messages: [{ role: 'user', content: prompt }] })`
6. Parse JSON response — extract array of drafts or ideas
7. For drafts: run `polishPost()` on each draft (import from `post-polish.ts`). Verify `polishPost` accepts `{ content: string }` — check its signature.
8. Insert `cp_mix_recipes` row via repo
9. If output = 'ideas': also insert into `cp_content_ideas` with `status: 'extracted'`
10. Return `MixerResult`

`getSuggestedRecipes(teamProfileId, limit)`:
- Query `cp_mix_recipes` for this profile, JOIN post engagement data
- Apply suggestion algorithm from spec:
  ```
  combo_score = (
    performance_multiplier * 0.5
    + recency_penalty * 0.2      // -0.1 per use in last 7 days
    + novelty_bonus * 0.2        // +0.5 if never used, +0.3 if ingredient has unreviewed items
    + freshness_bonus * 0.1      // +0.3 if trend < 3 days or creative < 7 days old
  )
  ```
- Group by ingredient combination, compute average engagement multiplier
- For new profiles: fall back to global averages across all profiles using same exploit
- Return top N by combo_score

`getComboPerformance(teamProfileId, limit)`:
- Query `cp_mix_recipes` WHERE `post_ids != '{}'`, JOIN ingredient names, JOIN post engagement
- Compute multiplier = avg engagement of combo posts / avg engagement of all profile posts
- Return sorted by multiplier DESC

**Reference files the worker MUST read:**
- `src/server/services/exploits.service.ts` for exploit fetching pattern
- `src/server/services/creatives.service.ts` for creative fetching pattern
- `src/app/api/content-pipeline/posts/generate/route.ts` lines 54-138 for ingredient fetching
- `src/lib/ai/content-pipeline/post-writer.ts` for `getBaseStyleGuidelines()` signature
- `src/lib/ai/content-pipeline/post-polish.ts` for `polishPost()` signature and input type

- [ ] **Step 2: Write service tests**

Test: `resolveScope` returns correct user/team IDs, `getInventory` returns counts for all 7 types, `mix` with single ingredient, `mix` with multiple ingredients, `mix` records recipe, error when no ingredients provided.

Mock Supabase calls following the pattern in `src/__tests__/api/content-pipeline/posts-generate.test.ts`.

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --testPathPattern="mixer.service" --verbose`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/server/services/mixer.service.ts src/__tests__/lib/services/mixer.service.test.ts
git commit -m "feat: add mixer service — core ingredient orchestrator"
```

---

## Task 6: API Routes

**Files:**
- Create: `src/app/api/content-pipeline/inventory/route.ts`
- Create: `src/app/api/content-pipeline/recipes/route.ts`
- Create: `src/app/api/content-pipeline/mix/route.ts`
- Create: `src/app/api/content-pipeline/combo-performance/route.ts`
- Create: `src/__tests__/api/content-pipeline/mix.test.ts`
- Create: `src/__tests__/api/content-pipeline/inventory.test.ts`

- [ ] **Step 1: Write the 4 API routes**

Each route follows the existing pattern in `src/app/api/content-pipeline/posts/generate/route.ts`:
1. `getServerSession()` for auth
2. Zod validation of request body/params
3. Delegate to mixer service
4. Return JSON response
5. `logError()` on catch, return status from `getStatusCode()`

Routes:
- `GET /api/content-pipeline/inventory?team_profile_id=...` → `mixerService.getInventory()`
- `GET /api/content-pipeline/recipes?team_profile_id=...&limit=5` → `mixerService.getSuggestedRecipes()`
- `POST /api/content-pipeline/mix` (body: MixSchema) → `mixerService.mix()`
- `GET /api/content-pipeline/combo-performance?team_profile_id=...&limit=10` → `mixerService.getComboPerformance()`

Each route should be <30 lines. All business logic lives in the service.

- [ ] **Step 2: Write route tests**

Test happy path + error cases for ALL 4 routes:
- `mix` — valid input returns drafts, missing ingredients returns 400, unauthenticated returns 401
- `inventory` — returns counts for all 7 types, missing team_profile_id returns 400
- `recipes` — returns suggestions when data exists, empty array for new profiles
- `combo-performance` — returns performance data, empty for new profiles

Create `src/__tests__/api/content-pipeline/recipes.test.ts` and `src/__tests__/api/content-pipeline/combo-performance.test.ts`.

Follow mock pattern from `src/__tests__/api/content-pipeline/posts-generate.test.ts`.

- [ ] **Step 3: Run tests**

Run: `pnpm test -- --testPathPattern="content-pipeline/(mix|inventory|recipes|combo-performance)" --verbose`
Expected: All tests pass

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-pipeline/inventory/ src/app/api/content-pipeline/recipes/ src/app/api/content-pipeline/mix/ src/app/api/content-pipeline/combo-performance/ src/__tests__/api/content-pipeline/mix.test.ts src/__tests__/api/content-pipeline/inventory.test.ts
git commit -m "feat: add mixer API routes — inventory, recipes, mix, combo-performance"
```

---

## Task 7: Frontend API Module + Hooks

**Files:**
- Create: `src/frontend/api/content-pipeline/mixer.ts`
- Create: `src/frontend/hooks/api/useMixer.ts`

- [ ] **Step 1: Write the frontend API module**

Follow the pattern in `src/frontend/api/content-pipeline/generate.ts` and `src/frontend/api/content-pipeline/exploits.ts`:

```typescript
/** Mixer API module. Client-side functions for the ingredient mixer. */
import { apiClient } from '../client';
import type { MixerResult, IngredientInventory, RecipeSuggestion, ComboPerformance } from '@/lib/types/mixer';
import type { MixInput } from '@/lib/validations/mixer';

export async function mix(input: MixInput): Promise<MixerResult> {
  return apiClient.post('/api/content-pipeline/mix', input);
}

export async function getInventory(teamProfileId: string): Promise<IngredientInventory> {
  return apiClient.get(`/api/content-pipeline/inventory?team_profile_id=${teamProfileId}`);
}

export async function getRecipes(teamProfileId: string, limit = 5): Promise<RecipeSuggestion[]> {
  return apiClient.get(`/api/content-pipeline/recipes?team_profile_id=${teamProfileId}&limit=${limit}`);
}

export async function getComboPerformance(teamProfileId: string, limit = 10): Promise<ComboPerformance[]> {
  return apiClient.get(`/api/content-pipeline/combo-performance?team_profile_id=${teamProfileId}&limit=${limit}`);
}
```

- [ ] **Step 2: Write SWR hooks**

Follow the pattern in `src/frontend/hooks/api/useGenerate.ts`:

```typescript
/** Mixer hooks. SWR for queries, useCallback for mutations. */
import useSWR from 'swr';
import { useCallback, useState } from 'react';
import * as mixerApi from '@/frontend/api/content-pipeline/mixer';
import type { MixInput } from '@/lib/validations/mixer';
import type { MixerResult } from '@/lib/types/mixer';

export function useInventory(teamProfileId: string | null) {
  return useSWR(
    teamProfileId ? ['inventory', teamProfileId] : null,
    () => mixerApi.getInventory(teamProfileId!)
  );
}

export function useRecipes(teamProfileId: string | null) {
  return useSWR(
    teamProfileId ? ['recipes', teamProfileId] : null,
    () => mixerApi.getRecipes(teamProfileId!)
  );
}

export function useMix() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<MixerResult | null>(null);

  const generate = useCallback(async (input: MixInput) => {
    setIsPending(true);
    setError(null);
    try {
      const data = await mixerApi.mix(input);
      setResult(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Mix failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { generate, isPending, error, result, reset };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/api/content-pipeline/mixer.ts src/frontend/hooks/api/useMixer.ts
git commit -m "feat: add mixer frontend API module and SWR hooks"
```

---

## Task 8: MCP Tools

**Files:**
- Create: `packages/mcp/src/tools/mixer.ts`
- Create: `packages/mcp/src/handlers/mixer.ts`
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/handlers/index.ts`
- Modify: `packages/mcp/src/client.ts`

- [ ] **Step 1: Define 4 MCP tools**

In `packages/mcp/src/tools/mixer.ts`, define:
- `magnetlab_get_ingredient_inventory` — params: `team_profile_id`
- `magnetlab_get_suggested_recipes` — params: `team_profile_id`, `limit?`
- `magnetlab_mix` — params: all MixInput fields
- `magnetlab_get_combo_performance` — params: `team_profile_id`, `limit?`

Follow the pattern in `packages/mcp/src/tools/posts.ts` for tool schema structure.

- [ ] **Step 2: Write MCP handler**

In `packages/mcp/src/handlers/mixer.ts`, dispatch tool calls to client methods. Follow `packages/mcp/src/handlers/posts.ts` pattern.

- [ ] **Step 3: Add client methods**

In `packages/mcp/src/client.ts`, add:
- `getIngredientInventory(teamProfileId)`
- `getSuggestedRecipes(teamProfileId, limit)`
- `mix(input)`
- `getComboPerformance(teamProfileId, limit)`

- [ ] **Step 4: Register in indexes**

Add imports and registrations in `packages/mcp/src/tools/index.ts` and `packages/mcp/src/handlers/index.ts`.

- [ ] **Step 5: Build and test MCP package**

Run: `cd packages/mcp && pnpm test && pnpm build`
Expected: Tests pass, build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/
git commit -m "feat(mcp): add 4 mixer tools — inventory, recipes, mix, combo-performance"
```

---

## Task 9: Pipeline Page

**Files:**
- Create: `src/app/(dashboard)/pipeline/page.tsx`
- Create: `src/components/pipeline/PipelineContent.tsx`

- [ ] **Step 1: Create Pipeline page server component**

Move the data fetching from current `src/app/(dashboard)/posts/page.tsx` (getPosts, getBufferStatus) into the new Pipeline page. This page hosts the kanban, calendar, autopilot, and content queue tabs.

Reference the current Posts page for data fetching pattern and `PostsContent.tsx` for the tab structure (pipeline, calendar, autopilot tabs only — remove ideas and library).

- [ ] **Step 2: Create PipelineContent client component**

Reuse the existing tab components:
- `PipelineView` from `src/components/posts/PipelineView.tsx` (kanban)
- `CalendarView` from `src/components/posts/CalendarView.tsx` (calendar)
- `AutopilotTab` from `src/components/posts/AutopilotTab.tsx` (autopilot)
- Content queue: find the component in `src/app/(dashboard)/content-queue/` or `src/components/content-queue/` — import and render as 4th tab

4 tabs: Pipeline, Calendar, Autopilot, Content Queue.

Follow the same dynamic import + Suspense pattern as current `PostsContent.tsx` (lines 70+).

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/pipeline/ src/components/pipeline/
git commit -m "feat: add Pipeline page — kanban, calendar, autopilot, content queue"
```

---

## Task 10: Mixer UI Components

**Files:**
- Create: `src/components/mixer/IngredientTile.tsx`
- Create: `src/components/mixer/IngredientDrawer.tsx`
- Create: `src/components/mixer/RecipeCard.tsx`
- Create: `src/components/mixer/DraftResultCard.tsx`
- Create: `src/components/mixer/InventoryCard.tsx`
- Create: `src/components/mixer/MixerBar.tsx`
- Create: `src/components/mixer/MixerZone.tsx`
- Create: `src/components/mixer/RecipesZone.tsx`
- Create: `src/components/mixer/InventoryZone.tsx`
- Create: `src/components/mixer/ResultsZone.tsx`
- Create: `src/components/mixer/SavedIdeasSection.tsx`

- [ ] **Step 1: Build IngredientTile**

Small chip component. Props: `type`, `label`, `icon`, `selected`, `selectedName`, `color`, `onSelect`, `onDeselect`, `loading`. Three visual states: unselected (dashed border), selected (solid colored border + name + ✕), loading (pulse).

Use design system tokens (bg-card, border-border, text-foreground). Reference existing components in `src/components/` for shadcn patterns.

- [ ] **Step 2: Build IngredientDrawer**

Reusable Sheet (from shadcn) that opens from the right. Props: `type`, `open`, `onOpenChange`, `teamProfileId`, `onSelect(item)`. Internal state for search, filters. Fetches items from existing API endpoints (exploits, knowledge, styles, etc.) using SWR hooks. Shows smart suggestion at top when performance data exists.

For Knowledge type: fetch topics from `/api/content-pipeline/knowledge/topics` and show semantic search bar.

- [ ] **Step 3: Build RecipeCard, DraftResultCard, InventoryCard, MixerBar**

Small presentational components. Each <100 lines:
- `RecipeCard` — shows combo name, icons, multiplier, click handler
- `DraftResultCard` — LinkedIn-style preview, "Send to Queue" / "Edit first" / copy buttons, "AI Pick" badge
- `InventoryCard` — count, health badge, sub-label, click handler
- `MixerBar` — collapsed recipe summary (ingredient chips, "Edit recipe", "Regenerate")

- [ ] **Step 4: Build zone components**

- `MixerZone` — orchestrates tiles + instructions field + generate buttons. Manages selected ingredients state. Opens drawers. Calls `useMix()` hook.
- `RecipesZone` — horizontal scroll of RecipeCards. Uses `useRecipes()` hook. Hidden when no data.
- `InventoryZone` — grid of InventoryCards + "+" add card. Uses `useInventory()` hook.
- `ResultsZone` — shows MixerBar (collapsed recipe) + DraftResultCards or IdeaCards. Actions: send to queue, edit, regenerate, send all.
- `SavedIdeasSection` — expandable section showing existing ideas from `cp_content_ideas`. Hidden when count is 0.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/mixer/
git commit -m "feat: add mixer UI components — tiles, drawer, results, inventory"
```

---

## Task 11: New Posts Page (Mixer)

**Files:**
- Modify: `src/app/(dashboard)/posts/page.tsx`
- Modify: `src/components/posts/PostsContent.tsx`

- [ ] **Step 1: Rewrite Posts page server component**

Replace current server component. New version fetches:
- `getInventory(teamProfileId)` for inventory zone
- `getRecipes(teamProfileId)` for suggested recipes
- Existing ideas count for saved ideas section

Pass as props to new PostsContent.

- [ ] **Step 2: Rewrite PostsContent**

Replace 5-tab layout with 4 zones:
1. `MixerZone` — ingredient selection + generate
2. `RecipesZone` — suggested combos
3. `InventoryZone` — ingredient counts
4. `ResultsZone` — inline results (shown after generation)
5. `SavedIdeasSection` — below inventory (if ideas exist)

Profile switcher stays at top.

- [ ] **Step 3: Visual test in dev**

Run: `pnpm dev` and visit `/posts`
Expected: Mixer page renders with all 4 zones. No JS errors in console.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/posts/ src/components/posts/
git commit -m "feat: replace Posts page with ingredient mixer"
```

---

## Task 12: Sidebar + Redirects

**Files:**
- Modify: `src/components/dashboard/AppSidebar.tsx`
- Modify: `src/app/(dashboard)/knowledge/page.tsx`
- Modify: `src/app/(dashboard)/inspo/page.tsx`
- Modify: `src/app/(dashboard)/content-queue/page.tsx`
- Modify or create: `src/app/(dashboard)/pages/page.tsx` (redirect)

- [ ] **Step 1: Update sidebar nav groups**

In `AppSidebar.tsx`:
- Remove `planNav` (Knowledge, Inspo)
- Remove `editNav` (Content Queue)
- Update `createNav`: Posts, Lead Magnets, Email (remove Pages)
- Update `distributeNav`: Pipeline (new, `/pipeline`), Campaigns, Signals, Leads
- Remove Plan and Edit NavGroup renders
- Keep Home ungrouped, bottom nav unchanged

Reference current structure at lines 92-120 of AppSidebar.tsx.

- [ ] **Step 2: Add redirect pages**

Replace page content with `redirect()` calls:
- `/knowledge/page.tsx` → `redirect('/posts')`
- `/inspo/page.tsx` → `redirect('/posts')`
- `/content-queue/page.tsx` → `redirect('/pipeline')`
- `/pages/page.tsx` → `redirect('/magnets')`

Use `import { redirect } from 'next/navigation'` in server components.

- [ ] **Step 3: Update CreateNewDropdown**

Update links in the dropdown component within AppSidebar.tsx:
- "New Page" → `/magnets/new` (or remove if Pages is fully merged)

- [ ] **Step 4: Visual test**

Run: `pnpm dev`
Expected: Sidebar shows Create (Posts, Lead Magnets, Email) and Distribute (Pipeline, Campaigns, Signals, Leads). Old URLs redirect correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/AppSidebar.tsx src/app/\(dashboard\)/knowledge/ src/app/\(dashboard\)/inspo/ src/app/\(dashboard\)/content-queue/ src/app/\(dashboard\)/pages/
git commit -m "feat: reorganize sidebar — Create + Distribute sections, add redirects"
```

---

## Task 13: Integration Test + Polish

**Files:**
- All files from previous tasks

- [ ] **Step 1: Run full test suite**

Run: `pnpm test --verbose`
Expected: All tests pass (existing + new)

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 4: Test end-to-end flow manually**

Run: `pnpm dev`
1. Visit `/posts` → see mixer page
2. Select an exploit tile → drawer opens
3. Pick an exploit → tile shows selected
4. Select knowledge tile → drawer with topics
5. Hit "Generate Drafts" → loading state → drafts appear inline
6. "Send to Queue" → redirects to `/pipeline`
7. Visit `/pipeline` → see kanban with new draft
8. Visit `/knowledge` → redirects to `/posts`
9. Visit `/inspo` → redirects to `/posts`
10. Sidebar shows correct sections

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes"
```

---

## Task 14: MCP Build + Deploy

**Files:**
- `packages/mcp/`

- [ ] **Step 1: Build MCP package**

Run: `cd packages/mcp && pnpm build`
Expected: Build succeeds

- [ ] **Step 2: Bump version**

Bump version in `packages/mcp/package.json` (e.g. 0.4.3 → 0.5.0)

- [ ] **Step 3: Run MCP tests**

Run: `cd packages/mcp && pnpm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/mcp/
git commit -m "feat(mcp): bump to 0.5.0 with mixer tools"
```

---

## Task Dependency Graph

```
Task 1 (DB migration)
  ↓
Task 2 (Types + Validation) — independent of Task 1
  ↓
Task 3 (Repository) — needs Task 1 + 2
  ↓
Task 4 (Prompt Builder) — independent, can parallel with Task 3
  ↓
Task 5 (Mixer Service) — needs Task 3 + 4
  ↓
Task 6 (API Routes) — needs Task 5
  ↓
Task 7 (Frontend API + Hooks) — needs Task 6
  ↓
Task 8 (MCP Tools) — needs Task 5, can parallel with Task 7
  ↓
Task 9 (Pipeline Page) — independent, can start after Task 2
  ↓
Task 10 (Mixer UI Components) — needs Task 7
  ↓
Task 11 (New Posts Page) — needs Task 9 + 10
  ↓
Task 12 (Sidebar + Redirects) — needs Task 9 + 11
  ↓
Task 13 (Integration Test) — needs all above
  ↓
Task 14 (MCP Build) — needs Task 8 + 13
```

**Parallelizable groups:**
- Group A: Task 1, Task 2, Task 4 (all independent)
- Group B: Task 3 (after 1+2), Task 9 (after 2)
- Group C: Task 7, Task 8 (both after 5+6)
- Group D: Task 10 (after 7), parallel with Task 8
