# MagnetLab CLI + Claude Code Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI (`magnetlab`) that lets Claude Code execute any MagnetLab tool via shell commands, plus `magnetlab init` to set up a project with slash commands and CLAUDE.md.

**Architecture:** Thin CLI dispatch layer in the existing `@magnetlab/mcp` package. `cli.ts` is the new entry point (`magnetlab` bin). `exec` command parses flags from tool schemas and routes through the existing `handleToolCall()` dispatcher. `init` command generates `.claude/commands/` markdown files and appends to CLAUDE.md. Zero new dependencies.

**Tech Stack:** Commander.js (existing), Node fs/readline (stdlib), Vitest (existing test framework)

---

### Task 1: CLI Entry Point + `tools` Command

The simplest command — list available tools by category. Gets the CLI skeleton working end-to-end.

**Files:**
- Create: `packages/mcp/src/cli.ts`
- Modify: `packages/mcp/package.json:10-12`
- Test: `packages/mcp/src/__tests__/cli/tools.test.ts`

**Step 1: Write the failing test**

Create `packages/mcp/src/__tests__/cli/tools.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatToolList, formatCategoryTools } from '../../cli/tools-command.js';

describe('tools command', () => {
  it('formatToolList returns all category names', () => {
    const output = formatToolList();
    expect(output).toContain('knowledge');
    expect(output).toContain('leadMagnets');
    expect(output).toContain('funnels');
    expect(output).toContain('emailSequences');
  });

  it('formatToolList includes tool counts', () => {
    const output = formatToolList();
    // Should contain numbers like "17 tools" or "(17)"
    expect(output).toMatch(/\d+ tools/);
  });

  it('formatCategoryTools returns tool names for valid category', () => {
    const output = formatCategoryTools('knowledge');
    expect(output).toContain('magnetlab_search_knowledge');
    expect(output).toContain('magnetlab_ask_knowledge');
  });

  it('formatCategoryTools returns error for invalid category', () => {
    const output = formatCategoryTools('nonexistent');
    expect(output).toContain('Unknown category');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/tools.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Create the tools command module**

Create `packages/mcp/src/cli/tools-command.ts`:

```typescript
import { discoveryCategories } from '../tools/index.js';
import { getCategoryLabel, getCategoryToolCount, DiscoveryCategoryKey } from '../tools/category-tools.js';
import { toolsByName } from '../tools/index.js';

/**
 * Format all categories with their labels and tool counts.
 */
export function formatToolList(): string {
  const lines: string[] = ['MagnetLab Tools\n'];

  for (const key of Object.keys(discoveryCategories) as DiscoveryCategoryKey[]) {
    const label = getCategoryLabel(key);
    const count = getCategoryToolCount(key);
    lines.push(`  ${key} — ${label} (${count} tools)`);
  }

  lines.push('');
  lines.push('Run: magnetlab tools <category> to see tools in a category');
  lines.push('Run: magnetlab help <tool> to see tool parameters');

  return lines.join('\n');
}

/**
 * Format tools in a specific category.
 */
export function formatCategoryTools(category: string): string {
  const categories = discoveryCategories as Record<string, string[]>;
  const toolNames = categories[category];

  if (!toolNames) {
    const validKeys = Object.keys(discoveryCategories).join(', ');
    return `Unknown category: "${category}". Valid categories: ${validKeys}`;
  }

  const label = getCategoryLabel(category as DiscoveryCategoryKey);
  const lines: string[] = [`${label} — ${toolNames.length} tools\n`];

  for (const name of toolNames) {
    const tool = toolsByName.get(name);
    const firstSentence = (tool?.description || '').split('.')[0];
    lines.push(`  ${name}: ${firstSentence}`);
  }

  return lines.join('\n');
}
```

**Step 4: Create the CLI entry point**

Create `packages/mcp/src/cli.ts`:

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { formatToolList, formatCategoryTools } from './cli/tools-command.js';

const VERSION = '0.5.0';

const program = new Command();

program
  .name('magnetlab')
  .description('MagnetLab CLI — create lead magnets, manage funnels, and run your content pipeline from the terminal')
  .version(VERSION);

program
  .command('tools [category]')
  .description('List available tools, optionally filtered by category')
  .action((category?: string) => {
    if (category) {
      console.log(formatCategoryTools(category));
    } else {
      console.log(formatToolList());
    }
  });

program.parse();
```

**Step 5: Update package.json bin entry**

In `packages/mcp/package.json`, change the `bin` field:

```json
"bin": {
  "magnetlab-mcp": "./dist/index.js",
  "magnetlab": "./dist/cli.js"
}
```

**Step 6: Run tests to verify they pass**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/tools.test.ts`
Expected: PASS (all 4 tests)

**Step 7: Build and verify CLI runs**

Run: `cd packages/mcp && npm run build && node dist/cli.js tools`
Expected: Prints all categories with counts

Run: `node dist/cli.js tools knowledge`
Expected: Prints knowledge tools with descriptions

**Step 8: Commit**

```bash
git add packages/mcp/src/cli.ts packages/mcp/src/cli/tools-command.ts packages/mcp/src/__tests__/cli/tools.test.ts packages/mcp/package.json
git commit -m "feat(cli): add magnetlab CLI entry point with tools command"
```

---

### Task 2: `help` Command

Show full schema for a single tool — parameters, types, required fields, enums.

**Files:**
- Create: `packages/mcp/src/cli/help-command.ts`
- Modify: `packages/mcp/src/cli.ts` (add command)
- Test: `packages/mcp/src/__tests__/cli/help.test.ts`

**Step 1: Write the failing test**

Create `packages/mcp/src/__tests__/cli/help.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatToolHelp } from '../../cli/help-command.js';

