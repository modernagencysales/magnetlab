/** Accelerator Coaching Rules Service.
 *  Manages system-wide learned rules that improve AI coaching quality.
 *  Rules are injected into the accelerator system prompt for all users.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { ModuleId } from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-coaching-rules';

// ─── Types ───────────────────────────────────────────────

export type RuleCategory =
  | 'coaching_mode'
  | 'module_specific'
  | 'conversation'
  | 'deliverable'
  | 'general';
export type RuleSeverity = 'critical' | 'important' | 'suggestion';
export type RuleSource = 'eval' | 'feedback' | 'manual';

export interface CoachingRule {
  id: string;
  rule: string;
  category: RuleCategory;
  module_id: string | null;
  severity: RuleSeverity;
  source: RuleSource;
  confidence: number;
  active: boolean;
  eval_scenario_id: string | null;
  evidence: string | null;
  created_at: string;
}

const RULE_COLUMNS =
  'id, rule, category, module_id, severity, source, confidence, active, eval_scenario_id, evidence, created_at';

// ─── Read ────────────────────────────────────────────────

/** Get all active coaching rules, optionally filtered by module. */
export async function getActiveRules(moduleId?: ModuleId | null): Promise<CoachingRule[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('program_coaching_rules')
    .select(RULE_COLUMNS)
    .eq('active', true)
    .order('severity')
    .order('created_at', { ascending: false });

  // Get rules that apply globally OR to the specific module
  if (moduleId) {
    query = query.or(`module_id.is.null,module_id.eq.${moduleId}`);
  } else {
    query = query.is('module_id', null);
  }

  const { data, error } = await query;

  if (error) {
    logError(LOG_CTX, error, { moduleId });
    return [];
  }
  return data || [];
}

/** Format active rules for injection into the system prompt. */
export async function formatRulesForPrompt(moduleId?: ModuleId | null): Promise<string> {
  const rules = await getActiveRules(moduleId);
  if (rules.length === 0) return '';

  const critical = rules.filter((r) => r.severity === 'critical');
  const important = rules.filter((r) => r.severity === 'important');
  const suggestions = rules.filter((r) => r.severity === 'suggestion');

  const sections: string[] = [
    '## Learned Coaching Rules\nThese rules were learned from feedback and quality evaluations. Follow them strictly.',
  ];

  if (critical.length > 0) {
    sections.push('**CRITICAL (must follow):**');
    critical.forEach((r) => sections.push(`- ${r.rule}`));
  }

  if (important.length > 0) {
    sections.push('**Important:**');
    important.forEach((r) => sections.push(`- ${r.rule}`));
  }

  if (suggestions.length > 0) {
    sections.push('**Suggestions:**');
    suggestions.forEach((r) => sections.push(`- ${r.rule}`));
  }

  return sections.join('\n');
}

// ─── Write ───────────────────────────────────────────────

export interface CreateRuleInput {
  rule: string;
  category: RuleCategory;
  moduleId?: string | null;
  severity?: RuleSeverity;
  source: RuleSource;
  confidence?: number;
  evalScenarioId?: string | null;
  evidence?: string | null;
}

/** Create a new coaching rule. */
export async function createRule(input: CreateRuleInput): Promise<CoachingRule | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_coaching_rules')
    .insert({
      rule: input.rule,
      category: input.category,
      module_id: input.moduleId || null,
      severity: input.severity || 'important',
      source: input.source,
      confidence: input.confidence ?? 1.0,
      eval_scenario_id: input.evalScenarioId || null,
      evidence: input.evidence || null,
    })
    .select(RULE_COLUMNS)
    .single();

  if (error) {
    logError(LOG_CTX, error, { input });
    return null;
  }
  return data;
}

// ─── Eval Results Persistence ────────────────────────────

export async function saveEvalRun(run: {
  model: string;
  scenarioCount: number;
  avgWeightedScore: number;
  avgRawScore: number;
  passCount: number;
  failCount: number;
  results: unknown;
}): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_eval_runs')
    .insert({
      model: run.model,
      scenario_count: run.scenarioCount,
      avg_weighted_score: run.avgWeightedScore,
      avg_raw_score: run.avgRawScore,
      pass_count: run.passCount,
      fail_count: run.failCount,
      results: run.results,
    })
    .select('id')
    .single();

  if (error) {
    logError(LOG_CTX, error, { step: 'save_eval_run' });
    return null;
  }
  return data?.id || null;
}
