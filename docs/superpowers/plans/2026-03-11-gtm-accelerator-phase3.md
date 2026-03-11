# GTM Accelerator Phase 3 — Metrics, Troubleshooting, Automation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add metrics collection, a troubleshooter agent, scheduled automation engine, and weekly digest — so the accelerator tracks progress, diagnoses issues, and runs recurring tasks without user prompting.

**Architecture:** Three new DB tables (program_metrics, program_schedules, diagnostic_rules) store metrics snapshots, cron-like schedules, and diagnostic rule definitions. A single Trigger.dev scheduled task polls program_schedules every 15 minutes and dispatches work (metrics collection, digest generation). A new troubleshooter sub-agent uses diagnostic_rules to diagnose performance issues. New actions let agents read metrics, manage schedules, and approve review queue items.

**Tech Stack:** Next.js 15, Supabase PostgreSQL, Trigger.dev v4 (schedules.task), Claude API (Haiku for diagnostics), Resend (digest emails), Jest

**Builds on:** Phase 1 (core state, sub-agents M0/M1/M7) + Phase 2 (providers, sub-agents M2/M3/M4)

---

## Deferred to Phase 4

These items are intentionally NOT in Phase 3:
- **Stripe metering / billing enforcement** — usage is tracked but not gated
- **Admin dashboard UI** — all interaction through copilot chat
- **Community features** — shared playbooks, peer benchmarking
- **M5 (LinkedIn Ads) and M6 (Operating System) agent prompts** — only type + seed script support added here; full agent prompts are Phase 4
- **Support ticket escalation system** — troubleshooter recommends fixes; human escalation deferred
- **Metrics archival / retention policy** — 12-month live is sufficient for now

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260311200000_phase3_tables.sql` | program_metrics, program_schedules, diagnostic_rules tables |
| `src/lib/services/accelerator-metrics.ts` | Metrics collection + querying service |
| `src/lib/services/accelerator-scheduler.ts` | Schedule CRUD + next-run computation |
| `src/lib/services/accelerator-troubleshooter.ts` | Diagnostic rule matching + analysis |
| `src/lib/actions/metrics.ts` | Agent actions: get_metrics, get_metrics_summary, collect_metrics |
| `src/lib/actions/schedules.ts` | Agent actions: list_schedules, create_schedule, toggle_schedule |
| `src/lib/ai/copilot/sub-agents/troubleshooter-agent.ts` | Troubleshooter sub-agent prompt builder |
| `src/trigger/accelerator-scheduler.ts` | Trigger.dev cron: polls schedules, dispatches tasks |
| `src/trigger/accelerator-collect-metrics.ts` | Trigger.dev task: collects metrics from providers |
| `src/trigger/accelerator-digest.ts` | Trigger.dev task: generates weekly metrics digest email |
| `scripts/seed-diagnostic-rules.ts` | Seeds diagnostic_rules table with initial rules |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/types/accelerator.ts` | Add Phase 3 types (MetricKey, ScheduleTaskType, DiagnosticRule, etc.), M5/M6 modules |
| `src/lib/ai/copilot/sub-agents/config.ts` | Wire troubleshooter agent, add metrics actions to tool list |
| `src/lib/actions/index.ts` | Import metrics + schedules actions |
| `src/lib/actions/program.ts` | Add `approve_review_item` and `reject_review_item` actions |
| `scripts/seed-sops.ts` | Add M5, M6 module directories |

### Test Files

| Test File | Covers |
|-----------|--------|
| `src/__tests__/lib/services/accelerator-metrics.test.ts` | Metrics service |
| `src/__tests__/lib/services/accelerator-scheduler.test.ts` | Scheduler service |
| `src/__tests__/lib/services/accelerator-troubleshooter.test.ts` | Troubleshooter service |
| `src/__tests__/lib/actions/metrics.test.ts` | Metrics actions |
| `src/__tests__/lib/actions/schedules.test.ts` | Schedule actions |
| `src/__tests__/lib/actions/program-review.test.ts` | Review queue actions |
| `src/__tests__/lib/ai/copilot/sub-agents/troubleshooter-agent.test.ts` | Troubleshooter prompt |

---

## Chunk 1: Database + Types + Core Services

### Task 1: Database Migration — Phase 3 Tables

**Files:**
- Create: `supabase/migrations/20260311200000_phase3_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Phase 3: Metrics, Schedules, Diagnostic Rules

-- ─── program_metrics ────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC NOT NULL,
  benchmark_low NUMERIC,
  benchmark_high NUMERIC,
  status TEXT NOT NULL DEFAULT 'at' CHECK (status IN ('above', 'at', 'below')),
  source TEXT NOT NULL DEFAULT 'manual',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_metrics_enrollment
  ON program_metrics (enrollment_id, metric_key, collected_at DESC);

CREATE INDEX idx_program_metrics_status
  ON program_metrics (enrollment_id, status)
  WHERE status = 'below';

-- ─── program_schedules ──────────────────────────────────
CREATE TABLE IF NOT EXISTS program_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_schedules_due
  ON program_schedules (next_run_at)
  WHERE is_active = true;

CREATE TRIGGER update_program_schedules_updated_at
  BEFORE UPDATE ON program_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── diagnostic_rules ───────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostic_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom TEXT NOT NULL,
  module_id TEXT NOT NULL,
  metric_key TEXT,
  threshold_operator TEXT CHECK (threshold_operator IN ('<', '>', '<=', '>=', '=')),
  threshold_value NUMERIC,
  diagnostic_questions TEXT[] NOT NULL DEFAULT '{}',
  common_causes JSONB NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagnostic_rules_module
  ON diagnostic_rules (module_id, is_active)
  WHERE is_active = true;

-- ─── RLS ────────────────────────────────────────────────
ALTER TABLE program_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_rules ENABLE ROW LEVEL SECURITY;

-- Service role full access (accessed via server-side services only)
CREATE POLICY "Service role full access" ON program_metrics
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON program_schedules
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON diagnostic_rules
  FOR ALL USING (true) WITH CHECK (true);

-- Users can read their own metrics and schedules
CREATE POLICY "Users read own metrics" ON program_metrics
  FOR SELECT USING (
    enrollment_id IN (
      SELECT id FROM program_enrollments WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Users read own schedules" ON program_schedules
  FOR SELECT USING (
    enrollment_id IN (
      SELECT id FROM program_enrollments WHERE user_id = auth.uid()
    )
  );
-- Diagnostic rules are public reference data
CREATE POLICY "Anyone can read diagnostic rules" ON diagnostic_rules
  FOR SELECT USING (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260311200000_phase3_tables.sql
git commit -m "feat(accelerator): add Phase 3 tables — metrics, schedules, diagnostic rules"
```

---

### Task 2: Expand Accelerator Types for Phase 3

**Files:**
- Modify: `src/lib/types/accelerator.ts`

- [ ] **Step 1: Read the current types file**

Read `src/lib/types/accelerator.ts` fully to understand current types.

- [ ] **Step 2: Add Phase 3 types**

Add after the existing `PHASE2_MODULES` constant:

```typescript
export const PHASE3_MODULES: ModuleId[] = ['m5', 'm6'];

// ─── Metrics ────────────────────────────────────────────

export type MetricKey =
  | 'email_sent'
  | 'email_open_rate'
  | 'email_reply_rate'
  | 'email_bounce_rate'
  | 'dm_sent'
  | 'dm_acceptance_rate'
  | 'dm_reply_rate'
  | 'tam_size'
  | 'tam_email_coverage'
  | 'content_posts_published'
  | 'content_avg_impressions'
  | 'content_avg_engagement'
  | 'funnel_opt_in_rate'
  | 'funnel_page_views';

export type MetricStatus = 'above' | 'at' | 'below';

export interface ProgramMetric {
  id: string;
  enrollment_id: string;
  module_id: string;
  metric_key: MetricKey;
  value: number;
  benchmark_low: number | null;
  benchmark_high: number | null;
  status: MetricStatus;
  source: string;
  collected_at: string;
}

export const METRIC_COLUMNS =
  'id, enrollment_id, module_id, metric_key, value, benchmark_low, benchmark_high, status, source, collected_at';

// ─── Schedules ──────────────────────────────────────────

export type ScheduleTaskType =
  | 'collect_metrics'
  | 'weekly_digest'
  | 'warmup_check'
  | 'tam_decay_check'
  | 'morning_briefing';

export interface ProgramSchedule {
  id: string;
  enrollment_id: string;
  task_type: ScheduleTaskType;
  cron_expression: string;
  config: Record<string, unknown>;
  is_system: boolean;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

export const SCHEDULE_COLUMNS =
  'id, enrollment_id, task_type, cron_expression, config, is_system, is_active, last_run_at, next_run_at';

// ─── Diagnostic Rules ───────────────────────────────────

export interface DiagnosticRule {
  id: string;
  symptom: string;
  module_id: string;
  metric_key: MetricKey | null;
  threshold_operator: '<' | '>' | '<=' | '>=' | '=' | null;
  threshold_value: number | null;
  diagnostic_questions: string[];
  common_causes: Array<{ cause: string; fix: string; severity: 'critical' | 'warning' | 'info' }>;
  priority: number;
}

export const DIAGNOSTIC_RULE_COLUMNS =
  'id, symptom, module_id, metric_key, threshold_operator, threshold_value, diagnostic_questions, common_causes, priority';
```

