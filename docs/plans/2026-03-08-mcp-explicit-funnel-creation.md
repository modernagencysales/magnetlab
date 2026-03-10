# MCP Explicit Funnel Creation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make funnel creation explicit with full config in the MCP — fix fabricated social proof, add `funnel_config` to `create_lead_magnet`, and document defaults clearly.

**Architecture:** Composition at the MCP handler layer. The server-side services (`lead-magnets.service.ts`, `funnels.service.ts`) stay unchanged. The MCP handler for `create_lead_magnet` gains optional `funnel_config` that triggers sequential calls to `createFunnel` and optionally `publishFunnel` via the existing client methods.

**Tech Stack:** TypeScript, MCP SDK, Vitest (for handler tests)

**Branch:** `early-users/experiments`

---

### Task 1: Fix fabricated social proof in server-side defaults

Two server-side files generate fabricated social proof text. Fix both to return `null`.

**Files:**
- Modify: `src/lib/ai/funnel-content-generator.ts:132` — change `socialProof` from fabricated string to `null`
- Modify: `src/server/services/lead-magnets.service.ts:844` — change spreadsheet import social proof to `null`

**Step 1: Fix `generateDefaultOptinContent()` social proof**

In `src/lib/ai/funnel-content-generator.ts`, line 132, change:
```typescript
// BEFORE
socialProof: 'Join thousands of professionals using this resource',

// AFTER
socialProof: null,
```

Also update the return type — `GeneratedOptinContent.socialProof` needs to accept `null`. Check the type definition:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && grep -n "GeneratedOptinContent" src/lib/types/funnel.ts
```
If `socialProof` is `string`, change to `string | null`.

**Step 2: Fix `buildFunnelPage()` spreadsheet social proof**

In `src/server/services/lead-magnets.service.ts`, line 844, change:
```typescript
// BEFORE
'Built from real spreadsheet calculations',

// AFTER
null,
```

This is inside the `buildFunnelPage()` call for spreadsheet imports. The 7th argument is `socialProof`.

**Step 3: Verify the changes compile**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck
```

Expected: No type errors from these changes.

**Step 4: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/ai/funnel-content-generator.ts src/server/services/lead-magnets.service.ts src/lib/types/funnel.ts
git commit -m "fix: remove fabricated social proof from funnel defaults

generateDefaultOptinContent() and buildFunnelPage() were generating fake
social proof text ('Join thousands of professionals...', 'Built from real
spreadsheet calculations'). Changed both to null — agents and UI should
provide real social proof or omit it entirely."
```

---

### Task 2: Update MCP `create_lead_magnet` tool definition with `funnel_config`

Add the optional `funnel_config` object to the tool schema and rewrite the description.

**Files:**
- Modify: `packages/mcp/src/tools/lead-magnets.ts:34-61`

**Step 1: Update the tool definition**

Replace the `magnetlab_create_lead_magnet` tool definition (lines 34-61) with:

```typescript
  {
    name: 'magnetlab_create_lead_magnet',
    description:
      'Create a new lead magnet. Choose an archetype and provide a title. ' +
      'A lead magnet alone is NOT publicly accessible — you must also create a funnel page. ' +
      'Two options: (1) pass funnel_config here to create both in one call, or ' +
      '(2) call magnetlab_create_funnel separately after. ' +
      'Without a funnel, the lead magnet exists only as a draft in the library.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Lead magnet title' },
        archetype: {
          type: 'string',
          enum: [
            'single-breakdown',
            'single-system',
            'focused-toolkit',
            'single-calculator',
            'focused-directory',
            'mini-training',
            'one-story',
            'prompt',
            'assessment',
            'workflow',
          ],
          description: 'Content archetype/format',
        },
        concept: { type: 'object', description: 'Concept data (optional, from ideation)' },
        funnel_config: {
          type: 'object',
          description:
            'Optional. Creates a funnel page for this lead magnet in the same call. ' +
            'If omitted, no funnel is created — use magnetlab_create_funnel separately. ' +
            'Defaults: headline=lead magnet title, button="Get Free Access", theme="dark", ' +
            'color="#8b5cf6", social_proof=null (do NOT fabricate).',
          properties: {
            slug: {
              type: 'string',
              description: 'URL slug (e.g. "my-free-guide"). Auto-generated from title if omitted.',
            },
            optin_headline: { type: 'string', description: 'Main headline (default: lead magnet title)' },
            optin_subline: { type: 'string', description: 'Subheadline text (default: null)' },
            optin_button_text: {
              type: 'string',
              description: 'CTA button text (default: "Get Free Access")',
            },
            optin_social_proof: {
              type: 'string',
              description: 'Social proof line. Null if omitted — use real data only, never fabricate.',
            },
            thankyou_headline: {
              type: 'string',
              description: 'Thank you page headline (default: "Thanks! Check your email.")',
            },
            thankyou_subline: { type: 'string', description: 'Thank you page subheadline (default: null)' },
            theme: { type: 'string', enum: ['light', 'dark'], description: 'Page theme (default: dark or brand kit)' },
            primary_color: { type: 'string', description: 'Accent color hex (default: #8b5cf6 or brand kit)' },
            background_style: {
              type: 'string',
              enum: ['solid', 'gradient', 'pattern'],
              description: 'Background style (default: solid)',
            },
            vsl_url: { type: 'string', description: 'Video URL for thank-you page' },
            calendly_url: { type: 'string', description: 'Calendly URL for booking on thank-you page' },
            logo_url: { type: 'string', description: 'Logo image URL' },
            qualification_form_id: { type: 'string', description: 'Qualification form UUID to attach' },
            publish: {
              type: 'boolean',
              description: 'Publish immediately after creation (default: false)',
            },
          },
        },
      },
      required: ['title', 'archetype'],
    },
  },
