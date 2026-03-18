# Creator.io Library Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape 37 resources from Creator.io, add library MCP tools to magnetlab, then import all content as a published library of `single-system` lead magnets.

**Architecture:** Three-phase pipeline — Playwright scraping → AI transformation → API import. Library MCP tools added to fill existing gap (API routes exist, MCP exposure missing). Migration script uses MCP client methods for all API calls.

**Tech Stack:** TypeScript, Playwright, Anthropic SDK (Claude), MCP SDK, vitest, Zod

**Spec:** `docs/superpowers/specs/2026-03-18-creator-io-library-migration-design.md`

---

## Tool Mapping (8 new MCP tools)

| # | Tool Name | API Route (exists) | Client Method |
|---|-----------|-------------------|---------------|
| 1 | `magnetlab_create_library` | POST `/api/libraries` | `createLibrary` |
| 2 | `magnetlab_list_libraries` | GET `/api/libraries` | `listLibraries` |
| 3 | `magnetlab_get_library` | GET `/api/libraries/[id]` | `getLibrary` |
| 4 | `magnetlab_update_library` | PUT `/api/libraries/[id]` | `updateLibrary` |
| 5 | `magnetlab_delete_library` | DELETE `/api/libraries/[id]` | `deleteLibrary` |
| 6 | `magnetlab_add_library_item` | POST `/api/libraries/[id]/items` | `addLibraryItem` |
| 7 | `magnetlab_remove_library_item` | DELETE `/api/libraries/[id]/items/[itemId]` | `removeLibraryItem` |
| 8 | `magnetlab_reorder_library_items` | POST `/api/libraries/[id]/items/reorder` | `reorderLibraryItems` |

---

## Chunk 1: Library MCP Tools

### Task 1: Create Feature Branch

**Files:** None (git only)

