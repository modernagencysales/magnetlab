/** Propose style rules from aggregated edit patterns. Runs weekly. */

import { task, schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
import * as styleRulesRepo from '@/server/repositories/style-rules.repo';

interface PatternAggregate {
  pattern_name: string;
  descriptions: string[];
  frequency: number;
  source_edit_ids: string[];
  example_original: string;
  example_edited: string;
}

export const proposeStyleRules = task({
  id: 'propose-style-rules',
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // 1. Find the latest proposal time to avoid reprocessing
    // NOTE: This task uses time-windowed queries (created_at), NOT the `processed` flag.
    // The `processed` flag is used by evolve-writing-style for per-profile voice evolution.
    // Both tasks independently consume the same edits for different purposes.
    const existingRules = await styleRulesRepo.listRules();
    const latestProposal = existingRules.reduce<string | null>((max, r) => {
      if (!max || r.proposed_at > max) return r.proposed_at;
      return max;
    }, null);

    // 2. Fetch edits since last proposal (or all if first run)
    let query = supabase
      .from('cp_edit_history')
      .select('id, original_text, edited_text, auto_classified_changes, created_at')
      .not('auto_classified_changes', 'is', null)
      .order('created_at', { ascending: true });

    if (latestProposal) {
      query = query.gt('created_at', latestProposal);
    }

    const { data: edits, error } = await query;
    if (error) throw new Error(`Failed to fetch edits: ${error.message}`);
    if (!edits || edits.length === 0) {
      logger.info('No new edits since last proposal run');
      return { status: 'no_edits' as const, proposed: 0 };
    }

    logger.info('Processing edits for rule proposals', { editCount: edits.length });

    // 3. Aggregate patterns across all edits
    const patternMap = new Map<string, PatternAggregate>();
    for (const edit of edits) {
      const patterns = edit.auto_classified_changes?.patterns;
      if (!Array.isArray(patterns)) continue;

      for (const p of patterns) {
        const key = p.pattern as string;
        const existing = patternMap.get(key);
        if (existing) {
          existing.descriptions.push(p.description as string);
          existing.frequency++;
          existing.source_edit_ids.push(edit.id);
        } else {
          patternMap.set(key, {
            pattern_name: key,
            descriptions: [p.description as string],
            frequency: 1,
            source_edit_ids: [edit.id],
            example_original: edit.original_text,
            example_edited: edit.edited_text,
          });
        }
      }
    }

    // 4. Filter: frequency >= 2, not already in cp_style_rules
    const existingPatterns = new Set(await styleRulesRepo.getExistingPatternNames());
    const candidates = Array.from(patternMap.values()).filter(
      (p) => p.frequency >= 2 && !existingPatterns.has(p.pattern_name)
    );

    if (candidates.length === 0) {
      logger.info('No new patterns qualifying for proposals');
      return { status: 'no_candidates' as const, proposed: 0 };
    }

    logger.info('Drafting rules for candidates', { count: candidates.length });

    // 5. Draft rules using Claude Haiku
    const template = await getPrompt('style-rule-drafter');
    const client = getAnthropicClient('style-rule-drafter');
    const proposals: styleRulesRepo.StyleRuleInsertInput[] = [];

    for (const candidate of candidates) {
      try {
        const prompt = interpolatePrompt(template.user_prompt, {
          pattern_name: candidate.pattern_name,
          pattern_descriptions: candidate.descriptions.join('\n- '),
          example_original: candidate.example_original.substring(0, 500),
          example_edited: candidate.example_edited.substring(0, 500),
        });

        const response = await client.messages.create({
          model: template.model,
          max_tokens: template.max_tokens,
          temperature: template.temperature,
          messages: [{ role: 'user', content: prompt }],
        });

        const ruleText =
          response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
        if (ruleText.length < 10) continue; // Skip bad drafts

        proposals.push({
          pattern_name: candidate.pattern_name,
          rule_text: ruleText,
          source_edit_ids: candidate.source_edit_ids,
          frequency: candidate.frequency,
          confidence: Math.min(candidate.frequency / 10, 1.0),
        });
      } catch (err) {
        logger.error('Failed to draft rule', {
          pattern: candidate.pattern_name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 6. Insert proposals
    const inserted = await styleRulesRepo.insertRulesBatch(proposals);
    logger.info('Style rule proposals created', { count: inserted });

    return { status: 'proposed' as const, proposed: inserted };
  },
});

// Weekly schedule — Sunday 4:30 AM UTC (staggered 1hr after evolve-writing-style at 3:30 AM)
export const weeklyStyleRuleProposal = schedules.task({
  id: 'weekly-style-rule-proposal',
  cron: '30 4 * * 0', // Sunday 4:30 AM UTC
  maxDuration: 300,
  run: async () => {
    await proposeStyleRules.trigger();
  },
});