Also expand `DeliverableType` union — add `'diagnostic_report'` if not present.

Expand `SubAgentType` — no change needed, `'troubleshooter'` already exists.

- [ ] **Step 3: Run typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/accelerator.ts
git commit -m "feat(accelerator): add Phase 3 types — metrics, schedules, diagnostic rules"
```

---

### Task 3: Metrics Collection Service + Tests

**Files:**
- Create: `src/lib/services/accelerator-metrics.ts`
- Create: `src/__tests__/lib/services/accelerator-metrics.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

function createChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.then = jest.fn((resolve: (v: typeof result) => void) => Promise.resolve(resolve(result)));
  return chain;
}

import {
  recordMetrics,
  getLatestMetrics,
  getMetricHistory,
  getMetricsSummary,
  computeMetricStatus,
} from '@/lib/services/accelerator-metrics';

describe('accelerator-metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue(createChain([]));
  });

  describe('computeMetricStatus', () => {
    it('returns "below" when value < benchmark_low', () => {
      expect(computeMetricStatus(5, 10, 20)).toBe('below');
    });
    it('returns "above" when value > benchmark_high', () => {
      expect(computeMetricStatus(25, 10, 20)).toBe('above');
    });
    it('returns "at" when value is within range', () => {
      expect(computeMetricStatus(15, 10, 20)).toBe('at');
    });
    it('returns "at" when no benchmarks provided', () => {
      expect(computeMetricStatus(15, null, null)).toBe('at');
    });
  });

  describe('recordMetrics', () => {
    it('inserts metrics rows', async () => {
      const chain = createChain(null);
      mockFrom.mockReturnValue(chain);

      await recordMetrics('enroll-1', [
        { module_id: 'm4', metric_key: 'email_sent', value: 100, source: 'plusvibe' },
      ]);

      expect(mockFrom).toHaveBeenCalledWith('program_metrics');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ enrollment_id: 'enroll-1', metric_key: 'email_sent', value: 100 }),
        ])
      );
    });
  });

  describe('getLatestMetrics', () => {
    it('returns latest metrics for enrollment', async () => {
      const metrics = [
        { metric_key: 'email_sent', value: 100, status: 'at', collected_at: '2026-03-11T00:00:00Z' },
      ];
      mockFrom.mockReturnValue(createChain(metrics));

      const result = await getLatestMetrics('enroll-1');
      expect(result).toHaveLength(1);
      expect(result[0].metric_key).toBe('email_sent');
    });

    it('returns empty array on error', async () => {
      mockFrom.mockReturnValue(createChain(null, { code: '42P01', message: 'table not found' }));
      const result = await getLatestMetrics('enroll-1');
      expect(result).toEqual([]);
    });
  });

  describe('getMetricHistory', () => {
    it('returns metric history for a key', async () => {
      const history = [
        { value: 100, collected_at: '2026-03-10' },
        { value: 120, collected_at: '2026-03-11' },
      ];
      mockFrom.mockReturnValue(createChain(history));

      const result = await getMetricHistory('enroll-1', 'email_sent', 7);
      expect(result).toHaveLength(2);
    });
  });

  describe('getMetricsSummary', () => {
    it('groups metrics by module with status counts', async () => {
      const metrics = [
        { module_id: 'm4', metric_key: 'email_sent', value: 100, status: 'at', benchmark_low: 50, benchmark_high: 200 },
        { module_id: 'm4', metric_key: 'email_open_rate', value: 5, status: 'below', benchmark_low: 15, benchmark_high: 30 },
        { module_id: 'm3', metric_key: 'dm_sent', value: 20, status: 'at', benchmark_low: 10, benchmark_high: 30 },
      ];
      mockFrom.mockReturnValue(createChain(metrics));

      const result = await getMetricsSummary('enroll-1');
      expect(result.modules).toHaveLength(2);
      expect(result.belowCount).toBe(1);
      expect(result.totalMetrics).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/services/accelerator-metrics.test.ts --no-coverage
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write the metrics service**

Create `src/lib/services/accelerator-metrics.ts`:

```typescript
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

  // Get most recent metric per key using distinct on
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
```

- [ ] **Step 4: Run tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/services/accelerator-metrics.test.ts --no-coverage
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/accelerator-metrics.ts src/__tests__/lib/services/accelerator-metrics.test.ts
git commit -m "feat(accelerator): add metrics collection service with benchmarks and status computation"
```

---

### Task 4: Scheduler Service + Tests

**Files:**
- Create: `src/lib/services/accelerator-scheduler.ts`
- Create: `src/__tests__/lib/services/accelerator-scheduler.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

function createChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.upsert = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.then = jest.fn((resolve: (v: typeof result) => void) => Promise.resolve(resolve(result)));
  return chain;
}

import {
  getDueSchedules,
  createSchedule,
  markScheduleRun,
  getSchedulesByEnrollment,
  computeNextRun,
} from '@/lib/services/accelerator-scheduler';

describe('accelerator-scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue(createChain([]));
  });

  describe('computeNextRun', () => {
    it('computes next run for daily cron', () => {
      const now = new Date('2026-03-11T10:00:00Z');
      const next = computeNextRun('0 8 * * *', now);
      // Next 8AM UTC after March 11 10AM UTC = March 12 8AM UTC
      expect(next.getUTCHours()).toBe(8);
      expect(next.getUTCDate()).toBe(12);
    });

    it('computes next run for weekly Monday cron', () => {
      const now = new Date('2026-03-11T10:00:00Z'); // Wednesday
      const next = computeNextRun('0 9 * * 1', now);
      // Next Monday 9AM UTC
      expect(next.getUTCDay()).toBe(1); // Monday
      expect(next.getUTCHours()).toBe(9);
    });
  });

  describe('getDueSchedules', () => {
    it('returns schedules where next_run_at <= now', async () => {
      const schedules = [
        { id: 's-1', task_type: 'collect_metrics', enrollment_id: 'e-1', config: {} },
      ];
      mockFrom.mockReturnValue(createChain(schedules));
      const result = await getDueSchedules();
      expect(result).toHaveLength(1);
      expect(result[0].task_type).toBe('collect_metrics');
    });
  });

  describe('createSchedule', () => {
    it('creates a schedule with computed next_run_at', async () => {
      const chain = createChain({ id: 's-new' });
      mockFrom.mockReturnValue(chain);

      const result = await createSchedule('e-1', 'weekly_digest', '0 9 * * 1', {}, true);
      expect(result).toBeTruthy();
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollment_id: 'e-1',
          task_type: 'weekly_digest',
          is_system: true,
        })
      );
    });
  });

  describe('markScheduleRun', () => {
    it('updates last_run_at and next_run_at', async () => {
      const chain = createChain(null);
      mockFrom.mockReturnValue(chain);
      await markScheduleRun('s-1', '0 9 * * 1');
      expect(chain.update).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 's-1');
    });
  });

  describe('getSchedulesByEnrollment', () => {
    it('returns all schedules for enrollment', async () => {
      mockFrom.mockReturnValue(createChain([{ id: 's-1' }, { id: 's-2' }]));
      const result = await getSchedulesByEnrollment('e-1');
      expect(result).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/services/accelerator-scheduler.test.ts --no-coverage
```

- [ ] **Step 3: Write the scheduler service**

Create `src/lib/services/accelerator-scheduler.ts`:

```typescript
/** Accelerator Scheduler Service.
 *  CRUD for program_schedules. Computes next run times from cron expressions.
 *  Uses a simple cron parser (no external dependency).
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { ProgramSchedule, ScheduleTaskType } from '@/lib/types/accelerator';
import { SCHEDULE_COLUMNS } from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-scheduler';

// ─── Cron Helpers ────────────────────────────────────────

/** Simple cron next-run calculator. Supports standard 5-field cron (min hour dom month dow). */
export function computeNextRun(cronExpression: string, from: Date = new Date()): Date {
  const [minStr, hourStr, , , dowStr] = cronExpression.split(' ');
  const minute = parseInt(minStr, 10);
  const hour = parseInt(hourStr, 10);
  const targetDow = dowStr === '*' ? null : parseInt(dowStr, 10);

  const next = new Date(from);
  next.setUTCSeconds(0, 0);

  // Start from next minute
  next.setUTCMinutes(next.getUTCMinutes() + 1);

  // Set target hour and minute
  next.setUTCHours(hour, minute, 0, 0);

  // If we're past that time today, go to tomorrow
  if (next <= from) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  // If specific day-of-week, advance to it
  if (targetDow !== null) {
    while (next.getUTCDay() !== targetDow) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  }

  return next;
}

// ─── Read ───────────────────────────────────────────────

export async function getDueSchedules(): Promise<ProgramSchedule[]> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('program_schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('is_active', true)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true });

  if (error) {
    logError(LOG_CTX, error, { context: 'getDueSchedules' });
    return [];
  }
  return data || [];
}

export async function getSchedulesByEnrollment(enrollmentId: string): Promise<ProgramSchedule[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('enrollment_id', enrollmentId)
    .order('task_type');

  if (error) {
    logError(LOG_CTX, error, { enrollmentId });
    return [];
  }
  return data || [];
}

// ─── Write ──────────────────────────────────────────────

export async function createSchedule(
  enrollmentId: string,
  taskType: ScheduleTaskType,
  cronExpression: string,
  config: Record<string, unknown> = {},
  isSystem: boolean = false
): Promise<ProgramSchedule | null> {
  const supabase = getSupabaseAdminClient();
  const nextRunAt = computeNextRun(cronExpression);

  const { data, error } = await supabase
    .from('program_schedules')
    .insert({
      enrollment_id: enrollmentId,
      task_type: taskType,
      cron_expression: cronExpression,
      config,
      is_system: isSystem,
      next_run_at: nextRunAt.toISOString(),
    })
    .select(SCHEDULE_COLUMNS)
    .single();

  if (error) {
    logError(LOG_CTX, error, { enrollmentId, taskType });
    return null;
  }
  return data;
}

export async function markScheduleRun(
  scheduleId: string,
  cronExpression: string
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const now = new Date();
  const nextRunAt = computeNextRun(cronExpression, now);

  const { error } = await supabase
    .from('program_schedules')
    .update({
      last_run_at: now.toISOString(),
      next_run_at: nextRunAt.toISOString(),
    })
    .eq('id', scheduleId);

  if (error) {
    logError(LOG_CTX, error, { scheduleId });
  }
}

export async function toggleSchedule(
  scheduleId: string,
  isActive: boolean
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('program_schedules')
    .update({ is_active: isActive })
    .eq('id', scheduleId);

  if (error) {
    logError(LOG_CTX, error, { scheduleId, isActive });
    return false;
  }
  return true;
}

// ─── System Schedule Initialization ──────────────────────

/** Create default system schedules for a new enrollment. */
export async function initializeSystemSchedules(enrollmentId: string): Promise<void> {
  const defaults: Array<{ taskType: ScheduleTaskType; cron: string }> = [
    { taskType: 'collect_metrics', cron: '0 6 * * *' },       // Daily 6 AM UTC
    { taskType: 'weekly_digest', cron: '0 9 * * 1' },         // Monday 9 AM UTC
    { taskType: 'warmup_check', cron: '0 7 * * *' },          // Daily 7 AM UTC
  ];

  for (const { taskType, cron } of defaults) {
    await createSchedule(enrollmentId, taskType, cron, {}, true);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/services/accelerator-scheduler.test.ts --no-coverage
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/accelerator-scheduler.ts src/__tests__/lib/services/accelerator-scheduler.test.ts
git commit -m "feat(accelerator): add scheduler service with cron computation and system schedule init"
```

---

### Task 5: Troubleshooter Service + Tests

**Files:**
- Create: `src/lib/services/accelerator-troubleshooter.ts`
- Create: `src/__tests__/lib/services/accelerator-troubleshooter.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

function createChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.then = jest.fn((resolve: (v: typeof result) => void) => Promise.resolve(resolve(result)));
  return chain;
}

import {
  getDiagnosticRules,
  matchRulesToMetrics,
} from '@/lib/services/accelerator-troubleshooter';

describe('accelerator-troubleshooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDiagnosticRules', () => {
    it('returns rules for a module', async () => {
      const rules = [{ id: 'r-1', symptom: 'Low open rate', module_id: 'm4' }];
      mockFrom.mockReturnValue(createChain(rules));
      const result = await getDiagnosticRules('m4');
      expect(result).toHaveLength(1);
    });

    it('returns empty array on error', async () => {
      mockFrom.mockReturnValue(createChain(null, { message: 'error' }));
      const result = await getDiagnosticRules('m4');
      expect(result).toEqual([]);
    });
  });

  describe('matchRulesToMetrics', () => {
    it('matches rules where metric is below threshold', () => {
      const rules = [
        {
          id: 'r-1',
          symptom: 'Low open rate',
          module_id: 'm4',
          metric_key: 'email_open_rate',
          threshold_operator: '<' as const,
          threshold_value: 20,
          diagnostic_questions: ['Are your subject lines personalized?'],
          common_causes: [{ cause: 'Generic subjects', fix: 'Use first name + pain point', severity: 'critical' as const }],
          priority: 10,
        },
        {
          id: 'r-2',
          symptom: 'High bounce rate',
          module_id: 'm4',
          metric_key: 'email_bounce_rate',
          threshold_operator: '>' as const,
          threshold_value: 5,
          diagnostic_questions: ['When did you validate emails?'],
          common_causes: [{ cause: 'Stale list', fix: 'Re-validate', severity: 'warning' as const }],
          priority: 20,
        },
      ];

      const metrics = [
        { metric_key: 'email_open_rate', value: 15 },
        { metric_key: 'email_bounce_rate', value: 3 },
      ];

      const matched = matchRulesToMetrics(rules, metrics);
      expect(matched).toHaveLength(1);
      expect(matched[0].symptom).toBe('Low open rate');
    });

    it('returns empty when all metrics are healthy', () => {
      const rules = [
        {
          id: 'r-1',
          symptom: 'Low open rate',
          module_id: 'm4',
          metric_key: 'email_open_rate',
          threshold_operator: '<' as const,
          threshold_value: 20,
          diagnostic_questions: [],
          common_causes: [],
          priority: 10,
        },
      ];
      const metrics = [{ metric_key: 'email_open_rate', value: 45 }];
      const matched = matchRulesToMetrics(rules, metrics);
      expect(matched).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the troubleshooter service**

Create `src/lib/services/accelerator-troubleshooter.ts`:

```typescript
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

    const isTriggered = evaluateThreshold(currentValue, rule.threshold_operator, rule.threshold_value);
    if (isTriggered) {
      triggered.push(rule);
    }
  }

  return triggered;
}

function evaluateThreshold(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case '<': return value < threshold;
    case '>': return value > threshold;
    case '<=': return value <= threshold;
    case '>=': return value >= threshold;
    case '=': return value === threshold;
    default: return false;
  }
}
```

- [ ] **Step 4: Run tests**

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/accelerator-troubleshooter.ts src/__tests__/lib/services/accelerator-troubleshooter.test.ts
git commit -m "feat(accelerator): add troubleshooter service with diagnostic rule matching"
```

---

## Chunk 2: Actions + Sub-Agent

### Task 6: Metrics Actions + Tests

**Files:**
- Create: `src/lib/actions/metrics.ts`
- Create: `src/__tests__/lib/actions/metrics.test.ts`
- Modify: `src/lib/actions/index.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/services/accelerator-metrics', () => ({
  getLatestMetrics: jest.fn(),
  getMetricsSummary: jest.fn(),
  getMetricHistory: jest.fn(),
}));

jest.mock('@/lib/services/accelerator-program', () => ({
  getEnrollmentByUserId: jest.fn(),
}));

import { executeAction } from '@/lib/actions';
import { getLatestMetrics, getMetricsSummary, getMetricHistory } from '@/lib/services/accelerator-metrics';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';

// Force import to register actions
import '@/lib/actions/metrics';

const ctx = { userId: 'user-1', teamId: null, sessionId: 'sess-1' };

describe('metrics actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEnrollmentByUserId as jest.Mock).mockResolvedValue({ id: 'enroll-1' });
  });

  it('get_metrics returns latest metrics', async () => {
    (getLatestMetrics as jest.Mock).mockResolvedValue([
      { metric_key: 'email_sent', value: 100, status: 'at' },
    ]);

    const result = await executeAction(ctx, 'get_metrics', {});
    expect(result.success).toBe(true);
    expect(result.data.metrics).toHaveLength(1);
  });

  it('get_metrics_summary returns grouped summary', async () => {
    (getMetricsSummary as jest.Mock).mockResolvedValue({
      modules: [{ module_id: 'm4', metrics: [], belowCount: 0 }],
      belowCount: 0,
      totalMetrics: 5,
    });

    const result = await executeAction(ctx, 'get_metrics_summary', {});
    expect(result.success).toBe(true);
    expect(result.data.totalMetrics).toBe(5);
  });

  it('get_metric_history returns trend data', async () => {
    (getMetricHistory as jest.Mock).mockResolvedValue([
      { value: 100, collected_at: '2026-03-10' },
      { value: 120, collected_at: '2026-03-11' },
    ]);

    const result = await executeAction(ctx, 'get_metric_history', {
      metric_key: 'email_sent',
      days: 7,
    });
    expect(result.success).toBe(true);
    expect(result.data.history).toHaveLength(2);
  });

  it('get_metrics fails without enrollment', async () => {
    (getEnrollmentByUserId as jest.Mock).mockResolvedValue(null);
    const result = await executeAction(ctx, 'get_metrics', {});
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the metrics actions**

Create `src/lib/actions/metrics.ts`:

```typescript
/** Metrics Actions.
 *  Actions for agents to query performance metrics, trends, and summaries.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import {
  getLatestMetrics,
  getMetricsSummary,
  getMetricHistory,
} from '@/lib/services/accelerator-metrics';
import type { MetricKey } from '@/lib/types/accelerator';

// ─── Read Actions ────────────────────────────────────────

registerAction({
  name: 'get_metrics',
  description:
    'Get the latest performance metrics across all modules — email stats, DM stats, TAM size, content engagement, funnel conversion.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const metrics = await getLatestMetrics(enrollment.id);
    return { success: true, data: { metrics }, displayHint: 'metrics_card' };
  },
});

registerAction({
  name: 'get_metrics_summary',
  description:
    'Get a high-level metrics summary grouped by module with below-benchmark counts. Good for quick health checks.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const summary = await getMetricsSummary(enrollment.id);
    return { success: true, data: summary, displayHint: 'metrics_card' };
  },
});

registerAction({
  name: 'get_metric_history',
  description:
    'Get historical trend data for a specific metric over time. Use for spotting improvements or regressions.',
  parameters: {
    properties: {
      metric_key: {
        type: 'string',
        enum: [
          'email_sent', 'email_open_rate', 'email_reply_rate', 'email_bounce_rate',
          'dm_sent', 'dm_acceptance_rate', 'dm_reply_rate',
          'tam_size', 'tam_email_coverage',
          'content_posts_published', 'content_avg_impressions', 'content_avg_engagement',
          'funnel_opt_in_rate', 'funnel_page_views',
        ],
      },
      days: { type: 'number', description: 'Lookback period in days (default 30)' },
    },
    required: ['metric_key'],
  },
  handler: async (ctx, params: { metric_key: MetricKey; days?: number }) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const history = await getMetricHistory(enrollment.id, params.metric_key, params.days || 30);
    return { success: true, data: { metric_key: params.metric_key, history }, displayHint: 'metrics_card' };
  },
});
```

- [ ] **Step 4: Add import to actions/index.ts**

Add `import './metrics';` and `import './schedules';` to `src/lib/actions/index.ts`.

- [ ] **Step 5: Run tests**

Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/metrics.ts src/__tests__/lib/actions/metrics.test.ts src/lib/actions/index.ts
git commit -m "feat(accelerator): add metrics actions for agent metric queries"
```

---

### Task 7: Schedule Actions + Tests

**Files:**
- Create: `src/lib/actions/schedules.ts`
- Create: `src/__tests__/lib/actions/schedules.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/services/accelerator-scheduler', () => ({
  getSchedulesByEnrollment: jest.fn(),
  createSchedule: jest.fn(),
  toggleSchedule: jest.fn(),
}));

jest.mock('@/lib/services/accelerator-program', () => ({
  getEnrollmentByUserId: jest.fn(),
}));

import { executeAction } from '@/lib/actions';
import { getSchedulesByEnrollment, createSchedule, toggleSchedule } from '@/lib/services/accelerator-scheduler';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';

import '@/lib/actions/schedules';

const ctx = { userId: 'user-1', teamId: null, sessionId: 'sess-1' };

describe('schedule actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEnrollmentByUserId as jest.Mock).mockResolvedValue({ id: 'enroll-1' });
  });

  it('list_schedules returns schedules for enrollment', async () => {
    (getSchedulesByEnrollment as jest.Mock).mockResolvedValue([
      { id: 's-1', task_type: 'collect_metrics', is_active: true },
    ]);
    const result = await executeAction(ctx, 'list_schedules', {});
    expect(result.success).toBe(true);
    expect(result.data.schedules).toHaveLength(1);
  });

  it('create_schedule creates and returns schedule', async () => {
    (createSchedule as jest.Mock).mockResolvedValue({ id: 's-new', task_type: 'weekly_digest' });
    const result = await executeAction(ctx, 'create_schedule', {
      task_type: 'weekly_digest',
      cron_expression: '0 9 * * 1',
    });
    expect(result.success).toBe(true);
    expect(result.data.task_type).toBe('weekly_digest');
  });

  it('toggle_schedule activates/deactivates', async () => {
    (toggleSchedule as jest.Mock).mockResolvedValue(true);
    const result = await executeAction(ctx, 'toggle_schedule', {
      schedule_id: 's-1',
      is_active: false,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the schedule actions**

Create `src/lib/actions/schedules.ts`:

```typescript
/** Schedule Actions.
 *  Actions for agents to manage recurring automation schedules.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import {
  getSchedulesByEnrollment,
  createSchedule,
  toggleSchedule,
} from '@/lib/services/accelerator-scheduler';
import type { ScheduleTaskType } from '@/lib/types/accelerator';

// ─── Read Actions ────────────────────────────────────────

registerAction({
  name: 'list_schedules',
  description:
    'List all active and inactive automation schedules — metrics collection, weekly digest, warmup checks, etc.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const schedules = await getSchedulesByEnrollment(enrollment.id);
    return { success: true, data: { schedules }, displayHint: 'task_board' };
  },
});

// ─── Write Actions ───────────────────────────────────────

registerAction({
  name: 'create_schedule',
  description:
    'Create a new recurring schedule. Use standard cron format (min hour dom month dow).',
  parameters: {
    properties: {
      task_type: {
        type: 'string',
        enum: ['collect_metrics', 'weekly_digest', 'warmup_check', 'tam_decay_check', 'morning_briefing'],
      },
      cron_expression: {
        type: 'string',
        description: 'Standard 5-field cron expression, e.g. "0 9 * * 1" for Monday 9AM UTC',
      },
      config: {
        type: 'object',
        description: 'Optional task-specific config',
      },
    },
    required: ['task_type', 'cron_expression'],
  },
  handler: async (
    ctx,
    params: { task_type: ScheduleTaskType; cron_expression: string; config?: Record<string, unknown> }
  ) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const schedule = await createSchedule(
      enrollment.id,
      params.task_type,
      params.cron_expression,
      params.config || {},
      false // user-created, not system
    );
    if (!schedule) return { success: false, error: 'Failed to create schedule.' };
    return { success: true, data: schedule, displayHint: 'text' };
  },
});

registerAction({
  name: 'toggle_schedule',
  description: 'Enable or disable an automation schedule.',
  parameters: {
    properties: {
      schedule_id: { type: 'string', description: 'Schedule UUID' },
      is_active: { type: 'boolean', description: 'true to enable, false to disable' },
    },
    required: ['schedule_id', 'is_active'],
  },
  handler: async (ctx, params: { schedule_id: string; is_active: boolean }) => {
    // Verify the schedule belongs to the user's enrollment
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const schedules = await getSchedulesByEnrollment(enrollment.id);
    const ownsSchedule = schedules.some((s) => s.id === params.schedule_id);
    if (!ownsSchedule) return { success: false, error: 'Schedule not found.' };

    const success = await toggleSchedule(params.schedule_id, params.is_active);
    if (!success) return { success: false, error: 'Failed to update schedule.' };
    return { success: true, data: { toggled: true }, displayHint: 'text' };
  },
});
```

- [ ] **Step 4: Run tests**

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/schedules.ts src/__tests__/lib/actions/schedules.test.ts
git commit -m "feat(accelerator): add schedule actions for managing recurring automation"
```

---

### Task 8: Review Queue Actions (approve/reject) + Tests

**Files:**
- Modify: `src/lib/actions/program.ts`
- Create: `src/__tests__/lib/actions/program-review.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/__tests__/lib/actions/program-review.test.ts`:

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/services/accelerator-program', () => ({
  getProgramState: jest.fn(),
  getEnrollmentByUserId: jest.fn(),
  updateModuleStatus: jest.fn(),
  createDeliverable: jest.fn(),
  updateDeliverableStatus: jest.fn(),
  getSopsByModule: jest.fn(),
  updateEnrollmentIntake: jest.fn(),
}));
jest.mock('@/lib/services/accelerator-validation', () => ({
  validateDeliverable: jest.fn(),
}));
jest.mock('@/lib/services/accelerator-usage', () => ({
  trackUsageEvent: jest.fn(),
}));

import { executeAction } from '@/lib/actions';
import { updateDeliverableStatus } from '@/lib/services/accelerator-program';

import '@/lib/actions/program';

const ctx = { userId: 'user-1', teamId: null, sessionId: 'sess-1' };

describe('review queue actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('approve_review_item sets status to approved', async () => {
    (updateDeliverableStatus as jest.Mock).mockResolvedValue({ id: 'd-1', status: 'approved' });
    const result = await executeAction(ctx, 'approve_review_item', { deliverable_id: 'd-1' });
    expect(result.success).toBe(true);
    expect(updateDeliverableStatus).toHaveBeenCalledWith('d-1', 'approved');
  });

  it('reject_review_item sets status to rejected with feedback', async () => {
    (updateDeliverableStatus as jest.Mock).mockResolvedValue({ id: 'd-1', status: 'rejected' });
    const result = await executeAction(ctx, 'reject_review_item', {
      deliverable_id: 'd-1',
      feedback: 'Needs more detail',
    });
    expect(result.success).toBe(true);
    expect(updateDeliverableStatus).toHaveBeenCalledWith(
      'd-1',
      'rejected',
      expect.objectContaining({ feedback: 'Needs more detail' })
    );
  });

  it('approve_review_item fails gracefully', async () => {
    (updateDeliverableStatus as jest.Mock).mockResolvedValue(null);
    const result = await executeAction(ctx, 'approve_review_item', { deliverable_id: 'd-bad' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Read program.ts**

Read the current `src/lib/actions/program.ts` to find the right insertion point.

- [ ] **Step 2: Add approve_review_item and reject_review_item actions**

Add after the existing `validate_deliverable` action (around line 238):

```typescript
registerAction({
  name: 'approve_review_item',
  description:
    'Approve a pending review item (e.g., a scheduled deliverable). Sets status to approved.',
  parameters: {
    properties: {
      deliverable_id: { type: 'string', description: 'Deliverable UUID to approve' },
    },
    required: ['deliverable_id'],
  },
  handler: async (_ctx, params: { deliverable_id: string }) => {
    const result = await updateDeliverableStatus(
      params.deliverable_id,
      'approved' as DeliverableStatus
    );
    if (!result) return { success: false, error: 'Failed to approve item.' };
    return { success: true, data: result, displayHint: 'deliverable_card' };
  },
});

registerAction({
  name: 'reject_review_item',
  description:
    'Reject a pending review item with optional feedback. Sets status to rejected.',
  parameters: {
    properties: {
      deliverable_id: { type: 'string', description: 'Deliverable UUID to reject' },
      feedback: { type: 'string', description: 'Reason for rejection' },
    },
    required: ['deliverable_id'],
  },
  handler: async (_ctx, params: { deliverable_id: string; feedback?: string }) => {
    const validationResult = params.feedback
      ? { passed: false, checks: [], feedback: params.feedback }
      : undefined;
    const result = await updateDeliverableStatus(
      params.deliverable_id,
      'rejected' as DeliverableStatus,
      validationResult
    );
    if (!result) return { success: false, error: 'Failed to reject item.' };
    return { success: true, data: result, displayHint: 'deliverable_card' };
  },
});
```

- [ ] **Step 3: Run typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

- [ ] **Step 4: Run tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/actions/program-review.test.ts --no-coverage
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/program.ts src/__tests__/lib/actions/program-review.test.ts
git commit -m "feat(accelerator): add approve/reject review queue actions"
```

---

### Task 9: Troubleshooter Agent Prompt + Tests

**Files:**
- Create: `src/lib/ai/copilot/sub-agents/troubleshooter-agent.ts`
- Create: `src/__tests__/lib/ai/copilot/sub-agents/troubleshooter-agent.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
/**
 * @jest-environment node
 */

import { buildTroubleshooterPrompt } from '@/lib/ai/copilot/sub-agents/troubleshooter-agent';
import type { DiagnosticRule } from '@/lib/types/accelerator';

describe('troubleshooter-agent prompt', () => {
  const mockRules: DiagnosticRule[] = [
    {
      id: 'r-1',
      symptom: 'Low email open rate',
      module_id: 'm4',
      metric_key: 'email_open_rate',
      threshold_operator: '<',
      threshold_value: 20,
      diagnostic_questions: ['Are subject lines personalized?', 'What is your sending volume?'],
      common_causes: [
        { cause: 'Generic subject lines', fix: 'Use first name + pain point in subject', severity: 'critical' },
      ],
      priority: 10,
    },
  ];

  const mockMetrics = [
    { metric_key: 'email_open_rate', value: 12, status: 'below' as const },
    { metric_key: 'email_sent', value: 50, status: 'at' as const },
  ];

  it('includes identity section', () => {
    const prompt = buildTroubleshooterPrompt([], [], 'guide_me');
    expect(prompt).toContain('Troubleshooter');
    expect(prompt).toContain('diagnos');
  });

  it('includes triggered diagnostic rules', () => {
    const prompt = buildTroubleshooterPrompt(mockRules, mockMetrics, 'guide_me');
    expect(prompt).toContain('Low email open rate');
    expect(prompt).toContain('Generic subject lines');
    expect(prompt).toContain('Are subject lines personalized?');
  });

  it('includes current metrics snapshot', () => {
    const prompt = buildTroubleshooterPrompt(mockRules, mockMetrics, 'guide_me');
    expect(prompt).toContain('email_open_rate');
    expect(prompt).toContain('12');
    expect(prompt).toContain('below');
  });

  it('adapts coaching mode', () => {
    const doIt = buildTroubleshooterPrompt(mockRules, mockMetrics, 'do_it');
    expect(doIt).toContain('Do It For Me');

    const teachMe = buildTroubleshooterPrompt(mockRules, mockMetrics, 'teach_me');
    expect(teachMe).toContain('Teach Me');
  });

  it('includes handoff protocol', () => {
    const prompt = buildTroubleshooterPrompt(mockRules, mockMetrics, 'guide_me');
    expect(prompt).toContain('diagnostic_report');
    expect(prompt).toContain('needs_escalation');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the troubleshooter agent prompt builder**

Create `src/lib/ai/copilot/sub-agents/troubleshooter-agent.ts`:

```typescript
/** Troubleshooter Agent.
 *  Diagnoses performance issues using diagnostic rules and current metrics.
 *  Asks targeted questions, identifies root causes, and recommends fixes.
 *  Never imports NextRequest, NextResponse, or cookies. */

import type { DiagnosticRule, CoachingMode } from '@/lib/types/accelerator';

interface MetricSnapshot {
  metric_key: string;
  value: number;
  status: 'above' | 'at' | 'below';
}

export function buildTroubleshooterPrompt(
  triggeredRules: DiagnosticRule[],
  currentMetrics: MetricSnapshot[],
  coachingMode: CoachingMode
): string {
  const sections: string[] = [];

  // ─── Identity ─────────────────────────────────────────
  sections.push(`You are the Troubleshooter specialist in the GTM Accelerator program.
Your job is to diagnose performance issues, identify root causes, and recommend actionable fixes.`);

  // ─── Coaching Mode ────────────────────────────────────
  if (coachingMode === 'do_it') {
    sections.push(`## Mode: Do It For Me
Analyze metrics, run diagnostics, and implement fixes automatically where possible.
For fixes requiring user action, provide exact step-by-step instructions.`);
  } else if (coachingMode === 'guide_me') {
    sections.push(`## Mode: Guide Me
Walk through the diagnosis together. Explain what each metric means and why it matters.
Ask the diagnostic questions and help interpret the answers.`);
  } else {
    sections.push(`## Mode: Teach Me
Explain the diagnostic framework in detail. Help the user understand benchmarks,
what drives each metric, and how to self-diagnose in the future.`);
  }

  // ─── Current Metrics ──────────────────────────────────
  if (currentMetrics.length > 0) {
    const lines = currentMetrics.map(
      (m) => `- **${m.metric_key}**: ${m.value} (${m.status})`
    );
    sections.push(`## Current Metrics Snapshot\n${lines.join('\n')}`);
  }

  // ─── Triggered Diagnostic Rules ───────────────────────
  if (triggeredRules.length > 0) {
    sections.push('## Triggered Diagnostics');
    for (const rule of triggeredRules) {
      const questions = rule.diagnostic_questions.map((q) => `  - ${q}`).join('\n');
      const causes = rule.common_causes
        .map((c) => `  - **${c.cause}** (${c.severity}): ${c.fix}`)
        .join('\n');

      sections.push(`### ${rule.symptom}
**Trigger:** ${rule.metric_key} ${rule.threshold_operator} ${rule.threshold_value}

**Diagnostic Questions:**
${questions}

**Common Causes & Fixes:**
${causes}`);
    }
  } else {
    sections.push(`## No Triggered Diagnostics
All metrics are within acceptable ranges. If the user reports a specific issue,
use the get_metrics and get_metric_history tools to investigate.`);
  }

  // ─── Diagnostic Workflow ──────────────────────────────
  sections.push(`## Diagnostic Workflow
1. Review current metrics snapshot above
2. For each triggered diagnostic, ask the diagnostic questions
3. Based on answers, identify the most likely root cause
4. Recommend the specific fix with actionable steps
5. If multiple issues, prioritize by severity (critical > warning > info)
6. If the issue is beyond what you can diagnose, escalate`);

  // ─── Output Protocol ──────────────────────────────────
  sections.push(`## Output Protocol
When you complete a diagnosis, create a deliverable:
- type: "diagnostic_report"

Report progress via update_module_progress.

When finished, return a handoff JSON block:
\`\`\`json
{
  "deliverables_created": [{"type": "diagnostic_report", "entity_type": "diagnostic"}],
  "progress_updates": [],
  "validation_results": [],
  "needs_escalation": false,
  "summary": "Diagnosed X issues: [list]. Recommended fixes: [list]."
}
\`\`\``);

  return sections.join('\n\n');
}
```

- [ ] **Step 4: Run tests**

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/troubleshooter-agent.ts src/__tests__/lib/ai/copilot/sub-agents/troubleshooter-agent.test.ts
git commit -m "feat(accelerator): add Troubleshooter Agent with diagnostic rule matching"
```

---

### Task 10: Wire Troubleshooter + Metrics into Sub-Agent Config

**Files:**
- Modify: `src/lib/ai/copilot/sub-agents/config.ts`

- [ ] **Step 1: Read config.ts**

Read `src/lib/ai/copilot/sub-agents/config.ts` to understand the current wiring.

- [ ] **Step 2: Add troubleshooter wiring**

Import the new modules:

```typescript
import { buildTroubleshooterPrompt } from './troubleshooter-agent';
import { getDiagnosticRules, matchRulesToMetrics } from '@/lib/services/accelerator-troubleshooter';
import { getLatestMetrics } from '@/lib/services/accelerator-metrics';
```

In the switch statement for `agentType`, replace the `troubleshooter` stub (lines 82-85):

```typescript
case 'troubleshooter': {
  if (!enrollment) {
    systemPrompt = 'No active enrollment found. Ask the user to enroll in the accelerator first.';
    break;
  }
  const latestMetrics = await getLatestMetrics(enrollment.id);
  const metricsSnapshot = latestMetrics.map((m) => ({
    metric_key: m.metric_key,
    value: m.value,
    status: m.status,
  }));

  // Collect rules from all active modules and match
  const allRules: DiagnosticRule[] = [];
  for (const mod of ['m0', 'm1', 'm2', 'm3', 'm4', 'm7'] as const) {
    const rules = await getDiagnosticRules(mod);
    allRules.push(...rules);
  }
  const triggered = matchRulesToMetrics(allRules, metricsSnapshot);

  systemPrompt = buildTroubleshooterPrompt(
    triggered,
    metricsSnapshot,
    userContext.coaching_mode
  );
  break;
}
```

Also add the `DiagnosticRule` type import at the top:

```typescript
import type { SubAgentType, ModuleId, CoachingMode, DiagnosticRule } from '@/lib/types/accelerator';
```

Add metrics tools to the base `relevantToolNames` array (line 92-103), so all agents can check metrics:

```typescript
  const relevantToolNames = [
    'get_program_state',
    'get_module_sops',
    'create_deliverable',
    'validate_deliverable',
    'update_module_progress',
    'save_intake_data',
    'list_providers',
    'check_provider_status',
    'configure_provider',
    'get_guided_steps',
    'get_metrics',
    'get_metrics_summary',
  ];

  // Troubleshooter gets additional metric tools
  if (agentType === 'troubleshooter') {
    relevantToolNames.push('get_metric_history', 'list_schedules');
  }
```

- [ ] **Step 3: Run typecheck + affected tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='sub-agents' --no-coverage
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/config.ts
git commit -m "feat(accelerator): wire troubleshooter agent + metrics tools into sub-agent config"
```

---

## Chunk 3: Trigger.dev Tasks + Seed Data

### Task 11: Trigger.dev Scheduler Task

**Files:**
- Create: `src/trigger/accelerator-scheduler.ts`

- [ ] **Step 1: Write the scheduler task**

```typescript
/** Accelerator Scheduler.
 *  Polls program_schedules every 15 minutes and dispatches due tasks.
 *  Each task type maps to a specific Trigger.dev task or inline handler. */

import { schedules, logger, tasks } from '@trigger.dev/sdk/v3';
import { getDueSchedules, markScheduleRun } from '@/lib/services/accelerator-scheduler';
import type { acceleratorCollectMetrics } from './accelerator-collect-metrics';
import type { acceleratorDigest } from './accelerator-digest';

export const acceleratorScheduler = schedules.task({
  id: 'accelerator-scheduler',
  cron: '*/15 * * * *', // Every 15 minutes
  maxDuration: 120,
  run: async () => {
    logger.info('Accelerator scheduler: checking for due tasks');

    const dueSchedules = await getDueSchedules();

    if (dueSchedules.length === 0) {
      logger.info('No due schedules');
      return { processed: 0 };
    }

    logger.info('Processing due schedules', { count: dueSchedules.length });

    let processed = 0;
    let errors = 0;

    for (const schedule of dueSchedules) {
      try {
        switch (schedule.task_type) {
          case 'collect_metrics':
            await tasks.trigger<typeof acceleratorCollectMetrics>(
              'accelerator-collect-metrics',
              { enrollmentId: schedule.enrollment_id, config: schedule.config }
            );
            break;

          case 'weekly_digest':
            await tasks.trigger<typeof acceleratorDigest>(
              'accelerator-digest',
              { enrollmentId: schedule.enrollment_id, config: schedule.config }
            );
            break;

          case 'warmup_check':
            await tasks.trigger<typeof acceleratorCollectMetrics>(
              'accelerator-collect-metrics',
              {
                enrollmentId: schedule.enrollment_id,
                config: { ...schedule.config, metricsOnly: ['email_warmup'] },
              }
            );
            break;

          case 'tam_decay_check':
          case 'morning_briefing':
            // These task types are handled by metrics collection
            // Morning briefing data is generated on-demand via chat action
            logger.info('Skipping task type (handled elsewhere)', { taskType: schedule.task_type });
            break;

          default:
            logger.warn('Unknown task type', { taskType: schedule.task_type });
        }

        await markScheduleRun(schedule.id, schedule.cron_expression);
        processed++;
      } catch (err) {
        errors++;
        logger.error('Failed to process schedule', {
          scheduleId: schedule.id,
          taskType: schedule.task_type,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    return { processed, errors, total: dueSchedules.length };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/trigger/accelerator-scheduler.ts
git commit -m "feat(accelerator): add Trigger.dev scheduler — polls due tasks every 15 minutes"
```

---

### Task 12: Trigger.dev Metrics Collection Task

**Files:**
- Create: `src/trigger/accelerator-collect-metrics.ts`

- [ ] **Step 1: Write the metrics collection task**

```typescript
/** Accelerator Metrics Collection.
 *  Collects performance metrics from configured providers and MagnetLab internal data.
 *  Triggered by the accelerator-scheduler or on-demand. */

import { task, logger } from '@trigger.dev/sdk/v3';
import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { recordMetrics, type MetricInput } from '@/lib/services/accelerator-metrics';
import { resolveProvider } from '@/lib/providers/registry';

interface CollectMetricsPayload {
  enrollmentId: string;
  config: Record<string, unknown>;
}

export const acceleratorCollectMetrics = task({
  id: 'accelerator-collect-metrics',
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async (payload: CollectMetricsPayload) => {
    const { enrollmentId, config } = payload;
    logger.info('Collecting metrics', { enrollmentId });

    const supabase = getSupabaseAdminClient();

    // Get enrollment to find user_id
    const { data: enrollment } = await supabase
      .from('program_enrollments')
      .select('id, user_id, selected_modules')
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      logger.error('Enrollment not found', { enrollmentId });
      return { collected: 0 };
    }

    const metrics: MetricInput[] = [];

    // ─── Email Outreach Metrics (M4) ────────────────────
    if (enrollment.selected_modules.includes('m4')) {
      try {
        const emailProvider = await resolveProvider(enrollment.user_id, 'email_outreach');
        if (emailProvider && 'getCampaignStats' in emailProvider) {
          const campaigns = await emailProvider.listCampaigns();
          for (const campaign of campaigns.slice(0, 3)) {
            const stats = await emailProvider.getCampaignStats(campaign.id);
            if (stats.sent > 0) {
              metrics.push(
                { module_id: 'm4', metric_key: 'email_sent', value: stats.sent, source: 'plusvibe' },
                { module_id: 'm4', metric_key: 'email_open_rate', value: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0, source: 'plusvibe' },
                { module_id: 'm4', metric_key: 'email_reply_rate', value: stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0, source: 'plusvibe' },
                { module_id: 'm4', metric_key: 'email_bounce_rate', value: stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0, source: 'plusvibe' }
              );
            }
          }
        }
      } catch (err) {
        logger.error('Failed to collect email metrics', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // ─── DM Outreach Metrics (M3) ───────────────────────
    if (enrollment.selected_modules.includes('m3')) {
      try {
        const dmProvider = await resolveProvider(enrollment.user_id, 'dm_outreach');
        if (dmProvider && 'getCampaignStats' in dmProvider) {
          const campaigns = await dmProvider.listCampaigns();
          for (const campaign of campaigns.slice(0, 3)) {
            const stats = await dmProvider.getCampaignStats(campaign.id);
            metrics.push(
              { module_id: 'm3', metric_key: 'dm_sent', value: stats.sent, source: 'heyreach' },
              { module_id: 'm3', metric_key: 'dm_acceptance_rate', value: stats.sent > 0 ? (stats.accepted / stats.sent) * 100 : 0, source: 'heyreach' },
              { module_id: 'm3', metric_key: 'dm_reply_rate', value: stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0, source: 'heyreach' }
            );
          }
        }
      } catch (err) {
        logger.error('Failed to collect DM metrics', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // ─── Content Metrics (M7) ───────────────────────────
    if (enrollment.selected_modules.includes('m7')) {
      try {
        const { data: posts } = await supabase
          .from('cp_pipeline_posts')
          .select('engagement_stats, published_at')
          .eq('user_id', enrollment.user_id)
          .not('published_at', 'is', null)
          .gte('published_at', new Date(Date.now() - 30 * 86400000).toISOString())
          .order('published_at', { ascending: false });

        if (posts && posts.length > 0) {
          metrics.push({
            module_id: 'm7',
            metric_key: 'content_posts_published',
            value: posts.length,
            source: 'magnetlab',
          });

          const withStats = posts.filter((p: Record<string, unknown>) => p.engagement_stats);
          if (withStats.length > 0) {
            const avgImpressions = withStats.reduce(
              (sum: number, p: Record<string, unknown>) =>
                sum + ((p.engagement_stats as Record<string, number>)?.impressions || 0),
              0
            ) / withStats.length;
            metrics.push({
              module_id: 'm7',
              metric_key: 'content_avg_impressions',
              value: Math.round(avgImpressions),
              source: 'magnetlab',
            });
          }
        }
      } catch (err) {
        logger.error('Failed to collect content metrics', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // ─── Funnel Metrics (M1) ────────────────────────────
    if (enrollment.selected_modules.includes('m1')) {
      try {
        const { data: funnels } = await supabase
          .from('funnel_pages')
          .select('id, views, conversions')
          .eq('user_id', enrollment.user_id)
          .not('published_at', 'is', null);

        if (funnels && funnels.length > 0) {
          const totalViews = funnels.reduce((sum: number, f: Record<string, number>) => sum + (f.views || 0), 0);
          const totalConversions = funnels.reduce((sum: number, f: Record<string, number>) => sum + (f.conversions || 0), 0);

          metrics.push(
            { module_id: 'm1', metric_key: 'funnel_page_views', value: totalViews, source: 'magnetlab' },
            { module_id: 'm1', metric_key: 'funnel_opt_in_rate', value: totalViews > 0 ? (totalConversions / totalViews) * 100 : 0, source: 'magnetlab' }
          );
        }
      } catch (err) {
        logger.error('Failed to collect funnel metrics', { error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    // ─── Record All Collected Metrics ───────────────────
    if (metrics.length > 0) {
      await recordMetrics(enrollmentId, metrics);
    }

    logger.info('Metrics collection complete', { enrollmentId, collected: metrics.length });
    return { collected: metrics.length };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/trigger/accelerator-collect-metrics.ts
git commit -m "feat(accelerator): add Trigger.dev metrics collection task — pulls from providers + MagnetLab"
```

---

### Task 13: Trigger.dev Weekly Digest Task

**Files:**
- Create: `src/trigger/accelerator-digest.ts`

- [ ] **Step 1: Write the digest task**

```typescript
/** Accelerator Weekly Digest.
 *  Generates a metrics digest email and creates a pending_review deliverable.
 *  Triggered weekly by the accelerator-scheduler. */

import { task, logger } from '@trigger.dev/sdk/v3';
import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getMetricsSummary } from '@/lib/services/accelerator-metrics';
import { createDeliverable } from '@/lib/services/accelerator-program';
import { sendEmail } from '@/lib/integrations/resend';

interface DigestPayload {
  enrollmentId: string;
  config: Record<string, unknown>;
}

export const acceleratorDigest = task({
  id: 'accelerator-digest',
  maxDuration: 60,
  retry: { maxAttempts: 2 },
  run: async (payload: DigestPayload) => {
    const { enrollmentId } = payload;
    logger.info('Generating weekly digest', { enrollmentId });

    const supabase = getSupabaseAdminClient();

    // Get enrollment + user info
    const { data: enrollment } = await supabase
      .from('program_enrollments')
      .select('id, user_id')
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      logger.error('Enrollment not found', { enrollmentId });
      return { sent: false };
    }

    const { data: user } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', enrollment.user_id)
      .single();

    if (!user?.email) {
      logger.error('User email not found', { userId: enrollment.user_id });
      return { sent: false };
    }

    // Get metrics summary
    const summary = await getMetricsSummary(enrollmentId);

    // Build digest content
    const digestLines: string[] = [
      `Hi ${user.name || 'there'},`,
      '',
      'Here is your weekly GTM Accelerator metrics digest:',
      '',
    ];

    if (summary.totalMetrics === 0) {
      digestLines.push('No metrics collected yet. Complete your first module to start tracking progress.');
    } else {
      for (const mod of summary.modules) {
        digestLines.push(`**Module ${mod.module_id.toUpperCase()}**`);
        for (const m of mod.metrics) {
          const indicator = m.status === 'below' ? '⚠️' : m.status === 'above' ? '✅' : '➡️';
          digestLines.push(`  ${indicator} ${m.metric_key}: ${m.value}`);
        }
        digestLines.push('');
      }

      if (summary.belowCount > 0) {
        digestLines.push(
          `${summary.belowCount} metric(s) below benchmark. Open the accelerator to run diagnostics.`
        );
      } else {
        digestLines.push('All metrics are on track. Keep up the momentum!');
      }
    }

    const digestText = digestLines.join('\n');

    // Send email (wrap plain text in HTML for Resend)
    const digestHtml = digestText
      .split('\n')
      .map((line) => (line.trim() === '' ? '<br/>' : `<p>${line}</p>`))
      .join('\n');

    await sendEmail({
      to: user.email,
      subject: `Your Weekly GTM Digest — ${summary.belowCount > 0 ? `${summary.belowCount} items need attention` : 'All on track'}`,
      html: digestHtml,
    });

    // Create deliverable for tracking
    await createDeliverable({
      enrollment_id: enrollmentId,
      module_id: 'm6' as const,
      deliverable_type: 'metrics_digest',
      status: 'approved',
    });

    logger.info('Weekly digest sent', { enrollmentId, email: user.email, metricsCount: summary.totalMetrics });
    return { sent: true, metricsCount: summary.totalMetrics };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/trigger/accelerator-digest.ts
git commit -m "feat(accelerator): add weekly digest Trigger.dev task — email + deliverable creation"
```

---

### Task 14: Seed Diagnostic Rules + Update SOP Seed Script

**Files:**
- Create: `scripts/seed-diagnostic-rules.ts`
- Modify: `scripts/seed-sops.ts`

- [ ] **Step 1: Write the diagnostic rules seed script**

Create `scripts/seed-diagnostic-rules.ts`:

```typescript
/** Diagnostic Rules Seed Script.
 *  Seeds the diagnostic_rules table with initial rules derived from SOPs.
 *  Run: npx tsx scripts/seed-diagnostic-rules.ts */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const RULES = [
  // ─── M4: Cold Email ──────────────────────────────────
  {
    symptom: 'Low email open rate',
    module_id: 'm4',
    metric_key: 'email_open_rate',
    threshold_operator: '<',
    threshold_value: 20,
    diagnostic_questions: [
      'Are your subject lines personalized with first name + pain point?',
      'What is your daily sending volume per account?',
      'Are you sending to validated emails only?',
    ],
    common_causes: [
      { cause: 'Generic subject lines', fix: 'Use {first_name} + specific pain point in every subject line', severity: 'critical' },
      { cause: 'Sending too fast', fix: 'Reduce to 30 emails/day/account and ensure 2-week warmup', severity: 'critical' },
      { cause: 'Poor list quality', fix: 'Re-validate emails through ZeroBounce, remove catch-all', severity: 'warning' },
    ],
    priority: 10,
  },
  {
    symptom: 'High email bounce rate',
    module_id: 'm4',
    metric_key: 'email_bounce_rate',
    threshold_operator: '>',
    threshold_value: 5,
    diagnostic_questions: [
      'When was your email list last validated?',
      'Are you using catch-all emails?',
      'How old is your TAM list?',
    ],
    common_causes: [
      { cause: 'Unvalidated emails', fix: 'Run all emails through ZeroBounce or BounceBan before sending', severity: 'critical' },
      { cause: 'Stale list', fix: 'Re-enrich TAM list — email addresses decay ~30% per year', severity: 'warning' },
    ],
    priority: 5,
  },
  {
    symptom: 'Low email reply rate',
    module_id: 'm4',
    metric_key: 'email_reply_rate',
    threshold_operator: '<',
    threshold_value: 2,
    diagnostic_questions: [
      'Does your email lead with their problem, not your solution?',
      'Is your CTA a simple yes/no question?',
      'Are you following up at least 3 times?',
    ],
    common_causes: [
      { cause: 'Feature-focused copy', fix: 'Rewrite opening to lead with prospect pain point from ICP research', severity: 'critical' },
      { cause: 'Weak CTA', fix: 'End with simple binary question: "Would it be worth a 15-min call to explore?"', severity: 'warning' },
      { cause: 'No follow-ups', fix: 'Add 3-4 follow-up emails spaced 3-5 days apart', severity: 'warning' },
    ],
    priority: 15,
  },

  // ─── M3: LinkedIn DMs ────────────────────────────────
  {
    symptom: 'Low DM acceptance rate',
    module_id: 'm3',
    metric_key: 'dm_acceptance_rate',
    threshold_operator: '<',
    threshold_value: 25,
    diagnostic_questions: [
      'Is your LinkedIn profile optimized with a clear headline?',
      'Are connection requests personalized?',
      'Are you targeting people who match your ICP?',
    ],
    common_causes: [
      { cause: 'Weak profile', fix: 'Update headline to "I help [ICP] achieve [outcome]" format', severity: 'critical' },
      { cause: 'Generic connection requests', fix: 'Reference something specific — mutual connection, recent post, company news', severity: 'warning' },
      { cause: 'Wrong audience', fix: 'Review ICP definition and tighten Sales Navigator filters', severity: 'warning' },
    ],
    priority: 10,
  },
  {
    symptom: 'Low DM reply rate',
    module_id: 'm3',
    metric_key: 'dm_reply_rate',
    threshold_operator: '<',
    threshold_value: 8,
    diagnostic_questions: [
      'Are you leading with value or a pitch?',
      'How long is your first message after connection?',
      'Are you engaging with their content before DM-ing?',
    ],
    common_causes: [
      { cause: 'Pitching too soon', fix: 'First message should offer value — share a relevant insight or resource', severity: 'critical' },
      { cause: 'Messages too long', fix: 'Keep first DM under 3 sentences. Ask one question.', severity: 'warning' },
    ],
    priority: 15,
  },

  // ─── M2: TAM ─────────────────────────────────────────
  {
    symptom: 'Low TAM email coverage',
    module_id: 'm2',
    metric_key: 'tam_email_coverage',
    threshold_operator: '<',
    threshold_value: 30,
    diagnostic_questions: [
      'Did you run the full enrichment waterfall (LeadMagic → Prospeo → BlitzAPI)?',
      'Are you including catch-all emails?',
    ],
    common_causes: [
      { cause: 'Incomplete enrichment', fix: 'Run all 3 enrichment providers in waterfall order', severity: 'critical' },
      { cause: 'Filtering too aggressively', fix: 'Include catch-all emails for cold outreach (validate individually)', severity: 'info' },
    ],
    priority: 20,
  },

  // ─── M7: Content ─────────────────────────────────────
  {
    symptom: 'Low content engagement',
    module_id: 'm7',
    metric_key: 'content_avg_engagement',
    threshold_operator: '<',
    threshold_value: 2,
    diagnostic_questions: [
      'Are you posting at least 3x per week?',
      'Are your hooks stopping the scroll?',
      'Are you engaging with others\' posts before and after publishing?',
    ],
    common_causes: [
      { cause: 'Low posting frequency', fix: 'Increase to 4-5 posts/week. Use content pipeline autopilot.', severity: 'warning' },
      { cause: 'Weak hooks', fix: 'First line must create curiosity gap or state a bold claim', severity: 'critical' },
      { cause: 'No engagement strategy', fix: 'Spend 15 min engaging with ICP posts before and after publishing', severity: 'warning' },
    ],
    priority: 20,
  },

  // ─── M1: Funnel ──────────────────────────────────────
  {
    symptom: 'Low funnel opt-in rate',
    module_id: 'm1',
    metric_key: 'funnel_opt_in_rate',
    threshold_operator: '<',
    threshold_value: 15,
    diagnostic_questions: [
      'Does your lead magnet title promise a specific outcome?',
      'Is the opt-in form above the fold?',
      'Are you using social proof?',
    ],
    common_causes: [
      { cause: 'Vague value proposition', fix: 'Lead magnet title should promise specific, measurable outcome', severity: 'critical' },
      { cause: 'Too many form fields', fix: 'Reduce to email only (add name if needed for personalization)', severity: 'warning' },
    ],
    priority: 15,
  },
];

async function seedRules() {
  console.log('Seeding diagnostic rules...\n');

  for (const rule of RULES) {
    const { data: existing } = await supabase
      .from('diagnostic_rules')
      .select('id')
      .eq('symptom', rule.symptom)
      .eq('module_id', rule.module_id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('diagnostic_rules')
        .update(rule)
        .eq('id', existing.id);

      if (error) console.error(`  ERROR updating "${rule.symptom}": ${error.message}`);
      else console.log(`  Updated: ${rule.symptom}`);
    } else {
      const { error } = await supabase
        .from('diagnostic_rules')
        .insert(rule);

      if (error) console.error(`  ERROR inserting "${rule.symptom}": ${error.message}`);
      else console.log(`  Inserted: ${rule.symptom}`);
    }
  }

  console.log(`\nDone! ${RULES.length} rules processed.`);
}

seedRules().catch(console.error);
```

- [ ] **Step 2: Update seed-sops.ts for M5, M6**

Add to `MODULE_DIRS` in `scripts/seed-sops.ts`:

```typescript
  m5: 'module-5-linkedin-ads',
  m6: 'module-6-operating-system',
```

- [ ] **Step 3: Add `diagnostic_report` to DeliverableType**

In `src/lib/types/accelerator.ts`, add `'diagnostic_report'` to the `DeliverableType` union:

```typescript
export type DeliverableType =
  | 'icp_definition'
  | 'lead_magnet'
  | 'funnel'
  | 'email_sequence'
  | 'tam_list'
  | 'tam_segment'
  | 'outreach_campaign'
  | 'dm_campaign'
  | 'email_campaign'
  | 'email_infrastructure'
  | 'content_plan'
  | 'post_drafts'
  | 'metrics_digest'
  | 'diagnostic_report';
```

In `src/lib/actions/program.ts`, add `'diagnostic_report'` to the `create_deliverable` action's enum array (around line 158-172):

```typescript
      deliverable_type: {
        type: 'string',
        enum: [
          'icp_definition',
          'lead_magnet',
          'funnel',
          'email_sequence',
          'tam_list',
          'tam_segment',
          'outreach_campaign',
          'dm_campaign',
          'email_campaign',
          'email_infrastructure',
          'content_plan',
          'post_drafts',
          'metrics_digest',
          'diagnostic_report',
        ],
      },
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-diagnostic-rules.ts scripts/seed-sops.ts src/lib/types/accelerator.ts src/lib/actions/program.ts
git commit -m "feat(accelerator): add diagnostic rules seed data + M5/M6 SOP support"
```

---

## Chunk 4: Integration + Verification

### Task 15: End-to-End Typecheck, Tests, Build

**Files:** (none created — verification only)

- [ ] **Step 1: Run typecheck**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Run all accelerator + Phase 3 tests**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='(accelerator|metrics|scheduler|troubleshooter|providers|sub-agents)' --no-coverage
```

Expected: ALL PASS

- [ ] **Step 3: Run full test suite**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage 2>&1 | tail -10
```

Expected: No NEW failures (pre-existing email-sequence + PostDetailModal failures are acceptable)

- [ ] **Step 4: Production build**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm build 2>&1 | tail -20
```

Expected: Build succeeds

- [ ] **Step 5: Commit any final fixes**

If any issues found, fix and commit.
