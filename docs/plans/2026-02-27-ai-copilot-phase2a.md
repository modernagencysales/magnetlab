# AI Co-pilot Phase 2a: Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working conversational AI co-pilot with a shared action layer, streaming Claude tool_use loop, conversation persistence, and a global sidebar UI.

**Architecture:** Claude Sonnet with tool_use calls a shared action layer (`src/lib/actions/`) — pure async functions that call Supabase + AI modules directly (no HTTP). The co-pilot streams responses via SSE from `POST /api/copilot/chat`. Frontend renders in a global sidebar mounted at the dashboard layout level.

**Tech Stack:** Next.js 15, @anthropic-ai/sdk ^0.74.0 (Helicone-proxied), Supabase (PostgreSQL), React 18, TailwindCSS, SSE streaming

**Design doc:** `docs/plans/2026-02-27-ai-copilot-design.md`

---

## Dependencies

No new npm packages needed. All existing:
- `@anthropic-ai/sdk` — Claude API with streaming
- `@supabase/supabase-js` — DB access
- `lucide-react` — Icons
- `zod` — Validation

## Key Existing Files (Read These)

- `src/lib/ai/content-pipeline/anthropic-client.ts` — `getAnthropicClient()`, `parseJsonResponse()`
- `src/lib/services/knowledge-brain.ts` — `searchKnowledgeV2()`, `listKnowledgeTopics()`
- `src/lib/ai/content-pipeline/post-writer.ts` — `writePost()`, `WritePostInput`
- `src/lib/ai/content-pipeline/post-polish.ts` — `polishPost()`
- `src/lib/ai/content-pipeline/briefing-agent.ts` — `buildContentBrief()`
- `src/lib/ai/content-pipeline/voice-prompt-builder.ts` — `buildVoicePromptSection()`
- `src/lib/ai/content-pipeline/prompt-defaults.ts` — `PROMPT_DEFAULTS` record, `PromptDefault` interface
- `src/lib/services/prompt-registry.ts` — `getPrompt()`, `interpolatePrompt()`
- `src/lib/auth/index.ts` — `auth()` returns `Session | null`
- `src/lib/utils/supabase-server.ts` — `createSupabaseAdminClient()`
- `src/app/(dashboard)/layout.tsx` — Dashboard layout (mount co-pilot here)
- `src/lib/types/content-pipeline.ts` — `TeamVoiceProfile`, `ContentBrief`, etc.

---

## Task 1: Action Layer Foundation — Types, Registry, Executor

**Files:**
- Create: `src/lib/actions/types.ts`
- Create: `src/lib/actions/registry.ts`
- Create: `src/lib/actions/executor.ts`
- Test: `src/__tests__/lib/actions/executor.test.ts`

**Step 1: Create types**

```typescript
// src/lib/actions/types.ts
export interface ActionContext {
  userId: string;
  teamId?: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  displayHint?: 'post_preview' | 'knowledge_list' | 'plan' | 'idea_list' | 'calendar' | 'text';
}

export type ActionHandler<TParams = unknown, TResult = unknown> = (
  ctx: ActionContext,
  params: TParams,
) => Promise<ActionResult<TResult>>;

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
  handler: ActionHandler;
  requiresConfirmation?: boolean; // For destructive actions
}
```

**Step 2: Create registry**

The registry exports Claude tool definitions AND maps names to handlers.

```typescript
// src/lib/actions/registry.ts
import type { ActionDefinition } from './types';

// Will be populated by action modules registering themselves
const actions = new Map<string, ActionDefinition>();

export function registerAction(def: ActionDefinition): void {
  actions.set(def.name, def);
}

export function getAction(name: string): ActionDefinition | undefined {
  return actions.get(name);
}

export function getAllActions(): ActionDefinition[] {
  return Array.from(actions.values());
}

/**
 * Export tool definitions in Claude's tool_use format.
 */
export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return getAllActions().map((action) => ({
    name: action.name,
    description: action.description,
    input_schema: {
      type: 'object',
      ...action.parameters,
    },
  }));
}
```

**Step 3: Create executor**

```typescript
// src/lib/actions/executor.ts
import type { ActionContext, ActionResult } from './types';
import { getAction } from './registry';

export async function executeAction(
  ctx: ActionContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ActionResult> {
  const action = getAction(name);
  if (!action) {
    return { success: false, error: `Unknown action: ${name}` };
  }

  try {
    return await action.handler(ctx, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Action execution failed';
    return { success: false, error: message };
  }
}

export function actionRequiresConfirmation(name: string): boolean {
  const action = getAction(name);
  return action?.requiresConfirmation ?? false;
}
```

**Step 4: Write tests**

```typescript
// src/__tests__/lib/actions/executor.test.ts
/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import { registerAction, getAction, getToolDefinitions } from '@/lib/actions/registry';
import type { ActionContext } from '@/lib/actions/types';

const ctx: ActionContext = { userId: 'user-1' };

describe('Action Registry', () => {
  beforeAll(() => {
    registerAction({
      name: 'test_action',
      description: 'A test action',
      parameters: { properties: { query: { type: 'string' } }, required: ['query'] },
      handler: async (_ctx, params: { query: string }) => ({
        success: true,
        data: { echo: params.query },
        displayHint: 'text' as const,
      }),
    });
  });

  it('registers and retrieves actions', () => {
    const action = getAction('test_action');
    expect(action).toBeDefined();
    expect(action!.name).toBe('test_action');
  });

  it('exports tool definitions in Claude format', () => {
    const tools = getToolDefinitions();
    expect(tools.length).toBeGreaterThan(0);
    const tool = tools.find(t => t.name === 'test_action');
    expect(tool).toBeDefined();
    expect(tool!.input_schema.type).toBe('object');
  });
});

describe('Action Executor', () => {
  it('executes a registered action', async () => {
    const result = await executeAction(ctx, 'test_action', { query: 'hello' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ echo: 'hello' });
  });

  it('returns error for unknown action', async () => {
    const result = await executeAction(ctx, 'nonexistent', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });

  it('catches handler errors', async () => {
    registerAction({
      name: 'broken_action',
      description: 'Throws',
      parameters: {},
      handler: async () => { throw new Error('boom'); },
    });
    const result = await executeAction(ctx, 'broken_action', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });
});
```