```

**Step 2: Verify it compiles**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && cd packages/mcp && pnpm run build
```

Expected: Clean build (tool definitions are just data — no logic yet).

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add packages/mcp/src/tools/lead-magnets.ts
git commit -m "feat(mcp): add funnel_config option to create_lead_magnet tool schema

Agents can now pass funnel_config to create a lead magnet and funnel in
one call. Description documents that lead magnets need a funnel to be
publicly accessible. All funnel field defaults are documented inline."
```

---

### Task 3: Update MCP `create_funnel` tool description with documented defaults

**Files:**
- Modify: `packages/mcp/src/tools/funnels.ts:45-92`

**Step 1: Update `magnetlab_create_funnel` description**

Change the description (line 47) from:
```typescript
'Create a new funnel/opt-in page. Must target a lead magnet, library, or external resource. Provide a slug (URL-safe name) and optionally customize headline, subline, button text, thank-you copy, theme (light/dark), colors, and VSL/Calendly URLs.',
```

To:
```typescript
'Create a new funnel/opt-in page. Must target a lead magnet, library, or external resource. ' +
'Defaults when fields are omitted: headline=target title, subline=null, ' +
'button_text="Get Free Access", social_proof=null (do NOT fabricate — use real data or omit), ' +
'thankyou_headline="Thanks! Check your email.", theme=brand kit or "dark", ' +
'color=brand kit or "#8b5cf6", background=brand kit or "solid". ' +
'Sections are auto-populated from the user\'s default template and brand kit.',
```

**Step 2: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add packages/mcp/src/tools/funnels.ts
git commit -m "docs(mcp): document create_funnel defaults in tool description

Agents now see exactly what happens when funnel fields are omitted.
Explicitly states social proof should be null, not fabricated."
```

---

### Task 4: Implement `funnel_config` handling in the MCP handler

This is the core logic — when `funnel_config` is passed with `create_lead_magnet`, the handler creates the funnel and optionally publishes it.

**Files:**
- Modify: `packages/mcp/src/handlers/lead-magnets.ts:23-28`

**Step 1: Add a slug generation helper at the top of the file**

Add after the imports (line 2):
```typescript
/** Generate URL-safe slug from a title. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}
```

**Step 2: Replace the `magnetlab_create_lead_magnet` case (lines 23-28)**

Replace:
```typescript
    case 'magnetlab_create_lead_magnet':
      return client.createLeadMagnet({
        title: args.title as string,
        archetype: args.archetype as Archetype,
        concept: args.concept as unknown,
      })
```

