-- Templates & Inspiration Pipeline
-- Adds tracked creators, search-based scraping, pipeline scrape audit trail,
-- extends cp_post_templates with global/scraped support, extends cp_viral_posts
-- with Bright Data integration, and adds RPCs for template matching + usage tracking.
--
-- FK convention: public.users(id) — MagnetLab uses NextAuth, NOT Supabase Auth.

-- ============================================
-- 1. CP_TRACKED_CREATORS
-- LinkedIn creators tracked for periodic scraping
-- ============================================

CREATE TABLE cp_tracked_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_url TEXT UNIQUE NOT NULL,
  name TEXT,
  headline TEXT,
  avatar_url TEXT,
  avg_engagement FLOAT DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  added_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Filter active creators for scrape jobs
CREATE INDEX idx_cp_tracked_creators_active
  ON cp_tracked_creators(is_active) WHERE is_active = true;

-- Lookup by user
CREATE INDEX idx_cp_tracked_creators_user
  ON cp_tracked_creators(added_by_user_id);

ALTER TABLE cp_tracked_creators ENABLE ROW LEVEL SECURITY;

-- Anyone can browse the creator list
CREATE POLICY "Anyone can view tracked creators"
  ON cp_tracked_creators FOR SELECT
  USING (true);

-- Users can add/edit/remove their own creators
CREATE POLICY "Users can insert own tracked creators"
  ON cp_tracked_creators FOR INSERT
  WITH CHECK (added_by_user_id = auth.uid());

CREATE POLICY "Users can update own tracked creators"
  ON cp_tracked_creators FOR UPDATE
  USING (added_by_user_id = auth.uid());

CREATE POLICY "Users can delete own tracked creators"
  ON cp_tracked_creators FOR DELETE
  USING (added_by_user_id = auth.uid());

-- Service role full access (Trigger.dev tasks)
CREATE POLICY "Service role full access to tracked creators"
  ON cp_tracked_creators FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================
-- 2. CP_SCRAPE_SEARCHES
-- Admin-defined LinkedIn search queries for content discovery
-- ============================================

CREATE TABLE cp_scrape_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  description TEXT,
  post_format_filter TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cp_scrape_searches ENABLE ROW LEVEL SECURITY;

-- Anyone can browse search definitions
CREATE POLICY "Anyone can view scrape searches"
  ON cp_scrape_searches FOR SELECT
  USING (true);

-- Only service role can manage searches
CREATE POLICY "Service role full access to scrape searches"
  ON cp_scrape_searches FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================
-- 3. CP_PIPELINE_SCRAPE_RUNS
-- Audit trail for scraper/extractor jobs
-- ============================================

CREATE TABLE cp_pipeline_scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('creator', 'search', 'extraction')),
  source_id UUID,
  posts_found INTEGER DEFAULT 0,
  winners_found INTEGER DEFAULT 0,
  templates_extracted INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_log TEXT
);

ALTER TABLE cp_pipeline_scrape_runs ENABLE ROW LEVEL SECURITY;

-- Only service role can access scrape run audit trail
CREATE POLICY "Service role full access to pipeline scrape runs"
  ON cp_pipeline_scrape_runs FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================
-- 4. EXTEND CP_POST_TEMPLATES
-- Add source, is_global, scraped_post_id + updated RLS
-- ============================================

-- New columns (IF NOT EXISTS for safety)
ALTER TABLE cp_post_templates
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user_created'
    CHECK (source IN ('user_created', 'scraped'));

ALTER TABLE cp_post_templates
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cp_post_templates
  ADD COLUMN IF NOT EXISTS scraped_post_id UUID REFERENCES cp_viral_posts(id) ON DELETE SET NULL;

-- Indexes for global library queries
CREATE INDEX IF NOT EXISTS idx_cp_templates_global
  ON cp_post_templates(is_global) WHERE is_global = true;

CREATE INDEX IF NOT EXISTS idx_cp_templates_source
  ON cp_post_templates(source);

-- Update RLS: drop old single policy, replace with granular policies
DROP POLICY IF EXISTS "Users can access own templates" ON cp_post_templates;

