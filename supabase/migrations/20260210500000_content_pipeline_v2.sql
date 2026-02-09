-- Content Pipeline V2: Week Planner, Business Context, Viral Posts, Scrape Runs, Jobs
-- Migration: 20260210500000

-- =============================================
-- cp_week_plans
-- =============================================
CREATE TABLE IF NOT EXISTS cp_week_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  posts_per_week INTEGER NOT NULL DEFAULT 5,
  pillar_moments_pct INTEGER NOT NULL DEFAULT 25,
  pillar_teaching_pct INTEGER NOT NULL DEFAULT 25,
  pillar_human_pct INTEGER NOT NULL DEFAULT 25,
  pillar_collab_pct INTEGER NOT NULL DEFAULT 25,
  planned_posts JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_progress', 'completed')),
  generation_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

ALTER TABLE cp_week_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own week plans"
  ON cp_week_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_cp_week_plans_updated_at
  BEFORE UPDATE ON cp_week_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- cp_business_context
-- =============================================
CREATE TABLE IF NOT EXISTS cp_business_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT,
  industry TEXT,
  company_description TEXT,
  icp_title TEXT,
  icp_industry TEXT,
  icp_pain_points TEXT[] DEFAULT '{}',
  target_audience TEXT,
  content_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cp_business_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own business context"
  ON cp_business_context FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_cp_business_context_updated_at
  BEFORE UPDATE ON cp_business_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- cp_scrape_runs
-- =============================================
CREATE TABLE IF NOT EXISTS cp_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  posts_found INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cp_scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own scrape runs"
  ON cp_scrape_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- cp_viral_posts
-- =============================================
CREATE TABLE IF NOT EXISTS cp_viral_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scrape_run_id UUID REFERENCES cp_scrape_runs(id) ON DELETE SET NULL,
  author_name TEXT,
  author_headline TEXT,
  author_url TEXT,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  percentile_rank DECIMAL,
  extracted_template_id UUID REFERENCES cp_post_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cp_viral_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own viral posts"
  ON cp_viral_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- cp_content_pipeline_jobs
-- =============================================
CREATE TABLE IF NOT EXISTS cp_content_pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress_pct INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  items_completed INTEGER DEFAULT 0,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cp_content_pipeline_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pipeline jobs"
  ON cp_content_pipeline_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_cp_content_pipeline_jobs_updated_at
  BEFORE UPDATE ON cp_content_pipeline_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ALTER cp_pipeline_posts — add new columns
-- =============================================
ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES cp_post_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS style_id UUID REFERENCES cp_writing_styles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enable_automation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS automation_config JSONB;

-- Index for week plan lookups
CREATE INDEX IF NOT EXISTS idx_cp_week_plans_user_week ON cp_week_plans(user_id, week_start_date);

-- Index for scheduled post date range queries
CREATE INDEX IF NOT EXISTS idx_cp_pipeline_posts_scheduled ON cp_pipeline_posts(user_id, scheduled_time) WHERE scheduled_time IS NOT NULL;

-- Index for auto-publish queries
CREATE INDEX IF NOT EXISTS idx_cp_pipeline_posts_auto_publish ON cp_pipeline_posts(auto_publish_after, status) WHERE auto_publish_after IS NOT NULL AND status = 'approved';

-- Index for viral posts by scrape run
CREATE INDEX IF NOT EXISTS idx_cp_viral_posts_scrape_run ON cp_viral_posts(scrape_run_id);

-- Index for jobs
CREATE INDEX IF NOT EXISTS idx_cp_content_pipeline_jobs_user ON cp_content_pipeline_jobs(user_id, status);
