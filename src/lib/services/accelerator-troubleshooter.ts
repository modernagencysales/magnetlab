/** Accelerator Troubleshooter Service.
 *  Loads diagnostic rules, matches against current metrics, and provides diagnostic context.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { DiagnosticRule } from '@/lib/types/accelerator';
import { DIAGNOSTIC_RULE_COLUMNS } from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-troubleshooter';

// ─── Rule Retrieval ──────────────────────────────────────

export async function getDiagnosticRules(moduleId: string): Promise<DiagnosticRule[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('diagnostic_rules')
    .select(DIAGNOSTIC_RULE_COLUMNS)
    .eq('module_id', moduleId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) {
    logError(LOG_CTX, error, { moduleId });
    return [];
  }
  return data || [];
}

// ─── Rule Matching ──────────────────────────────────────

interface MetricSnapshot {
  metric_key: string;
  value: number;
}

/** Match diagnostic rules against current metric values. Returns triggered rules. */
export function matchRulesToMetrics(
  rules: DiagnosticRule[],
  metrics: MetricSnapshot[]
): DiagnosticRule[] {
  const metricMap = new Map(metrics.map((m) => [m.metric_key, m.value]));
  const triggered: DiagnosticRule[] = [];

  for (const rule of rules) {
    if (!rule.metric_key || rule.threshold_operator === null || rule.threshold_value === null) {
      continue;
    }

    const currentValue = metricMap.get(rule.metric_key);
    if (currentValue === undefined) continue;

    const isTriggered = evaluateThreshold(
      currentValue,
      rule.threshold_operator,
      rule.threshold_value
    );
    if (isTriggered) {
      triggered.push(rule);
    }
  }

  return triggered;
}

function evaluateThreshold(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '<':
      return value < threshold;
    case '>':
      return value > threshold;
    case '<=':
      return value <= threshold;
    case '>=':
      return value >= threshold;
    case '=':
      return value === threshold;
    default:
      return false;
  }
}