**Step 5: Run tests**

```bash
npx jest --no-coverage src/__tests__/lib/actions/executor.test.ts
```
Expected: 5 tests pass

**Step 6: Commit**

```bash
git add src/lib/actions/ src/__tests__/lib/actions/
git commit -m "feat: add action layer foundation — types, registry, executor"
```

---

## Task 2: Knowledge Actions

**Files:**
- Create: `src/lib/actions/knowledge.ts`
- Test: `src/__tests__/lib/actions/knowledge.test.ts`

**Step 1: Implement knowledge actions**

These wrap the existing `knowledge-brain.ts` service functions.

```typescript
// src/lib/actions/knowledge.ts
import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { searchKnowledgeV2, listKnowledgeTopics } from '@/lib/services/knowledge-brain';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';

registerAction({
  name: 'search_knowledge',
  description: 'Search the AI Brain knowledge base using semantic search. Always call this before writing content to ground it in real expertise from transcripts and calls.',
  parameters: {
    properties: {
      query: { type: 'string', description: 'Semantic search query' },
      knowledge_type: {
        type: 'string',
        enum: ['how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'],
        description: 'Filter by knowledge type',
      },
      topic: { type: 'string', description: 'Filter by topic slug' },
      min_quality: { type: 'number', description: 'Minimum quality score 1-5' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    required: ['query'],
  },
  handler: async (ctx: ActionContext, params: {
    query: string;
    knowledge_type?: string;
    topic?: string;
    min_quality?: number;
    limit?: number;
  }): Promise<ActionResult> => {
    const results = await searchKnowledgeV2(ctx.userId, {
      query: params.query,
      knowledgeType: params.knowledge_type,
      topicSlug: params.topic,
      minQuality: params.min_quality,
      limit: params.limit || 10,
      teamId: ctx.teamId,
    });
    return { success: true, data: results, displayHint: 'knowledge_list' };
  },
});

registerAction({
  name: 'list_topics',
  description: 'List all auto-discovered knowledge topics with entry counts and quality scores.',
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max topics to return (default 20)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const topics = await listKnowledgeTopics(ctx.userId, {
      teamId: ctx.teamId,
      limit: params.limit || 20,
    });
    return { success: true, data: topics, displayHint: 'text' };
  },
});

registerAction({
  name: 'build_content_brief',
  description: 'Build a knowledge-powered content brief for a topic. Returns relevant knowledge entries organized by type, suggested angles, and topic readiness score. Use this before writing to inject real expertise.',
  parameters: {
    properties: {
      topic: { type: 'string', description: 'The topic to build a brief for' },
    },
    required: ['topic'],
  },
  handler: async (ctx: ActionContext, params: { topic: string }): Promise<ActionResult> => {
    const brief = await buildContentBrief(ctx.userId, params.topic, {
      teamId: ctx.teamId,
    });
    return { success: true, data: brief, displayHint: 'text' };
  },
});
```

**Step 2: Write tests** (mock Supabase/AI calls)

```typescript
// src/__tests__/lib/actions/knowledge.test.ts
/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import '@/lib/actions/knowledge'; // registers actions on import
import type { ActionContext } from '@/lib/actions/types';

// Mock the underlying services
jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledgeV2: jest.fn().mockResolvedValue([
    { id: 'k1', content: 'Pricing insight', knowledge_type: 'insight', quality_score: 4 },
  ]),
  listKnowledgeTopics: jest.fn().mockResolvedValue([
    { slug: 'pricing', display_name: 'Pricing', entry_count: 12, avg_quality: 3.8 },
  ]),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({
    topic: 'pricing',
    compiledContext: 'Context...',
    suggestedAngles: ['Angle 1'],
    topicReadiness: 0.85,
  }),
}));

const ctx: ActionContext = { userId: 'user-1' };

describe('Knowledge Actions', () => {
  it('search_knowledge returns results', async () => {
    const result = await executeAction(ctx, 'search_knowledge', { query: 'pricing' });
    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('knowledge_list');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('list_topics returns topics', async () => {
    const result = await executeAction(ctx, 'list_topics', {});
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('build_content_brief returns brief', async () => {
    const result = await executeAction(ctx, 'build_content_brief', { topic: 'pricing' });
    expect(result.success).toBe(true);
    expect((result.data as { topicReadiness: number }).topicReadiness).toBe(0.85);
  });
});
```

**Step 3: Run tests**

```bash
npx jest --no-coverage src/__tests__/lib/actions/knowledge.test.ts
```

**Step 4: Commit**

```bash
git add src/lib/actions/knowledge.ts src/__tests__/lib/actions/knowledge.test.ts
git commit -m "feat: add knowledge actions — search, topics, content brief"
```

---

## Task 3: Content Actions

**Files:**
- Create: `src/lib/actions/content.ts`
- Test: `src/__tests__/lib/actions/content.test.ts`

**Step 1: Implement content actions**

