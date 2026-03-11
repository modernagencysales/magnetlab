-- Creative Strategy System
-- Signal-to-play pipeline for content strategy automation.
-- Shared tables (no user_id) managed by super admins.

-- ─── cs_signals ──────────────────────────────────────────────────────────────

CREATE TABLE cs_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('own_account', 'scraped', 'manual')),
  source_account_id uuid,
  linkedin_url text UNIQUE,
  author_name text NOT NULL,
  author_headline text,
  author_follower_count int,
  content text NOT NULL,
  media_type text NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'carousel', 'video', 'document', 'poll')),
  media_description text,
  media_urls jsonb DEFAULT '[]'::jsonb,
  impressions int,
  likes int NOT NULL DEFAULT 0,
  comments int NOT NULL DEFAULT 0,
  shares int,
  engagement_multiplier float,
  niche text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'used', 'dismissed')),
  ai_analysis jsonb,
  submitted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_signals_status ON cs_signals(status);
CREATE INDEX idx_cs_signals_engagement ON cs_signals(engagement_multiplier DESC NULLS LAST);
CREATE INDEX idx_cs_signals_created ON cs_signals(created_at DESC);

-- ─── cs_plays ────────────────────────────────────────────────────────────────

CREATE TABLE cs_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  thesis text NOT NULL,
  exploit_type text NOT NULL CHECK (exploit_type IN ('media_format', 'hook_pattern', 'topic_trend', 'engagement_hack', 'cta_pattern', 'composite')),
  format_instructions text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'proven', 'declining', 'archived')),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'public')),
  niches text[],
  last_used_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_plays_status ON cs_plays(status);
CREATE INDEX idx_cs_plays_visibility ON cs_plays(visibility);

-- ─── cs_play_signals (junction) ──────────────────────────────────────────────

CREATE TABLE cs_play_signals (
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES cs_signals(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (play_id, signal_id)
);

-- ─── cs_play_results ─────────────────────────────────────────────────────────

CREATE TABLE cs_play_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES cp_pipeline_posts(id) ON DELETE CASCADE,
  account_id uuid,
  is_anonymous boolean NOT NULL DEFAULT false,
  baseline_impressions int,
  actual_impressions int,
  multiplier float,
  likes int NOT NULL DEFAULT 0,
  comments int NOT NULL DEFAULT 0,
  niche text,
  tested_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_cs_play_results_post ON cs_play_results(post_id);
CREATE INDEX idx_cs_play_results_play ON cs_play_results(play_id);

-- ─── cs_play_templates ───────────────────────────────────────────────────────

CREATE TABLE cs_play_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  name text NOT NULL,
  structure jsonb NOT NULL,
  media_instructions text NOT NULL,
  example_output text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_play_templates_play ON cs_play_templates(play_id);

-- ─── cs_play_feedback ────────────────────────────────────────────────────────

CREATE TABLE cs_play_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (play_id, user_id)
);

-- ─── cs_play_assignments ─────────────────────────────────────────────────────

CREATE TABLE cs_play_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_play_assignments_user ON cs_play_assignments(user_id, status);

-- ─── cs_scrape_config ────────────────────────────────────────────────────────

CREATE TABLE cs_scrape_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type text NOT NULL CHECK (config_type IN ('own_account', 'watchlist', 'niche_discovery')),
  outlier_threshold_multiplier float NOT NULL DEFAULT 5.0,
  min_reactions int NOT NULL DEFAULT 500,
  min_comments int NOT NULL DEFAULT 50,
  target_niches text[] DEFAULT '{}',
  search_keywords text[] DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  UNIQUE (config_type)
);

-- Insert default configs
INSERT INTO cs_scrape_config (config_type, outlier_threshold_multiplier, min_reactions, min_comments)
VALUES
  ('own_account', 5.0, 0, 0),
  ('watchlist', 0, 500, 50),
  ('niche_discovery', 0, 500, 50);

-- ─── ALTER existing tables ───────────────────────────────────────────────────

-- Add play_id to pipeline posts
ALTER TABLE cp_pipeline_posts ADD COLUMN play_id uuid REFERENCES cs_plays(id);

-- Add data sharing opt-in to users
ALTER TABLE users ADD COLUMN plays_data_sharing boolean NOT NULL DEFAULT false;

-- Expand signal_profile_monitors monitor_type
ALTER TABLE signal_profile_monitors
  DROP CONSTRAINT IF EXISTS signal_profile_monitors_monitor_type_check;
ALTER TABLE signal_profile_monitors
  ADD CONSTRAINT signal_profile_monitors_monitor_type_check
  CHECK (monitor_type IN ('competitor', 'influencer', 'content_strategy'));

-- ─── RLS policies ────────────────────────────────────────────────────────────

ALTER TABLE cs_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_scrape_config ENABLE ROW LEVEL SECURITY;

-- Super admin write access (all cs_ tables)
CREATE POLICY cs_signals_admin_all ON cs_signals
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_plays_admin_all ON cs_plays
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_signals_admin_all ON cs_play_signals
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_results_admin_all ON cs_play_results
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_templates_admin_all ON cs_play_templates
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_feedback_admin_all ON cs_play_feedback
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_assignments_admin_all ON cs_play_assignments
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_scrape_config_admin_all ON cs_scrape_config
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

-- Public read: signals with reviewed/used status
CREATE POLICY cs_signals_public_read ON cs_signals
  FOR SELECT USING (status IN ('reviewed', 'used'));

-- Public read: proven/declining public plays for opted-in users
CREATE POLICY cs_plays_public_read ON cs_plays
  FOR SELECT USING (
    visibility = 'public'
    AND status IN ('proven', 'declining')
    AND auth.uid() IN (SELECT id FROM users WHERE plays_data_sharing = true)
  );

-- Public read: templates for visible plays
CREATE POLICY cs_play_templates_public_read ON cs_play_templates
  FOR SELECT USING (
    play_id IN (
      SELECT id FROM cs_plays
      WHERE visibility = 'public' AND status IN ('proven', 'declining')
    )
    AND auth.uid() IN (SELECT id FROM users WHERE plays_data_sharing = true)
  );

-- Public read: play results (aggregated, no PII)
CREATE POLICY cs_play_results_public_read ON cs_play_results
  FOR SELECT USING (
    play_id IN (
      SELECT id FROM cs_plays
      WHERE visibility = 'public' AND status IN ('proven', 'declining')
    )
    AND auth.uid() IN (SELECT id FROM users WHERE plays_data_sharing = true)
  );

-- Public read: play signals for visible plays
CREATE POLICY cs_play_signals_public_read ON cs_play_signals
  FOR SELECT USING (
    play_id IN (
      SELECT id FROM cs_plays
      WHERE visibility = 'public' AND status IN ('proven', 'declining')
    )
    AND auth.uid() IN (SELECT id FROM users WHERE plays_data_sharing = true)
  );

-- Users can read their own assignments
CREATE POLICY cs_play_assignments_user_read ON cs_play_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert/update their own feedback
CREATE POLICY cs_play_feedback_user_write ON cs_play_feedback
  FOR ALL USING (user_id = auth.uid());
