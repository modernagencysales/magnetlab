import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { CLAUDE_SONNET_MODEL } from '@/lib/ai/content-pipeline/model-config';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError, logInfo } from '@/lib/utils/logger';

// ── Types ──────────────────────────────────────────────────────────────

export interface CSVTemplate {
  name: string;
  structure: string;
  funnelStage: string;
  originalPost?: string;
}

interface AIEnrichment {
  category: string;
  description: string;
  use_cases: string[];
  tags: string[];
}

interface SeedResult {
  imported: number;
  skipped: number;
  errors: number;
}

// ── CSV Parser ─────────────────────────────────────────────────────────

/**
 * Parse CSV content that may contain multiline quoted fields.
 * Handles BOM character, escaped quotes (""), and newlines within quotes.
 */
export function parseCSVTemplates(csvContent: string): CSVTemplate[] {
  // Strip BOM (U+FEFF) if present
  let content = csvContent;
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const rows = parseCSVRows(content);
  if (rows.length < 2) return []; // Need header + at least one data row

  const header = rows[0];

  // Find column indices by header name
  const colIndex = {
    title: header.findIndex((h) => h.trim() === 'TItle'),
    template: header.findIndex((h) => h.trim() === 'Template'),
    funnelStage: header.findIndex((h) => h.trim() === 'Funnel Stage'),
    originalPost: header.findIndex((h) => h.trim() === 'Original Post'),
  };

  // Fallback: try case-insensitive match if exact match fails
  if (colIndex.title === -1) {
    colIndex.title = header.findIndex((h) => h.trim().toLowerCase() === 'title');
  }

  if (colIndex.title === -1 || colIndex.template === -1) {
    logError('seed-templates', new Error('CSV missing required columns: TItle, Template'), {
      headers: header,
    });
    return [];
  }

  const templates: CSVTemplate[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const name = row[colIndex.title]?.trim() || '';
    const structure = row[colIndex.template]?.trim() || '';

    // Skip rows with empty title or structure
    if (!name || !structure) continue;

    const funnelStage =
      colIndex.funnelStage !== -1 ? (row[colIndex.funnelStage]?.trim() || '') : '';
    const originalPost =
      colIndex.originalPost !== -1 ? (row[colIndex.originalPost]?.trim() || undefined) : undefined;

    templates.push({ name, structure, funnelStage, originalPost });
  }

  return templates;
}

/**
 * Low-level CSV row parser that handles:
 * - Quoted fields with embedded newlines
 * - Escaped quotes ("" inside quoted fields)
 * - Mixed quoted and unquoted fields
 */
function parseCSVRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      currentField += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\n' || (char === '\r' && content[i + 1] === '\n')) {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((field) => field.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        i += char === '\r' ? 2 : 1;
      } else if (char === '\r') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((field) => field.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Flush last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((field) => field.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// ── AI Enrichment ──────────────────────────────────────────────────────

async function enrichTemplate(template: CSVTemplate): Promise<AIEnrichment> {
  const anthropic = getAnthropicClient('seed-templates');

  const prompt = `Analyze this LinkedIn post template and return a JSON object with enrichment data.

Template name: ${template.name}
Funnel stage: ${template.funnelStage || 'unknown'}
Template structure:
${template.structure}

Return ONLY a JSON object (no markdown, no explanation) with these fields:
{
  "category": "One of: story, framework, listicle, contrarian, case_study, question, educational, motivational",
  "description": "1-2 sentence description of what this template does and when to use it",
  "use_cases": ["3-5 specific scenarios where this template works well"],
  "tags": ["5-8 tags including the funnel stage if provided"]
}`;

  const response = await anthropic.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseJsonResponse<AIEnrichment>(text);
}

// ── Seed Import ────────────────────────────────────────────────────────

/**
 * Import parsed CSV templates into cp_post_templates with AI enrichment.
 * Deduplicates by name (case-insensitive) against existing global templates.
 * Processes in batches of 5 for rate limiting.
 */
export async function seedTemplatesFromCSV(
  templates: CSVTemplate[],
  userId: string
): Promise<SeedResult> {
  const supabase = createSupabaseAdminClient();
  const result: SeedResult = { imported: 0, skipped: 0, errors: 0 };

  // Fetch existing global template names for dedup
  const { data: existingTemplates } = await supabase
    .from('cp_post_templates')
    .select('name')
    .eq('is_global', true);

  const existingNames = new Set(
    (existingTemplates || []).map((t: { name: string }) => t.name.toLowerCase())
  );

  // Filter out duplicates
  const newTemplates: CSVTemplate[] = [];
  for (const template of templates) {
    if (existingNames.has(template.name.toLowerCase())) {
      result.skipped++;
    } else {
      newTemplates.push(template);
    }
  }

  logInfo('seed-templates', `Starting import: ${newTemplates.length} new, ${result.skipped} skipped (duplicates)`, {
    total: templates.length,
  });

  // Process in batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < newTemplates.length; i += BATCH_SIZE) {
    const batch = newTemplates.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (template) => {
        try {
          // Step 1: AI enrichment
          const enrichment = await enrichTemplate(template);

          // Step 2: Generate embedding
          const embeddingText = createTemplateEmbeddingText({
            name: template.name,
            category: enrichment.category,
            description: enrichment.description,
            structure: template.structure,
            use_cases: enrichment.use_cases,
            tags: enrichment.tags,
          });
          const embedding = await generateEmbedding(embeddingText);

          // Step 3: Build insert row
          const row: Record<string, unknown> = {
            user_id: userId,
            name: template.name,
            category: enrichment.category,
            description: enrichment.description,
            structure: template.structure,
            use_cases: enrichment.use_cases,
            tags: enrichment.tags,
            source: 'scraped',
            is_global: true,
            embedding: JSON.stringify(embedding),
          };

          // Include original post as example if available
          if (template.originalPost) {
            row.example_posts = [template.originalPost];
          }

          return { success: true as const, row };
        } catch (error) {
          logError('seed-templates', error, {
            step: 'enrich_template',
            templateName: template.name,
          });
          return { success: false as const, error };
        }
      })
    );

    // Insert successful rows
    const rowsToInsert = batchResults
      .filter((r): r is { success: true; row: Record<string, unknown> } => r.success)
      .map((r) => r.row);

    const errorCount = batchResults.filter((r) => !r.success).length;
    result.errors += errorCount;

    if (rowsToInsert.length > 0) {
      const { data, error } = await supabase
        .from('cp_post_templates')
        .insert(rowsToInsert)
        .select('id');

      if (error) {
        logError('seed-templates', error, { step: 'batch_insert', batchIndex: i });
        result.errors += rowsToInsert.length;
      } else {
        result.imported += data?.length || 0;
      }
    }

    logInfo('seed-templates', `Batch ${Math.floor(i / BATCH_SIZE) + 1} complete`, {
      batchImported: rowsToInsert.length,
      batchErrors: errorCount,
    });
  }

  logInfo('seed-templates', 'Import complete', { ...result });
  return result;
}