-- SELECT: own templates OR global templates
CREATE POLICY "Users can view own or global templates"
  ON cp_post_templates FOR SELECT
  USING (user_id = auth.uid() OR is_global = true);

-- INSERT: own templates only
CREATE POLICY "Users can insert own templates"
  ON cp_post_templates FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: own templates only
CREATE POLICY "Users can update own templates"
  ON cp_post_templates FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: own templates only
CREATE POLICY "Users can delete own templates"
  ON cp_post_templates FOR DELETE
  USING (user_id = auth.uid());

-- Service role full access (Trigger.dev tasks create global/scraped templates)
CREATE POLICY "Service role full access to templates"
  ON cp_post_templates FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================
-- 5. EXTEND CP_VIRAL_POSTS
-- Add Bright Data fields, engagement scoring, creator link, winner/template flags
-- ============================================

-- New columns
ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS bright_data_id TEXT;

ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;

ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES cp_tracked_creators(id) ON DELETE SET NULL;

ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT false;

ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS template_extracted BOOLEAN DEFAULT false;

ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS source_search_id UUID REFERENCES cp_scrape_searches(id) ON DELETE SET NULL;

-- Make user_id nullable (scraped posts may not belong to any user)
ALTER TABLE cp_viral_posts ALTER COLUMN user_id DROP NOT NULL;

-- Unique partial index for Bright Data dedup (only where bright_data_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_viral_posts_bright_data_id
  ON cp_viral_posts(bright_data_id) WHERE bright_data_id IS NOT NULL;

-- Index for winner filtering
CREATE INDEX IF NOT EXISTS idx_cp_viral_posts_winner
  ON cp_viral_posts(is_winner) WHERE is_winner = true;

-- Index for creator lookup
CREATE INDEX IF NOT EXISTS idx_cp_viral_posts_creator
  ON cp_viral_posts(creator_id) WHERE creator_id IS NOT NULL;

-- Index for search source lookup
CREATE INDEX IF NOT EXISTS idx_cp_viral_posts_search
  ON cp_viral_posts(source_search_id) WHERE source_search_id IS NOT NULL;

-- Update RLS: drop old policy, add new granular policies
DROP POLICY IF EXISTS "Users can manage their own viral posts" ON cp_viral_posts;

-- SELECT: own posts OR posts with no user (scraped/global)
CREATE POLICY "Users can view own or unowned viral posts"
  ON cp_viral_posts FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- INSERT: own posts OR unowned posts
CREATE POLICY "Users can insert own or unowned viral posts"
  ON cp_viral_posts FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- UPDATE: own posts only
CREATE POLICY "Users can update own viral posts"
  ON cp_viral_posts FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: own posts only
CREATE POLICY "Users can delete own viral posts"
  ON cp_viral_posts FOR DELETE
  USING (user_id = auth.uid());

-- Service role full access (Trigger.dev tasks insert scraped posts)
CREATE POLICY "Service role full access to viral posts"
  ON cp_viral_posts FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================
-- 6. RPC: CP_MATCH_TEMPLATES
-- pgvector semantic matching for template suggestions
-- ============================================

CREATE OR REPLACE FUNCTION cp_match_templates(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 3,
  min_similarity FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT,
  description TEXT,
  structure TEXT,
  example_posts TEXT[],
  use_cases TEXT[],
  tags TEXT[],
  usage_count INTEGER,
  avg_engagement_score DECIMAL,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.category,
    t.description,
    t.structure,
    t.example_posts,
    t.use_cases,
    t.tags,
    t.usage_count,
    t.avg_engagement_score,
    t.source,
    (1 - (t.embedding <=> query_embedding))::FLOAT AS similarity
  FROM cp_post_templates t
  WHERE t.is_active = true
    AND (t.is_global = true OR t.user_id = match_user_id)
    AND t.embedding IS NOT NULL
    AND (1 - (t.embedding <=> query_embedding)) >= min_similarity
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ============================================
-- 7. RPC: CP_INCREMENT_TEMPLATE_USAGE
-- Bump usage_count on a template
-- ============================================

CREATE OR REPLACE FUNCTION cp_increment_template_usage(
  template_id UUID
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE cp_post_templates
  SET usage_count = usage_count + 1
  WHERE id = template_id;
$$;
