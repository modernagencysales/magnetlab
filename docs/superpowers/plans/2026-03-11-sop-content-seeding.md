# SOP Content Seeding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the empty `program_sops` table with structured data extracted from the 52 SOP markdown files in the `dwy-playbook` repo, making the GTM Accelerator's copilot capable of guiding users through real curriculum.

**Architecture:** One-time Node/TypeScript extraction script (`scripts/seed-sops.ts`) reads each SOP markdown file, sends it to Claude Haiku for structured extraction, collects all results, and outputs a Supabase SQL migration file. The migration uses `INSERT ... ON CONFLICT (module_id, sop_number) DO UPDATE` for idempotency. No runtime AI — pure offline batch processing.

**Tech Stack:** Node.js, TypeScript (tsx runner), @anthropic-ai/sdk (Claude Haiku), Supabase SQL migrations

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/seed-sops.ts` | Main extraction script — reads markdown files, calls Claude Haiku, outputs SQL |
| `scripts/sop-extraction-prompt.ts` | Claude prompt template for structured SOP extraction |
| `scripts/sop-types.ts` | TypeScript types for extraction output (mirrors `ProgramSop` fields) |
| `supabase/migrations/20260311100000_seed_program_sops.sql` | Generated SQL migration (output artifact) |
| `src/__tests__/scripts/sop-extraction.test.ts` | Tests for extraction logic (parsing, validation, SQL generation) |

---

## Chunk 1: Extraction Infrastructure

### Task 1: Extraction Types and Prompt Template

**Files:**
- Create: `scripts/sop-types.ts`
- Create: `scripts/sop-extraction-prompt.ts`

- [ ] **Step 1: Write the extraction types file**

```typescript
// scripts/sop-types.ts

/** Types for SOP extraction output. Mirrors ProgramSop fields from accelerator types. */

