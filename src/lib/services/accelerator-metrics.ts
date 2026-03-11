/** Accelerator Metrics Service.
 *  Records, queries, and summarizes program performance metrics.
 *  Metrics are collected from providers (PlusVibe, HeyReach) and MagnetLab internal data.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { MetricKey, MetricStatus, ProgramMetric } from '@/lib/types/accelerator';
import { METRIC_COLUMNS } from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-metrics';

// ─── Benchmarks ──────────────────────────────────────────

/** Default benchmarks by metric key. SOP-derived targets. */
export const METRIC_BENCHMARKS: Record<MetricKey, { low: number; high: number }> = {
  email_sent: { low: 20, high: 50 },
  email_open_rate: { low: 40, high: 65 },
  email_reply_rate: { low: 3, high: 10 },
  email_bounce_rate: { low: 0, high: 5 },
  dm_sent: { low: 15, high: 30 },
  dm_acceptance_rate: { low: 30, high: 60 },
  dm_reply_rate: { low: 10, high: 25 },
  tam_size: { low: 500, high: 5000 },
  tam_email_coverage: { low: 40, high: 75 },
  content_posts_published: { low: 3, high: 7 },
  content_avg_impressions: { low: 500, high: 3000 },
  content_avg_engagement: { low: 2, high: 8 },
  funnel_opt_in_rate: { low: 15, high: 40 },
  funnel_page_views: { low: 50, high: 500 },
  ads_spend: { low: 1500, high: 5000 },
  ads_cpl: { low: 20, high: 150 }, // Lower is better — low=good, high=bad
  ads_ctr: { low: 0.3, high: 1.0 },
  ads_roas: { low: 1, high: 5 },
  os_weekly_reviews: { low: 3, high: 4 },
  os_daily_sessions: { low: 15, high: 25 }, // Daily GTM sessions per month (~22 work days)
};

// ─── Status Computation ──────────────────────────────────

export function computeMetricStatus(
  value: number,
  benchmarkLow: number | null,
  benchmarkHigh: number | null
): MetricStatus {
  if (benchmarkLow !== null && value < benchmarkLow) return 'below';
  if (benchmarkHigh !== null && value > benchmarkHigh) return 'above';
  return 'at';
}

// ─── Write ──────────────────────────────────────────────

export interface MetricInput {
  module_id: string;
  metric_key: MetricKey;
  value: number;
  source: string;
  benchmark_low?: number;
  benchmark_high?: number;
}

export async function recordMetrics(
  enrollmentId: string,
  metrics: MetricInput[]
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const rows = metrics.map((m) => {
    const benchLow = m.benchmark_low ?? METRIC_BENCHMARKS[m.metric_key]?.low ?? null;
    const benchHigh = m.benchmark_high ?? METRIC_BENCHMARKS[m.metric_key]?.high ?? null;
    return {
      enrollment_id: enrollmentId,
      module_id: m.module_id,
      metric_key: m.metric_key,
      value: m.value,
      benchmark_low: benchLow,
      benchmark_high: benchHigh,
      status: computeMetricStatus(m.value, benchLow, benchHigh),
      source: m.source,
    };
  });

  const { error } = await supabase.from('program_metrics').insert(rows);
  if (error) {
    logError(LOG_CTX, error, { enrollmentId, count: metrics.length });
    return false;
  }
  return true;
}

// ─── Read ───────────────────────────────────────────────

export async function getLatestMetrics(enrollmentId: string): Promise<ProgramMetric[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('program_metrics')
    .select(METRIC_COLUMNS)
    .eq('enrollment_id', enrollmentId)
    .order('collected_at', { ascending: false })
    .limit(50);

  if (error) {
    logError(LOG_CTX, error, { enrollmentId });
    return [];
  }

  // Deduplicate: keep only the latest per metric_key
  const seen = new Set<string>();
  const latest: ProgramMetric[] = [];
  for (const row of data || []) {
    if (!seen.has(row.metric_key)) {
      seen.add(row.metric_key);
      latest.push(row);
    }
  }
  return latest;
}

export async function getMetricHistory(
  enrollmentId: string,
  metricKey: MetricKey,
  days: number = 30
): Promise<Array<{ value: number; collected_at: string }>> {
  const supabase = getSupabaseAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('program_metrics')
    .select('value, collected_at')
    .eq('enrollment_id', enrollmentId)
    .eq('metric_key', metricKey)
    .gte('collected_at', since.toISOString())
    .order('collected_at', { ascending: true });

  if (error) {
    logError(LOG_CTX, error, { enrollmentId, metricKey });
    return [];
  }
  return data || [];
}

// ─── Summary ────────────────────────────────────────────

export interface MetricsSummary {
  modules: Array<{
    module_id: string;
    metrics: ProgramMetric[];
    belowCount: number;
  }>;
  belowCount: number;
  totalMetrics: number;
}

export async function getMetricsSummary(enrollmentId: string): Promise<MetricsSummary> {
  const latest = await getLatestMetrics(enrollmentId);

  const byModule = new Map<string, ProgramMetric[]>();
  for (const m of latest) {
    const arr = byModule.get(m.module_id) || [];
    arr.push(m);
    byModule.set(m.module_id, arr);
  }

  const modules = Array.from(byModule.entries()).map(([module_id, metrics]) => ({
    module_id,
    metrics,
    belowCount: metrics.filter((m) => m.status === 'below').length,
  }));

  return {
    modules,
    belowCount: latest.filter((m) => m.status === 'below').length,
    totalMetrics: latest.length,
  };
}
