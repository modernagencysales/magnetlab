-- Feedback Loop (Post Performance Tracking) & Inspiration System
-- Adds performance tracking, pattern extraction, inspiration sources, and inspiration pulls.
-- All tables are user_id scoped with RLS policies.

-- ============================================
-- CP_POST_PERFORMANCE
-- Tracks real engagement metrics for published posts
-- ============================================
CREATE TABLE cp_post_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES cp_pipeline_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'linkedin' CHECK (platform IN ('linkedin', 'twitter', 'instagram', 'other')),

  -- Metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(7,4) DEFAULT 0, -- e.g., 4.5200 for 4.52%

  -- Timing
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_post_perf_user ON cp_post_performance(user_id);
CREATE INDEX idx_cp_post_perf_post ON cp_post_performance(post_id);
CREATE INDEX idx_cp_post_perf_platform ON cp_post_performance(user_id, platform);
CREATE INDEX idx_cp_post_perf_captured ON cp_post_performance(user_id, captured_at DESC);
-- One performance record per post per platform per capture
CREATE UNIQUE INDEX idx_cp_post_perf_unique ON cp_post_performance(post_id, platform, captured_at);

-- ============================================
-- CP_PERFORMANCE_PATTERNS
-- AI-extracted patterns of what content performs best
-- ============================================
CREATE TABLE cp_performance_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pattern classification
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('archetype', 'hook', 'format', 'topic', 'time_of_day', 'content_pillar', 'content_type', 'length')),
  pattern_value TEXT NOT NULL, -- e.g., "problem-agitate" for hook, "story" for format

  -- Aggregated stats
  avg_engagement_rate DECIMAL(7,4) DEFAULT 0,
  avg_views INTEGER DEFAULT 0,
  avg_likes INTEGER DEFAULT 0,
  avg_comments INTEGER DEFAULT 0,
  sample_count INTEGER DEFAULT 0,

  -- Confidence: low (<5 samples), medium (5-15), high (>15)
  confidence TEXT DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),

  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, pattern_type, pattern_value)
);

CREATE INDEX idx_cp_perf_patterns_user ON cp_performance_patterns(user_id);
CREATE INDEX idx_cp_perf_patterns_type ON cp_performance_patterns(user_id, pattern_type);
CREATE INDEX idx_cp_perf_patterns_confidence ON cp_performance_patterns(user_id, confidence);

-- ============================================
-- CP_INSPIRATION_SOURCES
-- User-configured sources for daily inspiration pulls
-- ============================================
CREATE TABLE cp_inspiration_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  source_type TEXT NOT NULL CHECK (source_type IN ('creator', 'search_term', 'hashtag', 'competitor')),
  source_value TEXT NOT NULL, -- LinkedIn URL, search term, hashtag, or competitor name
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),

  last_pulled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, source_type, source_value)
);

CREATE INDEX idx_cp_inspo_sources_user ON cp_inspiration_sources(user_id);
CREATE INDEX idx_cp_inspo_sources_active ON cp_inspiration_sources(user_id, is_active) WHERE is_active = TRUE;

-- ============================================
-- CP_INSPIRATION_PULLS
-- Content found from inspiration sources with AI analysis
-- ============================================
CREATE TABLE cp_inspiration_pulls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES cp_inspiration_sources(id) ON DELETE SET NULL,

  -- Content metadata
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'lead_magnet', 'funnel', 'article')),
  title TEXT,
  content_preview TEXT, -- first ~500 chars of content
  source_url TEXT,
  platform TEXT DEFAULT 'linkedin',
  author_name TEXT,
  author_url TEXT,

  -- Engagement (when available)
  engagement_metrics JSONB DEFAULT '{}', -- {views, likes, comments, shares}

  -- AI analysis
  ai_analysis JSONB DEFAULT '{}', -- {hook_type, format, topic, what_makes_it_work, suggested_adaptation}

  -- Tracking
  pulled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_to_swipe_file BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_inspo_pulls_user ON cp_inspiration_pulls(user_id);
CREATE INDEX idx_cp_inspo_pulls_source ON cp_inspiration_pulls(source_id);
CREATE INDEX idx_cp_inspo_pulls_date ON cp_inspiration_pulls(user_id, pulled_at DESC);
CREATE INDEX idx_cp_inspo_pulls_saved ON cp_inspiration_pulls(user_id, saved_to_swipe_file) WHERE saved_to_swipe_file = TRUE;
-- Dedup: same URL shouldn't be pulled twice for same user
CREATE UNIQUE INDEX idx_cp_inspo_pulls_url ON cp_inspiration_pulls(user_id, source_url) WHERE source_url IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE cp_post_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_performance_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_inspiration_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_inspiration_pulls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own performance data" ON cp_post_performance
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own performance patterns" ON cp_performance_patterns
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own inspiration sources" ON cp_inspiration_sources
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own inspiration pulls" ON cp_inspiration_pulls
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGERS (for tables with updated_at)
-- ============================================

-- cp_performance_patterns has last_updated_at instead of updated_at, handled via application code.
-- No updated_at triggers needed for the new tables (they use created_at or last_updated_at).
