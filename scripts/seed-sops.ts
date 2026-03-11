/** SOP Seed Script.
 *  Reads SOP markdown files from dwy-playbook and upserts into program_sops.
 *  Run: npx tsx scripts/seed-sops.ts */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Use env vars or hardcode for local dev
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local or environment.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DWY_PLAYBOOK_PATH = '/Users/timlife/Documents/claude code/dwy-playbook/docs/sops';

// Phase 1 modules
const MODULE_DIRS: Record<string, string> = {
  m0: 'module-0-positioning',
  m1: 'module-1-lead-magnets',
  m7: 'module-7-daily-content',
};

interface ParsedSop {
  module_id: string;
  sop_number: string;
  title: string;
  content: string;
  quality_bars: unknown[];
  deliverables: unknown[];
  tools_used: string[];
  dependencies: string[];
}

function parseSopFile(filePath: string, moduleId: string): ParsedSop | null {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Parse frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.warn(`  Skipping ${filePath}: no frontmatter`);
    return null;
  }

  const fm = fmMatch[1];
  const idMatch = fm.match(/id:\s*(.+)/);
  const titleMatch = fm.match(/title:\s*"?([^"]+)"?/);

  if (!idMatch || !titleMatch) {
    console.warn(`  Skipping ${filePath}: missing id or title in frontmatter`);
    return null;
  }

  const sopId = idMatch[1].trim();
  const title = titleMatch[1].trim();

  // Extract SOP number from id (e.g., "sop-0-1-define-icp" → "0.1")
  const numMatch = sopId.match(/sop-(\d+)-(\d+)/);
  const sopNumber = numMatch ? `${numMatch[1]}.${numMatch[2]}` : sopId;

  // Content is everything after frontmatter
  const content = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

  // Extract tools mentioned
  const toolsUsed: string[] = [];
  if (content.toLowerCase().includes('magnet lab') || content.toLowerCase().includes('magnetlab')) {
    toolsUsed.push('magnetlab');
  }
  if (content.toLowerCase().includes('lead shock') || content.toLowerCase().includes('leadshark')) {
    toolsUsed.push('linkedin_automation');
  }
  if (content.toLowerCase().includes('transcript') || content.toLowerCase().includes('fathom')) {
    toolsUsed.push('transcript_ingestion');
  }

  return {
    module_id: moduleId,
    sop_number: sopNumber,
    title,
    content,
    quality_bars: [], // Will be populated later with specific checks
    deliverables: [], // Will be populated later
    tools_used: toolsUsed,
    dependencies: [],
  };
}

async function seedSops() {
  console.log('Starting SOP seed...\n');
  let total = 0;
  let inserted = 0;
  let updated = 0;

  for (const [moduleId, dirName] of Object.entries(MODULE_DIRS)) {
    const dirPath = path.join(DWY_PLAYBOOK_PATH, dirName);
    if (!fs.existsSync(dirPath)) {
      console.warn(`Directory not found: ${dirPath}`);
      continue;
    }

    console.log(`Processing ${moduleId} (${dirName})...`);

    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith('.md'))
      .sort();

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const parsed = parseSopFile(filePath, moduleId);
      if (!parsed) continue;

      total++;

      // Check if exists
      const { data: existing } = await supabase
        .from('program_sops')
        .select('id, version')
        .eq('module_id', parsed.module_id)
        .eq('sop_number', parsed.sop_number)
        .single();

      if (existing) {
        // Update with incremented version
        const { error } = await supabase
          .from('program_sops')
          .update({
            title: parsed.title,
            content: parsed.content,
            quality_bars: parsed.quality_bars,
            deliverables: parsed.deliverables,
            tools_used: parsed.tools_used,
            dependencies: parsed.dependencies,
            version: existing.version + 1,
          })
          .eq('id', existing.id);

        if (error) {
          console.error(`  ERROR updating ${parsed.sop_number}: ${error.message}`);
        } else {
          console.log(
            `  Updated: ${parsed.sop_number} — ${parsed.title} (v${existing.version + 1})`
          );
          updated++;
        }
      } else {
        // Insert new
        const { error } = await supabase.from('program_sops').insert({
          module_id: parsed.module_id,
          sop_number: parsed.sop_number,
          title: parsed.title,
          content: parsed.content,
          quality_bars: parsed.quality_bars,
          deliverables: parsed.deliverables,
          tools_used: parsed.tools_used,
          dependencies: parsed.dependencies,
        });

        if (error) {
          console.error(`  ERROR inserting ${parsed.sop_number}: ${error.message}`);
        } else {
          console.log(`  Inserted: ${parsed.sop_number} — ${parsed.title}`);
          inserted++;
        }
      }
    }
  }

  console.log(`\nDone! ${total} SOPs processed: ${inserted} inserted, ${updated} updated.`);
}

seedSops().catch(console.error);
