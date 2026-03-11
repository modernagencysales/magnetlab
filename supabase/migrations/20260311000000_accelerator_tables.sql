-- GTM Accelerator: program state, progress tracking, deliverables, SOPs, usage
-- Extends the copilot system with structured program awareness.

-- ─── Enrollments ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  selected_modules TEXT[] NOT NULL,
  coaching_mode TEXT NOT NULL DEFAULT 'guide_me',
  onboarding_completed_at TIMESTAMPTZ,
  intake_data JSONB,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_enrollments_user ON program_enrollments(user_id);
CREATE INDEX idx_program_enrollments_status ON program_enrollments(user_id, status);

-- ─── Usage Events (append-only) ─────────────────────────

CREATE TABLE IF NOT EXISTS program_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_usage_events_period ON program_usage_events(enrollment_id, created_at DESC);

-- ─── Module Progress ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS program_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  current_step TEXT,
  coaching_mode_override TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, module_id)
);

CREATE INDEX idx_program_modules_enrollment ON program_modules(enrollment_id);

-- ─── Deliverables ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS program_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  deliverable_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  entity_id UUID,
  entity_type TEXT,
  validation_result JSONB,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_deliverables_enrollment_status ON program_deliverables(enrollment_id, module_id, status);

-- ─── SOP Registry ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS program_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL,
  sop_number TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  quality_bars JSONB NOT NULL DEFAULT '[]',
  deliverables JSONB NOT NULL DEFAULT '[]',
  tools_used TEXT[] DEFAULT '{}',
  dependencies TEXT[] DEFAULT '{}',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, sop_number)
);

CREATE INDEX idx_program_sops_module ON program_sops(module_id);

-- ─── RLS Policies ────────────────────────────────────────
-- All accessed via service role from copilot chat route.
-- The API route authenticates via NextAuth and filters by user_id.

ALTER TABLE program_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to program_enrollments" ON program_enrollments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users read own enrollments" ON program_enrollments FOR SELECT USING (user_id = auth.uid());

ALTER TABLE program_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to program_usage_events" ON program_usage_events FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE program_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to program_modules" ON program_modules FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE program_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to program_deliverables" ON program_deliverables FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE program_sops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to program_sops" ON program_sops FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can read SOPs" ON program_sops FOR SELECT USING (true);

-- ─── Updated-at Triggers ─────────────────────────────────

CREATE TRIGGER update_program_enrollments_updated_at
  BEFORE UPDATE ON program_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_modules_updated_at
  BEFORE UPDATE ON program_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_deliverables_updated_at
  BEFORE UPDATE ON program_deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_program_sops_updated_at
  BEFORE UPDATE ON program_sops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