```typescript
// src/lib/actions/content.ts
import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { writePost, type WritePostInput } from '@/lib/ai/content-pipeline/post-writer';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';

registerAction({
  name: 'write_post',
  description: 'Write a LinkedIn post on a given topic. Automatically searches knowledge base for relevant context and uses the user\'s voice profile. Returns the full post content + variations.',
  parameters: {
    properties: {
      topic: { type: 'string', description: 'The topic or idea to write about' },
      content_type: {
        type: 'string',
        enum: ['thought_leadership', 'personal_story', 'how_to', 'contrarian', 'case_study', 'listicle', 'question', 'announcement'],
        description: 'Post format/type',
      },
      template_id: { type: 'string', description: 'Optional template ID to guide the structure' },
      style_id: { type: 'string', description: 'Optional writing style ID' },
    },
    required: ['topic'],
  },
  handler: async (ctx: ActionContext, params: {
    topic: string;
    content_type?: string;
    template_id?: string;
    style_id?: string;
  }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    // Build knowledge brief for context
    const brief = await buildContentBrief(ctx.userId, params.topic, { teamId: ctx.teamId });

    // Get voice profile
    const { data: profile } = await supabase
      .from('team_profiles')
      .select('voice_profile, full_name, title')
      .eq('user_id', ctx.userId)
      .limit(1)
      .single();

    const input: WritePostInput = {
      idea: {
        title: params.topic,
        core_insight: params.topic,
        content_type: params.content_type || 'thought_leadership',
        full_context: brief.compiledContext || '',
        hook: '',
        key_points: [],
      },
      knowledgeContext: brief.compiledContext,
      voiceProfile: profile?.voice_profile || undefined,
      authorName: profile?.full_name || undefined,
      authorTitle: profile?.title || undefined,
    };

    // Load template if specified
    if (params.template_id) {
      const { data: template } = await supabase
        .from('cp_post_templates')
        .select('*')
        .eq('id', params.template_id)
        .eq('user_id', ctx.userId)
        .single();
      if (template) {
        input.template = template;
      }
    }

    const result = await writePost(input);

    // Persist to pipeline
    const { data: post } = await supabase
      .from('cp_pipeline_posts')
      .insert({
        user_id: ctx.userId,
        draft_content: result.content,
        variations: result.variations?.map((v, i) => ({
          id: `copilot-var-${i}-${Date.now()}`,
          content: v.content,
          selected: false,
        })),
        dm_template: result.dm_template,
        cta_word: result.cta_word,
        status: 'draft',
        template_id: params.template_id || null,
        style_id: params.style_id || null,
      })
      .select('id, draft_content, status, created_at')
      .single();

    return {
      success: true,
      data: { post, content: result.content, variations: result.variations },
      displayHint: 'post_preview',
    };
  },
});

registerAction({
  name: 'polish_post',
  description: 'Polish/improve an existing post — removes AI patterns, strengthens the hook, tightens the writing. Returns the polished version.',
  parameters: {
    properties: {
      post_id: { type: 'string', description: 'The post ID to polish' },
    },
    required: ['post_id'],
  },
  handler: async (ctx: ActionContext, params: { post_id: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data: post } = await supabase
      .from('cp_pipeline_posts')
      .select('id, draft_content, final_content')
      .eq('id', params.post_id)
      .eq('user_id', ctx.userId)
      .single();

    if (!post) return { success: false, error: 'Post not found' };

    const content = post.final_content || post.draft_content;
    if (!content) return { success: false, error: 'Post has no content' };

    const result = await polishPost(content);

    // Save polished content
    await supabase
      .from('cp_pipeline_posts')
      .update({ final_content: result.polished, polish_status: 'polished' })
      .eq('id', params.post_id)
      .eq('user_id', ctx.userId);

    return {
      success: true,
      data: { original: result.original, polished: result.polished, changes: result.changes, hookScore: result.hookScore },
      displayHint: 'post_preview',
    };
  },
});

registerAction({
  name: 'list_posts',
  description: 'List pipeline posts filtered by status. Returns post ID, content preview, status, and scheduled time.',
  parameters: {
    properties: {
      status: {
        type: 'string',
        enum: ['draft', 'reviewing', 'scheduled', 'published', 'failed'],
        description: 'Filter by post status',
      },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { status?: string; limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_pipeline_posts')
      .select('id, draft_content, final_content, status, scheduled_time, hook_score, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data: posts } = await query;

    return {
      success: true,
      data: (posts || []).map(p => ({
        id: p.id,
        content_preview: (p.final_content || p.draft_content || '').slice(0, 150),
        status: p.status,
        scheduled_time: p.scheduled_time,
        hook_score: p.hook_score,
      })),
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'update_post_content',
  description: 'Update the content of an existing draft post. Use this when the user asks you to edit, rewrite, or modify a specific post.',
  parameters: {
    properties: {
      post_id: { type: 'string', description: 'The post ID to update' },
      content: { type: 'string', description: 'The new post content' },
    },
    required: ['post_id', 'content'],
  },
  handler: async (ctx: ActionContext, params: { post_id: string; content: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('cp_pipeline_posts')
      .update({ draft_content: params.content, updated_at: new Date().toISOString() })
      .eq('id', params.post_id)
      .eq('user_id', ctx.userId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: { post_id: params.post_id, updated: true }, displayHint: 'text' };
  },
});
```

**Step 2: Write tests** (mock Supabase + AI)

```typescript
// src/__tests__/lib/actions/content.test.ts
/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import '@/lib/actions/content';
import type { ActionContext } from '@/lib/actions/types';

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'post-1', draft_content: 'Test content', status: 'draft', voice_profile: null, full_name: 'Tim', title: 'CEO' },
        error: null,
      }),
    })),
  })),
}));

jest.mock('@/lib/ai/content-pipeline/post-writer', () => ({
  writePost: jest.fn().mockResolvedValue({
    content: 'Written post content',
    variations: [{ content: 'Variation 1' }],
    dm_template: 'DM template',
    cta_word: 'comment',
  }),
}));

jest.mock('@/lib/ai/content-pipeline/post-polish', () => ({
  polishPost: jest.fn().mockResolvedValue({
    original: 'Original', polished: 'Polished', changes: ['Fixed hook'], hookScore: 8,
  }),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({
    topic: 'pricing', compiledContext: 'Context', suggestedAngles: [], topicReadiness: 0.8,
  }),
}));

const ctx: ActionContext = { userId: 'user-1' };

describe('Content Actions', () => {
  it('write_post generates and persists a post', async () => {
    const result = await executeAction(ctx, 'write_post', { topic: 'pricing objections' });
    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('post_preview');
  });

  it('polish_post polishes existing post', async () => {
    const result = await executeAction(ctx, 'polish_post', { post_id: 'post-1' });
    expect(result.success).toBe(true);
    expect((result.data as { polished: string }).polished).toBe('Polished');
  });

  it('list_posts returns posts', async () => {
    const result = await executeAction(ctx, 'list_posts', { status: 'draft' });
    expect(result.success).toBe(true);
  });

  it('update_post_content updates content', async () => {
    const result = await executeAction(ctx, 'update_post_content', { post_id: 'post-1', content: 'New content' });
    expect(result.success).toBe(true);
  });
});
```

