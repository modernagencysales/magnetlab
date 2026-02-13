-- Engagement Scraping: track post commenters/likers, resolve LinkedIn profiles, push to HeyReach
-- Phase 3: Engagement scraping + HeyReach push

-- ============================================
-- New columns on cp_pipeline_posts
-- ============================================

ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS scrape_engagement BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS heyreach_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS last_engagement_scrape_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS engagement_scrape_count INTEGER DEFAULT 0;

-- Index for the cron task that finds posts needing scraping
CREATE INDEX IF NOT EXISTS idx_cp_posts_scrape_engagement
  ON cp_pipeline_posts(last_engagement_scrape_at, published_at)
  WHERE scrape_engagement = TRUE AND status = 'published' AND linkedin_post_id IS NOT NULL;

-- ============================================
-- cp_post_engagements: individual engagement events per post
-- ============================================

CREATE TABLE IF NOT EXISTS cp_post_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES cp_pipeline_posts(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('comment', 'reaction')),
  reaction_type TEXT,
  comment_text TEXT,
  first_name TEXT,
  last_name TEXT,
  linkedin_url TEXT,
  heyreach_campaign_id TEXT,
  heyreach_pushed_at TIMESTAMPTZ,
  heyreach_error TEXT,
  engaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dedup: one engagement per person per type per post
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_engagements_dedup
  ON cp_post_engagements(post_id, provider_id, engagement_type);

-- Find unresolved profiles to resolve
CREATE INDEX IF NOT EXISTS idx_cp_engagements_unresolved
  ON cp_post_engagements(post_id)
  WHERE linkedin_url IS NULL;

-- Find resolved but unpushed leads
CREATE INDEX IF NOT EXISTS idx_cp_engagements_unpushed
  ON cp_post_engagements(post_id)
  WHERE linkedin_url IS NOT NULL AND heyreach_pushed_at IS NULL AND heyreach_campaign_id IS NOT NULL;

-- RLS
ALTER TABLE cp_post_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own engagements"
  ON cp_post_engagements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to engagements"
  ON cp_post_engagements FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- cp_linkedin_profiles: global profile URL cache
-- ============================================

CREATE TABLE IF NOT EXISTS cp_linkedin_profiles (
  provider_id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  linkedin_url TEXT NOT NULL,
  headline TEXT,
  resolved_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS needed — this is a shared cache, only written by service role
ALTER TABLE cp_linkedin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles"
  ON cp_linkedin_profiles FOR SELECT
  USING (TRUE);

CREATE POLICY "Service role full access to profiles"
  ON cp_linkedin_profiles FOR ALL
  USING (auth.role() = 'service_role');
