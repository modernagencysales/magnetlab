/** SOP Seed Script (AI-Powered).
 *  Reads 52 SOP markdown files from dwy-playbook repo,
 *  sends each to Claude Haiku for structured extraction,
 *  outputs a Supabase SQL migration file.
 *
 *  Usage: npx tsx scripts/seed-sops.ts
 *  Requires: ANTHROPIC_API_KEY in environment */

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildExtractionPrompt } from './sop-extraction-prompt';
import {
  DIR_TO_MODULE,
  VALID_DELIVERABLE_TYPES,
  VALID_TOOLS,
  type ExtractedSop,
} from './sop-types';

// ─── Configuration ───────────────────────────────────────

const DWY_PLAYBOOK_SOPS = path.resolve(__dirname, '../../dwy-playbook/docs/sops');
const OUTPUT_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/20260311500000_seed_program_sops.sql'
);
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_RETRIES = 2;

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
      // Extract SOP number from filename: sop-2-4-email-enrichment.md -> "2-4"
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

  // Detect duplicate sop_number within same module
  const seen = new Map<string, string>();
  for (const file of files) {
    const key = `${file.moduleId}:${file.sopNumber}`;
    if (seen.has(key)) {
      console.error(
        `DUPLICATE SOP number detected: ${key}\n` +
          `  File 1: ${seen.get(key)}\n` +
          `  File 2: ${file.filePath}\n` +
          `Resolve by renaming one file. Aborting.`
      );
      process.exit(1);
    }
    seen.set(key, file.filePath);
  }

  return files.sort((a, b) => {
    if (a.moduleId !== b.moduleId) return a.moduleId.localeCompare(b.moduleId);
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

  // Check frontmatter wasn't included in content
  if (sop.content.trimStart().startsWith('---')) {
    warnings.push(`[${sopNumber}] Content still contains YAML frontmatter`);
  }

  for (const d of sop.deliverables) {
    if (!VALID_DELIVERABLE_TYPES.includes(d.type as (typeof VALID_DELIVERABLE_TYPES)[number])) {
      warnings.push(`[${sopNumber}] Invalid deliverable type: ${d.type}`);
    }
  }

  for (const t of sop.tools_used) {
    if (!VALID_TOOLS.includes(t as (typeof VALID_TOOLS)[number])) {
      warnings.push(`[${sopNumber}] Invalid tool name: ${t}`);
    }
  }

  if (sop.quality_bars.length === 0) {
    warnings.push(`[${sopNumber}] No quality bars extracted`);
  }

  return warnings;
}

// ─── Claude Extraction ───────────────────────────────────

async function extractSop(
  client: Anthropic,
  file: SopFile
): Promise<{ sop: ExtractedSop; warnings: string[] }> {
  const rawMarkdown = fs.readFileSync(file.filePath, 'utf-8');
  const userPrompt = buildExtractionPrompt(file.moduleId, file.sopNumber, rawMarkdown);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  let parsed: Record<string, unknown>;
  try {
    // Handle potential markdown fences around JSON
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `[${file.sopNumber}] Failed to parse Claude response as JSON: ${text.slice(0, 300)}`
    );
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
          VALID_TOOLS.includes(t as (typeof VALID_TOOLS)[number])
        )
      : [],
    dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies : [],
  };

  // Filter invalid deliverable types
  sop.deliverables = sop.deliverables.filter((d) =>
    VALID_DELIVERABLE_TYPES.includes(d.type as (typeof VALID_DELIVERABLE_TYPES)[number])
  );

  // Strip frontmatter from content if Claude left it in
  sop.content = sop.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

  const warnings = validateExtracted(sop, file.sopNumber);
  return { sop, warnings };
}

async function extractWithRetry(
  client: Anthropic,
  file: SopFile
): Promise<{ sop: ExtractedSop; warnings: string[] }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`  Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return await extractSop(client, file);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) continue;
    }
  }
  throw lastError;
}

// ─── SQL Generation ──────────────────────────────────────

/** Use dollar-quoting to safely embed markdown content in SQL */
function dollarQuote(str: string, tag: string = 'body'): string {
  // Ensure the tag doesn't appear in the content
  let finalTag = tag;
  let counter = 0;
  while (str.includes(`$${finalTag}$`)) {
    counter++;
    finalTag = `${tag}${counter}`;
  }
  return `$${finalTag}$${str}$${finalTag}$`;
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

export function generateSQL(sops: ExtractedSop[]): string {
  const lines: string[] = [
    '-- Generated by scripts/seed-sops.ts',
    `-- ${sops.length} SOPs extracted from dwy-playbook on ${new Date().toISOString().split('T')[0]}`,
    '',
    '-- Clears any old-format data (dot-separated sop_numbers from previous scripts)',
    "DELETE FROM program_sops WHERE sop_number LIKE '%.%';",
    '',
    '-- Uses ON CONFLICT for idempotent re-runs',
    '',
  ];

  for (const sop of sops) {
    const qualityBarsJson = escapeSQL(JSON.stringify(sop.quality_bars));
    const deliverablesJson = escapeSQL(JSON.stringify(sop.deliverables));
    const toolsArray =
      sop.tools_used.length > 0 ? sop.tools_used.map((t) => `'${escapeSQL(t)}'`).join(', ') : '';
    const depsArray =
      sop.dependencies.length > 0
        ? sop.dependencies.map((d) => `'${escapeSQL(d)}'`).join(', ')
        : '';

    // Use dollar-quoting for content field (may contain single quotes, backslashes, etc.)
    const contentSQL = dollarQuote(sop.content);

    lines.push(`INSERT INTO program_sops (module_id, sop_number, title, content, quality_bars, deliverables, tools_used, dependencies, version)
VALUES (
  '${escapeSQL(sop.module_id)}',
  '${escapeSQL(sop.sop_number)}',
  '${escapeSQL(sop.title)}',
  ${contentSQL},
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
  version = program_sops.version + 1;
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
  console.log(`Found ${files.length} SOP files\n`);

  const client = new Anthropic();
  const extracted: ExtractedSop[] = [];
  const allWarnings: string[] = [];
  let failures = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;

    try {
      console.log(`${progress} Extracting ${file.moduleId} SOP ${file.sopNumber}...`);
      const { sop, warnings } = await extractWithRetry(client, file);
      extracted.push(sop);
      allWarnings.push(...warnings);

      if (warnings.length > 0) {
        for (const w of warnings) console.warn(`  WARNING: ${w}`);
      }
    } catch (err) {
      failures++;
      console.error(`${progress} FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Small delay between requests
    if (i < files.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  console.log(`\nExtraction complete: ${extracted.length} succeeded, ${failures} failed`);

  if (allWarnings.length > 0) {
    console.log(`\nWarnings (${allWarnings.length}):`);
    for (const w of allWarnings) console.log(`  ${w}`);
  }

  if (failures > 0) {
    console.warn(`\n${failures} SOPs failed extraction. Re-run the script to retry (idempotent).`);
  }

  console.log('\nGenerating SQL migration...');
  const sql = generateSQL(extracted);
  fs.writeFileSync(OUTPUT_PATH, sql, 'utf-8');
  console.log(`Written to: ${OUTPUT_PATH}`);
  console.log(`SQL file size: ${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB`);
}

// Only run when executed directly (not imported by tests)
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