**Step 3: Run tests, commit**

```bash
npx jest --no-coverage src/__tests__/lib/actions/content.test.ts
git add src/lib/actions/content.ts src/__tests__/lib/actions/content.test.ts
git commit -m "feat: add content actions — write, polish, list, update posts"
```

---

## Task 4: Supporting Actions (Templates, Analytics, Scheduling)

**Files:**
- Create: `src/lib/actions/templates.ts`
- Create: `src/lib/actions/analytics.ts`
- Create: `src/lib/actions/scheduling.ts`
- Create: `src/lib/actions/index.ts` (barrel import)

**Step 1: Implement templates, analytics, scheduling actions**

Create all three files following the same pattern as Tasks 2-3. Key actions:

**templates.ts:**
- `list_templates` — List user's post templates
- `match_template` — Semantic match template to topic
- `list_writing_styles` — List available writing styles

**analytics.ts:**
- `get_post_performance` — Get engagement stats for recent posts (from `cp_pipeline_posts` where `engagement_stats IS NOT NULL`)
- `get_top_posts` — Top posts by engagement in a date range

**scheduling.ts:**
- `schedule_post` — Schedule a post for a specific time (update `scheduled_time` + `status='scheduled'`)
- `get_autopilot_status` — Buffer size, next slot, pillars

**Step 2: Create barrel import**

```typescript
// src/lib/actions/index.ts
// Import all action modules to trigger registration
import './knowledge';
import './content';
import './templates';
import './analytics';
import './scheduling';

// Re-export the executor and registry
export { executeAction, actionRequiresConfirmation } from './executor';
export { getToolDefinitions, getAllActions } from './registry';
export type { ActionContext, ActionResult } from './types';
```

**Step 3: Test, commit**

```bash
npx jest --no-coverage src/__tests__/lib/actions/
git add src/lib/actions/
git commit -m "feat: add template, analytics, scheduling actions + barrel import"
```

---

## Task 5: Database Migration

**Files:**
- Create: `supabase/migrations/20260227500000_copilot_tables.sql`

**Step 1: Write migration**

```sql
-- Copilot conversations
CREATE TABLE copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT,
  entity_id UUID,
  title TEXT,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  system_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_conv_user ON copilot_conversations(user_id, updated_at DESC);
CREATE INDEX idx_copilot_conv_entity ON copilot_conversations(user_id, entity_type, entity_id);

ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_conv_select ON copilot_conversations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY copilot_conv_insert ON copilot_conversations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY copilot_conv_update ON copilot_conversations FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY copilot_conv_delete ON copilot_conversations FOR DELETE USING (user_id = auth.uid());
CREATE POLICY copilot_conv_service ON copilot_conversations FOR ALL USING (auth.role() = 'service_role');

-- Copilot messages
CREATE TABLE copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool_call', 'tool_result')),
  content TEXT,
  tool_name TEXT,
  tool_args JSONB,
  tool_result JSONB,
  feedback JSONB,
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_msg_conv ON copilot_messages(conversation_id, created_at);

ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;
-- Messages accessed via conversation (which is user-scoped)
CREATE POLICY copilot_msg_select ON copilot_messages FOR SELECT
  USING (conversation_id IN (SELECT id FROM copilot_conversations WHERE user_id = auth.uid()));
CREATE POLICY copilot_msg_insert ON copilot_messages FOR INSERT
  WITH CHECK (conversation_id IN (SELECT id FROM copilot_conversations WHERE user_id = auth.uid()));
CREATE POLICY copilot_msg_update ON copilot_messages FOR UPDATE
  USING (conversation_id IN (SELECT id FROM copilot_conversations WHERE user_id = auth.uid()));
CREATE POLICY copilot_msg_service ON copilot_messages FOR ALL USING (auth.role() = 'service_role');

-- Copilot memories
CREATE TABLE copilot_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  category TEXT CHECK (category IN ('tone', 'structure', 'vocabulary', 'content', 'general')),
  confidence FLOAT NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL CHECK (source IN ('conversation', 'feedback', 'manual')),
  conversation_id UUID REFERENCES copilot_conversations(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_mem_user ON copilot_memories(user_id, active, category);

ALTER TABLE copilot_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_mem_select ON copilot_memories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY copilot_mem_insert ON copilot_memories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY copilot_mem_update ON copilot_memories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY copilot_mem_delete ON copilot_memories FOR DELETE USING (user_id = auth.uid());
CREATE POLICY copilot_mem_service ON copilot_memories FOR ALL USING (auth.role() = 'service_role');
```

**Step 2: Push migration**

```bash
npm run db:push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260227500000_copilot_tables.sql
git commit -m "feat: add copilot database tables — conversations, messages, memories"
```

---

## Task 6: Copilot Prompt Defaults + System Prompt Builder

**Files:**
- Modify: `src/lib/ai/content-pipeline/prompt-defaults.ts` — Add 3 copilot prompt slugs
- Create: `src/lib/copilot/system-prompt.ts`
- Test: `src/__tests__/lib/copilot/system-prompt.test.ts`

**Step 1: Add prompt defaults**

Add the 3 copilot prompt templates to `PROMPT_DEFAULTS` in `prompt-defaults.ts`. The `copilot-system` slug is the base identity prompt with `{{variable}}` placeholders for dynamic sections. Read the file first to match the existing pattern.

The `copilot-system` prompt should define the co-pilot's identity, rules (always search knowledge before writing, ask confirmation for destructive actions, show plan before multi-step), and placeholders for `{{authorName}}`, `{{voiceSection}}`, `{{memoriesSection}}`, `{{knowledgeSection}}`, `{{performanceSection}}`, `{{feedbackSection}}`, `{{pageContextSection}}`.

The `copilot-memory-extractor` prompt should instruct Haiku to extract preference rules from correction messages.

The `copilot-plan-generator` prompt should instruct how to present multi-step plans.