describe('help command', () => {
  it('returns schema for a valid tool', () => {
    const output = formatToolHelp('magnetlab_search_knowledge');
    expect(output).toContain('magnetlab_search_knowledge');
    expect(output).toContain('query');
    expect(output).toContain('limit');
  });

  it('strips magnetlab_ prefix if omitted', () => {
    const output = formatToolHelp('search_knowledge');
    expect(output).toContain('magnetlab_search_knowledge');
  });

  it('shows REQUIRED for required fields', () => {
    const output = formatToolHelp('magnetlab_create_lead_magnet');
    expect(output).toContain('REQUIRED');
    expect(output).toContain('title');
    expect(output).toContain('archetype');
  });

  it('shows enum values', () => {
    const output = formatToolHelp('magnetlab_create_lead_magnet');
    expect(output).toContain('single-breakdown');
    expect(output).toContain('focused-toolkit');
  });

  it('shows CLI flag format', () => {
    const output = formatToolHelp('magnetlab_search_knowledge');
    expect(output).toContain('--query');
    expect(output).toContain('--limit');
  });

  it('returns error for unknown tool', () => {
    const output = formatToolHelp('nonexistent_tool');
    expect(output).toContain('Unknown tool');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/help.test.ts`
Expected: FAIL

**Step 3: Implement help command**

Create `packages/mcp/src/cli/help-command.ts`:

```typescript
import { toolsByName } from '../tools/index.js';

/** Convert snake_case parameter name to --kebab-case CLI flag. */
function toFlag(name: string): string {
  return '--' + name.replace(/_/g, '-');
}

/**
 * Format full help text for a tool, including CLI flag syntax.
 */
export function formatToolHelp(toolName: string): string {
  // Try with and without prefix
  const resolved = toolsByName.get(toolName) || toolsByName.get(`magnetlab_${toolName}`);

  if (!resolved) {
    return `Unknown tool: "${toolName}". Run: magnetlab tools`;
  }

  const schema = resolved.inputSchema as {
    properties?: Record<string, {
      type?: string;
      description?: string;
      enum?: string[];
      default?: unknown;
      items?: { type?: string };
    }>;
    required?: string[];
  };

  const props = schema.properties || {};
  const required = new Set(schema.required || []);

  const lines: string[] = [
    resolved.name,
    resolved.description || '',
    '',
    'Usage:',
    `  magnetlab exec ${resolved.name.replace('magnetlab_', '')} [flags]`,
    '',
    'Flags:',
  ];

  for (const [name, def] of Object.entries(props)) {
    const flag = toFlag(name);
    const req = required.has(name) ? ' REQUIRED' : '';
    const type = def.type === 'array' ? `${def.items?.type || 'string'}[]` : (def.type || 'any');
    const enumStr = def.enum ? `  [${def.enum.join(' | ')}]` : '';
    const defaultStr = def.default !== undefined ? `  (default: ${def.default})` : '';
    const desc = def.description ? `  ${def.description}` : '';
    lines.push(`  ${flag} <${type}>${req}${enumStr}${defaultStr}`);
    if (desc) lines.push(`      ${desc.trim()}`);
  }

  if (Object.keys(props).length === 0) {
    lines.push('  (no parameters)');
  }

  return lines.join('\n');
}
```

**Step 4: Wire into cli.ts**

Add to `packages/mcp/src/cli.ts` after the `tools` command:

```typescript
import { formatToolHelp } from './cli/help-command.js';

program
  .command('help <tool>')
  .description('Show parameters and usage for a specific tool')
  .action((tool: string) => {
    console.log(formatToolHelp(tool));
  });
```

**Step 5: Run tests**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/help.test.ts`
Expected: PASS (all 6 tests)

**Step 6: Build and verify**

Run: `cd packages/mcp && npm run build && node dist/cli.js help search_knowledge`
Expected: Full schema with --query, --limit flags

**Step 7: Commit**

```bash
git add packages/mcp/src/cli/help-command.ts packages/mcp/src/__tests__/cli/help.test.ts packages/mcp/src/cli.ts
git commit -m "feat(cli): add help command with flag syntax"
```

---

### Task 3: `guide` Command

Print workflow recipes. Reuses existing `workflowRecipes` from category-tools.

**Files:**
- Modify: `packages/mcp/src/cli.ts` (add command)
- Test: `packages/mcp/src/__tests__/cli/guide.test.ts`

**Step 1: Write the failing test**

Create `packages/mcp/src/__tests__/cli/guide.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { workflowRecipes } from '../../tools/category-tools.js';

describe('guide command', () => {
  it('create_lead_magnet recipe exists and is non-empty', () => {
    expect(workflowRecipes['create_lead_magnet']).toBeTruthy();
    expect(workflowRecipes['create_lead_magnet'].length).toBeGreaterThan(100);
  });

  it('list_tasks recipe lists all available tasks', () => {
    const listing = workflowRecipes['list_tasks'];
    expect(listing).toContain('create_lead_magnet');
    expect(listing).toContain('write_linkedin_post');
    expect(listing).toContain('setup_funnel');
    expect(listing).toContain('analyze_content_gaps');
    expect(listing).toContain('plan_content_week');
  });

  it('all recipe keys are valid', () => {
    for (const key of Object.keys(workflowRecipes)) {
      expect(typeof workflowRecipes[key]).toBe('string');
      expect(workflowRecipes[key].length).toBeGreaterThan(0);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/guide.test.ts`
Expected: PASS (these test existing code — confirms guide data is usable)

**Step 3: Wire into cli.ts**

Add to `packages/mcp/src/cli.ts`:

```typescript
import { workflowRecipes } from './tools/category-tools.js';

program
  .command('guide [task]')
  .description('Show step-by-step workflow for common tasks')
  .action((task?: string) => {
    if (!task) {
      console.log(workflowRecipes['list_tasks']);
      return;
    }
    const recipe = workflowRecipes[task];
    if (!recipe) {
      console.log(`Unknown task: "${task}"\n`);
      console.log(workflowRecipes['list_tasks']);
      return;
    }
    console.log(recipe);
  });
```

**Step 4: Build and verify**

Run: `cd packages/mcp && npm run build && node dist/cli.js guide create_lead_magnet`
Expected: Full workflow recipe with all steps

**Step 5: Commit**

```bash
git add packages/mcp/src/cli.ts packages/mcp/src/__tests__/cli/guide.test.ts
git commit -m "feat(cli): add guide command for workflow recipes"
```

---

### Task 4: `exec` Command — Flag Parsing

The core command. Parses CLI flags into an argument object using the tool's inputSchema as the source of truth, then dispatches to `handleToolCall`.

**Files:**
- Create: `packages/mcp/src/cli/exec.ts`
- Test: `packages/mcp/src/__tests__/cli/exec.test.ts`

**Step 1: Write the failing tests**

Create `packages/mcp/src/__tests__/cli/exec.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseFlags, resolveToolName } from '../../cli/exec.js';

describe('resolveToolName', () => {
  it('returns full name when magnetlab_ prefix present', () => {
    expect(resolveToolName('magnetlab_search_knowledge')).toBe('magnetlab_search_knowledge');
  });

  it('adds magnetlab_ prefix when missing', () => {
    expect(resolveToolName('search_knowledge')).toBe('magnetlab_search_knowledge');
  });

  it('returns null for unknown tool', () => {
    expect(resolveToolName('totally_fake_tool')).toBeNull();
  });
});

describe('parseFlags', () => {
  it('parses string flags', () => {
    const result = parseFlags('magnetlab_search_knowledge', ['--query', 'cold email']);
    expect(result).toEqual({ query: 'cold email' });
  });

  it('converts kebab-case to snake_case', () => {
    const result = parseFlags('magnetlab_generate_lead_magnet_content', ['--lead-magnet-id', 'abc']);
    expect(result).toEqual({ lead_magnet_id: 'abc' });
  });

  it('parses boolean flags (--use-brain becomes true)', () => {
    const result = parseFlags('magnetlab_create_lead_magnet', ['--title', 'Test', '--archetype', 'prompt', '--use-brain']);
    expect(result.use_brain).toBe(true);
  });

  it('parses number flags', () => {
    const result = parseFlags('magnetlab_search_knowledge', ['--limit', '5']);
    expect(result.limit).toBe(5);
  });

  it('parses JSON object flags', () => {
    const result = parseFlags('magnetlab_create_lead_magnet', [
      '--title', 'Test',
      '--archetype', 'prompt',
      '--funnel-config', '{"slug":"test","theme":"dark"}',
    ]);
    expect(result.funnel_config).toEqual({ slug: 'test', theme: 'dark' });
  });

  it('parses JSON array flags', () => {
    const result = parseFlags('magnetlab_create_lead_magnet', [
      '--title', 'Test',
      '--archetype', 'prompt',
      '--knowledge-entry-ids', '["id1","id2"]',
    ]);
    expect(result.knowledge_entry_ids).toEqual(['id1', 'id2']);
  });

  it('returns empty object for no flags', () => {
    const result = parseFlags('magnetlab_list_lead_magnets', []);
    expect(result).toEqual({});
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/exec.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement flag parsing**

Create `packages/mcp/src/cli/exec.ts`:

```typescript
import { toolsByName } from '../tools/index.js';
import { MagnetLabClient } from '../client.js';
import { handleToolCall, ToolResult } from '../handlers/index.js';

/**
 * Resolve a tool name — add magnetlab_ prefix if missing, validate it exists.
 */
export function resolveToolName(input: string): string | null {
  if (toolsByName.has(input)) return input;
  const prefixed = `magnetlab_${input}`;
  if (toolsByName.has(prefixed)) return prefixed;
  return null;
}

/**
 * Convert --kebab-case flag to snake_case parameter name.
 */
function flagToParam(flag: string): string {
  return flag.replace(/^--/, '').replace(/-/g, '_');
}

/**
 * Get the expected type for a parameter from the tool's inputSchema.
 */
function getParamType(toolName: string, paramName: string): string | undefined {
  const tool = toolsByName.get(toolName);
  if (!tool) return undefined;
  const schema = tool.inputSchema as { properties?: Record<string, { type?: string }> };
  return schema.properties?.[paramName]?.type;
}

/**
 * Parse CLI flags into an argument object using the tool's schema for type coercion.
 */
export function parseFlags(toolName: string, argv: string[]): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  let i = 0;

  while (i < argv.length) {
    const token = argv[i];

    if (!token.startsWith('--')) {
      i++;
      continue;
    }

    const paramName = flagToParam(token);
    const paramType = getParamType(toolName, paramName);
    const nextToken = argv[i + 1];

    // Boolean flag: no next value, or next value is another flag
    if (paramType === 'boolean' || !nextToken || nextToken.startsWith('--')) {
      args[paramName] = true;
      i++;
      continue;
    }

    const value = nextToken;
    i += 2;

    // Type coercion based on schema
    if (paramType === 'number') {
      args[paramName] = Number(value);
    } else if (paramType === 'object' || paramType === 'array') {
      try {
        args[paramName] = JSON.parse(value);
      } catch {
        args[paramName] = value;
      }
    } else {
      // Try JSON parse for values that look like JSON (starts with { or [)
      if ((value.startsWith('{') || value.startsWith('[')) && paramType !== 'string') {
        try {
          args[paramName] = JSON.parse(value);
        } catch {
          args[paramName] = value;
        }
      } else {
        args[paramName] = value;
      }
    }
  }

  return args;
}

/**
 * Execute a tool via CLI and return the result.
 * This is the core dispatch function used by the exec command.
 */
export async function execTool(
  toolName: string,
  flags: string[],
  apiKey: string,
  baseUrl?: string
): Promise<{ output: string; exitCode: number }> {
  const resolved = resolveToolName(toolName);
  if (!resolved) {
    return {
      output: JSON.stringify({ error: `Unknown tool: "${toolName}". Run: magnetlab tools` }),
      exitCode: 1,
    };
  }

  const args = parseFlags(resolved, flags);
  const client = new MagnetLabClient(apiKey, { baseUrl });
  const result: ToolResult = await handleToolCall(resolved, args, client);

  const text = result.content[0]?.text || '{}';

  // Check if result is an error
  try {
    const parsed = JSON.parse(text);
    if (parsed.error) {
      return { output: text, exitCode: 1 };
    }
  } catch {
    // Not JSON — return as-is
  }

  return { output: text, exitCode: 0 };
}
```

**Step 4: Run tests**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/exec.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Wire exec into cli.ts**

Add to `packages/mcp/src/cli.ts`:

```typescript
import { execTool } from './cli/exec.js';

program
  .command('exec <tool> [flags...]')
  .description('Execute any MagnetLab tool (magnetlab_ prefix optional)')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .option('--pretty', 'Pretty-print JSON output')
  .allowUnknownOption()
  .action(async (tool: string, flags: string[], options: { apiKey?: string; baseUrl?: string; pretty?: boolean }) => {
    const apiKey = options.apiKey || process.env.MAGNETLAB_API_KEY;
    if (!apiKey) {
      console.error(JSON.stringify({ error: 'API key required. Set MAGNETLAB_API_KEY or use --api-key' }));
      process.exit(1);
    }

    // Merge unknown flags back — Commander captures known options separately
    const allFlags = flags;

    const { output, exitCode } = await execTool(tool, allFlags, apiKey, options.baseUrl);

    if (options.pretty) {
      try {
        console.log(JSON.stringify(JSON.parse(output), null, 2));
      } catch {
        console.log(output);
      }
    } else {
      console.log(output);
    }

    process.exit(exitCode);
  });
```

**Step 6: Build and verify**

Run: `cd packages/mcp && npm run build && MAGNETLAB_API_KEY=test node dist/cli.js exec list_lead_magnets --limit 1`
Expected: JSON response (or auth error if test key is invalid — the dispatch path works)

**Step 7: Commit**

```bash
git add packages/mcp/src/cli/exec.ts packages/mcp/src/__tests__/cli/exec.test.ts packages/mcp/src/cli.ts
git commit -m "feat(cli): add exec command with schema-driven flag parsing"
```

---

### Task 5: `status` Command

Convenience shortcut: `magnetlab status <id>` → `magnetlab exec lead_magnet_status --lead-magnet-id <id>`.

**Files:**
- Modify: `packages/mcp/src/cli.ts` (add command)

**Step 1: Add to cli.ts**

```typescript
program
  .command('status <id>')
  .description('Check lead magnet completeness — shortcut for exec lead_magnet_status')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .option('--pretty', 'Pretty-print JSON output')
  .action(async (id: string, options: { apiKey?: string; baseUrl?: string; pretty?: boolean }) => {
    const apiKey = options.apiKey || process.env.MAGNETLAB_API_KEY;
    if (!apiKey) {
      console.error(JSON.stringify({ error: 'API key required. Set MAGNETLAB_API_KEY or use --api-key' }));
      process.exit(1);
    }

    const { output, exitCode } = await execTool(
      'lead_magnet_status',
      ['--lead-magnet-id', id],
      apiKey,
      options.baseUrl
    );

    if (options.pretty) {
      try {
        console.log(JSON.stringify(JSON.parse(output), null, 2));
      } catch {
        console.log(output);
      }
    } else {
      console.log(output);
    }

    process.exit(exitCode);
  });
```

**Step 2: Build and verify**

Run: `cd packages/mcp && npm run build && node dist/cli.js status --help`
Expected: Shows help text with usage

**Step 3: Commit**

```bash
git add packages/mcp/src/cli.ts
git commit -m "feat(cli): add status shortcut command"
```

---

### Task 6: Slash Command Templates

Create the 6 slash command template files as TypeScript string exports. These will be written to `.claude/commands/` by `magnetlab init`.

**Files:**
- Create: `packages/mcp/src/cli/commands/create-lead-magnet.ts`
- Create: `packages/mcp/src/cli/commands/write-post.ts`
- Create: `packages/mcp/src/cli/commands/check-brain.ts`
- Create: `packages/mcp/src/cli/commands/lead-magnet-status.ts`
- Create: `packages/mcp/src/cli/commands/setup-funnel.ts`
- Create: `packages/mcp/src/cli/commands/content-week.ts`
- Create: `packages/mcp/src/cli/commands/index.ts`
- Test: `packages/mcp/src/__tests__/cli/commands.test.ts`

**Step 1: Write the failing test**

Create `packages/mcp/src/__tests__/cli/commands.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { slashCommands } from '../../cli/commands/index.js';

describe('slash command templates', () => {
  it('exports exactly 6 slash commands', () => {
    expect(Object.keys(slashCommands)).toHaveLength(6);
  });

  it('all commands have filename, content, and description', () => {
    for (const [key, cmd] of Object.entries(slashCommands)) {
      expect(cmd.filename, `${key} missing filename`).toBeTruthy();
      expect(cmd.filename).toMatch(/\.md$/);
      expect(cmd.content, `${key} missing content`).toBeTruthy();
      expect(cmd.content.length, `${key} content too short`).toBeGreaterThan(50);
      expect(cmd.description, `${key} missing description`).toBeTruthy();
    }
  });

  it('all commands reference magnetlab exec', () => {
    for (const [key, cmd] of Object.entries(slashCommands)) {
      expect(cmd.content, `${key} should reference magnetlab exec`).toContain('magnetlab exec');
    }
  });

  it('create-lead-magnet uses $ARGUMENTS', () => {
    expect(slashCommands['create-lead-magnet'].content).toContain('$ARGUMENTS');
  });

  it('write-post uses $ARGUMENTS', () => {
    expect(slashCommands['write-post'].content).toContain('$ARGUMENTS');
  });

  it('check-brain uses $ARGUMENTS', () => {
    expect(slashCommands['check-brain'].content).toContain('$ARGUMENTS');
  });

  it('lead-magnet-status uses $ARGUMENTS', () => {
    expect(slashCommands['lead-magnet-status'].content).toContain('$ARGUMENTS');
  });

  it('create-lead-magnet references key workflow steps', () => {
    const content = slashCommands['create-lead-magnet'].content;
    expect(content).toContain('knowledge_readiness');
    expect(content).toContain('search_knowledge');
    expect(content).toContain('synthesize_position');
    expect(content).toContain('create_lead_magnet');
    expect(content).toContain('generate_lead_magnet_content');
    expect(content).toContain('generate_email_sequence');
    expect(content).toContain('activate_email_sequence');
    expect(content).toContain('publish_funnel');
  });

  it('all commands end with a summary instruction', () => {
    for (const [key, cmd] of Object.entries(slashCommands)) {
      expect(cmd.content.toLowerCase(), `${key} should mention summary`).toMatch(/summary|present|report/);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/commands.test.ts`
Expected: FAIL

**Step 3: Create the slash command templates**

Create `packages/mcp/src/cli/commands/create-lead-magnet.ts`:

```typescript
export const createLeadMagnet = {
  filename: 'create-lead-magnet.md',
  description: 'Create a brain-informed lead magnet with funnel and email sequence',
  content: `Create a brain-informed lead magnet based on: $ARGUMENTS

Interpret the input to extract topic, format preference (checklist/guide/framework/template/swipe-file), and target audience. If any are unclear, ask before proceeding.

## Steps

### 1. Check Brain Readiness
\`\`\`bash
magnetlab exec knowledge_readiness --topic "<topic from input>" --goal lead_magnet
\`\`\`
- If confidence is "high" or "medium": proceed
- If confidence is "low": tell me what's missing, how many entries exist, and ask if I want to proceed with limited brain data or upload more transcripts first

### 2. Research & Synthesize
\`\`\`bash
magnetlab exec search_knowledge --query "<topic>"
magnetlab exec synthesize_position --topic "<topic-slug>"
\`\`\`
Review the position: thesis, differentiators, key stories, data points.

### 3. Propose Angle
Present what the brain has on this topic. Propose:
- A specific title that leads with the user's differentiator
- An archetype (single-breakdown, single-system, focused-toolkit, prompt, assessment, workflow, etc.)
- The hook angle based on their unique position

**Get my approval before creating.**

### 4. Create Lead Magnet + Funnel
\`\`\`bash
magnetlab exec create_lead_magnet --title "<title>" --archetype "<archetype>" --use-brain --funnel-config '{"slug":"<slug>","optin_headline":"<headline>","optin_social_proof":null,"publish":false}'
\`\`\`
Extract lead_magnet.id and funnel.funnel.id from the response.

### 5. Generate Content (30-90s)
\`\`\`bash
magnetlab exec generate_lead_magnet_content --lead-magnet-id "<id>"
\`\`\`

### 6. Generate Email Sequence (30-60s)
\`\`\`bash
magnetlab exec generate_email_sequence --lead-magnet-id "<id>"
\`\`\`
Review the response for placeholder text like [INSERT TIP] or [YOUR NAME]. If found, fix them:
\`\`\`bash
magnetlab exec update_email_sequence --lead-magnet-id "<id>" --emails '<fixed emails JSON>'
\`\`\`
Then activate:
\`\`\`bash
magnetlab exec activate_email_sequence --lead-magnet-id "<id>"
\`\`\`

### 7. Review & Publish
Ask me if I want to publish. If yes:
\`\`\`bash
magnetlab exec publish_funnel --funnel-id "<funnel-id>"
\`\`\`

## Error Handling
If any step fails, explain the error and suggest a fix. Check status anytime with:
\`\`\`bash
magnetlab status <lead-magnet-id>
\`\`\`

## Summary
After completing all steps, present a summary:
- **Lead magnet**: [title] (id: xxx)
- **Funnel**: [url or "draft"]
- **Email sequence**: [status] ([N] emails)
- **Brain data**: [N] entries used, position: [yes/no]
- **Warnings**: any issues (e.g., "Social proof omitted — no real data")
`,
};
```

Create `packages/mcp/src/cli/commands/write-post.ts`:

```typescript
export const writePost = {
  filename: 'write-post.md',
  description: 'Write a knowledge-grounded LinkedIn post',
  content: `Write a LinkedIn post about: $ARGUMENTS

## Steps

### 1. Research
\`\`\`bash
magnetlab exec search_knowledge --query "<topic from input>"
magnetlab exec synthesize_position --topic "<topic-slug>"
\`\`\`

### 2. Check Existing Ideas
\`\`\`bash
magnetlab exec list_ideas --status extracted --limit 10
\`\`\`
Look for ideas matching the topic.

### 3. Write
If a matching idea exists:
\`\`\`bash
magnetlab exec write_post_from_idea --idea-id "<id>"
\`\`\`

If no matching idea:
\`\`\`bash
magnetlab exec quick_write --topic "<topic>"
\`\`\`

### 4. Polish
\`\`\`bash
magnetlab exec polish_post --id "<post-id>"
\`\`\`

### 5. Review
Show me the polished post. Ask if I want to:
- Edit it further
- Schedule it (ask for date/time)
- Publish it now

## Summary
Present the final post with:
- **Post**: first 50 chars...
- **Status**: draft/scheduled/published
- **Brain data**: position used, key insight featured
`,
};
```

Create `packages/mcp/src/cli/commands/check-brain.ts`:

```typescript
export const checkBrain = {
  filename: 'check-brain.md',
  description: 'Check AI Brain knowledge on a topic',
  content: `Check my AI Brain knowledge on: $ARGUMENTS

## Steps

### 1. Readiness Check
\`\`\`bash
magnetlab exec knowledge_readiness --topic "<topic>" --goal lead_magnet
\`\`\`

### 2. Search for Entries
\`\`\`bash
magnetlab exec search_knowledge --query "<topic>" --limit 10
\`\`\`

### 3. Synthesize Position (if entries exist)
\`\`\`bash
magnetlab exec synthesize_position --topic "<topic-slug>"
\`\`\`

## Report
Present a summary:
- **Confidence**: high/medium/low
- **Entries found**: [N] entries
- **Key insights**: bullet list of top 3-5 insights from the brain
- **Position**: thesis + stance type (if synthesized)
- **Gaps**: what's missing
- **Recommendations**:
  - Ready for lead magnet? (yes/no + why)
  - Ready for LinkedIn post? (yes/no + why)
  - What transcripts/topics would strengthen coverage?
`,
};
```

Create `packages/mcp/src/cli/commands/lead-magnet-status.ts`:

```typescript
export const leadMagnetStatus = {
  filename: 'lead-magnet-status.md',
  description: 'Check completeness of a lead magnet',
  content: `Check the status of lead magnet: $ARGUMENTS

\`\`\`bash
magnetlab status $ARGUMENTS
\`\`\`

Present the results clearly:
- **Lead magnet**: [title] — [status]
- **Content**: generated / missing
- **Funnel**: exists / missing — published / draft
- **Email sequence**: exists / missing — [status] ([N] emails)
- **Brain enriched**: yes/no ([N] entries)
- **Next step**: [what to do next]

If there are missing items, offer to complete them.
`,
};
```

Create `packages/mcp/src/cli/commands/setup-funnel.ts`:

```typescript
export const setupFunnel = {
  filename: 'setup-funnel.md',
  description: 'Create and publish a funnel for an existing lead magnet',
  content: `Set up a funnel for lead magnet: $ARGUMENTS

## Steps

### 1. Check Lead Magnet
\`\`\`bash
magnetlab status $ARGUMENTS
\`\`\`
Verify the lead magnet exists and has content.

### 2. Create Funnel
\`\`\`bash
magnetlab exec create_funnel --lead-magnet-id "$ARGUMENTS" --slug "<auto-from-title>" --optin-headline "<from lead magnet title>" --optin-social-proof ""
\`\`\`
Do NOT fabricate social proof — leave null unless real data is available.

### 3. Restyle (optional)
Ask if I want a specific look. If yes:
\`\`\`bash
magnetlab exec restyle_funnel --funnel-id "<id>" --prompt "<style description>"
magnetlab exec apply_restyle --funnel-id "<id>" --plan '<plan JSON>'
\`\`\`

### 4. Email Sequence (if not exists)
\`\`\`bash
magnetlab exec generate_email_sequence --lead-magnet-id "$ARGUMENTS"
magnetlab exec activate_email_sequence --lead-magnet-id "$ARGUMENTS"
\`\`\`

### 5. Publish
Ask me before publishing:
\`\`\`bash
magnetlab exec publish_funnel --funnel-id "<id>"
\`\`\`

## Summary
Present:
- **Funnel**: [url]
- **Theme**: [dark/light], [color]
- **Email sequence**: [status]
- **Sections**: [count] sections
`,
};
```

Create `packages/mcp/src/cli/commands/content-week.ts`:

```typescript
export const contentWeek = {
  filename: 'content-week.md',
  description: 'Plan and schedule a week of LinkedIn content',
  content: `Plan a week of LinkedIn content.

## Steps

### 1. Check Knowledge Strength
\`\`\`bash
magnetlab exec list_topics
magnetlab exec knowledge_gaps
\`\`\`

### 2. Review Existing Ideas
\`\`\`bash
magnetlab exec list_ideas --status extracted --limit 20
\`\`\`

### 3. Check Current Schedule
\`\`\`bash
magnetlab exec get_autopilot_status
magnetlab exec list_posting_slots
\`\`\`

### 4. Generate Plan
\`\`\`bash
magnetlab exec generate_plan --week-count 1
\`\`\`

### 5. Review with Me
Present the plan: which topics, which days, what angles.
Ask if I want to adjust anything.

### 6. Approve & Execute
\`\`\`bash
magnetlab exec approve_plan --plan-id "<id>"
magnetlab exec trigger_autopilot --posts-per-batch 5
\`\`\`

## Summary
Report:
- **Posts planned**: [N] posts for [dates]
- **Topics covered**: bullet list
- **Posting slots**: [schedule]
- **Buffer status**: [N] posts ready
`,
};
```

Create `packages/mcp/src/cli/commands/index.ts`:

```typescript
import { createLeadMagnet } from './create-lead-magnet.js';
import { writePost } from './write-post.js';
import { checkBrain } from './check-brain.js';
import { leadMagnetStatus } from './lead-magnet-status.js';
import { setupFunnel } from './setup-funnel.js';
import { contentWeek } from './content-week.js';

export interface SlashCommand {
  filename: string;
  description: string;
  content: string;
}

export const slashCommands: Record<string, SlashCommand> = {
  'create-lead-magnet': createLeadMagnet,
  'write-post': writePost,
  'check-brain': checkBrain,
  'lead-magnet-status': leadMagnetStatus,
  'setup-funnel': setupFunnel,
  'content-week': contentWeek,
};
```

**Step 4: Run tests**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/commands.test.ts`
Expected: PASS (all 10 tests)

**Step 5: Commit**

```bash
git add packages/mcp/src/cli/commands/
git add packages/mcp/src/__tests__/cli/commands.test.ts
git commit -m "feat(cli): add 6 slash command templates"
```

---

### Task 7: `init` Command

The project setup command. Generates `.claude/commands/`, updates CLAUDE.md, verifies API key.

**Files:**
- Create: `packages/mcp/src/cli/init.ts`
- Modify: `packages/mcp/src/cli.ts` (add command)
- Test: `packages/mcp/src/__tests__/cli/init.test.ts`

**Step 1: Write the failing test**

Create `packages/mcp/src/__tests__/cli/init.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateClaudeMdSection, generateInitFiles } from '../../cli/init.js';
import { slashCommands } from '../../cli/commands/index.js';

describe('init command', () => {
  describe('generateClaudeMdSection', () => {
    it('returns non-empty markdown', () => {
      const section = generateClaudeMdSection();
      expect(section.length).toBeGreaterThan(100);
    });

    it('mentions magnetlab exec', () => {
      const section = generateClaudeMdSection();
      expect(section).toContain('magnetlab exec');
    });

    it('mentions magnetlab guide', () => {
      const section = generateClaudeMdSection();
      expect(section).toContain('magnetlab guide');
    });

    it('lists available slash commands', () => {
      const section = generateClaudeMdSection();
      for (const cmd of Object.values(slashCommands)) {
        expect(section).toContain(cmd.filename.replace('.md', ''));
      }
    });
  });

  describe('generateInitFiles', () => {
    it('returns files for all slash commands plus CLAUDE.md section', () => {
      const files = generateInitFiles();
      // 6 slash commands
      const commandFiles = files.filter((f) => f.path.includes('.claude/commands/'));
      expect(commandFiles).toHaveLength(6);
    });

    it('all command files have .md extension', () => {
      const files = generateInitFiles();
      const commandFiles = files.filter((f) => f.path.includes('.claude/commands/'));
      for (const file of commandFiles) {
        expect(file.path).toMatch(/\.md$/);
      }
    });

    it('returns CLAUDE.md section as a separate entry', () => {
      const files = generateInitFiles();
      const claudeMd = files.find((f) => f.type === 'claude-md-section');
      expect(claudeMd).toBeDefined();
      expect(claudeMd!.content.length).toBeGreaterThan(100);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/init.test.ts`
Expected: FAIL

**Step 3: Implement init module**

Create `packages/mcp/src/cli/init.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { slashCommands } from './commands/index.js';
import { MagnetLabClient } from '../client.js';

export interface InitFile {
  path: string;
  content: string;
  type: 'slash-command' | 'claude-md-section';
}

/**
 * Generate the CLAUDE.md section content.
 */
export function generateClaudeMdSection(): string {
  const commandList = Object.values(slashCommands)
    .map((cmd) => `| /${cmd.filename.replace('.md', '')} | ${cmd.description} |`)
    .join('\n');

  return `## MagnetLab CLI

MagnetLab is your AI-powered lead magnet platform. The \`magnetlab\` CLI lets you create lead magnets, manage funnels, write content, and run your knowledge base from the terminal.

### Slash Commands

| Command | Description |
|---------|-------------|
${commandList}

### CLI Reference

| Command | Purpose |
|---------|---------|
| \`magnetlab exec <tool> [flags]\` | Execute any tool (118 available) |
| \`magnetlab tools [category]\` | List available tools by category |
| \`magnetlab help <tool>\` | Show tool parameters and usage |
| \`magnetlab guide <task>\` | Step-by-step workflow for common tasks |
| \`magnetlab status <id>\` | Check lead magnet completeness |

### Key Principle

Always run \`magnetlab guide <task>\` before starting any multi-step task. The guide returns the exact sequence of CLI commands to follow.

The AI Brain (\`magnetlab exec search_knowledge\`) contains the user's real expertise from call transcripts. Always search it before creating content — never generate from thin air.
`;
}

/**
 * Generate all files that init should create (without writing them).
 * Pure function for testability.
 */
export function generateInitFiles(): InitFile[] {
  const files: InitFile[] = [];

  for (const cmd of Object.values(slashCommands)) {
    files.push({
      path: `.claude/commands/${cmd.filename}`,
      content: cmd.content,
      type: 'slash-command',
    });
  }

  files.push({
    path: 'CLAUDE.md',
    content: generateClaudeMdSection(),
    type: 'claude-md-section',
  });

  return files;
}

/**
 * Prompt user for API key via stdin.
 */
async function promptApiKey(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question('Enter your MagnetLab API key (from magnetlab.app/settings/developer): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Run the init command.
 */
export async function runInit(options: { apiKey?: string; baseUrl?: string }): Promise<void> {
  const cwd = process.cwd();

  // Step 1: Resolve API key
  let apiKey = options.apiKey || process.env.MAGNETLAB_API_KEY;

  if (!apiKey) {
    apiKey = await promptApiKey();
    if (!apiKey) {
      console.error('No API key provided. Aborting.');
      process.exit(1);
    }

    // Save to .env
    const envPath = path.join(cwd, '.env');
    const envLine = `MAGNETLAB_API_KEY=${apiKey}\n`;
    if (fs.existsSync(envPath)) {
      const existing = fs.readFileSync(envPath, 'utf-8');
      if (!existing.includes('MAGNETLAB_API_KEY')) {
        fs.appendFileSync(envPath, envLine);
        console.log('  Added MAGNETLAB_API_KEY to .env');
      }
    } else {
      fs.writeFileSync(envPath, envLine);
      console.log('  Created .env with MAGNETLAB_API_KEY');
    }
  }

  // Step 2: Verify connection
  try {
    const client = new MagnetLabClient(apiKey, { baseUrl: options.baseUrl });
    await client.listLeadMagnets({ limit: 1 });
    console.log('✓ API key verified');
  } catch (err) {
    console.error(`✗ API key verification failed: ${err instanceof Error ? err.message : err}`);
    console.error('  Check your key at magnetlab.app/settings/developer');
    process.exit(1);
  }

  // Step 3: Generate slash commands
  const commandsDir = path.join(cwd, '.claude', 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });

  const files = generateInitFiles();
  const commandFiles = files.filter((f) => f.type === 'slash-command');

  for (const file of commandFiles) {
    const filePath = path.join(cwd, file.path);
    fs.writeFileSync(filePath, file.content, 'utf-8');
    console.log(`✓ Created ${file.path}`);
  }

  // Step 4: Update CLAUDE.md
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const section = files.find((f) => f.type === 'claude-md-section')!;

  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf-8');
    if (existing.includes('## MagnetLab CLI')) {
      console.log('  CLAUDE.md already has MagnetLab CLI section — skipped');
    } else {
      fs.appendFileSync(claudeMdPath, '\n' + section.content);
      console.log('✓ Updated CLAUDE.md with MagnetLab CLI reference');
    }
  } else {
    fs.writeFileSync(claudeMdPath, section.content);
    console.log('✓ Created CLAUDE.md with MagnetLab CLI reference');
  }

  console.log('\nReady! Try: /create-lead-magnet <topic>');
}
```

**Step 4: Wire into cli.ts**

Add to `packages/mcp/src/cli.ts`:

```typescript
import { runInit } from './cli/init.js';

program
  .command('init')
  .description('Set up Claude Code project with slash commands and CLAUDE.md')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .action(async (options: { apiKey?: string; baseUrl?: string }) => {
    await runInit(options);
  });
```

**Step 5: Run tests**

Run: `cd packages/mcp && npx vitest run src/__tests__/cli/init.test.ts`
Expected: PASS (all 7 tests)

**Step 6: Build and verify**

Run: `cd packages/mcp && npm run build`
Run: `node dist/cli.js init --help`
Expected: Shows init help text

**Step 7: Commit**

```bash
git add packages/mcp/src/cli/init.ts packages/mcp/src/__tests__/cli/init.test.ts packages/mcp/src/cli.ts
git commit -m "feat(cli): add init command for Claude Code project setup"
```

---

### Task 8: Final Assembly + Build Verification

Ensure the complete `cli.ts` file is correct, all imports work, build is clean, and all tests pass.

**Files:**
- Modify: `packages/mcp/src/cli.ts` (final version with all commands)

**Step 1: Verify final cli.ts has all 6 commands**

The final `packages/mcp/src/cli.ts` should import and wire:
- `tools` — from `./cli/tools-command.js`
- `help` — from `./cli/help-command.js`
- `guide` — from `./tools/category-tools.js`
- `exec` — from `./cli/exec.js`
- `status` — uses `execTool` from `./cli/exec.js`
- `init` — from `./cli/init.js`

**Step 2: Run all tests**

Run: `cd packages/mcp && npx vitest run`
Expected: All tests pass (313 existing + ~25 new CLI tests)

**Step 3: Build**

Run: `cd packages/mcp && npm run build`
Expected: Clean build, no errors

**Step 4: Verify all CLI commands**

```bash
node dist/cli.js --help
node dist/cli.js tools
node dist/cli.js tools knowledge
node dist/cli.js help search_knowledge
node dist/cli.js guide create_lead_magnet
node dist/cli.js init --help
node dist/cli.js exec --help
node dist/cli.js status --help
```
Expected: All commands print their output without errors

**Step 5: Commit**

```bash
git add -A packages/mcp/src/
git commit -m "feat(cli): complete magnetlab CLI with all 6 commands"
```

---

### Task 9: Update package.json metadata + version bump

Update the package description, version, and keywords for the CLI release.

**Files:**
- Modify: `packages/mcp/package.json`

**Step 1: Update package.json**

Changes:
- `version`: `0.4.5` → `0.5.0` (minor bump for CLI feature)
- `description`: Update to mention CLI
- `keywords`: Add `cli`
- `exports`: Add CLI entry point

```json
{
  "version": "0.5.0",
  "description": "MCP server and CLI for MagnetLab — control your lead magnets, funnels, content pipeline, and analytics from Claude Code or any MCP client",
  "exports": {
    ".": "./dist/index.js",
    "./cli": "./dist/cli.js"
  },
  "bin": {
    "magnetlab-mcp": "./dist/index.js",
    "magnetlab": "./dist/cli.js"
  },
  "keywords": [
    "mcp",
    "cli",
    "claude",
    "claude-code",
    "magnetlab",
    "lead-magnet",
    "funnel",
    "content-pipeline",
    "model-context-protocol"
  ]
}
```

**Step 2: Update VERSION constant in cli.ts**

In `packages/mcp/src/cli.ts` and `packages/mcp/src/index.ts`, update `VERSION` to `'0.5.0'`.

**Step 3: Build and run final check**

Run: `cd packages/mcp && npm run build && npx vitest run`
Expected: Clean build, all tests pass

**Step 4: Commit**

```bash
git add packages/mcp/package.json packages/mcp/src/cli.ts packages/mcp/src/index.ts
git commit -m "chore: bump to v0.5.0 with CLI support"
```