With:
```typescript
    case 'magnetlab_create_lead_magnet': {
      const leadMagnet = await client.createLeadMagnet({
        title: args.title as string,
        archetype: args.archetype as Archetype,
        concept: args.concept as unknown,
      })

      const funnelConfig = args.funnel_config as Record<string, unknown> | undefined
      if (!funnelConfig) {
        return leadMagnet
      }

      // Extract lead magnet ID from response
      const lmId = (leadMagnet as Record<string, unknown>).id as string
      if (!lmId) {
        return { ...leadMagnet as Record<string, unknown>, funnel_error: 'Could not extract lead magnet ID' }
      }

      const slug = (funnelConfig.slug as string) || slugify(args.title as string)
      const shouldPublish = funnelConfig.publish === true

      try {
        const funnelResult = await client.createFunnel({
          leadMagnetId: lmId,
          slug,
          optinHeadline: funnelConfig.optin_headline as string | undefined,
          optinSubline: funnelConfig.optin_subline as string | undefined,
          optinButtonText: funnelConfig.optin_button_text as string | undefined,
          optinSocialProof: funnelConfig.optin_social_proof as string | undefined,
          thankyouHeadline: funnelConfig.thankyou_headline as string | undefined,
          thankyouSubline: funnelConfig.thankyou_subline as string | undefined,
          theme: funnelConfig.theme as FunnelTheme | undefined,
          primaryColor: funnelConfig.primary_color as string | undefined,
          backgroundStyle: funnelConfig.background_style as BackgroundStyle | undefined,
          vslUrl: funnelConfig.vsl_url as string | undefined,
          calendlyUrl: funnelConfig.calendly_url as string | undefined,
          logoUrl: funnelConfig.logo_url as string | undefined,
          qualificationFormId: funnelConfig.qualification_form_id as string | undefined,
        })

        const funnelData = funnelResult as Record<string, unknown>
        let publishResult: { publicUrl?: string | null } | undefined

        if (shouldPublish) {
          const funnelId = (funnelData.funnel as Record<string, unknown>)?.id as string
            || funnelData.id as string
          if (funnelId) {
            try {
              publishResult = await client.publishFunnel(funnelId) as { publicUrl?: string | null }
            } catch (publishErr) {
              return {
                lead_magnet: leadMagnet,
                funnel: funnelData,
                publish_error: publishErr instanceof Error ? publishErr.message : 'Publish failed',
              }
            }
          }
        }

        return {
          lead_magnet: leadMagnet,
          funnel: funnelData,
          ...(publishResult?.publicUrl ? { public_url: publishResult.publicUrl } : {}),
        }
      } catch (funnelErr) {
        // Lead magnet was created successfully — return it with the funnel error
        return {
          lead_magnet: leadMagnet,
          funnel_error: funnelErr instanceof Error ? funnelErr.message : 'Funnel creation failed',
        }
      }
    }
```

**Step 3: Add missing imports**

At the top of the file, update the import to include FunnelTheme and BackgroundStyle:
```typescript
import { MagnetLabClient } from '../client.js'
import type { Archetype, LeadMagnetStatus, FunnelTheme, BackgroundStyle } from '../constants.js'
```

**Step 4: Build and verify**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && pnpm run build
```

Expected: Clean build.

**Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add packages/mcp/src/handlers/lead-magnets.ts
git commit -m "feat(mcp): implement funnel_config handling in create_lead_magnet

When funnel_config is passed, the handler:
1. Creates the lead magnet
2. Creates a funnel with the provided config (slug auto-generated if omitted)
3. Optionally publishes if publish=true
Returns combined result with lead_magnet + funnel + public_url.
Errors in funnel creation don't lose the lead magnet."
```

---

### Task 5: Update workflow guide

Update the `create_lead_magnet` and `setup_funnel` workflows to show both patterns.

**Files:**
- Modify: `packages/mcp/src/tools/category-tools.ts:163-194` (create_lead_magnet recipe)
- Modify: `packages/mcp/src/tools/category-tools.ts:222-242` (setup_funnel recipe)

**Step 1: Update `create_lead_magnet` workflow**

Replace the `create_lead_magnet` recipe value (lines 163-194) with:

```typescript
  create_lead_magnet: `# Creating a Lead Magnet — Workflow

The AI Brain (knowledge base) contains the user's REAL expertise extracted from call transcripts.
The brand kit is for VISUAL styling only (colors, fonts) — never use it for content substance.

## Steps

1. RESEARCH — Search the AI Brain for expertise on the topic
   → magnetlab_execute({tool: "magnetlab_search_knowledge", arguments: {query: "<topic>"}})
   → magnetlab_execute({tool: "magnetlab_ask_knowledge", arguments: {question: "What are the key insights about <topic>?"}})

2. ASSESS — Check if there's enough knowledge
   → magnetlab_execute({tool: "magnetlab_knowledge_readiness", arguments: {topic: "<topic>", goal: "lead_magnet"}})