- [ ] **Step 1: Create branch from main**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git fetch origin
git checkout main
git pull origin main
git checkout -b feature/library-mcp-tools-and-creator-migration
```

- [ ] **Step 2: Verify clean state**

```bash
pnpm install
pnpm typecheck
```

---

### Task 2: Library Tool Definitions

**Files:**
- Create: `packages/mcp/src/tools/libraries.ts`

- [ ] **Step 1: Create library tool definitions**

```typescript
/** Library MCP tool definitions. 8 tools for CRUD on libraries and library items. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// ─── Tool Definitions ─────────────────────────────────────────────

export const libraryTools: Tool[] = [
  {
    name: 'magnetlab_create_library',
    description:
      'Create a new library (collection of lead magnets and/or external resources). Returns the created library with its generated slug.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Library name (required)',
        },
        description: {
          type: 'string',
          description: 'Library description',
        },
        icon: {
          type: 'string',
          description: 'Emoji icon (defaults to 📚)',
        },
        slug: {
          type: 'string',
          description: 'URL slug (auto-generated from name if omitted)',
        },
        auto_feature_days: {
          type: 'number',
          description:
            'Number of days an item is considered "new" after being added (default 14)',
        },
        team_id: {
          type: 'string',
          description:
            'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'magnetlab_list_libraries',
    description:
      'List all libraries. Returns library ID, name, description, icon, slug, and item count.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max results (1-100, default 50)',
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination',
        },
        team_id: {
          type: 'string',
          description:
            'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_library',
    description:
      'Get a single library with all its items. Items include display title, icon, featured status, and "new" badge status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Library UUID',
        },
        team_id: {
          type: 'string',
          description:
            'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_update_library',
    description: 'Update library metadata (name, description, icon, slug, auto-feature days).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Library UUID',
        },
        name: {
          type: 'string',
          description: 'New library name',
        },
        description: {
          type: ['string', 'null'],
          description: 'New description (null to clear)',
        },
        icon: {
          type: 'string',
          description: 'New emoji icon',
        },
        slug: {
          type: 'string',
          description: 'New URL slug',
        },
        auto_feature_days: {
          type: 'number',
          description: 'Days an item is considered "new"',
        },
        team_id: {
          type: 'string',
          description:
            'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_delete_library',
    description:
      'Delete a library and all its item associations. Does NOT delete the underlying lead magnets or external resources.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Library UUID',
        },
        team_id: {
          type: 'string',
          description:
            'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_add_library_item',
    description:
      'Add a lead magnet or external resource to a library. Each asset can only appear once per library.',
    inputSchema: {
      type: 'object',
      properties: {
        library_id: {
          type: 'string',
          description: 'Library UUID',
        },
        asset_type: {
          type: 'string',
          enum: ['lead_magnet', 'external_resource'],
          description: 'Type of asset to add',
        },
        lead_magnet_id: {
          type: 'string',
          description: 'Lead magnet UUID (required if asset_type is lead_magnet)',
        },
        external_resource_id: {
          type: 'string',
          description:
            'External resource UUID (required if asset_type is external_resource)',
        },
        icon_override: {
          type: 'string',
          description: 'Override the default icon for this item in the library',
        },
        sort_order: {
          type: 'number',
          description: 'Position in the library (auto-incremented if omitted)',
        },
        is_featured: {
          type: 'boolean',
          description: 'Pin this item as featured (default false)',
        },
        team_id: {
          type: 'string',
          description:
            'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['library_id', 'asset_type'],
    },
  },
  {
    name: 'magnetlab_remove_library_item',
    description:
      'Remove an item from a library. Does NOT delete the underlying lead magnet or external resource.',
    inputSchema: {
      type: 'object',
      properties: {
        library_id: {
          type: 'string',
          description: 'Library UUID',
        },
        item_id: {
          type: 'string',
          description: 'Library item UUID',
        },
        team_id: {
          type: 'string',
          description:
            'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['library_id', 'item_id'],
    },
  },
  {
    name: 'magnetlab_reorder_library_items',
    description:
      'Batch update sort order for multiple library items. Pass an array of {id, sort_order} pairs.',
    inputSchema: {
      type: 'object',
      properties: {
        library_id: {
          type: 'string',
          description: 'Library UUID',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Library item UUID' },
              sort_order: {
                type: 'number',
                description: 'New sort position',
              },
            },
            required: ['id', 'sort_order'],
          },
          description: 'Array of items with new sort orders',
        },
        team_id: {
          type: 'string',
          description:
            'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['library_id', 'items'],
    },
  },
];
```

- [ ] **Step 2: Verify file compiles**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsc --noEmit -p packages/mcp/tsconfig.json 2>&1 | head -20
```

---

### Task 3: Library Validation Schemas

**Files:**
- Modify: `packages/mcp/src/validation.ts`

- [ ] **Step 1: Add library Zod schemas to `toolSchemas`**

Add after the last existing tool schema entry (before the closing `}`):

```typescript
  // Libraries (8)
  magnetlab_create_library: z.object({
    name: z.string().min(1, 'name is required'),
    description: z.string().optional(),
    icon: z.string().optional(),
    slug: z.string().optional(),
    auto_feature_days: z.number().min(0).optional(),
    team_id: teamIdField,
  }),

  magnetlab_list_libraries: z.object({
    limit: paginationLimit,
    offset: paginationOffset,
    team_id: teamIdField,
  }),

  magnetlab_get_library: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_update_library: z.object({
    id: uuidField,
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    icon: z.string().optional(),
    slug: z.string().optional(),
    auto_feature_days: z.number().min(0).optional(),
    team_id: teamIdField,
  }),

  magnetlab_delete_library: z.object({
    id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_add_library_item: z.object({
    library_id: uuidField,
    asset_type: z.enum(['lead_magnet', 'external_resource']),
    lead_magnet_id: z.string().optional(),
    external_resource_id: z.string().optional(),
    icon_override: z.string().optional(),
    sort_order: z.number().min(0).optional(),
    is_featured: z.boolean().optional(),
    team_id: teamIdField,
  }),

  magnetlab_remove_library_item: z.object({
    library_id: uuidField,
    item_id: uuidField,
    team_id: teamIdField,
  }),

  magnetlab_reorder_library_items: z.object({
    library_id: uuidField,
    items: z.array(
      z.object({
        id: z.string().min(1),
        sort_order: z.number().min(0),
      })
    ).min(1),
    team_id: teamIdField,
  }),
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsc --noEmit -p packages/mcp/tsconfig.json 2>&1 | head -20
```

---

### Task 4: Library Client Methods

**Files:**
- Modify: `packages/mcp/src/client.ts`

- [ ] **Step 1: Add library client methods**

Add these methods to the `MagnetLabClient` class, after the existing funnel methods:

```typescript
  // ─── Libraries ──────────────────────────────────────────────────

  async createLibrary(params: {
    name: string;
    description?: string;
    icon?: string;
    slug?: string;
    autoFeatureDays?: number;
    teamId?: string;
  }) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId('/libraries', teamId);
    return this.request<{ library: unknown }>('POST', url, body);
  }

  async listLibraries(
    limit?: number,
    offset?: number,
    teamId?: string
  ) {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const qs = params.toString();
    const path = qs ? `/libraries?${qs}` : '/libraries';
    const url = this.appendTeamId(path, teamId);
    return this.request<{ libraries: unknown[] }>('GET', url);
  }

  async getLibrary(id: string, teamId?: string) {
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ library: unknown; items: unknown[] }>('GET', url);
  }

  async updateLibrary(
    id: string,
    params: {
      name?: string;
      description?: string | null;
      icon?: string;
      slug?: string;
      autoFeatureDays?: number;
      teamId?: string;
    }
  ) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ library: unknown }>('PUT', url, body);
  }

  async deleteLibrary(id: string, teamId?: string) {
    const url = this.appendTeamId(`/libraries/${id}`, teamId);
    return this.request<{ success: boolean }>('DELETE', url);
  }

  async addLibraryItem(
    libraryId: string,
    params: {
      assetType: string;
      leadMagnetId?: string;
      externalResourceId?: string;
      iconOverride?: string;
      sortOrder?: number;
      isFeatured?: boolean;
      teamId?: string;
    }
  ) {
    const { teamId, ...body } = params;
    const url = this.appendTeamId(`/libraries/${libraryId}/items`, teamId);
    return this.request<{ item: unknown }>('POST', url, body);
  }

  async removeLibraryItem(
    libraryId: string,
    itemId: string,
    teamId?: string
  ) {
    const url = this.appendTeamId(
      `/libraries/${libraryId}/items/${itemId}`,
      teamId
    );
    return this.request<{ success: boolean }>('DELETE', url);
  }

  async reorderLibraryItems(
    libraryId: string,
    items: Array<{ id: string; sortOrder: number }>,
    teamId?: string
  ) {
    const url = this.appendTeamId(
      `/libraries/${libraryId}/items/reorder`,
      teamId
    );
    return this.request<{ success: boolean }>('POST', url, { items });
  }
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsc --noEmit -p packages/mcp/tsconfig.json 2>&1 | head -20
```

---

### Task 5: Library Handlers

**Files:**
- Create: `packages/mcp/src/handlers/libraries.ts`

- [ ] **Step 1: Create library handler**

```typescript
/** Library MCP tool handlers. Maps snake_case MCP args to camelCase client methods. */