export interface ExtractedQualityBar {
  check: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface ExtractedDeliverable {
  type: string; // Must map to DeliverableType
  description: string;
}

export interface ExtractedSop {
  module_id: string;     // e.g. 'm0', 'm1', ..., 'm7'
  sop_number: string;    // e.g. '0-1', '3-106'
  title: string;
  content: string;       // Full markdown content (cleaned)
  quality_bars: ExtractedQualityBar[];
  deliverables: ExtractedDeliverable[];
  tools_used: string[];
  dependencies: string[];
}

/** Valid DeliverableType values from src/lib/types/accelerator.ts */
export const VALID_DELIVERABLE_TYPES = [
  'icp_definition', 'lead_magnet', 'funnel', 'email_sequence',
  'tam_list', 'outreach_campaign', 'tam_segment', 'dm_campaign',
  'email_campaign', 'email_infrastructure', 'content_plan',
  'post_drafts', 'metrics_digest', 'diagnostic_report',
  'ad_campaign', 'ad_targeting', 'weekly_ritual', 'operating_playbook',
] as const;

/** Valid tool names (consistent vocabulary for tools_used field) */
export const VALID_TOOLS = [
  'magnetlab_ideator', 'magnetlab_creator', 'magnetlab_funnel_builder',
  'magnetlab_post_writer', 'magnetlab_content_pipeline', 'magnetlab_brain',
  'clay', 'heyreach', 'plusvibe', 'zapmail', 'sales_navigator',
  'linkedin_ads_manager', 'linkedin', 'resend', 'stripe',
  'grain', 'fireflies', 'fathom', 'leadshark', 'unipile',
] as const;

/** Module ID mapping from directory names to module IDs */
export const DIR_TO_MODULE: Record<string, string> = {
  'module-0-positioning': 'm0',
  'module-1-lead-magnets': 'm1',
  'module-2-tam-building': 'm2',
  'module-3-linkedin-outreach': 'm3',
  'module-4-cold-email': 'm4',
  'module-5-linkedin-ads': 'm5',
  'module-6-operating-system': 'm6',
  'module-7-daily-content': 'm7',
};
```

- [ ] **Step 2: Write the extraction prompt template**

```typescript
// scripts/sop-extraction-prompt.ts

import { VALID_DELIVERABLE_TYPES, VALID_TOOLS } from './sop-types';

/**
 * Build the Claude prompt for extracting structured data from a raw SOP markdown file.
 * The prompt instructs Claude to return a JSON object matching ExtractedSop shape.
 */
export function buildExtractionPrompt(moduleId: string, sopNumber: string, rawMarkdown: string): string {
  return `You are extracting structured data from a Standard Operating Procedure (SOP) document.

The SOP belongs to module "${moduleId}" with SOP number "${sopNumber}".

Extract the following fields as a JSON object (no markdown fences, just raw JSON):

{
  "title": "Human-readable title (without SOP number prefix)",
  "content": "The full instructional content as clean markdown. Keep all steps, tips, warnings, examples. Remove frontmatter (---) blocks and the H1 title line. Keep :::tip, :::warning, :::info admonition blocks as-is.",
  "quality_bars": [
    {
      "check": "A measurable quality criterion for this SOP's output",
      "severity": "critical | warning | info"
    }
  ],
  "deliverables": [
    {
      "type": "One of the valid deliverable types listed below",
      "description": "What the user produces by completing this SOP"
    }
  ],
  "tools_used": ["tool_name_1", "tool_name_2"],
  "dependencies": ["module_id-sop_number of prerequisite SOPs, e.g. '0-1'"]
}

Rules:
- quality_bars: Extract from :::warning blocks, "Common Mistakes" sections, and implicit standards. Create 2-5 quality bars per SOP. Use "critical" for deal-breakers, "warning" for common mistakes, "info" for best practices.
- deliverables: What tangible output does this SOP produce? Map to these valid types ONLY: ${VALID_DELIVERABLE_TYPES.join(', ')}. If no exact match, use the closest fit. Most SOPs produce 1-2 deliverables.
- tools_used: Which tools are mentioned or implied? Use ONLY these names: ${VALID_TOOLS.join(', ')}. If a tool is mentioned but not in the list, omit it.
- dependencies: Which other SOPs must be completed first? Reference by "module-sop" format (e.g., "0-1" means Module 0 SOP 1). If none, use empty array.
- content: Keep the full instructional text. Remove YAML frontmatter and the H1 title. Keep admonition blocks (:::tip, :::warning, :::info). Keep step numbers. Keep all examples and field tips.

Here is the raw SOP markdown:

---
${rawMarkdown}
---

Respond with ONLY the JSON object. No explanation, no markdown fences.`;
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/sop-types.ts scripts/sop-extraction-prompt.ts
git commit -m "feat(accelerator): add SOP extraction types and prompt template"
```

### Task 2: Tests for Extraction Logic

**Files:**
- Create: `src/__tests__/scripts/sop-extraction.test.ts`

- [ ] **Step 1: Write tests for parsing, validation, and SQL generation**

```typescript
// src/__tests__/scripts/sop-extraction.test.ts
/**
 * @jest-environment node
 */

import { VALID_DELIVERABLE_TYPES, VALID_TOOLS, DIR_TO_MODULE } from '../../../scripts/sop-types';
import { buildExtractionPrompt } from '../../../scripts/sop-extraction-prompt';

describe('SOP extraction types', () => {
  it('DIR_TO_MODULE maps all 8 module directories', () => {
    expect(Object.keys(DIR_TO_MODULE)).toHaveLength(8);
    expect(DIR_TO_MODULE['module-0-positioning']).toBe('m0');
    expect(DIR_TO_MODULE['module-7-daily-content']).toBe('m7');
  });

  it('VALID_DELIVERABLE_TYPES contains all 18 types', () => {
    expect(VALID_DELIVERABLE_TYPES).toHaveLength(18);
    expect(VALID_DELIVERABLE_TYPES).toContain('icp_definition');
    expect(VALID_DELIVERABLE_TYPES).toContain('operating_playbook');
  });

  it('VALID_TOOLS contains expected tool names', () => {
    expect(VALID_TOOLS).toContain('magnetlab_ideator');
    expect(VALID_TOOLS).toContain('clay');
    expect(VALID_TOOLS).toContain('heyreach');
    expect(VALID_TOOLS).toContain('plusvibe');
  });
});

describe('buildExtractionPrompt', () => {
  const sampleMarkdown = `---
id: sop-1-1-ideate-lead-magnet
title: "SOP 1.1: Ideate a Lead Magnet"
---
# SOP 1.1: Ideate a Lead Magnet
## Steps
1. Open Magnet Lab Ideator tool.
2. Answer questions about expertise.`;

  it('includes module_id and sop_number in prompt', () => {
    const prompt = buildExtractionPrompt('m1', '1-1', sampleMarkdown);
    expect(prompt).toContain('"m1"');
    expect(prompt).toContain('"1-1"');
  });

  it('includes valid deliverable types in prompt', () => {
    const prompt = buildExtractionPrompt('m1', '1-1', sampleMarkdown);
    expect(prompt).toContain('icp_definition');
    expect(prompt).toContain('operating_playbook');
  });

  it('includes valid tool names in prompt', () => {
    const prompt = buildExtractionPrompt('m1', '1-1', sampleMarkdown);
    expect(prompt).toContain('magnetlab_ideator');
    expect(prompt).toContain('clay');
  });

  it('embeds the raw markdown content', () => {
    const prompt = buildExtractionPrompt('m1', '1-1', sampleMarkdown);
    expect(prompt).toContain('Open Magnet Lab Ideator tool');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="sop-extraction" --verbose`
Expected: All 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/scripts/sop-extraction.test.ts
git commit -m "test(accelerator): add SOP extraction unit tests"
```

---

## Chunk 2: Extraction Script and SQL Generation

### Task 3: File Discovery and Parsing Logic

**Files:**
- Create: `scripts/seed-sops.ts` (first half — file discovery, markdown parsing, validation)

- [ ] **Step 1: Write the file discovery and markdown parsing portion of the script**

```typescript
// scripts/seed-sops.ts

/**
 * One-time SOP extraction script.
 * Reads 52 SOP markdown files from dwy-playbook repo,
 * sends each to Claude Haiku for structured extraction,
 * outputs a Supabase SQL migration file.
 *
 * Usage: npx tsx scripts/seed-sops.ts
 * Requires: ANTHROPIC_API_KEY in environment
 */

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { buildExtractionPrompt } from './sop-extraction-prompt';
import {
  DIR_TO_MODULE,
  VALID_DELIVERABLE_TYPES,
  VALID_TOOLS,
  type ExtractedSop,
} from './sop-types';

// ─── Configuration ───────────────────────────────────────

const DWY_PLAYBOOK_SOPS = path.resolve(
  __dirname,
  '../../dwy-playbook/docs/sops'
);
const OUTPUT_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/20260311100000_seed_program_sops.sql'
);
const MODEL = 'claude-haiku-4-5-20251001';

// ─── File Discovery ──────────────────────────────────────

interface SopFile {
  filePath: string;
  moduleId: string;
  sopNumber: string;
}

function discoverSopFiles(): SopFile[] {
  const files: SopFile[] = [];
  const moduleDirs = fs.readdirSync(DWY_PLAYBOOK_SOPS);

  for (const dir of moduleDirs) {
    const moduleId = DIR_TO_MODULE[dir];
    if (!moduleId) continue;

    const dirPath = path.join(DWY_PLAYBOOK_SOPS, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;

    const mdFiles = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'));
    for (const file of mdFiles) {
      // Extract SOP number from filename: sop-2-4-email-enrichment.md → "2-4"
      const match = file.match(/^sop-(\d+-\d+)/);
      if (!match) {
        console.warn(`Skipping unrecognized filename: ${file}`);
        continue;
      }
      files.push({
        filePath: path.join(dirPath, file),
        moduleId,
        sopNumber: match[1],
      });
    }
  }

  return files.sort((a, b) => {
    if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
    // Sort by numeric parts: "1-1" before "1-100"
    const [aMaj, aMin] = a.sopNumber.split('-').map(Number);
    const [bMaj, bMin] = b.sopNumber.split('-').map(Number);
    return aMaj - bMaj || aMin - bMin;
  });
}

// ─── Validation ──────────────────────────────────────────

function validateExtracted(sop: ExtractedSop, sopNumber: string): string[] {
  const warnings: string[] = [];

  if (!sop.title || sop.title.trim().length === 0) {
    warnings.push(`[${sopNumber}] Missing title`);
  }

  if (!sop.content || sop.content.trim().length < 50) {
    warnings.push(`[${sopNumber}] Content seems too short (${sop.content?.length ?? 0} chars)`);
  }

  for (const d of sop.deliverables) {
    if (!VALID_DELIVERABLE_TYPES.includes(d.type as typeof VALID_DELIVERABLE_TYPES[number])) {
      warnings.push(`[${sopNumber}] Invalid deliverable type: ${d.type}`);
    }
  }

  for (const t of sop.tools_used) {
    if (!VALID_TOOLS.includes(t as typeof VALID_TOOLS[number])) {
      warnings.push(`[${sopNumber}] Invalid tool name: ${t}`);
    }
  }

  if (sop.quality_bars.length === 0) {
    warnings.push(`[${sopNumber}] No quality bars extracted`);
  }

  return warnings;
}
```

- [ ] **Step 2: Verify script file exists and TypeScript is valid**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsx --eval "import './scripts/sop-types'; console.log('types OK')" 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-sops.ts
git commit -m "feat(accelerator): add SOP seed script — file discovery and validation"
```

### Task 4: Claude Extraction and SQL Generation

**Files:**
- Modify: `scripts/seed-sops.ts` (add extraction loop, SQL generation, main function)

- [ ] **Step 1: Add the Claude extraction and SQL output logic to the script**

Append to `scripts/seed-sops.ts`:

```typescript
// ─── Claude Extraction ───────────────────────────────────

async function extractSop(
  client: Anthropic,
  file: SopFile
): Promise<{ sop: ExtractedSop; warnings: string[] }> {
  const rawMarkdown = fs.readFileSync(file.filePath, 'utf-8');
  const prompt = buildExtractionPrompt(file.moduleId, file.sopNumber, rawMarkdown);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`[${file.sopNumber}] Failed to parse Claude response as JSON: ${text.slice(0, 200)}`);
  }

  const sop: ExtractedSop = {
    module_id: file.moduleId,
    sop_number: file.sopNumber,
    title: String(parsed.title || ''),
    content: String(parsed.content || ''),
    quality_bars: Array.isArray(parsed.quality_bars) ? parsed.quality_bars : [],
    deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
    tools_used: Array.isArray(parsed.tools_used)
      ? parsed.tools_used.filter((t: string) =>
          VALID_TOOLS.includes(t as typeof VALID_TOOLS[number])
        )
      : [],
    dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies : [],
  };

  // Filter invalid deliverable types
  sop.deliverables = sop.deliverables.filter((d) =>
    VALID_DELIVERABLE_TYPES.includes(d.type as typeof VALID_DELIVERABLE_TYPES[number])
  );

  const warnings = validateExtracted(sop, file.sopNumber);
  return { sop, warnings };
}

// ─── SQL Generation ──────────────────────────────────────

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function generateSQL(sops: ExtractedSop[]): string {
  const lines: string[] = [
    '-- Generated by scripts/seed-sops.ts',
    `-- ${sops.length} SOPs extracted from dwy-playbook on ${new Date().toISOString().split('T')[0]}`,
    '',
    '-- Uses ON CONFLICT for idempotent re-runs',
    '',
  ];

  for (const sop of sops) {
    const qualityBarsJson = escapeSQL(JSON.stringify(sop.quality_bars));
    const deliverablesJson = escapeSQL(JSON.stringify(sop.deliverables));
    const toolsArray = sop.tools_used.map((t) => `'${escapeSQL(t)}'`).join(', ');
    const depsArray = sop.dependencies.map((d) => `'${escapeSQL(d)}'`).join(', ');

    lines.push(`INSERT INTO program_sops (module_id, sop_number, title, content, quality_bars, deliverables, tools_used, dependencies, version)
VALUES (
  '${escapeSQL(sop.module_id)}',
  '${escapeSQL(sop.sop_number)}',
  '${escapeSQL(sop.title)}',
  '${escapeSQL(sop.content)}',
  '${qualityBarsJson}'::jsonb,
  '${deliverablesJson}'::jsonb,
  ARRAY[${toolsArray}]::text[],
  ARRAY[${depsArray}]::text[],
  1
)
ON CONFLICT (module_id, sop_number) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  quality_bars = EXCLUDED.quality_bars,
  deliverables = EXCLUDED.deliverables,
  tools_used = EXCLUDED.tools_used,
  dependencies = EXCLUDED.dependencies,
  version = program_sops.version + 1,
  updated_at = now();
`);
  }

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('Discovering SOP files...');
  const files = discoverSopFiles();
  console.log(`Found ${files.length} SOP files`);

  const client = new Anthropic();
  const extracted: ExtractedSop[] = [];
  const allWarnings: string[] = [];
  let failures = 0;

  // Process sequentially to respect rate limits (Haiku is fast anyway)
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;

    try {
      console.log(`${progress} Extracting ${file.moduleId} SOP ${file.sopNumber}...`);
      const { sop, warnings } = await extractSop(client, file);
      extracted.push(sop);
      allWarnings.push(...warnings);

      if (warnings.length > 0) {
        for (const w of warnings) console.warn(`  ⚠ ${w}`);
      }
    } catch (err) {
      failures++;
      console.error(`${progress} FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Small delay to avoid rate limits
    if (i < files.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\nExtraction complete: ${extracted.length} succeeded, ${failures} failed`);

  if (allWarnings.length > 0) {
    console.log(`\nWarnings (${allWarnings.length}):`);
    for (const w of allWarnings) console.log(`  ⚠ ${w}`);
  }

  // Generate SQL
  console.log(`\nGenerating SQL migration...`);
  const sql = generateSQL(extracted);
  fs.writeFileSync(OUTPUT_PATH, sql, 'utf-8');
  console.log(`Written to: ${OUTPUT_PATH}`);
  console.log(`SQL file size: ${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script compiles**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsx --eval "console.log('tsx available')" && echo "OK"`

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-sops.ts
git commit -m "feat(accelerator): complete SOP seed script — extraction loop and SQL generation"
```

---

## Chunk 3: Execution and Verification

### Task 5: Run the Extraction Script

**Files:**
- Execute: `scripts/seed-sops.ts`
- Output: `supabase/migrations/20260311100000_seed_program_sops.sql`

- [ ] **Step 1: Run the extraction script**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsx scripts/seed-sops.ts`
Expected: 52 SOPs extracted with some warnings (acceptable), SQL migration file generated

- [ ] **Step 2: Verify the generated SQL file**

Run: `wc -l supabase/migrations/20260311100000_seed_program_sops.sql && head -20 supabase/migrations/20260311100000_seed_program_sops.sql`
Expected: Large SQL file with INSERT statements for all 52 SOPs

- [ ] **Step 3: Spot-check 3 SOP entries in the SQL**

Read the generated SQL file and verify:
- SOP 0-1 (simple core): Has title, content, quality_bars, deliverables
- SOP 2-4 (complex core): Has multiple tools_used, dependencies on earlier SOPs
- SOP 3-106 (advanced): Has quality_bars from Common Mistakes section, tools_used

- [ ] **Step 4: Fix any extraction issues**

If warnings indicate invalid deliverable types or missing quality bars:
1. Review the prompt template — adjust extraction instructions if needed
2. Re-run the script (idempotent — safe to retry)
3. Continue only when all critical warnings are resolved

- [ ] **Step 5: Commit the generated migration and script files**

```bash
git add supabase/migrations/20260311100000_seed_program_sops.sql scripts/
git commit -m "feat(accelerator): seed 52 SOPs from dwy-playbook curriculum"
```

### Task 6: Apply Migration and Verify in Database

**Files:**
- Apply: `supabase/migrations/20260311100000_seed_program_sops.sql`

- [ ] **Step 1: Apply the migration to Supabase**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applied successfully

- [ ] **Step 2: Verify SOP count in database**

Run a SQL query via Supabase MCP or CLI:
```sql
SELECT module_id, COUNT(*) as sop_count
FROM program_sops
GROUP BY module_id
ORDER BY module_id;
```

Expected: 8 rows (m0 through m7), totaling 52 SOPs:
- m0: 5, m1: 6, m2: 8, m3: 8, m4: 7, m5: 5, m6: 8, m7: 5

- [ ] **Step 3: Verify SOP data quality for a sample entry**

```sql
SELECT sop_number, title, array_length(tools_used, 1) as tool_count,
       jsonb_array_length(quality_bars) as qb_count,
       jsonb_array_length(deliverables) as del_count,
       length(content) as content_length
FROM program_sops
WHERE module_id = 'm1'
ORDER BY sop_number;
```

Expected: All m1 SOPs have non-null titles, content > 100 chars, at least 1 quality bar and 1 deliverable

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A && git commit -m "fix(accelerator): SOP seed data corrections"
```

### Task 7: Integration Test — getSopsByModule

**Files:**
- Create: `src/__tests__/lib/services/accelerator-sops.test.ts`

- [ ] **Step 1: Write test verifying getSopsByModule returns seeded data shape**

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/utils/supabase-server');
jest.mock('@/lib/utils/logger');

import { getSopsByModule } from '@/lib/services/accelerator-program';
import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';

const mockOrder = jest.fn();
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

(getSupabaseAdminClient as jest.MockedFunction<typeof getSupabaseAdminClient>).mockReturnValue({
  from: mockFrom,
} as unknown as ReturnType<typeof getSupabaseAdminClient>);

describe('getSopsByModule', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries program_sops table with correct module_id', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await getSopsByModule('m1');

    expect(mockFrom).toHaveBeenCalledWith('program_sops');
    expect(mockEq).toHaveBeenCalledWith('module_id', 'm1');
    expect(mockOrder).toHaveBeenCalledWith('sop_number');
  });

  it('returns SOP data with expected shape', async () => {
    const mockSops = [
      {
        id: 'sop-1',
        module_id: 'm1',
        sop_number: '1-1',
        title: 'Ideate a Lead Magnet',
        content: '## Steps\n1. Open Magnet Lab...',
        quality_bars: [{ check: 'Lead magnet addresses ICP #1 problem', severity: 'critical' }],
        deliverables: [{ type: 'lead_magnet', description: 'Lead magnet concept' }],
        tools_used: ['magnetlab_ideator'],
        dependencies: ['0-1'],
        version: 1,
      },
    ];
    mockOrder.mockResolvedValue({ data: mockSops, error: null });

    const result = await getSopsByModule('m1');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Ideate a Lead Magnet');
    expect(result[0].quality_bars).toHaveLength(1);
    expect(result[0].tools_used).toContain('magnetlab_ideator');
  });

  it('returns empty array on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'fail' } });

    const result = await getSopsByModule('m1');

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="accelerator-sops" --verbose`
Expected: All 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/lib/services/accelerator-sops.test.ts
git commit -m "test(accelerator): add getSopsByModule integration test"
```

### Task 8: Final Verification — Full Test Suite

- [ ] **Step 1: Run the full test suite**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --verbose 2>&1 | tail -30`
Expected: All tests pass (pre-existing failures in PostDetailModal + email-sequence are known and acceptable)

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git add -A && git commit -m "chore(accelerator): SOP content seeding complete — 52 SOPs"
```