3. IDEATE — Present findings, discuss the angle with the user

4. CREATE + FUNNEL (one call)
   → magnetlab_execute({tool: "magnetlab_create_lead_magnet", arguments: {
       title: "...",
       archetype: "...",
       concept: {...},
       funnel_config: {
         slug: "my-guide",
         optin_headline: "...",
         optin_subline: "...",
         publish: false
       }
     }})

   OR CREATE then FUNNEL separately:
   → magnetlab_execute({tool: "magnetlab_create_lead_magnet", arguments: {title: "...", archetype: "..."}})
   → magnetlab_execute({tool: "magnetlab_create_funnel", arguments: {lead_magnet_id: "...", slug: "..."}})

5. REVIEW & PUBLISH
   → magnetlab_execute({tool: "magnetlab_publish_funnel", arguments: {funnel_id: "..."}})

## Important
- A lead magnet without a funnel is NOT publicly accessible
- Never fabricate social proof — use real data or omit it
- The lead magnet should use the user's actual language from the AI Brain`,
```

**Step 2: Update `setup_funnel` workflow**

Replace the `setup_funnel` recipe value (lines 222-242) with:

```typescript
  setup_funnel: `# Setting Up a Funnel — Workflow

## Steps

1. Ensure a lead magnet, library, or external resource exists

2. CREATE FUNNEL — provide a slug and target
   → magnetlab_execute({tool: "magnetlab_create_funnel", arguments: {
       lead_magnet_id: "...",
       slug: "my-guide",
       optin_headline: "...",
       optin_subline: "...",
       optin_social_proof: null
     }})
   Defaults: headline=target title, button="Get Free Access", theme=dark, color=#8b5cf6

3. CUSTOMIZE — Edit sections, apply theme/restyle
   → magnetlab_execute({tool: "magnetlab_restyle_funnel", arguments: {funnel_id: "...", prompt: "..."}})
   → magnetlab_execute({tool: "magnetlab_apply_restyle", arguments: {funnel_id: "...", plan: {...}}})

4. QUALIFICATION (optional)
   → magnetlab_execute({tool: "magnetlab_create_qualification_form", arguments: {funnel_page_id: "...", questions: [...]}})

5. EMAIL SEQUENCE (optional)
   → magnetlab_execute({tool: "magnetlab_create_email_sequence", arguments: {funnel_page_id: "...", ...}})

6. PUBLISH
   → magnetlab_execute({tool: "magnetlab_publish_funnel", arguments: {funnel_id: "..."}})

## Key rules
- Never fabricate social proof — omit it or use real data
- Use magnetlab_generate_funnel_content to AI-generate copy from lead magnet content
- Use magnetlab_restyle_funnel for AI-powered visual design`,
```

**Step 3: Build and verify**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && pnpm run build
```

**Step 4: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add packages/mcp/src/tools/category-tools.ts
git commit -m "docs(mcp): update workflow guides for explicit funnel creation