import { MagnetLabClient } from '../client.js';

// ─── Handler ──────────────────────────────────────────────────────

export async function handleLibraryTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
) {
  switch (name) {
    case 'magnetlab_create_library':
      return client.createLibrary({
        name: args.name as string,
        description: args.description as string | undefined,
        icon: args.icon as string | undefined,
        slug: args.slug as string | undefined,
        autoFeatureDays: args.auto_feature_days as number | undefined,
        teamId: args.team_id as string | undefined,
      });

    case 'magnetlab_list_libraries':
      return client.listLibraries(
        args.limit as number | undefined,
        args.offset as number | undefined,
        args.team_id as string | undefined
      );

    case 'magnetlab_get_library':
      return client.getLibrary(
        args.id as string,
        args.team_id as string | undefined
      );

    case 'magnetlab_update_library':
      return client.updateLibrary(args.id as string, {
        name: args.name as string | undefined,
        description: args.description as string | null | undefined,
        icon: args.icon as string | undefined,
        slug: args.slug as string | undefined,
        autoFeatureDays: args.auto_feature_days as number | undefined,
        teamId: args.team_id as string | undefined,
      });

    case 'magnetlab_delete_library':
      return client.deleteLibrary(
        args.id as string,
        args.team_id as string | undefined
      );

    case 'magnetlab_add_library_item':
      return client.addLibraryItem(args.library_id as string, {
        assetType: args.asset_type as string,
        leadMagnetId: args.lead_magnet_id as string | undefined,
        externalResourceId: args.external_resource_id as string | undefined,
        iconOverride: args.icon_override as string | undefined,
        sortOrder: args.sort_order as number | undefined,
        isFeatured: args.is_featured as boolean | undefined,
        teamId: args.team_id as string | undefined,
      });

    case 'magnetlab_remove_library_item':
      return client.removeLibraryItem(
        args.library_id as string,
        args.item_id as string,
        args.team_id as string | undefined
      );

    case 'magnetlab_reorder_library_items': {
      const rawItems = args.items as Array<{ id: string; sort_order: number }>;
      return client.reorderLibraryItems(
        args.library_id as string,
        rawItems.map((item) => ({ id: item.id, sortOrder: item.sort_order })),
        args.team_id as string | undefined
      );
    }

    default:
      throw new Error(`Unknown library tool: ${name}`);
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsc --noEmit -p packages/mcp/tsconfig.json 2>&1 | head -20
```

---

### Task 6: Register Library Tools and Handlers

**Files:**
- Modify: `packages/mcp/src/tools/index.ts`
- Modify: `packages/mcp/src/handlers/index.ts`

- [ ] **Step 1: Register tools in `tools/index.ts`**

Add import:
```typescript
import { libraryTools } from './libraries.js';
```

Add to the `tools` array spread:
```typescript
  ...libraryTools,
```

- [ ] **Step 2: Register handlers in `handlers/index.ts`**

Add import:
```typescript
import { handleLibraryTools } from './libraries.js';
```

Add to `handlerMap`:
```typescript
  // Libraries (8)
  magnetlab_create_library: handleLibraryTools,
  magnetlab_list_libraries: handleLibraryTools,
  magnetlab_get_library: handleLibraryTools,
  magnetlab_update_library: handleLibraryTools,
  magnetlab_delete_library: handleLibraryTools,
  magnetlab_add_library_item: handleLibraryTools,
  magnetlab_remove_library_item: handleLibraryTools,
  magnetlab_reorder_library_items: handleLibraryTools,
```

- [ ] **Step 3: Update hardcoded tool counts**

The codebase has hardcoded tool counts that must be updated from the current count to current + 8. Check and update these files:
- `packages/mcp/src/tools/index.ts` — JSDoc comment mentioning tool count
- `packages/mcp/src/handlers/index.ts` — JSDoc comment mentioning tool count
- `packages/mcp/src/client.ts` — JSDoc comment mentioning tool count
- `packages/mcp/src/validation.ts` — comment above `toolSchemas` mentioning tool count

Search for the current count number and replace with current + 8 in all four files.

- [ ] **Step 4: Verify typecheck and build**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsc --noEmit -p packages/mcp/tsconfig.json
```

- [ ] **Step 5: Commit chunk 1**

```bash
git add packages/mcp/src/tools/libraries.ts packages/mcp/src/handlers/libraries.ts \
  packages/mcp/src/tools/index.ts packages/mcp/src/handlers/index.ts \
  packages/mcp/src/client.ts packages/mcp/src/validation.ts
git commit -m "feat(mcp): add 8 library tools for CRUD on libraries and items"
```

---

### Task 7: Library MCP Tests

**Files:**
- Modify: `packages/mcp/src/__tests__/tools.test.ts`
- Modify: `packages/mcp/src/__tests__/validation.test.ts`
- Modify: `packages/mcp/src/__tests__/handlers.test.ts`

Follow the existing test patterns in these files. Each test file has a consistent structure.

- [ ] **Step 1: Update hardcoded test counts and add tool registration tests**

In `tools.test.ts`:
- Update the `EXPECTED_TOOL_NAMES` array to include all 8 new library tool names
- Update all hardcoded count assertions (e.g., `toHaveLength(43)` → `toHaveLength(51)`, or whatever the current count is + 8)
- Add a `describe('Library tools')` block that verifies:
  - All 8 library tools are registered in the tools array
  - Each tool has the correct `name`, non-empty `description`, and `inputSchema`
  - Required fields are in the `required` array (e.g., `name` for create, `id` for get/update/delete)
  - `magnetlab_add_library_item` requires `library_id` and `asset_type`

- [ ] **Step 2: Add validation tests**

In `validation.test.ts`:
- Update any hardcoded tool count assertions (current count + 8)
- Add a `describe('Library validation')` block:
  - `magnetlab_create_library`: passes with `{name: 'Test'}`, fails without name
  - `magnetlab_get_library`: passes with `{id: 'uuid'}`, fails without id
  - `magnetlab_add_library_item`: passes with `{library_id: 'uuid', asset_type: 'lead_magnet'}`, fails without asset_type
  - `magnetlab_reorder_library_items`: passes with valid items array, fails with empty items array

- [ ] **Step 3: Add handler tests**

In `handlers.test.ts`:
- Update any hardcoded tool count or describe block text (e.g., "All 43 Tools" → "All 51 Tools")
- Add a `describe('Library handlers')` block:
  - Mock the `MagnetLabClient` methods
  - Test that each handler calls the correct client method with correctly mapped args (snake_case → camelCase)
  - Specifically test `reorderLibraryItems` to verify `sort_order` → `sortOrder` mapping on each item
  - Test that unknown tool name throws

- [ ] **Step 4: Run tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
pnpm --filter @magnetlab/mcp test
```

Expected: All tests pass (existing + new library tests).

- [ ] **Step 5: Commit tests**

```bash
git add packages/mcp/src/__tests__/
git commit -m "test(mcp): add tests for 8 library MCP tools"
```

---

## Chunk 2: Migration Script

### Task 8: Scrape Creator.io Resources

**Files:**
- Create: `scripts/migrate-creator-library.ts`
- Create: `scripts/data/` (directory, gitignored)

This is a one-time migration script. It runs locally, not in CI.

- [ ] **Step 1: Add `scripts/data/` to `.gitignore`**

```
scripts/data/
```

- [ ] **Step 2: Create migration script with scraping phase**

Create `scripts/migrate-creator-library.ts`. The script has three phases; start with scraping.

The scraping phase:
1. Launches Playwright browser
2. Visits each of the 37 resource URLs
3. Extracts: title, emoji, intro content (before first H3), sections (H3 heading + content between headings)
4. Converts HTML content to markdown using `turndown` (or manual regex for simple cases)
5. Saves to `scripts/data/creator-scraped.json`

**Resource list** (hardcoded in script):
```typescript
const RESOURCES = [
  { id: '695cda48a4cd5c57a94d95f7', title: "The 'No-Pitch' Teardown Framework", emoji: '🛠️', featured: true, order: 1 },
  { id: '695cd98cb3b4cbb9f9863d85', title: 'The $100k Case Study Breakdown', emoji: '📈', featured: true, order: 2 },
  { id: '695cd9f5b1cee85669d6b01e', title: "The Agency Founder's 'Sales-Led' Roadmap", emoji: '🗺️', featured: true, order: 3 },
  { id: '695cda480b1c93bdea089112', title: "The 'Agency Sales' Red Flag Guide", emoji: '🚩', featured: true, order: 4 },
  { id: '695cda34da68a299864b2094', title: "The 'Human' LinkedIn Automation SOP", emoji: '🤖', featured: true, order: 5 },
  { id: '695cda34d61559b0a8362db2', title: "The 'Agency Deal' Closing Checklist", emoji: '🏁', featured: true, order: 6 },
  { id: '695cda1d1c2f72d78f05a186', title: "The 'Safe to Pay' Brand Blueprint", emoji: '🛡️', featured: false, order: 7 },
  { id: '695cda0a5ffce4fd70776ab1', title: "The 'Incisive' Audit Template", emoji: '🔍', featured: false, order: 8 },
  { id: '695cda0a46957c861aad0f28', title: "The 'Zero-to-Owned' Pipeline Checklist", emoji: '✅', featured: false, order: 9 },
  { id: '695cda0a818c65689384d687', title: "The 'Smart' Agency Hiring Kit", emoji: '👥', featured: false, order: 10 },
  { id: '695cd9f5b1960dd4dbb9c8db', title: "The 'Authority' Content Calendar", emoji: '📅', featured: false, order: 11 },
  { id: '695cda1de1cc3bd0c39ccaa5', title: "The 'Referral-Free' Revenue Calculator", emoji: '🧮', featured: false, order: 12 },
  { id: '695cda1e4d4631d8589a2c4f', title: "The 'Operator's' Guide to Clay", emoji: '🧱', featured: false, order: 13 },
  { id: '695cda489d0dc1e97e394d4e', title: "The 'Founder-Led' Content Vault", emoji: '🔓', featured: false, order: 14 },
  { id: '695cda346169e7a5dbf94ea8', title: "The 'Referral to Pipeline' Transition Case Study", emoji: '📔', featured: false, order: 15 },
  { id: '695cda72e4f856d362cdcfa6', title: "The 'Complete' Sales Onboarding Kit", emoji: '📦', featured: false, order: 16 },
  { id: '695cda5cb6e61538649cfbb6', title: "The 'Operator to Owner' Time Audit", emoji: '⏳', featured: false, order: 17 },
  { id: '695cda5c29c1f6f9333ab90e', title: "The 'Irresistible' Agency Offer Framework", emoji: '💎', featured: false, order: 18 },
  { id: '695cda5c77b2fef5bfda311e', title: "The 'Agency Sales' Year-in-Review", emoji: '📅', featured: false, order: 19 },
  { id: '695cd9f569568151f89e614b', title: "The 'High-Ticket' LinkedIn Ad Blueprint", emoji: '🚀', featured: false, order: 20 },
  { id: '695cd9e22576ffaf36fa72c1', title: "The 'Inbound Momentum' Tracker", emoji: '📊', featured: false, order: 21 },
  { id: '695cd9e2e1a505efd60e042e', title: 'The 6-Figure LinkedIn Profile Audit', emoji: '🕵️', featured: false, order: 22 },
  { id: '695cd9e270cea8b44898294e', title: "The 'Stalled Deal' Hail Mary Kit", emoji: '⚡', featured: false, order: 23 },
  { id: '695cd9cc65a523664cf68835', title: "The 'Price Objection' Annihilator", emoji: '🛡️', featured: false, order: 24 },
  { id: '695cd9cc13408bfe42f99c8e', title: "The 'No-Guru' Sales Call Script", emoji: '🎙️', featured: false, order: 25 },
  { id: '695cd9ccf08846c7fc0fb20b', title: "The 'Lying on the Couch' Proposal Fix", emoji: '🛋️', featured: false, order: 26 },
  { id: '695cd9b83bc405769c490041', title: "The ROI of 'Smarter' Cold Email Kit", emoji: '🤖', featured: false, order: 27 },
  { id: '695cd9b8474b43bb38cf2b49', title: "The 'Always-On' Market Alerting Framework", emoji: '📢', featured: false, order: 28 },
  { id: '695cd9b846957c861aad0ef5', title: "The Agency Sales 'Tightrope' Audit", emoji: '⚖️', featured: false, order: 29 },
  { id: '695cd9a2f08846c7fc0fb1f3', title: "The 'One Question' DM Closing Script", emoji: '💬', featured: false, order: 30 },
  { id: '695cd9a2a0bb52ed1d4fd8aa', title: "The 'Ghost-Proof' Qualification Scorecard", emoji: '👻', featured: false, order: 31 },
  { id: '695cd9a2bfefe5b67f4cdc24', title: 'The 7-Figure Agency Sale Post-Mortem', emoji: '💰', featured: false, order: 32 },
  { id: '695cd98c7b6063439d430724', title: "The 'Always-On' Email Nurture System", emoji: '📧', featured: false, order: 33 },
  { id: '695cd98c0ef57bd42431dafa', title: "The 'No-Fluff' Agency Sales Stack", emoji: '🛠️', featured: false, order: 34 },
  { id: '695cd9757d45f2afd37b92ce', title: 'The LinkedIn Lead Magnet OS', emoji: '⚙️', featured: false, order: 35 },
  { id: '695cd97447a75394f23e8397', title: "The 'Referral Trap' Escape Blueprint", emoji: '⛓️', featured: false, order: 36 },
  { id: '695cd97461e951e2d359c65b', title: "The 20-Minute 'Incisive' Proposal Template", emoji: '📄', featured: false, order: 37 },
];
```

**Scraping approach:**
- Use `playwright` (already a dev dependency) to launch a headless browser
- For each resource: navigate to `https://app.getcreator.io/library-resource?id={id}`
- Wait for content to render (wait for `h1` element)
- Extract content using `page.evaluate()` to walk the DOM:
  - Find all H3 elements as section boundaries
  - For each section: collect all elements between that H3 and the next H3 (or end of content area)
  - Convert to markdown: `**bold**`, `*italic*`, `- list item`, `| table |`, `> blockquote`, `- [ ] checkbox`
  - Intro content = everything between the first decorative separator and the first H3
- Write JSON output

- [ ] **Step 3: Install turndown for HTML→markdown conversion**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
pnpm add -D turndown @types/turndown
```

- [ ] **Step 4: Run the scraping phase**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsx scripts/migrate-creator-library.ts --phase=scrape
```

Expected output: `scripts/data/creator-scraped.json` with 37 entries.

- [ ] **Step 5: Verify scraped data**

Manually spot-check 2-3 resources in the JSON to confirm:
- Title matches
- Sections are properly separated
- Markdown formatting is preserved (tables, lists, bold, blockquotes)
- Intro content captured

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-creator-library.ts .gitignore
git commit -m "feat: add Creator.io migration script (scrape phase)"
```

---

### Task 9: AI Transform Phase

**Files:**
- Modify: `scripts/migrate-creator-library.ts`

- [ ] **Step 1: Add transform phase to the script**

The transform phase reads `creator-scraped.json` and for each resource:

1. Builds a prompt with the scraped content (title, intro, sections)
2. Calls Claude API (`claude-sonnet-4-5-20250514` — fast and cheap for structured extraction)
3. Asks the AI to generate:
   - `headline` — from the title, naming the pain or outcome
   - `subheadline` — optional supporting line
   - `problem_statement` — 2-3 sentences from intro paragraphs
   - `call_to_action` — clear next step
   - Per section: `component_name` (memorable name), `how_it_connects` (what it feeds into)
   - Per section: `key_insight` (the design decision that makes it work)
   - `proof_points` — quantified claims if present
4. Preserves the original section `title` and `body` (markdown) faithfully — AI MUST NOT rewrite these
5. Validates against the `single-system` schema constraints (body min 50 chars, min 3 sections)
6. Saves to `scripts/data/creator-transformed.json`

**Prompt template:**
```
You are converting a scraped resource into a structured lead magnet format.

RESOURCE TITLE: {title}

INTRO CONTENT (before first section):
{introMarkdown}

SECTIONS:
{for each section: "### {heading}\n{markdown}"}

Generate a JSON object with these fields:
- headline: A compelling headline that names the pain or outcome (not the product name). Based on the title.
- subheadline: Optional one-line supporting text. null if not needed.
- problem_statement: 2-3 sentences making the reader feel understood. Extract from the intro content.
- proof_points: Array of quantified proof strings if any exist in the content. Empty array if none.
- call_to_action: A clear next step for the reader.
- sections: Array matching the source sections. For EACH section:
  - title: EXACTLY as provided (do not modify)
  - body: EXACTLY as provided (do not modify the markdown)
  - component_name: A memorable 2-4 word name for this component (not "Step 1")
  - how_it_connects: One sentence explaining what this component feeds into or receives from other components
  - key_insight: One sentence about the design decision that makes this work

RULES:
- Do NOT rewrite title or body fields — copy them EXACTLY from the input
- body must be at least 50 characters (if a section body is too short, note it)
- Minimum 3 sections required
- Return valid JSON only, no markdown code fences
```

- [ ] **Step 2: Run the transform phase**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY npx tsx scripts/migrate-creator-library.ts --phase=transform
```

Expected: `scripts/data/creator-transformed.json` with 37 entries, each conforming to the `single-system` content schema.

- [ ] **Step 3: Validate transformed data**

The script should validate each transformed resource against the `single-system` constraints:
- `headline` present and >= 10 chars
- `problem_statement` present and >= 20 chars
- `call_to_action` present and >= 5 chars
- `sections` array has >= 3 items
- Each section has `title`, `body` (>= 50 chars), `component_name` (>= 2 chars), `how_it_connects` (>= 10 chars)

Log any validation failures and fix manually if needed.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-creator-library.ts
git commit -m "feat: add AI transform phase to migration script"
```

---

### Task 10: Import Phase

**Files:**
- Modify: `scripts/migrate-creator-library.ts`

- [ ] **Step 1: Add import phase to the script**

The import phase reads `creator-transformed.json` and:

1. **Creates library** — `POST /api/libraries` with:
   - name: `"Gemini 3: Agency Sales System"`
   - description: `"(5M Dollar Swipefile)"`
   - icon: `"✨"` (matching the Creator.io star icon)
   - autoFeatureDays: `0` (disabled — using manual is_featured instead)

2. **For each of the 37 resources** (sequentially to avoid race conditions):
   a. **Create lead magnet** — `POST /api/lead-magnet` with:
      - title: resource title
      - archetype: `"single-system"`
      - concept: `{ creatorIoId: resource.id }` (for idempotency)
   b. **Update content** — `PATCH /api/lead-magnet/{id}` with:
      - content: the transformed `single-system` content object
      - expected_version: 1 (just created)
   c. **Add to library** — `POST /api/libraries/{libraryId}/items` with:
      - assetType: `"lead_magnet"`
      - leadMagnetId: the created lead magnet ID
      - iconOverride: resource emoji
      - sortOrder: resource order (1-37)
      - isFeatured: resource.featured

3. **Create funnel** — `POST /api/funnel` with:
   - slug: `"gemini-3-agency-sales-system"`
   - targetType: `"library"`
   - libraryId: the created library ID
   - optinHeadline: `"Gemini 3: Agency Sales System"`
   - optinSubline: `"(5M Dollar Swipefile)"`

4. **Publish funnel** — `POST /api/funnel/{id}/publish`

5. **Publish all lead magnets** — Use the MCP client's `request()` method directly (not the MCP `update_lead_magnet` tool, which only patches `content`):
   ```typescript
   await client.request('PUT', `/lead-magnet/${id}`, { status: 'published' });
   ```
   The `PUT /api/lead-magnet/{id}` route accepts general field updates including `status`.

**Authentication:** Use MCP client's `request()` method directly — it handles Bearer token auth. The script reads `MAGNETLAB_API_KEY` from env.

**Idempotency:** Before creating each lead magnet, check if one with the same title + archetype `single-system` already exists (via list endpoint). Skip if found.

**Error handling:** Log each step. On failure, log the resource that failed and continue with the next one. At the end, report how many succeeded/failed.

- [ ] **Step 2: Verify the script compiles**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsx --check scripts/migrate-creator-library.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-creator-library.ts
git commit -m "feat: add import phase to migration script"
```

---

### Task 11: Run the Full Migration

**Files:** None (execution only)

- [ ] **Step 1: Run scrape phase**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsx scripts/migrate-creator-library.ts --phase=scrape
```

Verify: `scripts/data/creator-scraped.json` exists with 37 entries.

- [ ] **Step 2: Run transform phase**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx tsx scripts/migrate-creator-library.ts --phase=transform
```

Verify: `scripts/data/creator-transformed.json` exists with 37 valid entries.

- [ ] **Step 3: Run import phase (against production)**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
MAGNETLAB_API_KEY=<your-api-key> npx tsx scripts/migrate-creator-library.ts --phase=import
```

Verify:
- 37 lead magnets created in magnetlab
- 1 library created with 37 items (6 featured)
- 1 funnel created and published targeting the library
- All lead magnets set to published status

- [ ] **Step 4: Manual verification**

1. Open magnetlab dashboard → Library section → verify "Gemini 3: Agency Sales System" appears
2. Open a few individual lead magnets → verify content renders correctly with proper formatting
3. Visit the public funnel page → verify the library page displays all 37 resources
4. Verify featured items appear correctly

- [ ] **Step 5: Commit final state**

```bash
git add scripts/migrate-creator-library.ts
git commit -m "feat: complete Creator.io library migration (37 resources)"
```

---

## Post-Migration

After Task 11, the migration is complete. The feature branch contains:
1. 8 new Library MCP tools (permanent addition)
2. Migration script (can be kept for reference or deleted)
3. Scraped/transformed data files (gitignored)

The branch should be merged to main after review.
