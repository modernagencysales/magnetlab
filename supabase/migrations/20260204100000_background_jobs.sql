-- Background Jobs Schema
-- Tables for async AI processing jobs (ideation, extraction, polish, etc.)
-- Jobs are processed by Trigger.dev and results are polled by the frontend

-- ============================================
-- BACKGROUND JOBS TABLE
-- ============================================

CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  trigger_task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================

-- Index for fetching user's jobs
CREATE INDEX idx_background_jobs_user_id ON background_jobs(user_id);

-- Composite index for filtering by user and status (common query pattern)
CREATE INDEX idx_background_jobs_user_status ON background_jobs(user_id, status);

-- Index for looking up jobs by Trigger.dev task ID (for callbacks)
CREATE INDEX idx_background_jobs_trigger_task ON background_jobs(trigger_task_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own jobs"
  ON background_jobs FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own jobs
CREATE POLICY "Users can create own jobs"
  ON background_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Service role can update jobs (for Trigger.dev callbacks)
-- Note: Service role bypasses RLS by default, but explicit policy for clarity
CREATE POLICY "Service role can update jobs"
  ON background_jobs FOR UPDATE
  USING (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_background_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER background_jobs_updated_at
  BEFORE UPDATE ON background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_background_jobs_updated_at();

-- ============================================
-- DOCUMENTATION
-- ============================================

COMMENT ON TABLE background_jobs IS 'Tracks async AI processing jobs (ideation, extraction, polish, etc.)';
COMMENT ON COLUMN background_jobs.id IS 'Unique job identifier';
COMMENT ON COLUMN background_jobs.user_id IS 'Owner of the job, references users table';
COMMENT ON COLUMN background_jobs.job_type IS 'One of: ideation, extraction, polish, posts, emails';
COMMENT ON COLUMN background_jobs.status IS 'One of: pending, processing, completed, failed';
COMMENT ON COLUMN background_jobs.input IS 'Job input parameters as JSON';
COMMENT ON COLUMN background_jobs.result IS 'Job output/result as JSON (null until completed)';
COMMENT ON COLUMN background_jobs.error IS 'Error message if job failed';
COMMENT ON COLUMN background_jobs.trigger_task_id IS 'Trigger.dev task ID for tracking/cancellation';
COMMENT ON COLUMN background_jobs.created_at IS 'When the job was created';
COMMENT ON COLUMN background_jobs.updated_at IS 'When the job was last updated';
COMMENT ON COLUMN background_jobs.started_at IS 'When job processing began';
COMMENT ON COLUMN background_jobs.completed_at IS 'When job finished (success or failure)';
