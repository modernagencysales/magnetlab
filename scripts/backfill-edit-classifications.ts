/** One-off script to backfill edit classifications for unclassified cp_edit_history records. */
/* Usage: npx tsx scripts/backfill-edit-classifications.ts */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicKey = process.env.ANTHROPIC_API_KEY!;

if (!supabaseUrl || !supabaseKey || !anthropicKey) {
  console.error(
    'Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

async function classifyEdit(
  original: string,
  edited: string,
  contentType: string,
  fieldName: string
) {
  const prompt = `You are analyzing edits a human made to AI-generated content to identify deliberate style patterns.

Content type: ${contentType}
Field: ${fieldName}

ORIGINAL (AI-generated):
${original}

EDITED (human version):
${edited}

Analyze what the human deliberately changed. Ignore trivial fixes (typos, whitespace). Focus on intentional style, tone, structure, and content decisions.

Return a JSON object with this exact structure:
{
  "patterns": [
    {
      "pattern": "snake_case_name",
      "description": "One sentence explaining what changed and why."
    }
  ]
}

If there are no meaningful patterns (just deletions with no clear intent, or trivial changes), return: { "patterns": [] }`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { patterns: [] };
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const { data: edits, error } = await supabase
    .from('cp_edit_history')
    .select('id, content_type, field_name, original_text, edited_text')
    .is('auto_classified_changes', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch edits:', error);
    process.exit(1);
  }

  console.log(`Found ${edits.length} unclassified edits\n`);

  let classified = 0;
  let withPatterns = 0;
  let errors = 0;

  for (const edit of edits) {
    try {
      const result = await classifyEdit(
        edit.original_text,
        edit.edited_text,
        edit.content_type,
        edit.field_name
      );

      const { error: updateError } = await supabase
        .from('cp_edit_history')
        .update({ auto_classified_changes: result })
        .eq('id', edit.id);

      if (updateError) {
        console.error(
          `  ✗ ${edit.id} (${edit.field_name}): update failed — ${updateError.message}`
        );
        errors++;
      } else {
        const patternCount = result.patterns?.length ?? 0;
        console.log(`  ✓ ${edit.id} (${edit.field_name}): ${patternCount} patterns`);
        classified++;
        if (patternCount > 0) withPatterns++;
      }

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(
        `  ✗ ${edit.id} (${edit.field_name}): ${err instanceof Error ? err.message : err}`
      );
      errors++;
    }
  }

  console.log(`\nDone: ${classified} classified (${withPatterns} with patterns), ${errors} errors`);
}

main();