Category for all three: add `'copilot'` to the category union (or use `'content_writing'` to avoid schema changes).

**Step 2: Create system prompt builder**

```typescript
// src/lib/copilot/system-prompt.ts
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { buildVoicePromptSection } from '@/lib/ai/content-pipeline/voice-prompt-builder';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

interface PageContext {
  pageType: string;
  entityType?: string;
  entityId?: string;
  entityData?: Record<string, unknown>;
}

// Simple in-memory cache (5 min TTL)
const cache = new Map<string, { data: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function buildCopilotSystemPrompt(
  userId: string,
  pageContext?: PageContext,
): Promise<string> {
  const cacheKey = `${userId}:${pageContext?.pageType || 'none'}:${pageContext?.entityId || 'none'}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.data;

  const supabase = createSupabaseAdminClient();

  // Parallel queries for dynamic sections
  const [basePrompt, profileResult, memoriesResult, recentPostsResult] = await Promise.all([
    getPrompt('copilot-system').catch(() => null),
    supabase
      .from('team_profiles')
      .select('voice_profile, full_name, title')
      .eq('user_id', userId)
      .limit(1)
      .single(),
    supabase
      .from('copilot_memories')
      .select('rule, category')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('cp_pipeline_posts')
      .select('draft_content, final_content, engagement_stats, hook_score, status')
      .eq('user_id', userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(5),
  ]);

  const profile = profileResult.data;
  const voiceProfile = profile?.voice_profile as TeamVoiceProfile | null;
  const authorName = profile?.full_name || 'the user';

  // Build dynamic sections
  const voiceSection = buildVoicePromptSection(voiceProfile, 'linkedin');

  const memories = memoriesResult.data || [];
  const memoriesSection = memories.length > 0
    ? '## User Preferences (from past corrections)\n' +
      memories.map(m => `- ${m.rule}`).join('\n')
    : '';

  const recentPosts = recentPostsResult.data || [];
  const performanceSection = recentPosts.length > 0
    ? '## Recent Post Performance\n' +
      recentPosts.slice(0, 3).map(p => {
        const content = (p.final_content || p.draft_content || '').slice(0, 80);
        const stats = p.engagement_stats as Record<string, number> | null;
        const impressions = stats?.impressions ?? 'unknown';
        return `- "${content}..." — ${impressions} impressions, hook score: ${p.hook_score ?? 'N/A'}`;
      }).join('\n')
    : '';

  const pageContextSection = pageContext
    ? `## Current Page Context\nUser is on: ${pageContext.pageType}` +
      (pageContext.entityType ? `\nEntity: ${pageContext.entityType} (${pageContext.entityId})` : '') +
      (pageContext.entityData ? `\nEntity data: ${JSON.stringify(pageContext.entityData).slice(0, 500)}` : '')
    : '';

  // Interpolate base prompt template
  const template = basePrompt?.system_prompt || getDefaultCopilotPrompt();
  const systemPrompt = interpolatePrompt(template, {
    authorName,
    voiceSection,
    memoriesSection,
    knowledgeSection: '', // Populated on-demand by Claude via tools
    performanceSection,
    feedbackSection: '', // Phase 2c
    pageContextSection,
  });

  cache.set(cacheKey, { data: systemPrompt, expires: Date.now() + CACHE_TTL });
  return systemPrompt;
}

function getDefaultCopilotPrompt(): string {
  return `You are magnetlab's AI co-pilot for {{authorName}}.

You help create LinkedIn content, search the knowledge base, manage the content pipeline, and execute multi-step workflows.

{{voiceSection}}

{{memoriesSection}}

{{performanceSection}}

{{pageContextSection}}

## Rules
- ALWAYS call search_knowledge or build_content_brief before writing any content — ground everything in real expertise
- For destructive actions (publishing, deleting, sending emails), describe what you will do and ask "Should I proceed?" before executing
- When a request requires 3+ steps, show a numbered plan first, then execute
- Reference specific knowledge entries when citing the user's expertise
- Match the user's voice and tone in all generated content
- Be concise in your messages — show results, not process narration`;
}
```

**Step 3: Write tests**

```typescript
// src/__tests__/lib/copilot/system-prompt.test.ts
/**
 * @jest-environment node
 */
import { buildCopilotSystemPrompt } from '@/lib/copilot/system-prompt';

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { voice_profile: { tone: 'direct' }, full_name: 'Tim', title: 'CEO' },
        error: null,
      }),
    })),
  })),
}));

jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn().mockRejectedValue(new Error('not found')),
  interpolatePrompt: jest.fn((template: string, vars: Record<string, string>) => {
    let result = template;
    for (const [k, v] of Object.entries(vars)) {
      result = result.replaceAll(`{{${k}}}`, v);
    }
    return result;
  }),
}));

jest.mock('@/lib/ai/content-pipeline/voice-prompt-builder', () => ({
  buildVoicePromptSection: jest.fn().mockReturnValue('Tone: direct'),
}));

describe('buildCopilotSystemPrompt', () => {
  it('builds a system prompt with author name', async () => {
    const prompt = await buildCopilotSystemPrompt('user-1');
    expect(prompt).toContain('Tim');
    expect(prompt).toContain('ALWAYS call search_knowledge');
  });

  it('includes page context when provided', async () => {
    const prompt = await buildCopilotSystemPrompt('user-1', {
      pageType: 'post-editor',
      entityType: 'post',
      entityId: 'post-123',
    });
    expect(prompt).toContain('post-editor');
    expect(prompt).toContain('post-123');
  });
});
```

**Step 4: Run tests, commit**

```bash
npx jest --no-coverage src/__tests__/lib/copilot/system-prompt.test.ts
git add src/lib/copilot/ src/lib/ai/content-pipeline/prompt-defaults.ts src/__tests__/lib/copilot/
git commit -m "feat: add copilot system prompt builder + prompt defaults"
```

---

## Task 7: Streaming Agent Loop — `POST /api/copilot/chat`

**Files:**
- Create: `src/app/api/copilot/chat/route.ts`
- Test: `src/__tests__/api/copilot/chat.test.ts`

This is the core endpoint. It:
1. Authenticates the user
2. Loads or creates a conversation
3. Builds the system prompt
4. Runs a Claude tool_use loop with streaming
5. Persists all messages

**Step 1: Implement the route**

```typescript
// src/app/api/copilot/chat/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';
import { buildCopilotSystemPrompt } from '@/lib/copilot/system-prompt';
import { getToolDefinitions, executeAction } from '@/lib/actions';
import { logError } from '@/lib/utils/logger';
import type { ActionContext } from '@/lib/actions/types';

