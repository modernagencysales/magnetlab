-- Engagement Intelligence: competitor monitoring + Apify migration
-- Replaces Unipile monitor accounts with Apify for scraping

-- ============================================
-- New table: cp_monitored_competitors
-- ============================================

CREATE TABLE IF NOT EXISTS cp_monitored_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_profile_url TEXT NOT NULL,
  name TEXT,
  headline TEXT,
  heyreach_campaign_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_cp_competitors_user_url
  ON cp_monitored_competitors(user_id, linkedin_profile_url);

CREATE INDEX idx_cp_competitors_active
  ON cp_monitored_competitors(user_id)
  WHERE is_active = true;

ALTER TABLE cp_monitored_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own competitors"
  ON cp_monitored_competitors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to competitors"
  ON cp_monitored_competitors FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Schema changes: cp_post_engagements
-- ============================================

-- Add source tracking columns
ALTER TABLE cp_post_engagements
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'own_post',
  ADD COLUMN IF NOT EXISTS source_post_url TEXT,
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES cp_monitored_competitors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtitle TEXT;

-- Make post_id nullable (competitor engagements don't have one)
ALTER TABLE cp_post_engagements ALTER COLUMN post_id DROP NOT NULL;

-- Drop old dedup index and recreate with WHERE clause for own posts
DROP INDEX IF EXISTS idx_cp_engagements_dedup;

CREATE UNIQUE INDEX idx_cp_engagements_dedup_own
  ON cp_post_engagements(post_id, provider_id, engagement_type)
  WHERE post_id IS NOT NULL;

-- New dedup index for competitor engagements
CREATE UNIQUE INDEX idx_cp_engagements_dedup_competitor
  ON cp_post_engagements(source_post_url, provider_id, engagement_type)
  WHERE source_post_url IS NOT NULL;

-- Index for competitor engagement lookups
CREATE INDEX idx_cp_engagements_competitor
  ON cp_post_engagements(competitor_id)
  WHERE competitor_id IS NOT NULL;

-- ============================================
-- Schema changes: linkedin_automations
-- ============================================

ALTER TABLE linkedin_automations
  ADD COLUMN IF NOT EXISTS heyreach_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS resource_url TEXT;
