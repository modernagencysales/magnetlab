-- Unipile Publishing: add provider-agnostic post tracking columns
-- Phase 1: Replace LeadShark post publishing with Unipile

-- cp_pipeline_posts: track which provider published the post
ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS linkedin_post_id TEXT,
  ADD COLUMN IF NOT EXISTS publish_provider TEXT;

-- lead_magnets: track LinkedIn post after wizard publish
ALTER TABLE lead_magnets
  ADD COLUMN IF NOT EXISTS linkedin_post_id TEXT,
  ADD COLUMN IF NOT EXISTS publish_provider TEXT;

-- cp_pipeline_posts: link back to lead_magnet when post originates from wizard
ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE SET NULL;

-- Index for FK lookups on lead_magnet_id (ON DELETE SET NULL needs this)
CREATE INDEX IF NOT EXISTS idx_cp_posts_lead_magnet
  ON cp_pipeline_posts(lead_magnet_id)
  WHERE lead_magnet_id IS NOT NULL;

-- Partial index for the cron task that finds scheduled posts ready to publish
CREATE INDEX IF NOT EXISTS idx_cp_posts_ready_publish
  ON cp_pipeline_posts(scheduled_time, status)
  WHERE status = 'scheduled' AND scheduled_time IS NOT NULL;