const MAX_ITERATIONS = 15;
const MODEL = 'claude-sonnet-4-20250514';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const { conversationId, message, pageContext } = body as {
    conversationId?: string;
    message: string;
    pageContext?: { pageType: string; entityType?: string; entityId?: string; entityData?: Record<string, unknown> };
  };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. Load or create conversation
        let convId = conversationId;
        if (!convId) {
          const { data: conv } = await supabase
            .from('copilot_conversations')
            .insert({
              user_id: userId,
              title: message.slice(0, 100),
              entity_type: pageContext?.entityType || null,
              entity_id: pageContext?.entityId || null,
              system_context: pageContext || null,
            })
            .select('id')
            .single();
          convId = conv!.id;
        }

        // 2. Persist user message
        await supabase.from('copilot_messages').insert({
          conversation_id: convId,
          role: 'user',
          content: message,
        });

        // 3. Load conversation history
        const { data: history } = await supabase
          .from('copilot_messages')
          .select('role, content, tool_name, tool_args, tool_result')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(50);

        // Build Claude messages array from history
        const claudeMessages: Array<{ role: string; content: unknown }> = [];
        for (const msg of history || []) {
          if (msg.role === 'user') {
            claudeMessages.push({ role: 'user', content: msg.content || '' });
          } else if (msg.role === 'assistant') {
            claudeMessages.push({ role: 'assistant', content: msg.content || '' });
          } else if (msg.role === 'tool_call') {
            // Tool use blocks are part of assistant messages — handled in loop below
          } else if (msg.role === 'tool_result') {
            claudeMessages.push({
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: msg.tool_name || 'unknown', content: JSON.stringify(msg.tool_result) }],
            });
          }
        }

        // 4. Build system prompt
        const systemPrompt = await buildCopilotSystemPrompt(userId, pageContext);

        // 5. Agent loop
        const client = getAnthropicClient('copilot');
        const tools = getToolDefinitions();
        const ctx: ActionContext = { userId };
        let iterations = 0;
        let currentMessages = [...claudeMessages];

        while (iterations < MAX_ITERATIONS) {
          iterations++;

          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages: currentMessages as Parameters<typeof client.messages.create>[0]['messages'],
            tools: tools as Parameters<typeof client.messages.create>[0]['tools'],
          });

          let hasToolUse = false;
          const assistantContent: unknown[] = [];
          let assistantText = '';

          for (const block of response.content) {
            if (block.type === 'text') {
              assistantText += block.text;
              assistantContent.push(block);
              // Send text delta
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text_delta', text: block.text })}\n\n`));
            } else if (block.type === 'tool_use') {
              hasToolUse = true;
              assistantContent.push(block);

              // Notify frontend of tool call
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: block.name, args: block.input })}\n\n`));

              // Execute the action
              const result = await executeAction(ctx, block.name, block.input as Record<string, unknown>);

              // Notify frontend of tool result
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_result', name: block.name, result })}\n\n`));

              // Persist tool call + result
              await supabase.from('copilot_messages').insert([
                { conversation_id: convId, role: 'tool_call', tool_name: block.name, tool_args: block.input, content: null },
                { conversation_id: convId, role: 'tool_result', tool_name: block.name, tool_result: result, content: null },
              ]);

              // Feed result back to Claude
              currentMessages.push({ role: 'assistant', content: assistantContent });
              currentMessages.push({
                role: 'user',
                content: [{ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) }],
              });
            }
          }

          // Persist assistant text message (if any)
          if (assistantText) {
            await supabase.from('copilot_messages').insert({
              conversation_id: convId,
              role: 'assistant',
              content: assistantText,
              tokens_used: response.usage?.output_tokens || null,
            });
          }

          if (!hasToolUse) {
            // No more tool calls — we're done
            break;
          }

          // Reset for next iteration (assistant content already pushed above)
          // Clear assistantContent for next loop
        }

        // Send done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`));

        // Update conversation timestamp
        await supabase
          .from('copilot_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);

      } catch (error) {
        logError('copilot/chat', error, { step: 'agent_loop' });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Step 2: Write tests** (mock Claude + Supabase, verify stream events)

Test that the route returns 401 without auth, returns SSE stream with correct content type, and handles basic message flow.

**Step 3: Run tests, commit**

```bash
npx jest --no-coverage src/__tests__/api/copilot/chat.test.ts
git add src/app/api/copilot/chat/ src/__tests__/api/copilot/
git commit -m "feat: add streaming copilot chat API route with agent loop"
```

---

## Task 8: Conversations CRUD API Routes

**Files:**
- Create: `src/app/api/copilot/conversations/route.ts` — GET (list)
- Create: `src/app/api/copilot/conversations/[id]/route.ts` — GET (detail), DELETE
- Create: `src/app/api/copilot/conversations/[id]/feedback/route.ts` — POST
- Create: `src/app/api/copilot/memories/route.ts` — GET, POST
- Create: `src/app/api/copilot/memories/[id]/route.ts` — DELETE

Standard CRUD routes. All scoped by `user_id = session.user.id`. Pattern matches existing API routes in the codebase.

**Key behaviors:**
- `GET /api/copilot/conversations?entityType=post&entityId=xxx` — filters by entity
- `GET /api/copilot/conversations/[id]` — returns conversation + messages (ordered by `created_at`)
- `DELETE /api/copilot/conversations/[id]` — cascade deletes messages
- `POST /api/copilot/conversations/[id]/feedback` — updates `copilot_messages.feedback` JSONB
- `GET /api/copilot/memories` — returns active memories for user
- `POST /api/copilot/memories` — body: `{ rule, category }`, source: 'manual'
- `DELETE /api/copilot/memories/[id]` — sets `active = false` (soft delete)

**Commit:**
```bash
git add src/app/api/copilot/
git commit -m "feat: add copilot conversations + memories CRUD API routes"
```

---

## Task 9: CopilotProvider + useCopilotContext Hook

**Files:**
- Create: `src/components/copilot/CopilotProvider.tsx`
- Create: `src/hooks/useCopilotContext.ts`

**Step 1: Create the provider**

```typescript
// src/components/copilot/CopilotProvider.tsx
'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface PageContext {
  pageType: string;
  entityType?: string;
  entityId?: string;
  entityData?: Record<string, unknown>;
}

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: { success: boolean; data?: unknown; displayHint?: string; error?: string };
  timestamp: number;
}

interface CopilotState {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  messages: CopilotMessage[];
  conversationId: string | null;
  isStreaming: boolean;
  pageContext: PageContext | null;
  setPageContext: (ctx: PageContext | null) => void;
  sendMessage: (text: string) => Promise<void>;
  startNewConversation: () => void;
}

const CopilotContext = createContext<CopilotState | null>(null);

export function useCopilot(): CopilotState {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider');
  return ctx;
}

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (isStreaming) return;

    // Add user message to UI immediately
    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    // Start assistant message placeholder
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);

    try {
      abortRef.current = new AbortController();
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text, pageContext }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to connect to co-pilot');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));

          switch (data.type) {
            case 'text_delta':
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: (m.content || '') + data.text } : m
              ));
              break;

            case 'tool_call':
              setMessages(prev => [...prev, {
                id: `tool-call-${Date.now()}`,
                role: 'tool_call',
                toolName: data.name,
                toolArgs: data.args,
                timestamp: Date.now(),
              }]);
              break;

            case 'tool_result':
              setMessages(prev => [...prev, {
                id: `tool-result-${Date.now()}`,
                role: 'tool_result',
                toolName: data.name,
                toolResult: data.result,
                timestamp: Date.now(),
              }]);
              break;

            case 'done':
              if (data.conversationId) setConversationId(data.conversationId);
              break;

            case 'error':
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: (m.content || '') + `\n\n_Error: ${data.message}_` } : m
              ));
              break;
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: 'Sorry, something went wrong. Please try again.' } : m
        ));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [conversationId, isStreaming, pageContext]);

  return (
    <CopilotContext.Provider value={{
      isOpen, setIsOpen, messages, conversationId, isStreaming,
      pageContext, setPageContext, sendMessage, startNewConversation,
    }}>
      {children}
    </CopilotContext.Provider>
  );
}
```

**Step 2: Create page context hook**

```typescript
// src/hooks/useCopilotContext.ts
'use client';

import { useEffect } from 'react';
import { useCopilot } from '@/components/copilot/CopilotProvider';

interface CopilotPageContext {
  pageType: string;
  entityType?: string;
  entityId?: string;
  entityData?: Record<string, unknown>;
}

export function useCopilotContext(context: CopilotPageContext): void {
  const { setPageContext } = useCopilot();

  useEffect(() => {
    setPageContext(context);
    return () => setPageContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.pageType, context.entityType, context.entityId, setPageContext]);
}
```

**Step 3: Commit**

```bash
git add src/components/copilot/CopilotProvider.tsx src/hooks/useCopilotContext.ts
git commit -m "feat: add CopilotProvider context + useCopilotContext hook"
```

---

## Task 10: CopilotSidebar + ConversationInput

**Files:**
- Create: `src/components/copilot/CopilotSidebar.tsx`
- Create: `src/components/copilot/CopilotToggleButton.tsx`
- Create: `src/components/copilot/ConversationInput.tsx`

**Step 1: Build the sidebar shell**

```typescript
// src/components/copilot/CopilotSidebar.tsx
'use client';

import { useRef, useEffect } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { useCopilot } from './CopilotProvider';
import { ConversationInput } from './ConversationInput';
import { MessageList } from './MessageList';
import { cn } from '@/lib/utils';

export function CopilotSidebar() {
  const { isOpen, setIsOpen, messages, isStreaming, startNewConversation, pageContext } = useCopilot();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-[400px] max-w-[90vw] flex-col border-l bg-background shadow-xl transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-semibold">AI Co-pilot</span>
            {pageContext?.entityType && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                {pageContext.entityType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={startNewConversation}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <MessageList messages={messages} />
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <Sparkles className="h-8 w-8 text-violet-300" />
              <p className="text-sm text-muted-foreground">
                Ask me to write posts, search your knowledge base, or manage your content pipeline.
              </p>
            </div>
          )}
        </div>

        {/* Input */}
        <ConversationInput disabled={isStreaming} />
      </div>
    </>
  );
}
```

**Step 2: Build toggle button**

```typescript
// src/components/copilot/CopilotToggleButton.tsx
'use client';

import { Sparkles } from 'lucide-react';
import { useCopilot } from './CopilotProvider';

export function CopilotToggleButton() {
  const { isOpen, setIsOpen } = useCopilot();

  if (isOpen) return null;

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition-colors"
      title="Open AI Co-pilot"
    >
      <Sparkles className="h-5 w-5" />
    </button>
  );
}
```

**Step 3: Build input component**

```typescript
// src/components/copilot/ConversationInput.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { useCopilot } from './CopilotProvider';

export function ConversationInput({ disabled }: { disabled?: boolean }) {
  const [text, setText] = useState('');
  const { sendMessage } = useCopilot();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    sendMessage(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, disabled, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          placeholder="Ask the co-pilot..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-30 transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/copilot/CopilotSidebar.tsx src/components/copilot/CopilotToggleButton.tsx src/components/copilot/ConversationInput.tsx
git commit -m "feat: add CopilotSidebar, toggle button, and conversation input"
```

---

## Task 11: Message Components

**Files:**
- Create: `src/components/copilot/MessageList.tsx`
- Create: `src/components/copilot/UserMessage.tsx`
- Create: `src/components/copilot/AssistantMessage.tsx`
- Create: `src/components/copilot/ToolCallCard.tsx`

**Step 1: Build message components**

`MessageList` iterates messages and renders the correct component by role. `UserMessage` is a simple right-aligned bubble. `AssistantMessage` renders markdown text (left-aligned). `ToolCallCard` shows tool name + spinner (for `tool_call`) or result summary (for `tool_result`).

For `tool_result` with `displayHint: 'post_preview'`, show the post content in a card. For `displayHint: 'knowledge_list'`, show a list of entries. For other hints, show formatted JSON.

Keep it simple for Phase 2a — rich cards (PostPreviewCard, KnowledgeResultCard, PlanCard) come in Phase 2b.

**Step 2: Commit**

```bash
git add src/components/copilot/MessageList.tsx src/components/copilot/UserMessage.tsx src/components/copilot/AssistantMessage.tsx src/components/copilot/ToolCallCard.tsx
git commit -m "feat: add copilot message components — MessageList, UserMessage, AssistantMessage, ToolCallCard"
```

---

## Task 12: Dashboard Layout Integration

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx` — Wrap children with CopilotProvider, add sidebar + toggle

**Step 1: Read the current layout file**

Read `src/app/(dashboard)/layout.tsx` to understand the current structure.

**Step 2: Add CopilotProvider + CopilotSidebar + CopilotToggleButton**

Wrap the existing layout content inside `<CopilotProvider>`. Add `<CopilotSidebar />` and `<CopilotToggleButton />` after `<FeedbackWidget />`.

Since the layout is a server component but CopilotProvider is a client component, create a thin client wrapper `src/components/copilot/CopilotShell.tsx`:

```typescript
// src/components/copilot/CopilotShell.tsx
'use client';

import { CopilotProvider } from './CopilotProvider';
import { CopilotSidebar } from './CopilotSidebar';
import { CopilotToggleButton } from './CopilotToggleButton';

export function CopilotShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      {children}
      <CopilotSidebar />
      <CopilotToggleButton />
    </CopilotProvider>
  );
}
```

Then in `layout.tsx`, wrap the content:

```tsx
import { CopilotShell } from '@/components/copilot/CopilotShell';

