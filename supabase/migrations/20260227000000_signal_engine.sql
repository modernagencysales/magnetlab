-- Signal Engine: LinkedIn intent signal detection tables
-- Creates 6 tables for ICP config, monitors, leads, and events
-- Migrates data from cp_monitored_competitors → signal_profile_monitors

-- ============================================
-- 1. signal_configs — Per-tenant ICP filters
-- ============================================

CREATE TABLE IF NOT EXISTS signal_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_countries TEXT[] DEFAULT '{}',
  target_job_titles TEXT[] DEFAULT '{}',
  exclude_job_titles TEXT[] DEFAULT '{}',
  min_company_size INTEGER,
  max_company_size INTEGER,
  target_industries TEXT[] DEFAULT '{}',
  default_heyreach_campaign_id TEXT,
  enrichment_enabled BOOLEAN NOT NULL DEFAULT true,
  sentiment_scoring_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_push_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE signal_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own signal configs"
  ON signal_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to signal configs"
  ON signal_configs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 2. signal_keyword_monitors — Keyword watchlists
-- ============================================

CREATE TABLE IF NOT EXISTS signal_keyword_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  posts_found INTEGER NOT NULL DEFAULT 0,
  leads_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, keyword)
);

ALTER TABLE signal_keyword_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own keyword monitors"
  ON signal_keyword_monitors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to keyword monitors"
  ON signal_keyword_monitors FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 3. signal_company_monitors — Company page watchlists
-- ============================================

CREATE TABLE IF NOT EXISTS signal_company_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_company_url TEXT NOT NULL,
  company_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scanned_at TIMESTAMPTZ,
  heyreach_campaign_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_company_url)
);

ALTER TABLE signal_company_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own company monitors"
  ON signal_company_monitors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to company monitors"
  ON signal_company_monitors FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 4. signal_profile_monitors — Profile watchlists
--    (replaces cp_monitored_competitors)
-- ============================================

CREATE TABLE IF NOT EXISTS signal_profile_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_profile_url TEXT NOT NULL,
  name TEXT,
  headline TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  heyreach_campaign_id TEXT,
  monitor_type TEXT NOT NULL DEFAULT 'competitor'
    CHECK (monitor_type IN ('competitor', 'influencer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_profile_url)
);

ALTER TABLE signal_profile_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile monitors"
  ON signal_profile_monitors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to profile monitors"
  ON signal_profile_monitors FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 5. signal_leads — Discovered leads (deduplicated)
-- ============================================

CREATE TABLE IF NOT EXISTS signal_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_url TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  headline TEXT,
  job_title TEXT,
  company TEXT,
  country TEXT,
  profile_data JSONB,
  email TEXT,
  icp_match BOOLEAN,
  icp_score INTEGER NOT NULL DEFAULT 0,
  signal_count INTEGER NOT NULL DEFAULT 0,
  compound_score INTEGER NOT NULL DEFAULT 0,
  sentiment_score TEXT,
  content_velocity_score REAL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'enriched', 'qualified', 'pushed', 'excluded')),
  heyreach_campaign_id TEXT,
  heyreach_pushed_at TIMESTAMPTZ,
  heyreach_error TEXT,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_url)
);

ALTER TABLE signal_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own signal leads"
  ON signal_leads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to signal leads"
  ON signal_leads FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 6. signal_events — Individual signal occurrences
-- ============================================

CREATE TABLE IF NOT EXISTS signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES signal_leads(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL
    CHECK (signal_type IN (
      'keyword_engagement',
      'company_engagement',
      'profile_engagement',
      'job_change',
      'content_velocity',
      'job_posting'
    )),
  source_url TEXT,
  source_monitor_id UUID,
  comment_text TEXT,
  sentiment TEXT
    CHECK (sentiment IS NULL OR sentiment IN (
      'high_intent',
      'medium_intent',
      'low_intent',
      'question'
    )),
  keyword_matched TEXT,
  engagement_type TEXT
    CHECK (engagement_type IS NULL OR engagement_type IN (
      'comment',
      'reaction',
      'post_author'
    )),
  metadata JSONB NOT NULL DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE signal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own signal events"
  ON signal_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to signal events"
  ON signal_events FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_signal_events_user_lead
  ON signal_events(user_id, lead_id);

CREATE INDEX idx_signal_events_type
  ON signal_events(user_id, signal_type);

CREATE INDEX idx_signal_events_dedup
  ON signal_events(user_id, lead_id, signal_type, source_url);

CREATE INDEX idx_signal_leads_status
  ON signal_leads(user_id, status);

CREATE INDEX idx_signal_leads_score
  ON signal_leads(user_id, compound_score DESC);

CREATE INDEX idx_signal_leads_icp
  ON signal_leads(user_id, icp_match)
  WHERE icp_match = true;

-- ============================================
-- Data migration: cp_monitored_competitors → signal_profile_monitors
-- ============================================

INSERT INTO signal_profile_monitors (
  id, user_id, linkedin_profile_url, name, headline,
  is_active, last_scraped_at, heyreach_campaign_id,
  monitor_type, created_at, updated_at
)
SELECT
  id, user_id, linkedin_profile_url, name, headline,
  is_active, last_scraped_at, heyreach_campaign_id,
  'competitor', created_at, updated_at
FROM cp_monitored_competitors
ON CONFLICT DO NOTHING;
