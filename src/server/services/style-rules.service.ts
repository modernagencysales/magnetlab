/**
 * Style Rules Service.
 * Business logic for proposing, reviewing, and compiling style rules.
 * Never imports from Next.js HTTP layer.
 */

import * as repo from '@/server/repositories/style-rules.repo';
import { savePrompt } from '@/lib/services/prompt-registry';
import { compileRuleText } from '@/lib/services/style-rules';
import { logInfo } from '@/lib/utils/logger';
import type { StyleRuleCreateInput, StyleRulePatchInput } from '@/lib/validations/style-rules';

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function listRules(filters?: { status?: string; scope?: string }) {
  return repo.listRules(filters);
}

export async function getRuleById(id: string) {
  return repo.getRuleById(id);
}

// ─── Writes ────────────────────────────────────────────────────────────────

export async function createRule(input: StyleRuleCreateInput) {
  const rule = await repo.insertRule({
    pattern_name: input.pattern_name,
    rule_text: input.rule_text,
    scope: input.scope,
    team_id: input.team_id ?? null,
  });
  return rule;
}

export async function updateRule(id: string, input: StyleRulePatchInput, reviewerId: string) {
  const rule = await repo.getRuleById(id);
  if (!rule) {
    throw Object.assign(new Error('Rule not found'), { statusCode: 404 });
  }

  const updates: Parameters<typeof repo.updateRule>[1] = {};

  if (input.rule_text !== undefined) {
    updates.rule_text = input.rule_text;
  }

  if (input.status !== undefined) {
    updates.status = input.status;
    updates.reviewed_at = new Date().toISOString();
    updates.reviewed_by = reviewerId;
  }

  await repo.updateRule(id, updates);

  // Recompile if status changed or rule_text changed on an approved rule
  if (input.status !== undefined || (input.rule_text !== undefined && rule.status === 'approved')) {
    await compileGlobalRules(reviewerId);
  }

  return { ...rule, ...updates };
}

// ─── Compile ───────────────────────────────────────────────────────────────

export async function compileGlobalRules(changedBy: string): Promise<{ ruleCount: number }> {
  const approvedRules = await repo.getApprovedGlobalRules();
  const compiledText = compileRuleText(approvedRules);

  await savePrompt(
    'global-style-rules',
    { user_prompt: compiledText },
    changedBy,
    `Compiled ${approvedRules.length} approved global style rules`
  );

  logInfo('style-rules', 'Global rules compiled', {
    ruleCount: approvedRules.length,
    textLength: compiledText.length,
  });

  return { ruleCount: approvedRules.length };
}