// In the return:
return (
  <CopilotShell>
    <div className="min-h-screen bg-background">
      {/* ... existing layout ... */}
    </div>
  </CopilotShell>
);
```

**Step 3: Verify dev server works**

```bash
npm run dev
```

Open http://localhost:3000 — verify the floating button appears and clicking it opens the sidebar.

**Step 4: Commit**

```bash
git add src/components/copilot/CopilotShell.tsx src/app/\(dashboard\)/layout.tsx
git commit -m "feat: integrate copilot sidebar into dashboard layout"
```

---

## Task 13: Register useCopilotContext on Post Editor

**Files:**
- Modify: `src/components/content-pipeline/PostDetailModal.tsx` — Add `useCopilotContext` hook

**Step 1: Read the file, add the hook call**

Add near the top of the component (after the state declarations):

```tsx
import { useCopilotContext } from '@/hooks/useCopilotContext';

// Inside the component:
useCopilotContext({
  pageType: 'post-editor',
  entityType: 'post',
  entityId: post.id,
  entityData: { content: editContent, status: post.status },
});
```

This tells the co-pilot what the user is looking at. When the co-pilot sidebar opens while a post is being edited, the system prompt includes the post content and status.

**Step 2: Commit**

```bash
git add src/components/content-pipeline/PostDetailModal.tsx
git commit -m "feat: register copilot page context on post editor"
```

---

## Task 14: Component Tests

**Files:**
- Create: `src/__tests__/components/copilot/CopilotSidebar.test.tsx`

**Step 1: Write tests**

Test that:
1. CopilotProvider renders children
2. Toggle button appears when sidebar is closed
3. Sidebar opens when toggle is clicked
4. Empty state shows placeholder text
5. Input field is present and functional

Mock the fetch API for SSE. Use React Testing Library.

**Step 2: Run tests, commit**

```bash
npx jest --no-coverage src/__tests__/components/copilot/
git add src/__tests__/components/copilot/
git commit -m "test: add copilot sidebar component tests"
```

---

## Task 15: End-to-End Smoke Test + CLAUDE.md Update

**Files:**
- Modify: `/Users/timlife/Documents/claude code/magnetlab/CLAUDE.md` — Add AI Co-pilot section

**Step 1: Run all copilot tests**

```bash
npx jest --no-coverage src/__tests__/lib/actions/ src/__tests__/lib/copilot/ src/__tests__/api/copilot/ src/__tests__/components/copilot/
```

All tests must pass.

**Step 2: Run typecheck**

```bash
npm run typecheck
```

Must pass with no errors.

**Step 3: Update CLAUDE.md**

Add an "AI Co-pilot" section documenting:
- Architecture (shared action layer + streaming agent loop)
- Key files
- API routes
- Database tables
- How to add new actions (register in `src/lib/actions/`, auto-available to co-pilot + MCP)

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add AI Co-pilot section to CLAUDE.md"
```

---

## Summary

| Task | Description | New Files | Tests |
|------|-------------|-----------|-------|
| 1 | Action layer types + registry + executor | 3 | 5 |
| 2 | Knowledge actions | 1 | 3 |
| 3 | Content actions | 1 | 4 |
| 4 | Supporting actions + barrel import | 4 | — |
| 5 | Database migration (3 tables) | 1 | — |
| 6 | Prompt defaults + system prompt builder | 2 | 2 |
| 7 | Streaming agent loop API route | 1 | 3+ |
| 8 | Conversations + memories CRUD routes | 5 | — |
| 9 | CopilotProvider + useCopilotContext | 2 | — |
| 10 | CopilotSidebar + toggle + input | 3 | — |
| 11 | Message components | 4 | — |
| 12 | Dashboard layout integration | 1 | — |
| 13 | PostDetailModal context registration | 0 (modify) | — |
| 14 | Component tests | 1 | 5+ |
| 15 | Smoke test + CLAUDE.md | 0 (modify) | — |

**Total: ~29 new files, ~22+ tests**
