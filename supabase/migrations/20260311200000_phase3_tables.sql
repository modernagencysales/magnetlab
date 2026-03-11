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
CREATE POLICY "Service role full access on metrics" ON program_metrics
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on schedules" ON program_schedules
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on rules" ON diagnostic_rules
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