create_lead_magnet guide now shows both one-call (funnel_config) and
two-call patterns. setup_funnel guide documents defaults and warns
against fabricating social proof."
```

---

### Task 6: Write handler tests

Create Vitest tests for the new `funnel_config` handler logic.

**Files:**
- Create: `packages/mcp/src/__tests__/handlers/lead-magnets.test.ts`

**Step 1: Create test directory**

```bash
mkdir -p "/Users/timlife/Documents/claude code/magnetlab/packages/mcp/src/__tests__/handlers"
```

**Step 2: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleLeadMagnetTools } from '../../handlers/lead-magnets.js'
import type { MagnetLabClient } from '../../client.js'

function createMockClient(overrides: Partial<MagnetLabClient> = {}): MagnetLabClient {
  return {
    createLeadMagnet: vi.fn().mockResolvedValue({ id: 'lm-123', title: 'Test LM' }),
    createFunnel: vi.fn().mockResolvedValue({ funnel: { id: 'fn-456', slug: 'test-guide' } }),
    publishFunnel: vi.fn().mockResolvedValue({ funnel: { id: 'fn-456' }, publicUrl: 'https://magnetlab.app/p/user/test-guide' }),
    ...overrides,
  } as unknown as MagnetLabClient
}

describe('handleLeadMagnetTools — magnetlab_create_lead_magnet', () => {
  let client: MagnetLabClient

  beforeEach(() => {
    client = createMockClient()
  })

  it('creates lead magnet without funnel when funnel_config is omitted', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      { title: 'My Guide', archetype: 'single-breakdown' },
      client,
    )

    expect(client.createLeadMagnet).toHaveBeenCalledWith({
      title: 'My Guide',
      archetype: 'single-breakdown',
      concept: undefined,
    })
    expect(client.createFunnel).not.toHaveBeenCalled()
    expect(result).toEqual({ id: 'lm-123', title: 'Test LM' })
  })

  it('creates lead magnet + funnel when funnel_config is provided', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'My Guide',
        archetype: 'focused-toolkit',
        funnel_config: {
          slug: 'my-guide',
          optin_headline: 'Get the Guide',
          optin_social_proof: 'Downloaded 200+ times',
          theme: 'light',
        },
      },
      client,
    )

    expect(client.createLeadMagnet).toHaveBeenCalled()
    expect(client.createFunnel).toHaveBeenCalledWith(
      expect.objectContaining({
        leadMagnetId: 'lm-123',
        slug: 'my-guide',
        optinHeadline: 'Get the Guide',
        optinSocialProof: 'Downloaded 200+ times',
        theme: 'light',
      }),
    )
    expect(result).toHaveProperty('lead_magnet')
    expect(result).toHaveProperty('funnel')
  })

  it('auto-generates slug from title when slug is omitted in funnel_config', async () => {
    await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'The Ultimate B2B Guide!',
        archetype: 'single-breakdown',
        funnel_config: {},
      },
      client,
    )

    expect(client.createFunnel).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'the-ultimate-b2b-guide',
      }),
    )
  })

  it('publishes funnel when publish=true in funnel_config', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'My Guide',
        archetype: 'single-breakdown',
        funnel_config: { slug: 'my-guide', publish: true },
      },
      client,
    ) as Record<string, unknown>

    expect(client.publishFunnel).toHaveBeenCalledWith('fn-456')
    expect(result.public_url).toBe('https://magnetlab.app/p/user/test-guide')
  })

  it('does not publish when publish is false or omitted', async () => {
    await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'My Guide',
        archetype: 'single-breakdown',
        funnel_config: { slug: 'my-guide' },
      },
      client,
    )

    expect(client.publishFunnel).not.toHaveBeenCalled()
  })

  it('returns lead magnet with funnel_error when funnel creation fails', async () => {
    client = createMockClient({
      createFunnel: vi.fn().mockRejectedValue(new Error('Slug already taken')),
    })

    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'My Guide',
        archetype: 'single-breakdown',
        funnel_config: { slug: 'taken-slug' },
      },
      client,
    ) as Record<string, unknown>

    expect(result.lead_magnet).toEqual({ id: 'lm-123', title: 'Test LM' })
    expect(result.funnel_error).toBe('Slug already taken')
  })

  it('returns lead magnet + funnel with publish_error when publish fails', async () => {
    client = createMockClient({
      publishFunnel: vi.fn().mockRejectedValue(new Error('No username set')),
    })

    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'My Guide',
        archetype: 'single-breakdown',
        funnel_config: { slug: 'my-guide', publish: true },
      },
      client,
    ) as Record<string, unknown>

    expect(result.lead_magnet).toBeDefined()
    expect(result.funnel).toBeDefined()
    expect(result.publish_error).toBe('No username set')
  })
})
```

**Step 3: Run the tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && pnpm test
```

Expected: All 7 tests pass.

**Step 4: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add packages/mcp/src/__tests__/handlers/lead-magnets.test.ts
git commit -m "test(mcp): add handler tests for create_lead_magnet with funnel_config

Tests cover: no funnel_config, with funnel_config, auto-slug generation,
publish=true, publish=false, funnel error recovery, publish error recovery."
```

---

### Task 7: Build MCP package and verify

**Step 1: Full build**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && pnpm run build
```

**Step 2: Run tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && pnpm test
```

**Step 3: Verify the tool shows up correctly — inspect the built output**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab/packages/mcp" && node -e "
const { leadMagnetTools } = require('./dist/tools/lead-magnets.js');
const tool = leadMagnetTools.find(t => t.name === 'magnetlab_create_lead_magnet');
console.log(JSON.stringify(tool.inputSchema.properties.funnel_config, null, 2));
"
```

Expected: Shows the funnel_config schema with all properties.

**Step 4: Commit build if needed, or skip if dist is gitignored**

Check: `grep dist packages/mcp/.gitignore` — if dist is ignored, no commit needed.
